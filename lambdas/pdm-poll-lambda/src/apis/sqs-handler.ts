import { Pdm } from 'app/pdm';
import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';
import {
  PDMResourceAvailable,
  PDMResourceRetriesExceeded,
  PDMResourceSubmitted,
  PDMResourceUnavailable,
  validatePDMResourceAvailable,
  validatePDMResourceRetriesExceeded,
  validatePDMResourceSubmitted,
  validatePDMResourceUnavailable,
} from 'digital-letters-events';
import { randomUUID } from 'node:crypto';
import { EventPublisher, Logger } from 'utils';

export interface HandlerDependencies {
  eventPublisher: EventPublisher;
  logger: Logger;
  pdm: Pdm;
  pollMaxRetries: number;
}

type PollableEvent = PDMResourceSubmitted | PDMResourceUnavailable;

type ValidatedRecord = {
  messageId: string;
  event: PollableEvent;
};

function validateRecord(
  { body, messageId }: { body: string; messageId: string },
  logger: Logger,
): ValidatedRecord | null {
  try {
    const sqsEventBody = JSON.parse(body);
    const sqsEventDetail = sqsEventBody.detail;

    if (
      sqsEventDetail.type ===
      'uk.nhs.notify.digital.letters.pdm.resource.submitted.v1'
    ) {
      validatePDMResourceSubmitted(sqsEventDetail, logger);

      return { messageId, event: sqsEventDetail };
    }

    validatePDMResourceUnavailable(sqsEventDetail, logger);

    return { messageId, event: sqsEventDetail };
  } catch (error) {
    logger.warn({
      err: error,
      description: 'Error parsing SQS record',
    });
    return null;
  }
}

function generateAvailableEvent(
  event: PollableEvent,
  nhsNumber: string,
  odsCode: string,
): PDMResourceAvailable {
  const eventTime = new Date().toISOString();

  return {
    ...event,
    id: randomUUID(),
    time: eventTime,
    recordedtime: eventTime,
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-available-data.schema.json',
    type: 'uk.nhs.notify.digital.letters.pdm.resource.available.v1',
    data: {
      messageReference: event.data.messageReference,
      senderId: event.data.senderId,
      resourceId: event.data.resourceId,
      nhsNumber,
      odsCode,
    },
  };
}

function generateUnavailableEvent(
  event: PollableEvent,
  retries: number,
): PDMResourceUnavailable {
  const eventTime = new Date().toISOString();

  return {
    ...event,
    id: randomUUID(),
    time: eventTime,
    recordedtime: eventTime,
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-unavailable-data.schema.json',
    type: 'uk.nhs.notify.digital.letters.pdm.resource.unavailable.v1',
    data: {
      messageReference: event.data.messageReference,
      senderId: event.data.senderId,
      resourceId: event.data.resourceId,
      retryCount: retries,
    },
  };
}

function generateRetriesExceededEvent(
  event: PollableEvent,
  retries: number,
): PDMResourceRetriesExceeded {
  const eventTime = new Date().toISOString();

  return {
    ...event,
    id: randomUUID(),
    time: eventTime,
    recordedtime: eventTime,
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-retries-exceeded-data.schema.json',
    type: 'uk.nhs.notify.digital.letters.pdm.resource.retries.exceeded.v1',
    data: {
      messageReference: event.data.messageReference,
      senderId: event.data.senderId,
      resourceId: event.data.resourceId,
      retryCount: retries,
      reasonCode: 'DL_PDMV_002',
    },
  };
}

export const createHandler = ({
  eventPublisher,
  logger,
  pdm,
  pollMaxRetries,
}: HandlerDependencies) =>
  async function handler(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const receivedItemCount = sqsEvent.Records.length;
    const batchItemFailures: SQSBatchItemFailure[] = [];
    const validatedRecords: ValidatedRecord[] = [];
    const availableEvents: PDMResourceAvailable[] = [];
    const unavailableEvents: PDMResourceUnavailable[] = [];
    const retriesExceededEvents: PDMResourceRetriesExceeded[] = [];

    logger.info(`Received SQS Event of ${receivedItemCount} record(s)`);

    for (const record of sqsEvent.Records) {
      const validated = validateRecord(record, logger);
      if (validated) {
        validatedRecords.push(validated);
      } else {
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }

    await Promise.all(
      validatedRecords.map(async (validatedRecord: ValidatedRecord) => {
        try {
          const { event } = validatedRecord;
          const { nhsNumber, odsCode, pdmAvailability } = await pdm.poll(event);
          let retries = 0; // First attempt for submitted events
          if ('retryCount' in event.data) {
            retries = event.data.retryCount + 1; // Increment attempt for unavailable events
          }

          if (pdmAvailability === 'unavailable') {
            if (retries >= pollMaxRetries) {
              const outgoing = generateRetriesExceededEvent(event, retries);
              logger.info({
                description: 'TraceContext hop',
                incoming_traceparent: event.traceparent,
                outgoing_traceparent: outgoing.traceparent,
              });
              retriesExceededEvents.push(outgoing);
            } else {
              const outgoing = generateUnavailableEvent(event, retries);
              logger.info({
                description: 'TraceContext hop',
                incoming_traceparent: event.traceparent,
                outgoing_traceparent: outgoing.traceparent,
              });
              unavailableEvents.push(outgoing);
            }
          } else {
            const outgoing = generateAvailableEvent(event, nhsNumber, odsCode);
            logger.info({
              description: 'TraceContext hop',
              incoming_traceparent: event.traceparent,
              outgoing_traceparent: outgoing.traceparent,
            });
            availableEvents.push(outgoing);
          }
        } catch (error: any) {
          logger.warn({
            err: error.message,
            description: 'Failed processing message',
          });
          batchItemFailures.push({ itemIdentifier: validatedRecord.messageId });
        }
      }),
    );

    await Promise.all(
      [
        availableEvents.length > 0 &&
          eventPublisher.sendEvents(
            availableEvents,
            validatePDMResourceAvailable,
          ),
        unavailableEvents.length > 0 &&
          eventPublisher.sendEvents(
            unavailableEvents,
            validatePDMResourceUnavailable,
          ),
        retriesExceededEvents.length > 0 &&
          eventPublisher.sendEvents(
            retriesExceededEvents,
            validatePDMResourceRetriesExceeded,
          ),
      ].filter(Boolean),
    );

    const processedItemCount = receivedItemCount - batchItemFailures.length;
    logger.info(
      `${processedItemCount} of ${receivedItemCount} records processed successfully`,
    );

    return { batchItemFailures };
  };
