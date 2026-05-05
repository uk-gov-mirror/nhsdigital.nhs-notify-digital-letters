import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import type { CreateTtl, CreateTtlOutcome } from 'app/create-ttl';
import { EventPublisher, Logger } from 'utils';
import {
  ItemEnqueued,
  MESHInboxMessageDownloaded,
  validateItemEnqueued,
  validateMESHInboxMessageDownloaded,
} from 'digital-letters-events';

interface ProcessingResult {
  result: CreateTtlOutcome;
  item?: MESHInboxMessageDownloaded;
}

interface CreateHandlerDependencies {
  createTtl: CreateTtl;
  eventPublisher: EventPublisher;
  logger: Logger;
}

export const createHandler = ({
  createTtl,
  eventPublisher,
  logger,
}: CreateHandlerDependencies) =>
  async function handler(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const batchItemFailures: SQSBatchItemFailure[] = [];

    const promises = sqsEvent.Records.map(
      async ({ body, messageId }): Promise<ProcessingResult> => {
        try {
          const sqsEventBody = JSON.parse(body);
          const sqsEventDetail = sqsEventBody.detail;
          validateMESHInboxMessageDownloaded(sqsEventDetail, logger);

          const result = await createTtl.send(sqsEventDetail);

          if (result === 'failed') {
            batchItemFailures.push({ itemIdentifier: messageId });
            return { result: 'failed' };
          }

          return { result, item: sqsEventDetail };
        } catch (error) {
          logger.error({
            err: error,
            description: 'Error during SQS trigger handler',
          });

          batchItemFailures.push({ itemIdentifier: messageId });

          return { result: 'failed' };
        }
      },
    );

    const results = await Promise.allSettled(promises);

    const processed: Record<CreateTtlOutcome | 'retrieved', number> = {
      retrieved: results.length,
      sent: 0,
      failed: 0,
    };

    const successfulEvents: MESHInboxMessageDownloaded[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { item, result: outcome } = result.value;
        processed[outcome] += 1;

        if (outcome === 'sent' && item) {
          successfulEvents.push(item);
        }
      } else {
        logger.error({ err: result.reason });
        processed.failed += 1;
      }
    }

    if (successfulEvents.length > 0) {
      try {
        const failedEvents = await eventPublisher.sendEvents<ItemEnqueued>(
          successfulEvents.map((event) => ({
            ...event,
            id: randomUUID(),
            time: new Date().toISOString(),
            recordedtime: new Date().toISOString(),
            type: 'uk.nhs.notify.digital.letters.queue.item.enqueued.v1',
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-queue-item-enqueued-data.schema.json',
            source: event.source.replace(/\/mesh$/, '/queue'),
            data: {
              messageReference: event.data.messageReference,
              senderId: event.data.senderId,
              messageUri: event.data.messageUri,
            },
          })),
          validateItemEnqueued,
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
