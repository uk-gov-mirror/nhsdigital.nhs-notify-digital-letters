import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { mock } from 'jest-mock-extended';
import { EventPublisher, Logger, Sender } from 'utils';
import { NotifyMessageProcessor } from 'app/notify-message-processor';
import { ISenderManagement } from 'sender-management';
import { SqsHandlerDependencies, createHandler } from 'apis/sqs-handler';
import { parseSqsRecord } from 'app/parse-sqs-message';
import { RequestNotifyError } from 'domain/request-notify-error';
import { validPdmEvent, validSender } from '__tests__/constants';
import {
  InvalidEvent,
  MessageRequestRejected,
  MessageRequestSkipped,
  MessageRequestSubmitted,
} from 'digital-letters-events';
import { CoreRequestMapper } from 'domain/core-request-mapper';
import { MessageRequestRejectedMapper } from 'domain/message-request-rejected-mapper';
import { MessageRequestSubmittedMapper } from 'domain/message-request-submitted-mapper';

jest.mock('app/parse-sqs-message');

const mockLogger = mock<Logger>();
const mockNotifyMessageProcessor = mock<NotifyMessageProcessor>();
const mockSenderManagement = mock<ISenderManagement>();
const mockEventPublisher = mock<EventPublisher>();
const mockParseSqsRecord = jest.mocked(parseSqsRecord);
const mockCoreRequestMapper = mock<CoreRequestMapper>();
const mockMessageRequestSubmittedMapper = mock<MessageRequestSubmittedMapper>();
const mockMessageRequestRejectedMapper = mock<MessageRequestRejectedMapper>();

const createSqsRecord = (messageId: string): SQSRecord => ({
  messageId,
  receiptHandle: 'receipt-handle',
  body: JSON.stringify({
    detail: validPdmEvent,
  }),
  attributes: {
    ApproximateReceiveCount: '1',
    SentTimestamp: '1234567890',
    SenderId: 'sender-id',
    ApproximateFirstReceiveTimestamp: '1234567890',
  },
  messageAttributes: {},
  md5OfBody: 'md5',
  eventSource: 'aws:sqs',
  eventSourceARN: 'arn:aws:sqs:region:account:queue',
  awsRegion: 'eu-west-2',
});

const createSqsEvent = (recordCount: number): SQSEvent => ({
  Records: Array.from({ length: recordCount }, (_, i) =>
    createSqsRecord(`message-id-${i + 1}`),
  ),
});

