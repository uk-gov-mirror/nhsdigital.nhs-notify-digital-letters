import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  $LetterEvent,
  LetterEvent,
} from '@nhsdigital/nhs-notify-event-schemas-supplier-api/src/events/letter-events';
import {
  PrintLetterTransitioned,
  validatePrintLetterTransitioned,
} from 'digital-letters-events';
import { EventPublisher, Logger } from 'utils';

export interface HandlerDependencies {
  eventPublisher: EventPublisher;
  logger: Logger;
}

type ValidatedRecord = {
  messageId: string;
  event: LetterEvent;
};

const originSubjectSchema = z
  .string()
  .regex(
    /^client\/[^/]+\/letter-request\/[^/]+$/,
    'Subject must be in format: client/{senderId}/letter-request/{messageReference}',
  );

function validateRecord(
  { body, messageId }: { body: string; messageId: string },
  logger: Logger,
): ValidatedRecord | null {
  try {
    const sqsEventBody = JSON.parse(body);
    const sqsEventDetail = sqsEventBody.detail;

    const {
      data: item,
      error: parseError,
      success: parseSuccess,
    } = $LetterEvent.safeParse(sqsEventDetail);

    if (!parseSuccess) {
      logger.warn({
        err: parseError,
        description: 'Error parsing queue item',
      });

      return null;
    }

    const subjectValidation = originSubjectSchema.safeParse(
      item.data.origin.subject,
    );

    if (!subjectValidation.success) {
      logger.warn({
        err: subjectValidation.error,
        description: 'Invalid origin.subject format',
      });

      return null;
    }

    logger.info({
      description: 'Successfully validated SQS record',
      messageId,
      subject: item.data.origin.subject,
    });

    return { messageId, event: item };
  } catch (error) {
    logger.warn({
      err: error,
      description: 'Error parsing SQS record',
    });

    return null;
  }
}

function generateUpdatedEvent(event: LetterEvent): PrintLetterTransitioned {
  const eventTime = new Date().toISOString();

  const {
    data: {
      origin: { subject },
      reasonCode,
      reasonText,
      specificationId,
      status,
      supplierId,
    },
    time,
  } = event;

  const senderId = subject.split('/')[1];
  const messageReference = subject.split('/')[3];

  return {
    ...event,
    id: randomUUID(),
    time: eventTime,
    recordedtime: eventTime,
    subject: `client/${senderId}/letter-request/${messageReference}`,
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-letter-transitioned-data.schema.json',
    type: 'uk.nhs.notify.digital.letters.print.letter.transitioned.v1',
    // NOTE: CCM-13892 Generate event digital letters source property from scratch
    source: '/nhs/england/notify/production/primary/digitalletters/print',
    plane: 'data',
    dataschemaversion: '1.0.0',
    data: {
      senderId,
      messageReference,
      specificationId,
      status,
      supplierId,
      time,
      ...(reasonCode && { reasonCode }),
      ...(reasonText && { reasonText }),
    },
  };
}

export const createHandler = ({
  eventPublisher,
  logger,
}: HandlerDependencies) =>
  async function handler(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const receivedItemCount = sqsEvent.Records.length;
    const batchItemFailures: SQSBatchItemFailure[] = [];
    const validatedRecords: ValidatedRecord[] = [];
    const validEvents: PrintLetterTransitioned[] = [];

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
          validEvents.push(generateUpdatedEvent(event));
        } catch (error: any) {
          logger.warn({
            err: error.message,
            description: 'Failed processing message',
          });
          batchItemFailures.push({ itemIdentifier: validatedRecord.messageId });
        }
      }),
    );

    await eventPublisher.sendEvents(
      validEvents,
      validatePrintLetterTransitioned,
    );

    const processedItemCount = receivedItemCount - batchItemFailures.length;
    logger.info(
      `${processedItemCount} of ${receivedItemCount} records processed successfully`,
    );

    return { batchItemFailures };
  };
