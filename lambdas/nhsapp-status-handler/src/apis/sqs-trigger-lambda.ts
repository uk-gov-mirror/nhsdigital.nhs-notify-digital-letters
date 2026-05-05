import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import type { TtlActionOutcome, TtlActions } from 'app/ttl-actions';
import { $ChannelStatusPublishedEvent, EventPublisher, Logger } from 'utils';
import {
  DigitalLetterRead,
  MESHInboxMessageDownloaded,
  validateDigitalLetterRead,
} from 'digital-letters-events';

interface ProcessingResult {
  outcome: TtlActionOutcome;
}

interface CreateHandlerDependencies {
  ttlActions: TtlActions;
  eventPublisher: EventPublisher;
  logger: Logger;
}

export const createHandler = ({
  eventPublisher,
  logger,
  ttlActions,
}: CreateHandlerDependencies) =>
  async function handler(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const batchItemFailures: SQSBatchItemFailure[] = [];

    const promises = sqsEvent.Records.map(
      async ({ body, messageId }): Promise<ProcessingResult> => {
        try {
          const sqsEventBody = JSON.parse(body);
          const sqsEventDetail = sqsEventBody.detail;

          const {
            data: item,
            error: parseError,
            success: parseSuccess,
          } = $ChannelStatusPublishedEvent.safeParse(sqsEventDetail);

          if (!parseSuccess) {
            logger.warn({
              err: parseError,
              messageReference:
                sqsEventDetail?.data?.messageReference || 'not present',
              description: 'Error parsing sqs record',
            });

            batchItemFailures.push({ itemIdentifier: messageId });
            return { outcome: { result: 'failed' } };
          }

          const result = await ttlActions.markWithdrawn(item);

          if (result.result === 'failed') {
            batchItemFailures.push({ itemIdentifier: messageId });
            return { outcome: { result: 'failed' } };
          }

          return { outcome: result };
        } catch (error) {
          logger.warn({
            err: error,
            description: 'Error during SQS trigger handler',
          });

          batchItemFailures.push({ itemIdentifier: messageId });

          return { outcome: { result: 'failed' } };
        }
      },
    );

    const results = await Promise.allSettled(promises);

    const processed: Record<TtlActionOutcome['result'] | 'retrieved', number> =
      {
        retrieved: results.length,
        success: 0,
        failed: 0,
      };

    const successfulEvents: MESHInboxMessageDownloaded[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { outcome } = result.value;
        processed[outcome.result] += 1;

        if (outcome.result === 'success' && outcome.ttlItem) {
          successfulEvents.push(outcome.ttlItem.event);
        }
      } else {
        logger.warn({ err: result.reason });
        processed.failed += 1;
      }
    }

    if (successfulEvents.length > 0) {
      try {
        const failedEvents = await eventPublisher.sendEvents<DigitalLetterRead>(
          successfulEvents.map((event) => ({
            ...event,
            id: randomUUID(),
            time: new Date().toISOString(),
            recordedtime: new Date().toISOString(),
            type: 'uk.nhs.notify.digital.letters.queue.digital.letter.read.v1',
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-queue-digital-letter-read-data.schema.json',
            source: event.source.replace(/\/mesh$/, '/queue'),
            data: {
              messageReference: event.data.messageReference,
              senderId: event.data.senderId,
            },
          })),
          validateDigitalLetterRead,
        );
        if (failedEvents.length > 0) {
          logger.warn({
            description: 'Some events failed to publish',
            failedCount: failedEvents.length,
            totalAttempted: successfulEvents.length,
          });
        }
      } catch (error) {
        logger.warn({
          err: error,
          description: 'Failed to send events to EventBridge',
          eventCount: successfulEvents.length,
        });
      }
    }

    logger.info({
      description: 'Processed SQS Event.',
      ...processed,
    });

    return { batchItemFailures };
  };

export default createHandler;
