import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import type {
  UploadToPdm,
  UploadToPdmOutcome,
  UploadToPdmResult,
} from 'app/upload-to-pdm';
import {
  MESHInboxMessageDownloaded,
  PDMResourceSubmitted,
  validateMESHInboxMessageDownloaded,
  validatePDMResourceSubmissionRejected,
  validatePDMResourceSubmitted,
} from 'digital-letters-events';
import { EventPublisher, Logger } from 'utils';

interface ProcessingResult {
  result: UploadToPdmResult;
  item?: MESHInboxMessageDownloaded;
}

interface CreateHandlerDependencies {
  uploadToPdm: UploadToPdm;
  eventPublisher: EventPublisher;
  logger: Logger;
}

interface ValidatedRecord {
  messageId: string;
  event: MESHInboxMessageDownloaded;
}

function validateRecord(
  { body, messageId }: { body: string; messageId: string },
  logger: Logger,
): ValidatedRecord | null {
  try {
    const sqsEventBody = JSON.parse(body);
    const sqsEventDetail = sqsEventBody.detail;

    validateMESHInboxMessageDownloaded(sqsEventDetail, logger);

    return { messageId, event: sqsEventDetail };
  } catch (error) {
    logger.error({
      err: error,
      description: 'Error parsing SQS record',
    });
    return null;
  }
}

async function processRecord(
  { event, messageId }: ValidatedRecord,
  uploadToPdm: UploadToPdm,
  logger: Logger,
  batchItemFailures: SQSBatchItemFailure[],
): Promise<ProcessingResult> {
  try {
    const result = await uploadToPdm.send(event);

    if (result.outcome === 'failed') {
      batchItemFailures.push({ itemIdentifier: messageId });
      return { result: { outcome: 'failed' }, item: event };
    }

    return { result, item: event };
  } catch (error) {
    logger.error({
      err: error,
      description: 'Error during SQS trigger handler',
    });
    batchItemFailures.push({ itemIdentifier: messageId });
    return { result: { outcome: 'failed' } };
  }
}

interface CategorizedResults {
  processed: Record<UploadToPdmOutcome | 'retrieved', number>;
  successfulItems: { event: MESHInboxMessageDownloaded; resourceId: string }[];
  failedItems: MESHInboxMessageDownloaded[];
}

function categorizeResults(
  results: PromiseSettledResult<ProcessingResult>[],
  logger: Logger,
): CategorizedResults {
  const processed: Record<UploadToPdmOutcome | 'retrieved', number> = {
    retrieved: results.length,
    sent: 0,
    failed: 0,
  };

  const successfulItems: {
    event: MESHInboxMessageDownloaded;
    resourceId: string;
  }[] = [];
  const failedItems: MESHInboxMessageDownloaded[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { item, result: itemResult } = result.value;
      processed[itemResult.outcome] += 1;

      if (item) {
        if (itemResult.outcome === 'sent' && itemResult.resourceId) {
          successfulItems.push({
            event: item,
            resourceId: itemResult.resourceId,
          });
        } else {
          failedItems.push(item);
        }
      }
    } else {
      logger.error({ err: result.reason });
      processed.failed += 1;
    }
  }

  return { processed, successfulItems, failedItems };
}

async function publishSuccessfulEvents(
  successfulItems: { event: MESHInboxMessageDownloaded; resourceId: string }[],
  eventPublisher: EventPublisher,
  logger: Logger,
): Promise<void> {
  if (successfulItems.length === 0) return;

  try {
    const submittedFailedEvents =
      await eventPublisher.sendEvents<PDMResourceSubmitted>(
        successfulItems.map(({ event, resourceId }) => ({
          ...event,
          id: randomUUID(),
          time: new Date().toISOString(),
          recordedtime: new Date().toISOString(),
          type: 'uk.nhs.notify.digital.letters.pdm.resource.submitted.v1',
          dataschema:
            'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-submitted-data.schema.json',
          source: event.source.replace(/\/mesh$/, '/pdm'),
          data: {
            messageReference: event.data.messageReference,
            senderId: event.data.senderId,
            resourceId,
          },
        })),
        validatePDMResourceSubmitted,
      );
    if (submittedFailedEvents.length > 0) {
      logger.warn({
        description: 'Some successful events failed to publish',
        failedCount: submittedFailedEvents.length,
        totalAttempted: successfulItems.length,
      });
    }
  } catch (error) {
    logger.warn({
      err: error,
      description: 'Failed to send successful events to EventBridge',
      eventCount: successfulItems.length,
    });
  }
}

async function publishFailedEvents(
  failedItems: MESHInboxMessageDownloaded[],
  eventPublisher: EventPublisher,
  logger: Logger,
): Promise<void> {
  if (failedItems.length === 0) return;

  try {
    const rejectedFailedEvents = await eventPublisher.sendEvents(
      failedItems.map((event) => ({
        ...event,
        id: randomUUID(),
        time: new Date().toISOString(),
        recordedtime: new Date().toISOString(),
        type: 'uk.nhs.notify.digital.letters.pdm.resource.submission.rejected.v1',
        dataschema:
          'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-submission-rejected-data.schema.json',
        source: event.source.replace(/\/mesh$/, '/pdm'),
        data: {
          messageReference: event.data.messageReference,
          senderId: event.data.senderId,
          reasonCode: 'DL_PDMV_001',
        },
      })),
      validatePDMResourceSubmissionRejected,
    );
    if (rejectedFailedEvents.length > 0) {
      logger.warn({
        description: 'Some failed events failed to publish',
        failedCount: rejectedFailedEvents.length,
        totalAttempted: failedItems.length,
      });
    }
  } catch (error) {
    logger.warn({
      err: error,
      description: 'Failed to send failed events to EventBridge',
      eventCount: failedItems.length,
    });
  }
}

export const createHandler = ({
  eventPublisher,
  logger,
  uploadToPdm,
}: CreateHandlerDependencies) =>
  async function handler(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const batchItemFailures: SQSBatchItemFailure[] = [];

    const validatedRecords: ValidatedRecord[] = [];
    for (const record of sqsEvent.Records) {
      const validated = validateRecord(record, logger);
      if (validated) {
        validatedRecords.push(validated);
      } else {
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }

    const promises = validatedRecords.map((record) =>
      processRecord(record, uploadToPdm, logger, batchItemFailures),
    );

    const results = await Promise.allSettled(promises);
    const { failedItems, processed, successfulItems } = categorizeResults(
      results,
      logger,
    );

    await publishSuccessfulEvents(successfulItems, eventPublisher, logger);
    await publishFailedEvents(failedItems, eventPublisher, logger);

    logger.info({
      description: 'Processed SQS Event.',
      ...processed,
    });

    return { batchItemFailures };
  };

export default createHandler;
