import { expect, test } from '@playwright/test';
import {
  ENV,
  PRINT_SENDER_DLQ_NAME,
  PRINT_SENDER_LAMBDA_LOG_GROUP_NAME,
} from 'constants/backend-constants';
import { PDFAnalysed, validatePDFAnalysed } from 'digital-letters-events';
import { getLogsFromCloudwatch } from 'helpers/cloudwatch-helpers';
import eventPublisher from 'helpers/event-bus-helpers';
import expectToPassEventually from 'helpers/expectations';
import { expectMessageContainingString } from 'helpers/sqs-helpers';
import { v4 as uuidv4 } from 'uuid';

test.describe('Digital Letters - Print Sender', () => {
  test('should send Letter Prepared event from PDF Analysed event', async () => {
    test.setTimeout(120_000);

    const letterId = uuidv4();
    const letterUri = `s3://bucket/${letterId}.pdf`;
    const pageCount = 2;
    const sha256Hash =
      'f353e9431b095ccfec5edaa9100e0597952306bc0ab49a00eb1e895789f1124a';
    const createdAt = '2023-05-19T11:00:00.250Z';
    const senderId = 'test-sender-1';
    const messageReference = 'message-ref-123';

    await eventPublisher.sendEvents<PDFAnalysed>(
      [
        {
          id: letterId,
          specversion: '1.0',
          plane: 'data',
          dataschemaversion: '1.0.0',
          source: '/nhs/england/notify/production/primary/digitalletters/print',
          subject:
            'customer/920fca11-596a-4eca-9c47-99f624614658/recipient/769acdd4-6a47-496f-999f-76a6fd2c3959',
          type: 'uk.nhs.notify.digital.letters.print.pdf.analysed.v1',
          time: '2023-06-20T12:00:00Z',
          recordedtime: '2023-06-20T12:00:00.250Z',
          severitynumber: 2,
          traceparent:
            '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
          datacontenttype: 'application/json',
          dataschema:
            'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-pdf-analysed-data.schema.json',
          severitytext: 'INFO',
          data: {
            senderId,
            messageReference,
            letterUri,
            pageCount,
            sha256Hash,
            createdAt,
          },
        },
      ],
      validatePDFAnalysed,
    );

    // Verify letter prepared event published
    await expectToPassEventually(async () => {
      const eventLogEntry = await getLogsFromCloudwatch(
        `/aws/vendedlogs/events/event-bus/nhs-${ENV}-dl`,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.letter-rendering.letter-request.prepared.v1"',
          `$.details.event_detail = "*\\"domainId\\":\\"${senderId}_${messageReference}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toEqual(1);
    }, 60_000);
  });

  test('should send invalid event to print sender dlq', async () => {
    test.setTimeout(160_000);

    const messageReference = uuidv4();
    const event = {
      id: uuidv4(),
      specversion: '1.0',
      plane: 'data',
      dataschemaversion: '1.0.0',
      source: '/nhs/england/notify/production/primary/digitalletters/print',
      subject:
        'customer/920fca11-596a-4eca-9c47-99f624614658/recipient/769acdd4-6a47-496f-999f-76a6fd2c3959',
      type: 'uk.nhs.notify.digital.letters.print.pdf.analysed.v1',
      time: '2023-06-20T12:00:00Z',
      recordedtime: '2023-06-20T12:00:00.250Z',
      severitynumber: 2,
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      datacontenttype: 'application/json',
      dataschema:
        'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-pdf-analysed-data.schema.json',
      severitytext: 'INFO',
      data: {
        messageReference,
      },
    } as unknown as PDFAnalysed;

    // Send event bypassing validation to trigger validation error in lambda
    await eventPublisher.sendEvents<PDFAnalysed>([event], () => true);

    await Promise.all([
      expectToPassEventually(async () => {
        const eventLogEntry = await getLogsFromCloudwatch(
          PRINT_SENDER_LAMBDA_LOG_GROUP_NAME,
          [
            '$.message.description = "Error parsing PDFAnalysed event"',
            `$.message.err[0].message = "must have required property 'senderId'"`,
            `$.messageReference = "${messageReference}"`,
          ],
        );

        expect(eventLogEntry.length).toBeGreaterThanOrEqual(1);
      }, 150),

      expectMessageContainingString(
        PRINT_SENDER_DLQ_NAME,
        messageReference,
        150,
      ),
    ]);
  });
});
