import { expect, test } from '@playwright/test';
import {
  ENV,
  MESH_DOWNLOAD_DLQ_NAME,
  MESH_DOWNLOAD_LAMBDA_LOG_GROUP_NAME,
  MESH_POLL_LAMBDA_NAME,
  NON_PII_S3_BUCKET_NAME,
  PII_S3_BUCKET_NAME,
} from 'constants/backend-constants';
import { getLogsFromCloudwatch } from 'helpers/cloudwatch-helpers';
import eventPublisher from 'helpers/event-bus-helpers';
import expectToPassEventually from 'helpers/expectations';
import { invokeLambda } from 'helpers/lambda-helpers';
import { downloadFromS3, uploadToS3 } from 'helpers/s3-helpers';
import { expectMessageContainingString, purgeQueue } from 'helpers/sqs-helpers';
import { v4 as uuidv4 } from 'uuid';
import { SENDER_ID_SKIPS_NOTIFY } from 'constants/tests-constants';
import { validateMESHInboxMessageReceived } from 'digital-letters-events';

const validPdmRequest = {
  resourceType: 'DocumentReference',
  id: '82bfb7f3-4889-4e15-b308-bbe4e3cd431f',
  status: 'current',
  docStatus: 'final',
  type: {
    coding: [
      {
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        system: 'http://snomed.info/sct',
        code: '308540004',
        display: 'Appointment',
      },
    ],
  },
  subject: {
    identifier: {
      system: 'https://fhir.nhs.uk/Id/nhs-number',
      value: '9876543210',
    },
  },
  author: [
    {
      identifier: {
        system: 'https://fhir.nhs.uk/Id/ods-organization-code',
        value: 'RX809',
      },
      display: 'Example NHS Trust',
    },
  ],
  custodian: {
    identifier: {
      system: 'https://fhir.nhs.uk/Id/ods-organization-code',
      value: 'C4L8E',
    },
    display: 'NHS ENGLAND: NHS NOTIFY',
  },
  date: '2025-11-19T14:30:00Z',
  description: 'Appointment notification letter for outpatient consultation',
  content: [
    {
      attachment: {
        contentType: 'application/pdf',
        title: 'Appointment Letter - November 2025',
        data: 'base64here==',
      },
    },
  ],
};