describe('createHandler', () => {
  const dependencies: SqsHandlerDependencies = {
    logger: mockLogger,
    notifyMessageProcessor: mockNotifyMessageProcessor,
    senderManagement: mockSenderManagement,
    eventPublisher: mockEventPublisher,
    coreRequestMapper: mockCoreRequestMapper,
    messageRequestSubmittedMapper: mockMessageRequestSubmittedMapper,
    messageRequestRejectedMapper: mockMessageRequestRejectedMapper,
  };

  const senderId = 'sender-123';
  const messageReference = 'msg-ref-123';
  const notifyId = 'notify-id-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when processing a single successful SQS record', () => {
    it('processes the message and returns no batch item failures', async () => {
      const sqsEvent = createSqsEvent(1);
      const handler = createHandler(dependencies);

      mockParseSqsRecord.mockReturnValueOnce(validPdmEvent);
      mockSenderManagement.getSender.mockResolvedValue(validSender);
      mockNotifyMessageProcessor.process.mockResolvedValueOnce(notifyId);
      mockMessageRequestSubmittedMapper.mapPdmEventToMessageRequestSubmitted.mockReturnValueOnce(
        {} as MessageRequestSubmitted,
      );

      const result = await handler(sqsEvent);

      expect(result).toEqual({ batchItemFailures: [] });
      expect(mockLogger.info).toHaveBeenCalledWith({
        description: 'Received SQS Event of 1 record(s)',
      });
      expect(mockLogger.info).toHaveBeenCalledWith({
        description: '1 of 1 records processed successfully',
      });
      expect(mockParseSqsRecord).toHaveBeenCalledWith(
        sqsEvent.Records[0],
        mockLogger,
      );
      expect(mockSenderManagement.getSender).toHaveBeenCalledWith({
        senderId,
      });
      expect(mockNotifyMessageProcessor.process).toHaveBeenCalledTimes(1);
      expect(
        mockEventPublisher.sendEvents<MessageRequestSubmitted>,
      ).toHaveBeenCalledTimes(1);
    });

    it('skips the message and publishes a skipped event', async () => {
      const sqsEvent = createSqsEvent(1);
      const handler = createHandler(dependencies);
      const senderWithoutRouting: Sender = {
        ...validSender,
        routingConfigId: undefined,
      };

      mockParseSqsRecord.mockReturnValueOnce(validPdmEvent);
      mockSenderManagement.getSender.mockResolvedValue(senderWithoutRouting);

      const result = await handler(sqsEvent);

      expect(result).toEqual({ batchItemFailures: [] });
      expect(mockNotifyMessageProcessor.process).not.toHaveBeenCalled();
      expect(
        mockEventPublisher.sendEvents<MessageRequestSkipped>,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockEventPublisher.sendEvents<MessageRequestSkipped>,
      ).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              senderId: validSender.senderId,
            }),
          }),
        ]),
        expect.any(Function),
      );
    });

    it('throws an error when sender is not found', async () => {
      const sqsEvent = createSqsEvent(1);
      const handler = createHandler(dependencies);

      mockParseSqsRecord.mockReturnValueOnce(validPdmEvent);
      mockSenderManagement.getSender.mockResolvedValue(null);

      const result = await handler(sqsEvent);

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: sqsEvent.Records[0].messageId }],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Failed processing message',
          messageId: sqsEvent.Records[0].messageId,
          senderId: validSender.senderId,
        }),
      );
    });
  });

  describe('when processing multiple SQS records', () => {
    it('processes all records successfully', async () => {
      const sqsEvent = createSqsEvent(3);
      const handler = createHandler(dependencies);

      mockParseSqsRecord.mockReturnValue(validPdmEvent);
      mockSenderManagement.getSender.mockResolvedValue(validSender);
      mockNotifyMessageProcessor.process.mockResolvedValue(notifyId);

      const result = await handler(sqsEvent);

      expect(result).toEqual({ batchItemFailures: [] });
      expect(mockLogger.info).toHaveBeenCalledWith({
        description: 'Received SQS Event of 3 record(s)',
      });
      expect(mockLogger.info).toHaveBeenCalledWith({
        description: '3 of 3 records processed successfully',
      });
      expect(mockParseSqsRecord).toHaveBeenCalledTimes(3);
      expect(mockNotifyMessageProcessor.process).toHaveBeenCalledTimes(3);
    });

    it('returns only failed message IDs', async () => {
      const sqsEvent = createSqsEvent(3);
      const handler = createHandler(dependencies);

      mockParseSqsRecord
        .mockReturnValueOnce(validPdmEvent)
        .mockImplementationOnce(() => {
          throw new Error('Parse error');
        })
        .mockReturnValueOnce(validPdmEvent);

      mockSenderManagement.getSender.mockResolvedValue(validSender);
      mockNotifyMessageProcessor.process.mockResolvedValue(notifyId);

      const result = await handler(sqsEvent);

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: 'message-id-2' }],
      });
      expect(mockLogger.info).toHaveBeenCalledWith({
        description: '2 of 3 records processed successfully',
      });
    });
  });

  describe('when parseSqsRecord throws InvalidEvent', () => {
    it('marks the message as failed for retry', async () => {
      const sqsEvent = createSqsEvent(1);
      const handler = createHandler(dependencies);
      const { messageId } = sqsEvent.Records[0];

      mockParseSqsRecord.mockImplementationOnce(() => {
        throw new InvalidEvent('Some validation errors');
      });

      const result = await handler(sqsEvent);

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: messageId }],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith({
        error: 'Unable to parse event',
        description: 'Failed processing message',
        messageId,
        senderId: undefined,
      });
      expect(mockLogger.info).toHaveBeenCalledWith({
        description: '0 of 1 records processed successfully',
      });
    });
  });

  describe('when processing throws error', () => {
    it('marks the message as failed as is not a RequestNotifyError', async () => {
      const sqsEvent = createSqsEvent(1);
      const handler = createHandler(dependencies);
      const { messageId } = sqsEvent.Records[0];
      const error = new Error('Validation failed');

      mockParseSqsRecord.mockReturnValueOnce(validPdmEvent);
      mockSenderManagement.getSender.mockResolvedValue(validSender);
      mockNotifyMessageProcessor.process.mockRejectedValueOnce(error);

      const result = await handler(sqsEvent);

      // Since RequestNotifyError doesn't have messageReference property,
      // it falls through to the else branch and is treated as a transient error
      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: messageId }],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith({
        error: error.message,
        description: 'Failed processing message',
        messageId,
        senderId: validSender.senderId,
      });
      expect(
        mockEventPublisher.sendEvents<MessageRequestRejected>,
      ).not.toHaveBeenCalled();
    });

    it('publishes rejected event when error has messageReference property', async () => {
      const sqsEvent = createSqsEvent(1);
      const handler = createHandler(dependencies);
      const { messageId } = sqsEvent.Records[0];
      const errorCode = 'VALIDATION_ERROR';
      const failureReason = 'Request validation failed';
      const correlationId = 'corr-123';
      const error = new RequestNotifyError(
        new Error('Validation failed'),
        correlationId,
        errorCode,
        failureReason,
      );
      // Add messageReference property dynamically to trigger the terminal error path
      (error as any).messageReference = messageReference;

      mockParseSqsRecord.mockReturnValueOnce(validPdmEvent);
      mockSenderManagement.getSender.mockResolvedValue(validSender);
      mockNotifyMessageProcessor.process.mockRejectedValueOnce(error);
      mockMessageRequestRejectedMapper.mapPdmEventToMessageRequestRejected.mockReturnValueOnce(
        {
          data: {
            senderId,
            messageReference,
            failureCode: errorCode,
          },
        } as MessageRequestRejected,
      );

      const result = await handler(sqsEvent);

      // With messageReference property, it's treated as terminal error and not retried
      expect(result).toEqual({ batchItemFailures: [] });
      expect(mockLogger.warn).toHaveBeenCalledWith({
        error: error.message,
        description: 'Failed processing message',
        messageId,
        senderId: validSender.senderId,
      });
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              senderId,
              messageReference,
              failureCode: errorCode,
            }),
          }),
        ]),
        expect.any(Function),
      );
    });
  });
});
