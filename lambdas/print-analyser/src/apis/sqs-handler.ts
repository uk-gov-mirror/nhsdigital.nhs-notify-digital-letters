import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';
import { createHash, randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import {
  FileSafe,
  InvalidAttachmentReceived,
  PDFAnalysed,
  validateFileSafe,
  validateInvalidAttachmentReceived,
  validatePDFAnalysed,
} from 'digital-letters-events';
import { EventPublisher, Logger, getS3ObjectBufferFromUri } from 'utils';

export interface HandlerDependencies {
  eventPublisher: EventPublisher;
  logger: Logger;
}

type ValidatedRecord = {
  messageId: string;
  event: FileSafe;
};

type PdfInfo = {
  pageCount: number;
  hash: string;
};

function validateRecord(
  { body, messageId }: { body: string; messageId: string },
  logger: Logger,
): ValidatedRecord | null {
  try {
    const sqsEventBody = JSON.parse(body);
    const sqsEventDetail = sqsEventBody.detail;

    const messageReference =
      sqsEventDetail?.data?.messageReference || 'not present';
    const childLogger = logger.child({ messageReference });

    validateFileSafe(sqsEventDetail, childLogger);

    return { messageId, event: sqsEventDetail };
  } catch (error) {
    logger.warn({
      err: error,
      description: 'Error parsing SQS record',
    });

    return null;
  }
}

function generateUpdatedEvent(event: FileSafe, pdfInfo: PdfInfo): PDFAnalysed {
  const eventTime = new Date().toISOString();

  const {
    data: { createdAt, letterUri, messageReference, senderId },
  } = event;

  return {
    ...event,
    id: randomUUID(),
    time: eventTime,
    recordedtime: eventTime,
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-pdf-analysed-data.schema.json',
    type: 'uk.nhs.notify.digital.letters.print.pdf.analysed.v1',
    // NOTE: CCM-13892 Generate event digital letters source property from scratch
    source: '/nhs/england/notify/production/primary/digitalletters/print',
    data: {
      senderId,
      messageReference,
      letterUri,
      pageCount: pdfInfo.pageCount,
      sha256Hash: pdfInfo.hash,
      createdAt,
    },
  };
}

function generateInvalidAttachmentEvent(
  event: FileSafe,
): InvalidAttachmentReceived {
  const eventTime = new Date().toISOString();

  const {
    data: { messageReference, senderId },
  } = event;

  return {
    ...event,
    id: randomUUID(),
    time: eventTime,
    recordedtime: eventTime,
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-invalid-attachment-received-data.schema.json',
    type: 'uk.nhs.notify.digital.letters.print.invalid.attachment.received.v1',
    data: {
      senderId,
      messageReference,
      reasonCode: 'DL_CLIV_002',
    },
  };
}

async function analysePdf(pdf: Buffer): Promise<PdfInfo> {
  const doc = await PDFDocument.load(pdf);
  const pageCount = doc.getPageCount();
  const hash = createHash('sha256').update(pdf).digest('hex');

  return { pageCount, hash };
}

export const createHandler = ({
  eventPublisher,
  logger,
}: HandlerDependencies) =>
  async function handler(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const receivedItemCount = sqsEvent.Records.length;
    const batchItemFailures: SQSBatchItemFailure[] = [];
    const validatedRecords: ValidatedRecord[] = [];
    const validEvents: (PDFAnalysed | InvalidAttachmentReceived)[] = [];

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
          const pdfBuffer = await getS3ObjectBufferFromUri(
            event.data.letterUri,
          );

          try {
            const pdfInfo = await analysePdf(pdfBuffer);
            validEvents.push(generateUpdatedEvent(event, pdfInfo));
          } catch (pdfError: any) {
            const invalidAttachmentEvent =
              generateInvalidAttachmentEvent(event);
            validEvents.push(invalidAttachmentEvent);
            logger.warn({
              err: pdfError,
              messageReference: event.data.messageReference,
              reasonCode: 'DL_CLIV_002',
              description: 'Failed to analyze PDF - invalid attachment format',
            });
          }
        } catch (error: any) {
          logger.warn({
            err: error,
            description: 'Failed processing message',
          });
          batchItemFailures.push({
            itemIdentifier: validatedRecord.messageId,
          });
        }
      }),
    );

    await eventPublisher.sendEvents(validEvents, (event) => {
      if (event.type.includes('pdf.analysed')) {
        return validatePDFAnalysed(event as PDFAnalysed, logger);
      }
      if (event.type.includes('invalid.attachment.received')) {
        return validateInvalidAttachmentReceived(
          event as InvalidAttachmentReceived,
          logger,
        );
      }
      throw new Error(`Unknown event type: ${event.type}`);
    });

    const processedItemCount = receivedItemCount - batchItemFailures.length;
    logger.info(
      `${processedItemCount} of ${receivedItemCount} records processed successfully`,
    );

    return { batchItemFailures };
  };
