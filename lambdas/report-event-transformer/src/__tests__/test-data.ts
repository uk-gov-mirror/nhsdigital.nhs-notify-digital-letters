import type { FirehoseTransformationEvent } from 'aws-lambda';
import { DigitalLettersEvent } from 'types/events';

export const digitalLettersEvent = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  specversion: '1.0',
  source: '/nhs/england/notify/production/primary/digitalletters/pdm',
  subject:
    'customer/920fca11-596a-4eca-9c47-99f624614658/recipient/769acdd4-6a47-496f-999f-76a6fd2c3959',
  type: 'uk.nhs.notify.digital.letters.pdm.resource.submitted.v1',
  time: '2023-06-20T12:00:00Z',
  recordedtime: '2023-06-20T12:00:00.250Z',
  severitynumber: 2,
  traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  datacontenttype: 'application/json',
  dataschema:
    'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-submitted-data.schema.json',
  severitytext: 'INFO',
  data: {
    resourceId: 'a2bcbb42-ab7e-42b6-88d6-74f8d3ca4a09',
    messageReference: 'ref1',
    pageCount: 5,
    reasonCode: 'FAILURE001',
    reasonText: 'Letter has too many pages',
    senderId: 'sender1',
    status: 'DISPATCHED',
    supplierId: 'supplier1',
  },
} as DigitalLettersEvent;

export const firehoseEvent = (
  events: DigitalLettersEvent[],
): FirehoseTransformationEvent => ({
  invocationId: 'test-invocation-id',
  deliveryStreamArn:
    'arn:aws:firehose:eu-west-2:123456789012:deliverystream/test',
  region: 'eu-west-2',
  records: events.map((event, i) => ({
    recordId: String(i + 1),
    approximateArrivalTimestamp: Date.now(),
    data: Buffer.from(
      JSON.stringify({
        version: '0',
        id: 'ab07d406-0797-e919-ff9b-3ad9c5498114',
        detail: event,
      }),
    ).toString('base64'),
  })),
});