test.describe('Digital Letters - MESH Poll and Download', () => {
  const senderId = SENDER_ID_SKIPS_NOTIFY;
  const sendersMeshMailboxId = 'test-mesh-sender-1';
  const meshMailboxId = 'mock-mailbox';

  test.beforeAll(async () => {
    await purgeQueue(MESH_DOWNLOAD_DLQ_NAME);
  });

  async function uploadMeshMessage(
    meshMessageId: string,
    messageReference: string,
    messageContent: string,
    metadata: Record<string, string> = {},
  ): Promise<void> {
    const key = `mock-mesh/${meshMailboxId}/in/${meshMessageId}`;
    const meshMetadata = {
      sender: sendersMeshMailboxId,
      subject: '201',
      workflow_id: 'NHS_NOTIFY_SEND_REQUEST',
      local_id: messageReference,
      ...metadata,
    };

    await uploadToS3(messageContent, NON_PII_S3_BUCKET_NAME, key, meshMetadata);
  }

  async function expectMeshInboxMessageReceivedEvent(
    meshMessageId: string,
  ): Promise<void> {
    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.mesh.inbox.message.received.v1"',
          `$.details.event_detail = "*\\"meshMessageId\\":\\"${meshMessageId}\\"*"`,
          `$.details.event_detail = "*\\"senderId\\":\\"${senderId}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toBeGreaterThanOrEqual(1);
    }, 120_000);
  }

  async function expectMeshInboxMessageDownloadedEvent(
    messageReference: string,
  ): Promise<void> {
    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"',
          `$.details.event_detail = "*\\"messageReference\\":\\"${messageReference}\\"*"`,
          `$.details.event_detail = "*\\"senderId\\":\\"${senderId}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toBeGreaterThanOrEqual(1);
    }, 180_000);
  }

  async function expectMeshInboxMessageInvalidEvent(
    meshMessageId: string,
    messageReference: string,
    failureCode: string,
  ): Promise<void> {
    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.mesh.inbox.message.invalid.v1"',
          `$.details.event_detail = "*\\"messageReference\\":\\"${messageReference}\\"*"`,
          `$.details.event_detail = "*\\"senderId\\":\\"${senderId}\\"*"`,
          `$.details.event_detail = "*\\"meshMessageId\\":\\"${meshMessageId}\\"*"`,
          `$.details.event_detail = "*\\"failureCode\\":\\"${failureCode}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toBeGreaterThanOrEqual(1);
    }, 180_000);
  }

  test('should poll message from MESH inbox, publish received event, download message, and publish downloaded event', async () => {
    const meshMessageId = `${Date.now()}_TEST_${uuidv4().slice(0, 8)}`;
    const messageReference = uuidv4();
    const messageContent = JSON.stringify(validPdmRequest);

    await uploadMeshMessage(meshMessageId, messageReference, messageContent);

    await invokeLambda(MESH_POLL_LAMBDA_NAME);

    await expectMeshInboxMessageReceivedEvent(meshMessageId);
    await expectMeshInboxMessageDownloadedEvent(messageReference);

    await expectToPassEventually(async () => {
      const storedMessage = await downloadFromS3(
        PII_S3_BUCKET_NAME,
        `document-reference/${senderId}/${messageReference}`,
      );

      expect(storedMessage.body).toContain(messageContent);
      expect(storedMessage.metadata?.mesh_message_id).toBe(meshMessageId);
    }, 60_000);

    await expectToPassEventually(async () => {
      await expect(async () => {
        await downloadFromS3(
          NON_PII_S3_BUCKET_NAME,
          `mock-mesh/${meshMailboxId}/in/${meshMessageId}`,
        );
      }).rejects.toThrow('No objects found');
    }, 60_000);
  });

  test('given invalid PDM request should publish invalid event, log an error, acknowledge message', async () => {
    const meshMessageId = `${Date.now()}_TEST_${uuidv4().slice(0, 8)}`;
    const messageReference = uuidv4();
    const invalidPdmRequest = { ...validPdmRequest, id: undefined };

    const messageContent = JSON.stringify(invalidPdmRequest);

    await uploadMeshMessage(meshMessageId, messageReference, messageContent);

    await invokeLambda(MESH_POLL_LAMBDA_NAME);

    await expectMeshInboxMessageReceivedEvent(meshMessageId);
    await expectMeshInboxMessageInvalidEvent(
      meshMessageId,
      messageReference,
      'DL_CLIV_005',
    );

    await expectToPassEventually(async () => {
      const filteredLogs = await getLogsFromCloudwatch(
        MESH_DOWNLOAD_LAMBDA_LOG_GROUP_NAME,
        [
          '$.event  = "FHIR content is invalid"',
          `$.mesh_message_id = "${meshMessageId}"`,
          '$.error = "\'id\' is a required property*"',
        ],
      );

      expect(filteredLogs.length).toEqual(1);
    }, 120);

    await expectToPassEventually(async () => {
      await expect(async () => {
        await downloadFromS3(
          NON_PII_S3_BUCKET_NAME,
          `mock-mesh/${meshMailboxId}/in/${meshMessageId}`,
        );
      }).rejects.toThrow('No objects found');
    }, 60_000);
  });

  test('should send message to mesh-download DLQ when download fails', async () => {
    test.setTimeout(220_000);

    const invalidMeshMessageId = `${Date.now()}_DLQ_${uuidv4().slice(0, 8)}`;
    const messageReference = uuidv4();

    await eventPublisher.sendEvents(
      [
        {
          id: uuidv4(),
          specversion: '1.0',
          plane: 'data',
          dataschemaversion: '1.0.0',
          datacontenttype: 'application/json',
          source: '/nhs/england/notify/development/primary/digitalletters/mesh',
          subject:
            'customer/00000000-0000-0000-0000-000000000000/recipient/00000000-0000-0000-0000-000000000000',
          type: 'uk.nhs.notify.digital.letters.mesh.inbox.message.received.v1',
          time: '2026-01-20T15:48:21.636284+00:00',
          recordedtime: '2026-01-20T15:48:21.636284+00:00',
          severitynumber: 2,
          severitytext: 'INFO',
          traceparent:
            '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
          dataschema:
            'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-mesh-inbox-message-received-data.schema.json',
          data: {
            meshMessageId: invalidMeshMessageId,
            senderId,
            messageReference,
          },
        },
      ],
      validateMESHInboxMessageReceived,
    );

    await expectMessageContainingString(
      MESH_DOWNLOAD_DLQ_NAME,
      invalidMeshMessageId,
      200,
    );
  });

  test('should handle multiple messages in inbox', async () => {
    test.setTimeout(300_000);

    const messages = Array.from({ length: 3 }, (_, i) => ({
      meshMessageId: `${Date.now()}_MULTI_${i}_${uuidv4().slice(0, 8)}`,
      messageReference: uuidv4(),
      messageContent: JSON.stringify({
        senderId,
        messageReference: uuidv4(),
        testData: `Test message ${i}`,
      }),
    }));

    for (const msg of messages) {
      await uploadMeshMessage(
        msg.meshMessageId,
        msg.messageReference,
        msg.messageContent,
      );
    }

    await invokeLambda(MESH_POLL_LAMBDA_NAME);

    for (const msg of messages) {
      await expectMeshInboxMessageReceivedEvent(msg.meshMessageId);
    }
  });

  test('should publish MESHInboxMessageInvalid event when local_id is missing', async () => {
    const meshMessageId = `${Date.now()}_INVALID_${uuidv4().slice(0, 8)}`;
    const messageContent = JSON.stringify({
      senderId,
      testData: 'This message has no local_id',
      timestamp: new Date().toISOString(),
    });

    await uploadMeshMessage(meshMessageId, '', messageContent, {
      local_id: '',
    });

    await invokeLambda(MESH_POLL_LAMBDA_NAME);

    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.mesh.inbox.message.invalid.v1"',
          String.raw`$.details.event_detail = "*\"meshMessageId\":\"${meshMessageId}\"*"`,
          String.raw`$.details.event_detail = "*\"senderId\":\"${senderId}\"*"`,
          String.raw`$.details.event_detail = "*\"failureCode\":\"DL_CLIV_006\"*"`,
        ],
      );

      expect(eventLogEntry.length).toBeGreaterThanOrEqual(1);
    }, 120_000);

    await expectToPassEventually(async () => {
      await expect(async () => {
        await downloadFromS3(
          NON_PII_S3_BUCKET_NAME,
          `mock-mesh/${meshMailboxId}/in/${meshMessageId}`,
        );
      }).rejects.toThrow('No objects found');
    }, 60_000);

    await expectToPassEventually(async () => {
      const receivedEvents = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.mesh.inbox.message.received.v1"',
          `$.details.event_detail = "*\\"meshMessageId\\":\\"${meshMessageId}\\"*"`,
        ],
      );
      expect(receivedEvents.length).toBe(0);
    }, 15_000);
  });

  test('should skip publishing downloaded event and acknowledge message when internal retry detected', async () => {
    test.setTimeout(200_000);

    const meshMessageId = `${Date.now()}_DUPLICATE_${uuidv4().slice(0, 8)}`;
    const messageReference = uuidv4();
    const messageContent = JSON.stringify(validPdmRequest);

    await uploadMeshMessage(meshMessageId, messageReference, messageContent);

    // Pre-upload the document to S3 with the SAME meshMessageId in metadata to simulate internal retry
    const documentKey = `document-reference/${senderId}/${messageReference}`;
    await uploadToS3('pre-existing content', PII_S3_BUCKET_NAME, documentKey, {
      mesh_message_id: meshMessageId,
    });

    // Publish the MESHInboxMessageReceived event directly, skipping the poll lambda
    await eventPublisher.sendEvents(
      [
        {
          id: uuidv4(),
          specversion: '1.0',
          source: '/nhs/england/notify/development/primary/digitalletters/mesh',
          subject:
            'customer/00000000-0000-0000-0000-000000000000/recipient/00000000-0000-0000-0000-000000000000',
          type: 'uk.nhs.notify.digital.letters.mesh.inbox.message.received.v1',
          time: new Date().toISOString(),
          recordedtime: new Date().toISOString(),
          severitynumber: 2,
          severitytext: 'INFO',
          traceparent:
            '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
          dataschema:
            'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-mesh-inbox-message-received-data.schema.json',
          dataschemaversion: '1.0.0',
          datacontenttype: 'application/json',
          plane: 'data',
          data: {
            meshMessageId,
            senderId,
            messageReference,
          },
        },
      ],
      validateMESHInboxMessageReceived,
    );

    await expectToPassEventually(async () => {
      const warnLogEntry = await getLogsFromCloudwatch(
        MESH_DOWNLOAD_LAMBDA_LOG_GROUP_NAME,
        [
          '$.event = "Internal retry detected. Message already stored with same meshMessageId, skipping"',
          `$.mesh_message_id = "${meshMessageId}"`,
        ],
      );
      expect(warnLogEntry.length).toBeGreaterThanOrEqual(1);
    }, 120_000);

    // Assert that no MESHInboxMessageDownloaded event was published
    await expectToPassEventually(async () => {
      const downloadedEvents = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"',
          `$.details.event_detail = "*\\"messageReference\\":\\"${messageReference}\\"*"`,
        ],
      );
      expect(downloadedEvents.length).toBe(0);
    }, 15_000);

    // Assert the MESH message was still acknowledged (deleted from mock inbox)
    await expectToPassEventually(async () => {
      await expect(async () => {
        await downloadFromS3(
          NON_PII_S3_BUCKET_NAME,
          `mock-mesh/${meshMailboxId}/in/${meshMessageId}`,
        );
      }).rejects.toThrow('No objects found');
    }, 60_000);
  });

  test('should publish MESHInboxMessageInvalid with DL_CLIV_004 and acknowledge when trust duplicate detected', async () => {
    test.setTimeout(200_000);

    const originalMeshMessageId = `${Date.now()}_ORIG_${uuidv4().slice(0, 8)}`;
    const duplicateMeshMessageId = `${Date.now()}_DUP_${uuidv4().slice(0, 8)}`;
    const messageReference = uuidv4();
    const messageContent = JSON.stringify(validPdmRequest);

    await uploadMeshMessage(
      duplicateMeshMessageId,
      messageReference,
      messageContent,
    );

    // Pre-upload the document to S3 with a DIFFERENT meshMessageId in metadata to simulate trust duplicate
    const documentKey = `document-reference/${senderId}/${messageReference}`;
    await uploadToS3('pre-existing content', PII_S3_BUCKET_NAME, documentKey, {
      mesh_message_id: originalMeshMessageId,
    });

    // Publish the MESHInboxMessageReceived event directly, skipping the poll lambda
    await eventPublisher.sendEvents(
      [
        {
          id: uuidv4(),
          specversion: '1.0',
          source: '/nhs/england/notify/development/primary/digitalletters/mesh',
          subject:
            'customer/00000000-0000-0000-0000-000000000000/recipient/00000000-0000-0000-0000-000000000000',
          type: 'uk.nhs.notify.digital.letters.mesh.inbox.message.received.v1',
          time: new Date().toISOString(),
          recordedtime: new Date().toISOString(),
          severitynumber: 2,
          severitytext: 'INFO',
          traceparent:
            '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
          dataschema:
            'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-mesh-inbox-message-received-data.schema.json',
          dataschemaversion: '1.0.0',
          datacontenttype: 'application/json',
          plane: 'data',
          data: {
            meshMessageId: duplicateMeshMessageId,
            senderId,
            messageReference,
          },
        },
      ],
      validateMESHInboxMessageReceived,
    );

    // Assert MESHInboxMessageInvalid event with DL_CLIV_004 was published
    await expectMeshInboxMessageInvalidEvent(
      duplicateMeshMessageId,
      messageReference,
      'DL_CLIV_004',
    );

    // Assert the MESH message was acknowledged (deleted from mock inbox)
    await expectToPassEventually(async () => {
      await expect(async () => {
        await downloadFromS3(
          NON_PII_S3_BUCKET_NAME,
          `mock-mesh/${meshMailboxId}/in/${duplicateMeshMessageId}`,
        );
      }).rejects.toThrow('No objects found');
    }, 60_000);
  });
});
