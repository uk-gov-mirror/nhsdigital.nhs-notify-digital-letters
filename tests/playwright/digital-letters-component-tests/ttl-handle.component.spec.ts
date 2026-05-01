import { expect, test } from '@playwright/test';
import { ENV, HANDLE_TTL_DLQ_NAME } from 'constants/backend-constants';
import { MESHInboxMessageDownloaded } from 'digital-letters-events';
import { getLogsFromCloudwatch } from 'helpers/cloudwatch-helpers';
import { deleteTtl, putTtl } from 'helpers/dynamodb-helpers';
import expectToPassEventually from 'helpers/expectations';
import { expectMessageContainingString, purgeQueue } from 'helpers/sqs-helpers';
import { v4 as uuidv4 } from 'uuid';

test.describe('Digital Letters - Handle TTL', () => {
  test.beforeAll(async () => {
    await purgeQueue(HANDLE_TTL_DLQ_NAME);
  });

  const baseEvent: MESHInboxMessageDownloaded = {
    id: 'sample-id',
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
      messageReference: 'ref1',
      senderId: 'sender1',
      messageUri: 'https://example.com/ttl/resource/sample',
    },
  };

  test('should handle withdrawn item', async () => {
    test.setTimeout(200_000);
    const letterId = uuidv4();
    const messageUri = `https://example.com/ttl/resource/${letterId}`;
    const messageReference = letterId;
    const { senderId } = baseEvent.data;

    const event = {
      ...baseEvent,
      id: letterId,
      data: {
        ...baseEvent.data,
        messageUri,
        messageReference,
      },
    } satisfies MESHInboxMessageDownloaded;

    const ttlItem = {
      PK: `${senderId}_${messageReference}`,
      SK: 'TTL',
      dateOfExpiry: '2023-12-31#0',
      event,
      ttl: Date.now() / 1000 + 3600,
      withdrawn: true,
    };

    const putResponseCode = await putTtl(ttlItem);
    expect(putResponseCode).toBe(200);

    const deleteResponseCode = await deleteTtl(senderId, messageReference);
    expect(deleteResponseCode).toBe(200);

    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/lambda/nhs-${ENV}-dl-ttl-handle-expiry`,
        [
          `$.message.messageUri = "${messageUri}"`,
          '$.message.description = "ItemDequeued event not sent as item withdrawn"',
        ],
      );

      expect(eventLogEntry.length).toEqual(1);
    }, 180_000);
  });

  test('should handle expired item', async () => {
    test.setTimeout(200_000);
    const letterId = uuidv4();
    const messageUri = `https://example.com/ttl/resource/${letterId}`;
    const messageReference = letterId;
    const { senderId } = baseEvent.data;

    const event = {
      ...baseEvent,
      id: letterId,
      data: {
        ...baseEvent.data,
        messageUri,
        messageReference,
      },
    } satisfies MESHInboxMessageDownloaded;

    const ttlItem = {
      PK: `${senderId}_${messageReference}`,
      SK: 'TTL',
      dateOfExpiry: '2023-12-31#0',
      event,
      ttl: Date.now() / 1000 + 3600,
    };

    const putResponseCode = await putTtl(ttlItem);
    expect(putResponseCode).toBe(200);

    const deleteResponseCode = await deleteTtl(senderId, messageReference);
    expect(deleteResponseCode).toBe(200);

    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.queue.item.dequeued.v1"',
          `$.details.event_detail = "*\\"messageUri\\":\\"${messageUri}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toEqual(1);
    }, 180_000);
  });

  test('should send invalid item to dlq', async () => {
    test.setTimeout(220_000);

    const letterId = uuidv4();
    const messageReference = letterId;
    const { senderId } = baseEvent.data;

    const eventWithNoMessageUri = {
      ...baseEvent,
      id: letterId,
      data: {
        ...baseEvent.data,
        unexpectedField: 'I should not be here',
      },
    };

    const ttlItem = {
      PK: `${senderId}_${messageReference}`,
      SK: 'TTL',
      dateOfExpiry: '2023-12-31#0',
      event: eventWithNoMessageUri,
      ttl: Date.now() / 1000 + 3600,
    };

    const putResponseCode = await putTtl(ttlItem);
    expect(putResponseCode).toBe(200);

    const deleteResponseCode = await deleteTtl(senderId, messageReference);
    expect(deleteResponseCode).toBe(200);

    await expectMessageContainingString(HANDLE_TTL_DLQ_NAME, letterId, 200);
  });
});
