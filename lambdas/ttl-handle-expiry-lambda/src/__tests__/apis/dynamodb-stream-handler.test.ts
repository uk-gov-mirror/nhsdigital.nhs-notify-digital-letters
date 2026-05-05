import type { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import { EventPublisher, Logger } from 'utils';
import { mock } from 'jest-mock-extended';
import { createHandler } from 'apis/dynamodb-stream-handler';
import { Dlq } from 'app/dlq';
import { validateItemDequeued } from 'digital-letters-events';

const logger = mock<Logger>();
const eventPublisher = mock<EventPublisher>();
const dlq = mock<Dlq>();
const futureTimestamp = Date.now() + 1_000_000;

const mockEvent: DynamoDBStreamEvent = {
  Records: [
    {
      eventID: 'test-event-1',
      eventName: 'REMOVE',
      eventVersion: '1.1',
      eventSource: 'aws:dynamodb',
      awsRegion: 'us-east-1',
      dynamodb: {
        ApproximateCreationDateTime: 1_234_567_890,
        Keys: {
          PK: { S: 'sender1_ref1' },
          SK: { S: 'METADATA' },
        },
        OldImage: {
          PK: { S: 'sender1_ref1' },
          SK: { S: 'METADATA' },
          dateOfExpiry: { S: 'dateOfExpiry' },
          event: {
            M: {
              id: { S: '550e8400-e29b-41d4-a716-446655440001' },
              specversion: { S: '1.0' },
              source: {
                S: '/nhs/england/notify/production/primary/digitalletters/mesh',
              },
              subject: {
                S: 'customer/920fca11-596a-4eca-9c47-99f624614658/recipient/769acdd4-6a47-496f-999f-76a6fd2c3959',
              },
              plane: { S: 'data' },
              dataschemaversion: { S: '1.0.0' },
              type: {
                S: 'uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1',
              },
              time: { S: '2023-06-20T12:00:00Z' },
              recordedtime: { S: '2023-06-20T12:00:00.250Z' },
              severitynumber: { N: '2' },
              traceparent: {
                S: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
              },
              datacontenttype: { S: 'application/json' },
              dataschema: {
                S: 'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-mesh-inbox-message-downloaded-data.schema.json',
              },
              severitytext: { S: 'INFO' },
              data: {
                M: {
                  meshMessageId: { S: '12345' },
                  messageUri: { S: 'https://example.com/ttl/resource' },
                  messageReference: { S: 'ref1' },
                  senderId: { S: 'sender1' },
                },
              },
            },
          },
          ttl: { N: futureTimestamp.toString() },
        },
        SequenceNumber: '123456789',
        SizeBytes: 100,
        StreamViewType: 'OLD_IMAGE',
      },
    },
  ] as DynamoDBRecord[],
};

describe('createHandler', () => {
  const handler = createHandler({
    dlq,
    eventPublisher,
    logger,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dlq.send.mockResolvedValue([]);
  });

  it('should process DynamoDB stream event with valid TTL expired records (withdrawn=undefined)', async () => {
    const result = await handler(mockEvent);

    expect(logger.info).toHaveBeenCalledWith({
      description: 'DynamoDB event received',
      event: mockEvent,
    });

    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processing DynamoDB event record',
      record: mockEvent.Records[0],
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Finished processing DynamoDB event',
      expect.objectContaining({}),
    );

    expect(eventPublisher.sendEvents).toHaveBeenCalledTimes(1);

    expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          specversion: '1.0',
          source: '/nhs/england/notify/production/primary/digitalletters/queue',
          subject:
            'customer/920fca11-596a-4eca-9c47-99f624614658/recipient/769acdd4-6a47-496f-999f-76a6fd2c3959',
          type: 'uk.nhs.notify.digital.letters.queue.item.dequeued.v1',
          datacontenttype: 'application/json',
          dataschema:
            'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-queue-item-dequeued-data.schema.json',
          data: expect.objectContaining({
            messageReference: 'ref1',
            messageUri: 'https://example.com/ttl/resource',
            senderId: 'sender1',
          }),
        }),
      ],
      validateItemDequeued,
    );

    const publishedEvent = eventPublisher.sendEvents.mock.lastCall?.[0];
    expect(publishedEvent).toHaveLength(1);
    expect(() =>
      validateItemDequeued(publishedEvent?.[0], logger),
    ).not.toThrow();

    expect(result).toEqual({});
  });

  it('should handle non-REMOVE events by skipping them', async () => {
    const mockInsertEvent: DynamoDBStreamEvent = {
      Records: [
        {
          eventID: 'test-event-1',
          eventName: 'INSERT',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          awsRegion: 'us-east-1',
          dynamodb: {
            ApproximateCreationDateTime: 1_234_567_890,
            SequenceNumber: '123456789',
            SizeBytes: 100,
            StreamViewType: 'NEW_IMAGE',
          },
        },
      ] as DynamoDBRecord[],
    };

    const result = await handler(mockInsertEvent);

    expect(logger.error).toHaveBeenCalledWith({
      description: 'Non-REMOVE event or missing OldImage',
      record: mockInsertEvent.Records[0],
    });

    expect(eventPublisher.sendEvents).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should handle records without OldImage by skipping them', async () => {
    const mockNoOldImageEvent: DynamoDBStreamEvent = {
      Records: [
        {
          eventID: 'test-event-1',
          eventName: 'REMOVE',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          awsRegion: 'us-east-1',
          dynamodb: {
            ApproximateCreationDateTime: 1_234_567_890,
            Keys: {
              PK: { S: 'https://example.com/ttl/resource' },
            },
            SequenceNumber: '123456789',
            SizeBytes: 100,
            StreamViewType: 'KEYS_ONLY',
          },
        },
      ] as DynamoDBRecord[],
    };

    const result = await handler(mockNoOldImageEvent);

    expect(logger.error).toHaveBeenCalledWith({
      description: 'Non-REMOVE event or missing OldImage',
      record: mockNoOldImageEvent.Records[0],
    });

    expect(eventPublisher.sendEvents).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should handle ttl dynamodb record parsing errors by sending to DLQ', async () => {
    const mockInvalidEvent: DynamoDBStreamEvent = {
      Records: [
        {
          ...mockEvent.Records[0],
          dynamodb: {
            ...mockEvent.Records[0].dynamodb,
            OldImage: {
              invalidField: { S: 'invalid-data' },
            },
          },
        },
      ],
    };

    const result = await handler(mockInvalidEvent);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Object),
        description: 'Error parsing ttl dynamodb record',
      }),
    );

    expect(dlq.send).toHaveBeenCalledWith([mockInvalidEvent.Records[0]]);
    expect(eventPublisher.sendEvents).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should handle ttl item event parsing errors by sending to DLQ', async () => {
    const mockInvalidEvent: DynamoDBStreamEvent = {
      Records: [
        {
          ...mockEvent.Records[0],
          dynamodb: {
            ...mockEvent.Records[0].dynamodb,
            OldImage: {
              ...mockEvent.Records[0].dynamodb?.OldImage,
              event: {
                M: {
                  invalidField: { S: 'invalid-data' },
                },
              },
            },
          },
        },
      ],
    };

    const result = await handler(mockInvalidEvent);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Object),
        description: 'Error parsing MESHInboxMessageDownloaded event',
      }),
    );

    expect(dlq.send).toHaveBeenCalledWith([mockInvalidEvent.Records[0]]);
    expect(eventPublisher.sendEvents).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should handle empty records array', async () => {
    const mockNoRecordsEvent: DynamoDBStreamEvent = {
      Records: [],
    };

    const result = await handler(mockNoRecordsEvent);

    expect(logger.info).toHaveBeenCalledWith({
      description: 'DynamoDB event received',
      event: mockNoRecordsEvent,
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Finished processing DynamoDB event',
      result,
    );

    expect(eventPublisher.sendEvents).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should handle EventPublisher errors by sending to DLQ', async () => {
    const error = new Error('EventPublisher failed');
    eventPublisher.sendEvents.mockRejectedValueOnce(error);

    const result = await handler(mockEvent);

    expect(logger.warn).toHaveBeenCalledWith({
      err: error,
      description: 'Error processing ttl dynamodb record',
    });

    expect(dlq.send).toHaveBeenCalledWith([mockEvent.Records[0]]);
    expect(result).toEqual({});
  });

  it('should handle DLQ failures by adding to batch failures', async () => {
    const mockInvalidEvent: DynamoDBStreamEvent = {
      Records: [
        {
          eventID: 'test-event-1',
          eventName: 'REMOVE',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          awsRegion: 'us-east-1',
          dynamodb: {
            ApproximateCreationDateTime: 1_234_567_890,
            Keys: {
              id: { S: 'test-id-1' },
            },
            OldImage: {
              invalidField: { S: 'invalid-data' },
            },
            SequenceNumber: '123456789',
            SizeBytes: 100,
            StreamViewType: 'OLD_IMAGE',
          },
        },
      ] as DynamoDBRecord[],
    };

    dlq.send.mockResolvedValueOnce([mockInvalidEvent.Records[0]]);

    const result = await handler(mockInvalidEvent);

    expect(dlq.send).toHaveBeenCalledWith([mockInvalidEvent.Records[0]]);
    expect(result).toEqual({
      batchItemFailures: [{ itemIdentifier: '123456789' }],
    });
  });

  it('should not send event when item is withdrawn (withdrawn=true)', async () => {
    const mockWithdrawnEvent: DynamoDBStreamEvent = {
      ...mockEvent,
      Records: [
        {
          ...mockEvent.Records[0],
          dynamodb: {
            ...mockEvent.Records[0].dynamodb,
            OldImage: {
              ...mockEvent.Records[0].dynamodb!.OldImage,
              withdrawn: { BOOL: true },
            },
          },
        },
      ],
    };

    const result = await handler(mockWithdrawnEvent);

    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processing DynamoDB event record',
      record: mockWithdrawnEvent.Records[0],
    });

    expect(logger.info).toHaveBeenCalledWith({
      description: 'ItemDequeued event not sent as item withdrawn',
      messageReference: 'ref1',
      messageUri: 'https://example.com/ttl/resource',
      senderId: 'sender1',
    });

    expect(eventPublisher.sendEvents).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('should send event when item is not withdrawn (withdrawn=false)', async () => {
    const mockNotWithdrawnEvent: DynamoDBStreamEvent = {
      ...mockEvent,
      Records: [
        {
          ...mockEvent.Records[0],
          dynamodb: {
            ...mockEvent.Records[0].dynamodb,
            OldImage: {
              ...mockEvent.Records[0].dynamodb!.OldImage,
              withdrawn: { BOOL: false },
            },
          },
        },
      ],
    };

    const result = await handler(mockNotWithdrawnEvent);

    expect(eventPublisher.sendEvents).toHaveBeenCalledTimes(1);
    expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: 'uk.nhs.notify.digital.letters.queue.item.dequeued.v1',
          data: expect.objectContaining({
            messageReference: 'ref1',
            messageUri: 'https://example.com/ttl/resource',
            senderId: 'sender1',
          }),
        }),
      ],
      validateItemDequeued,
    );
    expect(result).toEqual({});
  });
});
