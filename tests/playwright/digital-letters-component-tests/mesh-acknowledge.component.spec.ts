import { expect, test } from '@playwright/test';
import {
  ENV,
  MESH_ACKNOWLEDGE_DLQ_NAME,
  NON_PII_S3_BUCKET_NAME,
} from 'constants/backend-constants';
import { SENDER_ID_SKIPS_NOTIFY } from 'constants/tests-constants';
import {
  MESHInboxMessageDownloaded,
  MESHInboxMessageInvalid,
  validateMESHInboxMessageDownloaded,
  validateMESHInboxMessageInvalid,
} from 'digital-letters-events';
import { getLogsFromCloudwatch } from 'helpers/cloudwatch-helpers';
import eventPublisher from 'helpers/event-bus-helpers';
import expectToPassEventually from 'helpers/expectations';
import { downloadFromS3 } from 'helpers/s3-helpers';
import { expectMessageContainingString } from 'helpers/sqs-helpers';
import { v4 as uuidv4 } from 'uuid';

test.describe('Digital Letters - Mesh Acknowledger', () => {
  // These values match the ones configured in senders.setup.ts
  const senderId = SENDER_ID_SKIPS_NOTIFY;
  const sendersMeshMailboxId = 'test-mesh-sender-1';

  const validMessageDownloadedEvent: MESHInboxMessageDownloaded = {
    id: uuidv4(),
    specversion: '1.0',
    plane: 'data',
    dataschemaversion: '1.0.0',
    source: '/nhs/england/notify/production/primary/digitalletters/mesh',
    subject:
      'customer/920fca11-596a-4eca-9c47-99f624614658/recipient/769acdd4-6a47-496f-999f-76a6fd2c3959',
    type: 'uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1',
    time: '2023-06-20T12:00:00Z',
    recordedtime: '2023-06-20T12:00:00.250Z',
    severitynumber: 2,
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    datacontenttype: 'application/json',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-mesh-inbox-message-downloaded-data.schema.json',
    severitytext: 'INFO',
    datacategory: 'non-sensitive',
    dataclassification: 'public',
    dataregulation: 'GDPR',
    tracestate: 'rojo=00f067aa0ba902b7,congo=t61rcWkgMzE',
    partitionkey: 'customer-920fca11',
    sampledrate: 5,
    sequence: '00000000000000000042',
    data: {
      meshMessageId: '12345',
      messageUri: `https://example.com/ttl/resource/${uuidv4()}`,
      messageReference: 'ref1',
      senderId,
    },
  };

  test('should send MESH acknowledgement and publish message acknowledged event following message downloaded event', async () => {
    const letterId = uuidv4();
    const messageReference = uuidv4();
    const meshMessageId = '20200601122152994285_D59900';

    await eventPublisher.sendEvents<MESHInboxMessageDownloaded>(
      [
        {
          ...validMessageDownloadedEvent,
          id: letterId,
          data: {
            ...validMessageDownloadedEvent.data,
            messageUri: `https://example.com/ttl/resource/${letterId}`,
            messageReference,
            meshMessageId,
          },
        },
      ],
      validateMESHInboxMessageDownloaded,
    );

    // The mailbox ID matches the Mock MESH config in SSM.
    const meshMailboxId = 'mock-mailbox';

    // Verify message acknowledged event was published,
    // and extract sentMeshMessageId to use for the S3 lookup.
    let sentMeshMessageId: string;
    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.mesh.inbox.message.acknowledged.v1"',
          `$.details.event_detail = "*\\"messageReference\\":\\"${messageReference}\\"*"`,
          `$.details.event_detail = "*\\"senderId\\":\\"${senderId}\\"*"`,
          `$.details.event_detail = "*\\"meshMailboxId\\":\\"${sendersMeshMailboxId}\\"*"`,
          `$.details.event_detail = "*\\"receivedMeshMessageId\\":\\"${meshMessageId}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toEqual(1);

      const eventDetail = JSON.parse(
        (eventLogEntry[0] as any).details.event_detail,
      );
      sentMeshMessageId = eventDetail.data.sentMeshMessageId;
      expect(sentMeshMessageId).toBeTruthy();
    });

    // Verify MESH acknowledgement message was sent.
    await expectToPassEventually(async () => {
      const messageContent = await downloadFromS3(
        NON_PII_S3_BUCKET_NAME,
        `mock-mesh/${meshMailboxId}/out/${sendersMeshMailboxId}/${sentMeshMessageId}`,
      );

      const messageHeaders = messageContent.metadata ?? {};
      expect(messageHeaders.subject).toEqual('202');
      expect(messageHeaders.local_id).toEqual(messageReference);
      expect(messageHeaders.workflow_id).toEqual('NHS_NOTIFY_FHIR_ACK');

      const messageBody = JSON.parse(messageContent.body);
      expect(messageBody).toEqual({
        meshMessageId,
        requestId: `${senderId}_${messageReference}`,
      });
    });
  });

  test('should send an event for an unknown sender to dlq', async () => {
    test.setTimeout(120_000);

    const letterId = uuidv4();

    await eventPublisher.sendEvents<MESHInboxMessageDownloaded>(
      [
        {
          ...validMessageDownloadedEvent,
          id: letterId,
          data: {
            ...validMessageDownloadedEvent.data,
            senderId: 'unknown-sender-id',
          },
        },
      ],
      validateMESHInboxMessageDownloaded,
    );

    await expectMessageContainingString(
      MESH_ACKNOWLEDGE_DLQ_NAME,
      letterId,
      100,
    );
  });

  test('should send invalid event to dlq', async () => {
    test.setTimeout(160_000);

    const letterId = uuidv4();

    await eventPublisher.sendEvents<
      MESHInboxMessageDownloaded & { data: { unexpectedField: string } }
    >(
      [
        {
          ...validMessageDownloadedEvent,
          id: letterId,
          data: {
            ...validMessageDownloadedEvent.data,
            unexpectedField: 'I should not be here',
          },
        },
      ],
      // We don't actually want to validate this event on the way out, as we intend it to be invalid.
      () => true,
    );

    await expectMessageContainingString(
      MESH_ACKNOWLEDGE_DLQ_NAME,
      letterId,
      150,
    );
  });

  test('should send MESH negative acknowledgement and publish message acknowledged event following message invalid event', async () => {
    test.setTimeout(160_000);

    const letterId = uuidv4();
    const meshMessageId = `${Date.now()}_TEST_${uuidv4().slice(0, 8)}`;
    const failureCode = 'DL_CLIV_005';

    const validMessageInvalidEvent: MESHInboxMessageInvalid = {
      ...validMessageDownloadedEvent,
      id: letterId,
      type: 'uk.nhs.notify.digital.letters.mesh.inbox.message.invalid.v1',
      dataschema:
        'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-mesh-inbox-message-invalid-data.schema.json',
      data: {
        meshMessageId,
        senderId,
        failureCode,
      },
    };

    await eventPublisher.sendEvents<MESHInboxMessageInvalid>(
      [validMessageInvalidEvent],
      validateMESHInboxMessageInvalid,
    );

    const meshMailboxId = 'mock-mailbox';

    // Verify message acknowledged event was published with statusCode 400,
    // and extract sentMeshMessageId to use for the S3 lookup.
    let sentMeshMessageId: string;
    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.mesh.inbox.message.acknowledged.v1"',
          `$.details.event_detail = "*\\"senderId\\":\\"${senderId}\\"*"`,
          `$.details.event_detail = "*\\"meshMailboxId\\":\\"${sendersMeshMailboxId}\\"*"`,
          `$.details.event_detail = "*\\"statusCode\\":400*"`,
          `$.details.event_detail = "*\\"failureCode\\":\\"${failureCode}\\"*"`,
          `$.details.event_detail = "*\\"receivedMeshMessageId\\":\\"${meshMessageId}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toEqual(1);

      const eventDetail = JSON.parse(
        (eventLogEntry[0] as any).details.event_detail,
      );
      sentMeshMessageId = eventDetail.data.sentMeshMessageId;
      expect(sentMeshMessageId).toBeTruthy();
    }, 120_000);

    // Verify MESH negative acknowledgement message was sent.
    await expectToPassEventually(async () => {
      const messageContent = await downloadFromS3(
        NON_PII_S3_BUCKET_NAME,
        `mock-mesh/${meshMailboxId}/out/${sendersMeshMailboxId}/${sentMeshMessageId}`,
      );

      const messageHeaders = messageContent.metadata ?? {};
      expect(messageHeaders.subject).toEqual('400');
      expect(messageHeaders.local_id).toBeUndefined();
      expect(messageHeaders.workflow_id).toEqual('NHS_NOTIFY_FHIR_ACK');

      const messageBody = JSON.parse(messageContent.body);
      expect(messageBody.meshMessageId).toEqual(meshMessageId);
      expect(messageBody.failureCode).toEqual(failureCode);
      expect(messageBody.requestId).toEqual(`${senderId}_`);
    }, 30);
  });
});
