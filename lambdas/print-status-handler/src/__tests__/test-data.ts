import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { LetterEvent } from '@nhsdigital/nhs-notify-event-schemas-supplier-api/src/events/letter-events';

export const acceptedLetterEvent = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  specversion: '1.0',
  source: '/data-plane/supplier-api/prod/update-status',
  subject:
    'letter-origin/digital-letters/letter/f47ac10b-58cc-4372-a567-0e02b2c3d479_2503cbd5-6722-4e90-9fbd-5f1e96d65c22',
  type: 'uk.nhs.notify.supplier-api.letter.ACCEPTED.v1',
  dataschema:
    'https://notify.nhs.uk/cloudevents/schemas/supplier-api/letter.ACCEPTED.1.0.17.schema.json',
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
      'f47ac10b-58cc-4372-a567-0e02b2c3d479_2503cbd5-6722-4e90-9fbd-5f1e96d65c22',
    groupId: 'client_template',
    specificationId: '1y3q9v1zzzz',
    supplierId: 'supplier-1',
    status: 'ACCEPTED',
    billingRef: '1y3q9v1zzzz',
    origin: {
      domain: 'letter-rendering',
      event: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      source: '/data-plane/letter-rendering/prod/render-pdf',
      subject:
        'client/f47ac10b-58cc-4372-a567-0e02b2c3d479/letter-request/2503cbd5-6722-4e90-9fbd-5f1e96d65c22',
    },
  },
} as LetterEvent;

export const failedLetterEvent = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  specversion: '1.0',
  source: '/data-plane/supplier-api/prod/update-status',
  subject:
    'letter-origin/digital-letters/letter/f47ac10b-58cc-4372-a567-0e02b2c3d480_2503cbd5-6722-4e90-9fbd-5f1e96d65c22',
  type: 'uk.nhs.notify.supplier-api.letter.FAILED.v1',
  dataschema:
    'https://notify.nhs.uk/cloudevents/schemas/supplier-api/letter.FAILED.1.0.17.schema.json',
  dataschemaversion: '1.0.17',
  time: '2023-06-20T13:00:00Z',
  recordedtime: '2023-06-20T13:00:00.250Z',
  severitynumber: 3,
  traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203332-01',
  datacontenttype: 'application/json',
  severitytext: 'WARN',
  plane: 'data',
  data: {
    domainId:
      'f47ac10b-58cc-4372-a567-0e02b2c3d480_2503cbd5-6722-4e90-9fbd-5f1e96d65c22',
    groupId: 'client_template',
    specificationId: '1y3q9v1zzzz',
    supplierId: 'supplier-1',
    status: 'FAILED',
    billingRef: '1y3q9v1zzzz',
    reasonCode: 'FAILURE001',
    reasonText: 'Letter has too many pages',
    origin: {
      domain: 'letter-rendering',
      event: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
      source: '/data-plane/letter-rendering/prod/render-pdf',
      subject:
        'client/f47ac10b-58cc-4372-a567-0e02b2c3d480/letter-request/2503cbd5-6722-4e90-9fbd-5f1e96d65c22',
    },
  },
} as LetterEvent;

const busEvent = {
  version: '0',
  id: 'ab07d406-0797-e919-ff9b-3ad9c5498114',
};

const sqsRecord = {
  messageId: '1',
  receiptHandle: 'abc',
  attributes: {
    ApproximateReceiveCount: '1',
    SentTimestamp: '2025-07-03T14:23:30Z',
    SenderId: 'sender-id',
    ApproximateFirstReceiveTimestamp: '2025-07-03T14:23:30Z',
  },
  messageAttributes: {},
  md5OfBody: '',
  eventSource: 'aws:sqs',
  eventSourceARN: '',
  awsRegion: '',
} as SQSRecord;

export const recordEvent = (events: LetterEvent[]): SQSEvent => ({
  Records: events.map((event, i) => ({
    ...sqsRecord,
    messageId: String(i + 1),
    body: JSON.stringify({ ...busEvent, detail: event }),
  })),
});
