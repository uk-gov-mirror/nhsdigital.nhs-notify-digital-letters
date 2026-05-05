import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
  SQSRecord,
} from 'aws-lambda';
import { EventPublisher, Logger, Sender } from 'utils';
import {
  MessageRequestRejected,
  MessageRequestSkipped,
  MessageRequestSubmitted,
  PDMResourceAvailable,
  validateMessageRequestRejected,
  validateMessageRequestSkipped,
  validateMessageRequestSubmitted,
} from 'digital-letters-events';
import { parseSqsRecord } from 'app/parse-sqs-message';
import type { NotifyMessageProcessor } from 'app/notify-message-processor';
import { ISenderManagement } from 'sender-management';
import { RequestNotifyError } from 'domain/request-notify-error';
import { CoreRequestMapper } from 'domain/core-request-mapper';
import { MessageRequestSubmittedMapper } from 'domain/message-request-submitted-mapper';
import { MessageRequestRejectedMapper } from 'domain/message-request-rejected-mapper';
import { mapPdmEventToMessageRequestSkipped } from 'domain/message-request-skipped-mapper';

export interface SqsHandlerDependencies {
  logger: Logger;
  notifyMessageProcessor: NotifyMessageProcessor;
  senderManagement: ISenderManagement;
  eventPublisher: EventPublisher;
  coreRequestMapper: CoreRequestMapper;
  messageRequestSubmittedMapper: MessageRequestSubmittedMapper;
  messageRequestRejectedMapper: MessageRequestRejectedMapper;
}

type EventToPublish = {
  skipped?: MessageRequestSkipped;
  submitted?: MessageRequestSubmitted;
  rejected?: MessageRequestRejected;
};

type ProcessRecordResult = {
  submitted?: MessageRequestSubmitted;
  skipped?: MessageRequestSkipped;
  rejected?: MessageRequestRejected;
  batchItemFailure?: SQSBatchItemFailure;
};

async function handlePdmResourceAvailable(
  notifyMessageProcessor: NotifyMessageProcessor,
  incoming: PDMResourceAvailable,
  sender: Sender,
  coreRequestMapper: CoreRequestMapper,
  messageRequestSubmittedMapper: MessageRequestSubmittedMapper,
): Promise<EventToPublish> {
  const eventToPublish = {} as EventToPublish;

  if (sender.routingConfigId === undefined) {
    const messageRequestSkipped = mapPdmEventToMessageRequestSkipped(
      incoming,
      sender,
    );
    eventToPublish.skipped = messageRequestSkipped;
  } else {
    const request = coreRequestMapper.mapPdmEventToSingleMessageRequest(
      incoming,
      sender,
    );
    const notifyId = await notifyMessageProcessor.process(
      request,
      incoming.data.senderId,
    );
    const messageRequestSubmitted =
      messageRequestSubmittedMapper.mapPdmEventToMessageRequestSubmitted(
        incoming,
        sender,
        notifyId,
      );
    eventToPublish.submitted = messageRequestSubmitted;
  }

  return eventToPublish;
}

async function processSqsRecord(
  sqsRecord: SQSRecord,
  logger: Logger,
  senderManagement: ISenderManagement,
  notifyMessageProcessor: NotifyMessageProcessor,
  coreRequestMapper: CoreRequestMapper,
  messageRequestSubmittedMapper: MessageRequestSubmittedMapper,
  messageRequestRejectedMapper: MessageRequestRejectedMapper,
): Promise<ProcessRecordResult> {
  const result: ProcessRecordResult = {};

  let incoming: PDMResourceAvailable | undefined;
  let sender: Sender | null = null;

  try {
    incoming = parseSqsRecord(sqsRecord, logger);
    sender = await senderManagement.getSender({
      senderId: incoming.data.senderId,
    });

    if (sender === null) {
      throw new Error(
        `Sender not found for senderId: ${incoming.data.senderId}`,
      );
    }

    const eventToPublish = await handlePdmResourceAvailable(
      notifyMessageProcessor,
      incoming,
      sender,
      coreRequestMapper,
      messageRequestSubmittedMapper,
    );

    if (eventToPublish.submitted) {
      result.submitted = eventToPublish.submitted;
    }
    if (eventToPublish.skipped) {
      result.skipped = eventToPublish.skipped;
    }
  } catch (error: any) {
    logger.warn({
      error: error.message,
      description: 'Failed processing message',
      messageId: sqsRecord.messageId,
      senderId: incoming?.data.senderId,
    });

    if (error instanceof RequestNotifyError && incoming && sender) {
      // CCM-12858 A/C 5: When any other response other than a 201 is returned, don't retry the message
      result.rejected =
        messageRequestRejectedMapper.mapPdmEventToMessageRequestRejected(
          incoming,
          sender,
          error.errorCode,
          error.failureReason,
        );
    } else {
      // this might be a transient error so we notify the queue to retry
      result.batchItemFailure = { itemIdentifier: sqsRecord.messageId };
    }
  }

  return result;
}

export const createHandler = ({
  coreRequestMapper,
  eventPublisher,
  logger,
  messageRequestRejectedMapper,
  messageRequestSubmittedMapper,
  notifyMessageProcessor,
  senderManagement,
}: SqsHandlerDependencies) =>
  async function handler(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const receivedItemCount = sqsEvent.Records.length;

    logger.info({
      description: `Received SQS Event of ${receivedItemCount} record(s)`,
    });

    const batchItemFailures: SQSBatchItemFailure[] = [];
    const skippedEvents: MessageRequestSkipped[] = [];
    const submittedEvents: MessageRequestSubmitted[] = [];
    const rejectedEvents: MessageRequestRejected[] = [];

    const results = await Promise.all(
      sqsEvent.Records.map((sqsRecord) =>
        processSqsRecord(
          sqsRecord,
          logger,
          senderManagement,
          notifyMessageProcessor,
          coreRequestMapper,
          messageRequestSubmittedMapper,
          messageRequestRejectedMapper,
        ),
      ),
    );

    // Aggregate results from all processed records
    for (const result of results) {
      if (result.submitted) {
        submittedEvents.push(result.submitted);
      }
      if (result.skipped) {
        skippedEvents.push(result.skipped);
      }
      if (result.rejected) {
        rejectedEvents.push(result.rejected);
      }
      if (result.batchItemFailure) {
        batchItemFailures.push(result.batchItemFailure);
      }
    }

    await Promise.all(
      [
        submittedEvents.length > 0 &&
          eventPublisher.sendEvents<MessageRequestSubmitted>(
            submittedEvents,
            validateMessageRequestSubmitted,
          ),
        skippedEvents.length > 0 &&
          eventPublisher.sendEvents<MessageRequestSkipped>(
            skippedEvents,
            validateMessageRequestSkipped,
          ),
        rejectedEvents.length > 0 &&
          eventPublisher.sendEvents<MessageRequestRejected>(
            rejectedEvents,
            validateMessageRequestRejected,
          ),
      ].filter(Boolean),
    );

    const processedItemCount = receivedItemCount - batchItemFailures.length;

    logger.info({
      description: `${processedItemCount} of ${receivedItemCount} records processed successfully`,
    });

    return { batchItemFailures };
  };
