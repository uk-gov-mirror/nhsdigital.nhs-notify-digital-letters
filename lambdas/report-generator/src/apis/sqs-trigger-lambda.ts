import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import type {
  ReportGenerator,
  ReportGeneratorOutcome,
  ReportGeneratorResult,
} from 'app/report-generator';
import {
  GenerateReport,
  ReportGenerated,
  validateGenerateReport,
  validateReportGenerated,
} from 'digital-letters-events';
import { EventPublisher, Logger } from 'utils';

interface ProcessingResult {
  result: ReportGeneratorResult;
  item: GenerateReport;
}

interface CreateHandlerDependencies {
  reportGenerator: ReportGenerator;
  eventPublisher: EventPublisher;
  logger: Logger;
}

interface ValidatedRecord {
  messageId: string;
  event: GenerateReport;
}

function validateRecord(
  { body, messageId }: { body: string; messageId: string },
  logger: Logger,
): ValidatedRecord | null {
  try {
    const sqsEventBody = JSON.parse(body);
    const sqsEventDetail = sqsEventBody.detail;

    validateGenerateReport(sqsEventDetail, logger);

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
  reportGenerator: ReportGenerator,
  logger: Logger,
  batchItemFailures: SQSBatchItemFailure[],
): Promise<ProcessingResult> {
  try {
    const result = await reportGenerator.generate(event);

    if (result.outcome === 'failed') {
      batchItemFailures.push({ itemIdentifier: messageId });
    }

    return { result, item: event };
  } catch (error) {
    logger.error({
      err: error,
      description: 'Error during SQS trigger handler',
    });
    batchItemFailures.push({ itemIdentifier: messageId });
    return { result: { outcome: 'failed' }, item: event };
  }
}

interface CategorizedResults {
  processed: Record<ReportGeneratorOutcome | 'retrieved', number>;
  successfulItems: { event: GenerateReport; reportUri: string }[];
}

function categorizeResults(
  results: PromiseSettledResult<ProcessingResult>[],
  logger: Logger,
): CategorizedResults {
  const processed: Record<ReportGeneratorOutcome | 'retrieved', number> = {
    retrieved: results.length,
    generated: 0,
    failed: 0,
  };

  const successfulItems: {
    event: GenerateReport;
    reportUri: string;
  }[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { item, result: itemResult } = result.value;
      processed[itemResult.outcome] += 1;

      if (itemResult.outcome === 'generated') {
        successfulItems.push({
          event: item,
          reportUri: itemResult.reportUri,
        });
      }
    } else {
      logger.error({ err: result.reason });
      processed.failed += 1;
    }
  }

  return { processed, successfulItems };
}

async function publishSuccessfulEvents(
  successfulItems: { event: GenerateReport; reportUri: string }[],
  eventPublisher: EventPublisher,
): Promise<ReportGenerated[]> {
  if (successfulItems.length === 0) return [];
  const reportGeneratedEvents: ReportGenerated[] = successfulItems.map(
    ({ event, reportUri }) => {
      const generatedEventId = randomUUID();
      const reportGeneratedEvent: ReportGenerated = {
        ...event,
        id: generatedEventId,
        time: new Date().toISOString(),
        recordedtime: new Date().toISOString(),
        type: 'uk.nhs.notify.digital.letters.reporting.report.generated.v1',
        dataschema:
          'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-reporting-report-generated-data.schema.json',
        data: {
          senderId: event.data.senderId,
          reportUri,
        },
      };
      return reportGeneratedEvent;
    },
  );

  const submittedFailedEvents =
    await eventPublisher.sendEvents<ReportGenerated>(
      reportGeneratedEvents,
      validateReportGenerated,
    );

  return submittedFailedEvents;
}

export const createHandler = ({
  eventPublisher,
  logger,
  reportGenerator,
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
      processRecord(record, reportGenerator, logger, batchItemFailures),
    );

    const results = await Promise.allSettled(promises);
    const { processed, successfulItems } = categorizeResults(results, logger);

    const eventsFailedToPublish = await publishSuccessfulEvents(
      successfulItems,
      eventPublisher,
    );

    // we have the GenerateReport but we need to report back the messageId of the record.
    for (const event of eventsFailedToPublish) {
      for (const record of validatedRecords) {
        if (record.event.id === event.id) {
          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
      }
    }

    logger.info({
      description: 'Processed SQS Event.',
      failedToPublish: eventsFailedToPublish.length,
      ...processed,
    });

    return { batchItemFailures };
  };

export default createHandler;
