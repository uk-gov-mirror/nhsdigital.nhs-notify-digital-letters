import type {
  GuardDutyScanResultNotificationEventDetail,
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
  SQSRecord,
} from 'aws-lambda';
import { EventPublisher, Logger } from 'utils';
import {
  FileQuarantined,
  FileSafe,
  validateFileQuarantined,
  validateFileSafe,
} from 'digital-letters-events';
import { parseSqsRecord } from 'app/parse-sqs-message';
import { MoveFileHandler } from 'app/move-file-handler';

export interface SqsHandlerDependencies {
  logger: Logger;
  eventPublisher: EventPublisher;
  moveFileHandler: MoveFileHandler;
}

export const createHandler = ({
  eventPublisher,
  logger,
  moveFileHandler,
}: SqsHandlerDependencies) =>
  async function handler(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const receivedItemCount = sqsEvent.Records.length;

    logger.info({
      description: `Received SQS Event of ${receivedItemCount} record(s)`,
    });

    const batchItemFailures: SQSBatchItemFailure[] = [];
    const fileSafeEvents: FileSafe[] = [];
    const fileQuarantinedEvents: FileQuarantined[] = [];

    let incoming: GuardDutyScanResultNotificationEventDetail;

    await Promise.all(
      sqsEvent.Records.map(async (sqsRecord: SQSRecord) => {
        try {
          incoming = parseSqsRecord(sqsRecord, logger);

          const eventToPublish = await moveFileHandler.handle(incoming);

          if (eventToPublish) {
            if (eventToPublish.fileSafe) {
              fileSafeEvents.push(eventToPublish.fileSafe);
            }
            if (eventToPublish.fileQuarantined) {
              fileQuarantinedEvents.push(eventToPublish.fileQuarantined);
            }
          } else {
            // there was something wrong with the event
            batchItemFailures.push({ itemIdentifier: sqsRecord.messageId });
          }
        } catch (error: any) {
          logger.warn({
            error: error.message,
            description: 'Failed processing message',
            messageId: sqsRecord.messageId,
          });
          // this might be a transient error so we notify the queue to retry
          batchItemFailures.push({ itemIdentifier: sqsRecord.messageId });
        }
      }),
    );

    await Promise.all(
      [
        fileSafeEvents.length > 0 &&
          eventPublisher.sendEvents<FileSafe>(fileSafeEvents, validateFileSafe),
        fileQuarantinedEvents.length > 0 &&
          eventPublisher.sendEvents<FileQuarantined>(
            fileQuarantinedEvents,
            validateFileQuarantined,
          ),
      ].filter(Boolean),
    );

    const processedItemCount = receivedItemCount - batchItemFailures.length;

    logger.info({
      description: `${processedItemCount} of ${receivedItemCount} records processed successfully`,
    });

    return { batchItemFailures };
  };
