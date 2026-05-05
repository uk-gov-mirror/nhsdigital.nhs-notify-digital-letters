import type { SQSRecord } from 'aws-lambda';
import { mock } from 'jest-mock-extended';
import { Logger } from 'utils';
import { parseSqsRecord } from 'app/parse-sqs-message';
import { validPdmEvent } from '__tests__/constants';
import { InvalidEvent } from 'digital-letters-events';

const mockLogger = mock<Logger>();
const mockChildLogger = mock<Logger>();

describe('parseSqsRecord', () => {
  const messageId = 'test-message-id-123';

  const createSqsRecord = (detailContents: any): SQSRecord => ({
    messageId,
    receiptHandle: 'receipt-handle',
    body: JSON.stringify({ detail: detailContents }),
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

  beforeAll(() => {
    mockLogger.child.mockReturnValue(mockChildLogger);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when SQS record contains a valid PDMResourceAvailable event', () => {
    it('parses and returns the PDMResourceAvailable event', () => {
      const sqsRecord = createSqsRecord(validPdmEvent);

      const result = parseSqsRecord(sqsRecord, mockLogger);

      expect(result).toEqual(validPdmEvent);
      expect(mockLogger.child).toHaveBeenCalledWith({ messageId });
      expect(mockChildLogger.info).toHaveBeenCalledWith({
        description: 'Parsing SQS Record',
      });
      expect(mockChildLogger.info).toHaveBeenCalledWith({
        description: 'Parsed valid PDMResourceAvailable Event',
        messageReference: validPdmEvent.data.messageReference,
        senderId: validPdmEvent.data.senderId,
        resourceId: validPdmEvent.data.resourceId,
      });
    });
  });

  describe('when SQS record contains an invalid PDMResourceAvailable event', () => {
    it('logs error and throws InvalidEvent', () => {
      const invalidEvent = { ...validPdmEvent, data: {} };
      const sqsRecord = createSqsRecord(invalidEvent);

      expect(() => parseSqsRecord(sqsRecord, mockLogger)).toThrow(InvalidEvent);
      expect(mockLogger.child).toHaveBeenCalledWith({ messageId });
      expect(mockChildLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error parsing PDMResourceAvailable event',
          err: expect.any(Array),
        }),
      );
    });
  });

  describe('when SQS record body is malformed JSON', () => {
    it('throws a JSON parse error', () => {
      const sqsRecord: SQSRecord = {
        messageId,
        receiptHandle: 'receipt-handle',
        body: 'not valid json{',
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
      };

      expect(() => parseSqsRecord(sqsRecord, mockLogger)).toThrow(SyntaxError);
      expect(mockChildLogger.info).toHaveBeenCalledWith({
        description: 'Parsing SQS Record',
      });
    });
  });
});
