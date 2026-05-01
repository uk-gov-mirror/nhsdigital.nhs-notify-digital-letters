import {
  DigitalLetterRead,
  FileQuarantined,
  InvalidAttachmentReceived,
  ItemDequeued,
  MessageRequestRejected,
  PDMResourceRetriesExceeded,
  PDMResourceSubmissionRejected,
  PrintLetterTransitioned,
} from 'digital-letters-events';

function buildBaseEvent(sourceComponent: string, time: string) {
  return {
    specversion: '1.0',
    plane: 'data',
    dataschemaversion: '1.0.0',
    source: `/nhs/england/notify/production/primary/digitalletters/${sourceComponent}`,
    subject:
      'customer/920fca11-596a-4eca-9c47-99f624614658/recipient/769acdd4-6a47-496f-999f-76a6fd2c3959',
    time,
    recordedtime: time,
    severitynumber: 2,
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    datacontenttype: 'application/json',
    severitytext: 'INFO',
  };
}

export function buildDigitalLetterReadEvent(
  eventId: string,
  time: string,
  messageReference: string,
  senderId: string,
): DigitalLetterRead {
  const baseEvent = buildBaseEvent('queue', time);
  return {
    ...baseEvent,
    id: eventId,
    type: 'uk.nhs.notify.digital.letters.queue.digital.letter.read.v1',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-queue-digital-letter-read-data.schema.json',
    data: {
      messageReference,
      senderId,
    },
  } as DigitalLetterRead;
}

export function buildItemDequeuedEvent(
  eventId: string,
  time: string,
  messageReference: string,
  senderId: string,
): ItemDequeued {
  const baseEvent = buildBaseEvent('queue', time);
  return {
    ...baseEvent,
    id: eventId,
    type: 'uk.nhs.notify.digital.letters.queue.item.dequeued.v1',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-queue-item-dequeued-data.schema.json',
    data: {
      messageReference,
      senderId,
      messageUri: `https://example.com/ttl/resource/${eventId}`,
    },
  } as ItemDequeued;
}

export function buildPrintLetterTransitionedEvent(
  eventId: string,
  time: string,
  messageReference: string,
  status: string,
  senderId: string,
  reasonCode: string,
  reasonText: string,
): PrintLetterTransitioned {
  const baseEvent = buildBaseEvent('print', time);
  return {
    ...baseEvent,
    id: eventId,
    type: 'uk.nhs.notify.digital.letters.print.letter.transitioned.v1',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-letter-transitioned-data.schema.json',
    data: {
      messageReference,
      senderId,
      status,
      supplierId: 'supplier-1',
      time,
      reasonCode,
      reasonText,
    },
  } as PrintLetterTransitioned;
}

export function buildPDMResourceSubmissionRejectedEvent(
  eventId: string,
  time: string,
  messageReference: string,
  senderId: string,
): PDMResourceSubmissionRejected {
  const baseEvent = buildBaseEvent('pdm', time);
  return {
    ...baseEvent,
    id: eventId,
    type: 'uk.nhs.notify.digital.letters.pdm.resource.submission.rejected.v1',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-submission-rejected-data.schema.json',
    data: {
      messageReference,
      senderId,
      reasonCode: 'DL_PDMV_001',
    },
  } as PDMResourceSubmissionRejected;
}

export function buildPDMResourceRetriesExceededEvent(
  eventId: string,
  time: string,
  messageReference: string,
  senderId: string,
): PDMResourceRetriesExceeded {
  const baseEvent = buildBaseEvent('pdm', time);
  return {
    ...baseEvent,
    id: eventId,
    type: 'uk.nhs.notify.digital.letters.pdm.resource.retries.exceeded.v1',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-retries-exceeded-data.schema.json',
    data: {
      messageReference,
      senderId,
      resourceId: `resource-${eventId}`,
      retryCount: 5,
      reasonCode: 'DL_PDMV_002',
    },
  } as PDMResourceRetriesExceeded;
}

export function buildMessageRequestRejectedEvent(
  eventId: string,
  time: string,
  messageReference: string,
  senderId: string,
): MessageRequestRejected {
  const baseEvent = buildBaseEvent('messages', time);
  return {
    ...baseEvent,
    id: eventId,
    type: 'uk.nhs.notify.digital.letters.messages.request.rejected.v1',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-message-request-rejected-data.schema.json',
    data: {
      messageReference,
      senderId,
      messageUri: `https://example.com/messages/${eventId}`,
      failureCode: 'VALIDATION_ERROR',
      reasonCode: 'DL_INTE_001',
      reasonText: 'Request validation failed',
    },
  } as MessageRequestRejected;
}

export function buildFileQuarantinedEvent(
  eventId: string,
  time: string,
  messageReference: string,
  senderId: string,
): FileQuarantined {
  const baseEvent = buildBaseEvent('print', time);
  return {
    ...baseEvent,
    id: eventId,
    type: 'uk.nhs.notify.digital.letters.print.file.quarantined.v1',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-file-quarantined-data.schema.json',
    data: {
      messageReference,
      senderId,
      letterUri: `s3://bucket/letters/${eventId}.pdf`,
      createdAt: time,
      reasonCode: 'DL_CLIV_003',
    },
  } as FileQuarantined;
}

export function buildInvalidAttachmentReceivedEvent(
  eventId: string,
  time: string,
  messageReference: string,
  senderId: string,
): InvalidAttachmentReceived {
  const baseEvent = buildBaseEvent('print', time);
  return {
    ...baseEvent,
    id: eventId,
    type: 'uk.nhs.notify.digital.letters.print.invalid.attachment.received.v1',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-invalid-attachment-received-data.schema.json',
    data: {
      messageReference,
      senderId,
      reasonCode: 'DL_CLIV_002',
    },
  } as InvalidAttachmentReceived;
}
