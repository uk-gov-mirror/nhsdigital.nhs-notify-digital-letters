import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FileSafe } from 'digital-letters-events';

export const fileSafeEvent: FileSafe = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  specversion: '1.0',
  source: '/nhs/england/notify/production/primary/digitalletters/print',
  plane: 'data',
  dataschemaversion: '1.0.0',
  subject:
    'letter-origin/digital-letters/letter/f47ac10b-58cc-4372-a567-0e02b2c3d479',
  type: 'uk.nhs.notify.digital.letters.print.file.safe.v1',
  dataschema:
    'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-file-safe-data.schema.json',
  time: '2023-06-20T12:00:00Z',
  recordedtime: '2023-06-20T12:00:00.250Z',
  severitynumber: 2,
  traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  datacontenttype: 'application/json',
  severitytext: 'INFO',
  data: {
    messageReference: 'ref1',
    senderId: 'sender1',
    letterUri: 'uri1',
    createdAt: '2023-06-20T12:00:00.250Z',
  },
};

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

export const recordEvent = (events: FileSafe[]): SQSEvent => ({
  Records: events.map((event, i) => ({
    ...sqsRecord,
    messageId: String(i + 1),
    body: JSON.stringify({ ...busEvent, detail: event }),
  })),
});

export const fivePagePdf = () =>
  readFileSync(path.join(__dirname, 'five-page.pdf'));
