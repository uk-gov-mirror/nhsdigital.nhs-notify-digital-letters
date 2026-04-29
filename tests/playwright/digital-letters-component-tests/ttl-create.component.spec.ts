import { expect, test } from '@playwright/test';
import {
  CREATE_TTL_DLQ_NAME,
  CREATE_TTL_LAMBDA_LOG_GROUP_NAME,
  ENV,
} from 'constants/backend-constants';
import {
  SENDER_ID_SKIPS_NOTIFY,
  SENDER_ID_VALID_FOR_NOTIFY_SANDBOX,
} from 'constants/tests-constants';
import {
  MESHInboxMessageDownloaded,
  validateMESHInboxMessageDownloaded,
} from 'digital-letters-events';
import { getLogsFromCloudwatch } from 'helpers/cloudwatch-helpers';
import { getTtl } from 'helpers/dynamodb-helpers';
import eventPublisher from 'helpers/event-bus-helpers';
import expectToPassEventually from 'helpers/expectations';
import { expectMessageContainingString, purgeQueue } from 'helpers/sqs-helpers';
import { v4 as uuidv4 } from 'uuid';

test.describe('Digital Letters - Create TTL', () => {
  test.beforeAll(async () => {
    await purgeQueue(CREATE_TTL_DLQ_NAME);
  });

  const baseEvent: MESHInboxMessageDownloaded = {
    id: 'id',
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
    data: {
      meshMessageId: '12345',
      messageUri: 'uri',
      messageReference: 'ref1',
      senderId: SENDER_ID_VALID_FOR_NOTIFY_SANDBOX,
    },
  };

  test('should create TTL and publish item enqueued event following message downloaded event', async () => {
    test.setTimeout(200_000);

    const letterId = uuidv4();
    const messageUri = `https://example.com/ttl/resource/${letterId}`;
    const messageReference = letterId;

    await eventPublisher.sendEvents<MESHInboxMessageDownloaded>(
      [
        {
          ...baseEvent,
          id: letterId,
          data: {
            ...baseEvent.data,
            messageUri,
            messageReference,
          },
        },
      ],
      validateMESHInboxMessageDownloaded,
    );

    // Verify TTL created
    await expectToPassEventually(async () => {
      const ttl = await getTtl(
        SENDER_ID_VALID_FOR_NOTIFY_SANDBOX,
        messageReference,
      );

      expect(ttl.length).toBe(1);
    }, 90);

    // Verify item enqueued event published
    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.queue.item.enqueued.v1"',
          `$.details.event_detail = "*\\"messageUri\\":\\"${messageUri}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toEqual(1);
    }, 90);
  });

  test('should create TTL and publish item enqueued event following message downloaded event - direct to print', async () => {
    test.setTimeout(200_000);

    const letterId = uuidv4();
    const messageUri = `https://example.com/ttl/resource/${letterId}`;
    const messageReference = letterId;

    await eventPublisher.sendEvents<MESHInboxMessageDownloaded>(
      [
        {
          ...baseEvent,
          id: letterId,
          data: {
            ...baseEvent.data,
            messageUri,
            messageReference,
            senderId: SENDER_ID_SKIPS_NOTIFY,
          },
        },
      ],
      validateMESHInboxMessageDownloaded,
    );

    // Verify TTL created
    await expectToPassEventually(async () => {
      const ttl = await getTtl(SENDER_ID_SKIPS_NOTIFY, messageReference);

      expect(ttl.length).toBe(1);
    }, 90);

    // Verify item enqueued event published
    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.queue.item.enqueued.v1"',
          `$.details.event_detail = "*\\"messageUri\\":\\"${messageUri}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toEqual(1);
    }, 90);
  });

  test('should send invalid event to dlq', async () => {
    test.setTimeout(220_000);

    const letterId = uuidv4();
    const messageUri = `https://example.com/ttl/resource/${letterId}`;
    const unexpectedField = uuidv4();

    await eventPublisher.sendEvents<MESHInboxMessageDownloaded>(
      [
        {
          ...baseEvent,
          id: letterId,
          data: {
            ...baseEvent.data,
            messageUri,
            [unexpectedField]: 'I should not be here',
          },
        } as MESHInboxMessageDownloaded,
      ],
      () => true,
    );

    await Promise.all([
      expectToPassEventually(async () => {
        const eventLogEntry = await getLogsFromCloudwatch(
          CREATE_TTL_LAMBDA_LOG_GROUP_NAME,
          [
            '$.message.description = "Error parsing MESHInboxMessageDownloaded event"',
            `$.message.err[0].params.additionalProperty = "${unexpectedField}"`,
          ],
        );

        expect(eventLogEntry.length).toEqual(1);
      }, 200),

      expectMessageContainingString(CREATE_TTL_DLQ_NAME, letterId, 200),
    ]);
  });

  test('should send events from unknown sender to dlq', async () => {
    test.setTimeout(220_000);

    const letterId = uuidv4();
    const messageUri = `https://example.com/ttl/resource/${letterId}`;
    const senderId = uuidv4();

    await eventPublisher.sendEvents<MESHInboxMessageDownloaded>(
      [
        {
          ...baseEvent,
          id: letterId,
          data: {
            ...baseEvent.data,
            messageUri,
            senderId,
          },
        },
      ],
      validateMESHInboxMessageDownloaded,
    );

    await Promise.all([
      expectToPassEventually(async () => {
        const eventLogEntry = await getLogsFromCloudwatch(
          CREATE_TTL_LAMBDA_LOG_GROUP_NAME,
          [
            `$.message.description = "Sender ${senderId} could not be retrieved"`,
          ],
        );

        expect(eventLogEntry.length).toEqual(1);
      }, 200),

      expectMessageContainingString(CREATE_TTL_DLQ_NAME, letterId, 200),
    ]);
  });
});
