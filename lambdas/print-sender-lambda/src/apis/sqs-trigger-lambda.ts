import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';
import type { PrintSender, PrintSenderOutcome } from 'app/print-sender';
import { Logger } from 'utils';
import { validatePDFAnalysed } from 'digital-letters-events';

interface PrintSenderHandlerDependencies {
  printSender: PrintSender;
  logger: Logger;
}

export const createHandler = ({
  logger,
  printSender,
}: PrintSenderHandlerDependencies) =>
  async function handler(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const batchItemFailures: SQSBatchItemFailure[] = [];
    let sent = 0;

    const promises = sqsEvent.Records.map(
      async ({ body, messageId }): Promise<void> => {
        try {
          const sqsEventBody = JSON.parse(body);
          const sqsEventDetail = sqsEventBody.detail;

          const messageReference =
            sqsEventDetail?.data?.messageReference || 'not present';
          const childLogger = logger.child({ messageReference });

          validatePDFAnalysed(sqsEventDetail, childLogger);

          const result = await printSender.send(sqsEventDetail);

          if (result === 'failed') {
            batchItemFailures.push({ itemIdentifier: messageId });
            return;
          }

          sent += 1;
        } catch (error) {
          logger.error({
            err: error,
            description: 'Error during SQS trigger handler',
          });

          batchItemFailures.push({ itemIdentifier: messageId });
        }
      },
    );

    await Promise.all(promises);

    const processed: Record<PrintSenderOutcome | 'retrieved', number> = {
      retrieved: sqsEvent.Records.length,
      sent,
      failed: batchItemFailures.length,
    };

    logger.info({
      description: 'Processed SQS Event.',
      ...processed,
    });

    return { batchItemFailures };
  };

export default createHandler;
