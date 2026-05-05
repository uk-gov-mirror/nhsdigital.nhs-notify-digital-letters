import { expect, test } from '@playwright/test';
import { LetterEvent } from '@nhsdigital/nhs-notify-event-schemas-supplier-api/src/events/letter-events';
import {
  ENV,
  PRINT_STATUS_HANDLER_DLQ_NAME,
  PRINT_STATUS_HANDLER_LAMBDA_LOG_GROUP_NAME,
} from 'constants/backend-constants';
import { getLogsFromCloudwatch } from 'helpers/cloudwatch-helpers';
import eventPublisher from 'helpers/event-bus-helpers';
import expectToPassEventually from 'helpers/expectations';
import { v4 as uuidv4 } from 'uuid';
import { expectMessageContainingString, purgeQueue } from 'helpers/sqs-helpers';

const baseLetterEvent = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  specversion: '1.0',
  source: '/data-plane/supplier-api/prod/update-status',
  dataschemaversion: '1.0.17',
  time: '2023-06-20T12:00:00Z',
  recordedtime: '2023-06-20T12:00:00.250Z',
  severitynumber: 2,
  traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  datacontenttype: 'application/json',
  severitytext: 'INFO',
  plane: 'data',
  data: {
    domainId:
      '00f3b388-bbe9-41c9-9e76-052d37ee8988_2503cbd5-6722-4e90-9fbd-5f1e96d65c22',
    groupId: 'client_template',
    specificationId: '1y3q9v1zzzz',
    supplierId: 'supplier-1',
    billingRef: '1y3q9v1zzzz',
    origin: {
      domain: 'letter-rendering',
      event: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      source: '/data-plane/letter-rendering/prod/render-pdf',
    },
  },
} as LetterEvent;

const letterStatuses = [
  'ACCEPTED',
  'REJECTED',
  'PRINTED',
  'DISPATCHED',
  'FAILED',
  'RETURNED',
  'PENDING',
  'ENCLOSED',
  'CANCELLED',
  'FORWARDED',
  'DELIVERED',
] as const;

test.describe('Print status handler', () => {
  test.beforeAll(async () => {
    test.setTimeout(150_000);
    await purgeQueue(PRINT_STATUS_HANDLER_DLQ_NAME);
  });

  for (const status of letterStatuses) {
    test(`should create print.letter.transitioned ${status} event for a letters.${status} event`, async () => {
      const messageReference = uuidv4();
      const letterEvent = {
        ...baseLetterEvent,
        subject: `letter-origin/letter-rendering/letter/00f3b388-bbe9-41c9-9e76-052d37ee8988_${messageReference}`,
        type: `uk.nhs.notify.supplier-api.letter.${status}.v1`,
        dataschema: `https://notify.nhs.uk/cloudevents/schemas/supplier-api/letter.${status}.1.0.17.schema.json`,
        data: {
          ...baseLetterEvent.data,
          status,
          origin: {
            ...baseLetterEvent.data.origin,
            subject: `client/00f3b388-bbe9-41c9-9e76-052d37ee8988/letter-request/${messageReference}`,
          },
        },
      };

      await eventPublisher.sendEvents<LetterEvent>([letterEvent], () => true);

      await expectToPassEventually(async () => {
        const eventLogEntry = await getLogsFromCloudwatch(
          `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
          [
            '$.message_type = "EVENT_RECEIPT"',
            '$.details.detail_type = "uk.nhs.notify.digital.letters.print.letter.transitioned.v1"',
            `$.details.event_detail = "*\\"messageReference\\":\\"${messageReference}\\"*"`,
            `$.details.event_detail = "*\\"status\\":\\"${status}\\"*"`,
          ],
        );

        expect(eventLogEntry.length).toEqual(1);
      }, 120);
    });
  }

  test('should send invalid event to print status handler dlq', async () => {
    test.setTimeout(160_000);

    const messageReference = uuidv4();

    // Send letter.ACCEPTED event with no data.status
    await eventPublisher.sendEvents<LetterEvent>(
      [
        {
          ...baseLetterEvent,
          subject: `letter-origin/letter-rendering/letter/00f3b388-bbe9-41c9-9e76-052d37ee8988_${messageReference}`,
          type: `uk.nhs.notify.supplier-api.letter.ACCEPTED.v1`,
          dataschema: `https://notify.nhs.uk/cloudevents/schemas/supplier-api/letter.ACCEPTED.1.0.0.schema.json`,
          data: {
            ...baseLetterEvent.data,
            origin: {
              ...baseLetterEvent.data.origin,
              subject: `client/00f3b388-bbe9-41c9-9e76-052d37ee8988/letter-request/${messageReference}`,
            },
          },
        },
      ],
      () => true,
    );

    await Promise.all([
      expectToPassEventually(async () => {
        const eventLogEntry = await getLogsFromCloudwatch(
          PRINT_STATUS_HANDLER_LAMBDA_LOG_GROUP_NAME,
          [
            String.raw`$.message.err.message = "*Invalid option: expected one of \\\"PENDING\\\"*"`,
            '$.message.description = "Error parsing queue item"',
          ],
        );

        expect(eventLogEntry.length).toEqual(1);
      }, 150),

      expectMessageContainingString(
        PRINT_STATUS_HANDLER_DLQ_NAME,
        messageReference,
        150,
      ),
    ]);
  });
});
