import { randomUUID } from 'node:crypto';
import { FileQuarantined, FileSafe } from 'digital-letters-events';

export function createFileSafeEvent(
  messageReference: string,
  senderId: string,
  letterUri: string,
  createdAt: string,
  traceparent?: string,
): FileSafe {
  return {
    specversion: '1.0',
    id: randomUUID(),
    subject: `customer/${senderId}/recipient/${messageReference}`,
    plane: 'data',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-file-safe-data.schema.json',
    dataschemaversion: '1.0.0',
    datacontenttype: 'application/json',
    source: '/nhs/england/notify/production/primary/digitalletters/print', // Note CCM-13892.
    traceparent: traceparent ?? '',
    type: 'uk.nhs.notify.digital.letters.print.file.safe.v1',
    time: new Date().toISOString(),
    data: {
      messageReference,
      senderId,
      letterUri,
      createdAt,
    },
    recordedtime: new Date().toISOString(),
    severitynumber: 2,
  };
}

export function createFileQuarantinedEvent(
  messageReference: string,
  senderId: string,
  letterUri: string,
  createdAt: string,
  traceparent?: string,
): FileQuarantined {
  return {
    specversion: '1.0',
    id: randomUUID(),
    subject: `customer/${senderId}/recipient/${messageReference}`,
    plane: 'data',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-file-quarantined-data.schema.json',
    dataschemaversion: '1.0.0',
    datacontenttype: 'application/json',
    source: '/nhs/england/notify/production/primary/digitalletters/print', // Note CCM-13892.
    traceparent: traceparent ?? '',
    type: 'uk.nhs.notify.digital.letters.print.file.quarantined.v1',
    time: new Date().toISOString(),
    data: {
      messageReference,
      senderId,
      letterUri,
      createdAt,
      reasonCode: 'DL_CLIV_003',
    },
    recordedtime: new Date().toISOString(),
    severitynumber: 2,
  };
}
