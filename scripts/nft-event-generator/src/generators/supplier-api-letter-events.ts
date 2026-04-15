import { randomUUID } from 'node:crypto';

import { LetterEvent } from '@nhsdigital/nhs-notify-event-schemas-supplier-api/src/events/letter-events';

/* eslint-disable no-console */

export const LETTER_STATUSES = [
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

export type LetterStatus = (typeof LETTER_STATUSES)[number];

const SENDER_ID = '00f3b388-bbe9-41c9-9e76-052d37ee8988';
const SCHEMA_VERSION = '1.0.17';
const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
// Cast required: domainId is a Zod-branded type that cannot be constructed from a plain string literal
const DOMAIN_ID =
  `${SENDER_ID}_2503cbd5-6722-4e90-9fbd-5f1e96d65c22` as LetterEvent['data']['domainId'];

type GenerateEventsParams = {
  numberOfEvents: number;
  environment: string;
  status: LetterStatus;
  id?: string;
  time?: string;
  subject?: string;
  messageReference?: string;
};

function generateSupplierApiLetterEvent(
  environment: string,
  status: LetterStatus,
  overrides: {
    id?: string;
    time?: string;
    subject?: string;
    messageReference?: string;
  } = {},
): LetterEvent {
  const now = new Date();
  const id = overrides.id ?? randomUUID();
  const messageReference = overrides.messageReference ?? randomUUID();
  const time = overrides.time ?? now.toISOString();
  const subject =
    overrides.subject ??
    `letter-origin/letter-rendering/letter/${SENDER_ID}_${messageReference}`;

  return {
    specversion: '1.0',
    plane: 'data',
    datacontenttype: 'application/json',
    dataschemaversion: SCHEMA_VERSION,
    severitynumber: 2,
    severitytext: 'INFO',
    traceparent: TRACEPARENT,
    id,
    time,
    recordedtime: time,
    subject,
    source: `/data-plane/supplier-api/${environment}/update-status`,
    type: `uk.nhs.notify.supplier-api.letter.${status}.v1`,
    dataschema: `https://notify.nhs.uk/cloudevents/schemas/supplier-api/letter.${status}.${SCHEMA_VERSION}.schema.json`,
    data: {
      domainId: DOMAIN_ID,
      billingRef: '1y3q9v1zzzz',
      groupId: 'client_template',
      specificationId: '1y3q9v1zzzz',
      supplierId: 'supplier-1',
      status,
      origin: {
        domain: 'letter-rendering',
        event: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        source: '/data-plane/letter-rendering/prod/render-pdf',
        subject: `client/${SENDER_ID}/letter-request/${messageReference}`,
      },
    },
  };
}

export function generateSupplierApiLetterEvents({
  environment,
  id,
  messageReference,
  numberOfEvents,
  status,
  subject,
  time,
}: GenerateEventsParams): LetterEvent[] {
  const events: LetterEvent[] = [];

  for (let i = 0; i < numberOfEvents; i++) {
    events.push(
      generateSupplierApiLetterEvent(environment, status, {
        id,
        time,
        subject,
        messageReference,
      }),
    );
  }

  console.group('Event generation:');
  console.log(`Total events generated:\t\t${numberOfEvents}`);
  console.log(`Status:\t\t\t\t${status}`);
  console.groupEnd();

  return events;
}
