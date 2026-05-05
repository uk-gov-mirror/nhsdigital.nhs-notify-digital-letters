import { FileScanner } from 'app/file-scanner';
import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';
import { ItemDequeued, validateItemDequeued } from 'digital-letters-events';
import { EventPublisher, Logger } from 'utils';

export interface HandlerDependencies {
  eventPublisher: EventPublisher;
  logger: Logger;
  fileScanner: FileScanner;
}

type ValidatedRecord = {
  messageId: string;
  event: ItemDequeued;
};

function validateRecord(
  { body, messageId }: { body: string; messageId: string },
  logger: Logger,
): ValidatedRecord | null {
  try {
    const sqsEventBody = JSON.parse(body);
    const sqsEventDetail = sqsEventBody.detail;

    validateItemDequeued(sqsEventDetail, logger);

    return { messageId, event: sqsEventDetail };
  } catch (error) {
    logger.warn({
      err: error,
      description: 'Error parsing SQS record',
    });
    return null;
  }
}

async function processRecord(
  validatedRecord: ValidatedRecord,
  { fileScanner, logger }: HandlerDependencies,
): Promise<void> {
  const { event } = validatedRecord;

  logger.info({
    description: 'Processing ItemDequeued event',
    eventId: event.id,
    messageReference: event.data.messageReference,
    senderId: event.data.senderId,
  });

  const result = await fileScanner.scanFile(event.data.messageUri, {
    messageReference: event.data.messageReference,
    senderId: event.data.senderId,
    createdAt: event.time,
    traceparent: event.traceparent,
  });

  if (result.outcome === 'failed') {
    throw new Error(
      `Failed to process file for scanning: ${result.errorMessage}`,
    );
  }
}

export function createHandler(dependencies: HandlerDependencies) {
  return async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
    const { logger } = dependencies;

    logger.info({
      description: 'Starting file scanner batch',
      recordCount: event.Records.length,
    });

    const itemFailures: SQSBatchItemFailure[] = [];

    for (const record of event.Records) {
      const validatedRecord = validateRecord(record, logger);

      if (validatedRecord) {
        try {
          await processRecord(validatedRecord, dependencies);
        } catch (error) {
          logger.error({
            description: 'Error processing record',
            err:
              error instanceof Error
                ? {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                  }
                : error,
            messageId: validatedRecord.messageId,
          });

          itemFailures.push({ itemIdentifier: validatedRecord.messageId });
        }
      } else {
        // Validation failed - return to queue for retry/DLQ
        logger.warn({
          description: 'Invalid record will be retried',
          messageId: record.messageId,
        });
        itemFailures.push({ itemIdentifier: record.messageId });
      }
    }

    logger.info({
      description: 'Completed file scanner batch',
      successCount: event.Records.length - itemFailures.length,
      failureCount: itemFailures.length,
    });

    return { batchItemFailures: itemFailures };
  };
}
