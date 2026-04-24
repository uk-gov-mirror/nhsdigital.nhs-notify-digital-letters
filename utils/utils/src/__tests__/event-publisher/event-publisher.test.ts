import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsResultEntry,
} from '@aws-sdk/client-eventbridge';
import { randomInt, randomUUID } from 'node:crypto';
import { mockClient } from 'aws-sdk-client-mock';
import { Logger } from 'logger';
import { EventPublisher, EventPublisherDependencies } from 'event-publisher';
import { MetricHandler } from 'cloudwatch/metric-handler';

const eventBridgeMock = mockClient(EventBridgeClient);
const sqsMock = mockClient(SQSClient);
const metricHandlerMock: MetricHandler = {
  addMetrics: jest.fn(),
  getChildMetricHandler: jest.fn(),
} as unknown as MetricHandler;

const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as any;

type TestEvent = { id: string; source: string; type: string };

const testConfig: EventPublisherDependencies = {
  eventBusArn: 'arn:aws:events:us-east-1:123456789012:event-bus/test-bus',
  dlqUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-dlq',
  logger: mockLogger,
  sqsClient: sqsMock as unknown as SQSClient,
  eventBridgeClient: eventBridgeMock as unknown as EventBridgeClient,
  metricHandler: metricHandlerMock,
};

const event: TestEvent = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  source: '/nhs/england/notify/production/primary/digital-letters',
  type: 'uk.nhs.notify.digital.letters.sent.v1',
};

const event2: TestEvent = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  source: '/nhs/england/notify/development/primary/digital-letters',
  type: 'uk.nhs.notify.digital.letters.sent.v2',
};

const events = [event, event2];

describe('Event Publishing', () => {
  beforeEach(() => {
    eventBridgeMock.reset();
    sqsMock.reset();
    jest.clearAllMocks();
  });

  test('should return empty array when no events provided', async () => {
    const publisher = new EventPublisher(testConfig);
    const result = await publisher.sendEvents([], () => true);

    expect(result).toEqual([]);
    expect(eventBridgeMock.calls()).toHaveLength(0);
    expect(sqsMock.calls()).toHaveLength(0);
    expect(metricHandlerMock.addMetrics).not.toHaveBeenCalled();
  });

  test('should send valid events to EventBridge', async () => {
    eventBridgeMock.on(PutEventsCommand).resolves({
      FailedEntryCount: 0,
      Entries: [{ EventId: 'event-1' }],
    });

    const publisher = new EventPublisher(testConfig);
    const result = await publisher.sendEvents(events, () => true);

    expect(result).toEqual([]);
    expect(eventBridgeMock.calls()).toHaveLength(1);
    expect(sqsMock.calls()).toHaveLength(0);
    expect(metricHandlerMock.addMetrics).toHaveBeenCalledWith(['uk.nhs.notify.digital.letters.sent.v1_batchSuccess', 'Count', 2]);

    const eventBridgeCall = eventBridgeMock.calls()[0];
    expect(eventBridgeCall.args[0].input).toEqual({
      Entries: [
        {
          Source: event.source,
          DetailType: event.type,
          Detail: JSON.stringify(event),
          EventBusName:
            'arn:aws:events:us-east-1:123456789012:event-bus/test-bus',
        },
        {
          Source: event2.source,
          DetailType: event2.type,
          Detail: JSON.stringify(event2),
          EventBusName:
            'arn:aws:events:us-east-1:123456789012:event-bus/test-bus',
        },
      ],
    });
  });

  test('should send invalid events directly to DLQ', async () => {
    sqsMock.on(SendMessageBatchCommand).resolves({
      Successful: [
        { Id: 'msg-1', MessageId: 'success-1', MD5OfMessageBody: 'hash1' },
      ],
    });

    const publisher = new EventPublisher(testConfig);
    const result = await publisher.sendEvents(events, () => {
      throw new Error('Some validation error');
    });

    expect(result).toEqual([]);
    expect(eventBridgeMock.calls()).toHaveLength(0);
    expect(sqsMock.calls()).toHaveLength(1);

    const sqsCall = sqsMock.calls()[0];
    const sqsInput = sqsCall.args[0].input as any;
    expect(sqsInput.QueueUrl).toBe(
      'https://sqs.us-east-1.amazonaws.com/123456789012/test-dlq',
    );
    expect(sqsInput.Entries).toHaveLength(2);
    expect(sqsInput.Entries[0].MessageBody).toBe(JSON.stringify(events[0]));
    expect(sqsInput.Entries[0].Id).toBeDefined();
    expect(sqsInput.Entries[1].MessageBody).toBe(JSON.stringify(events[1]));
    expect(sqsInput.Entries[1].Id).toBeDefined();
  });

  test('should send failed EventBridge events to DLQ', async () => {
    eventBridgeMock.on(PutEventsCommand).resolves({
      FailedEntryCount: 1,
      Entries: [
        { ErrorCode: 'InternalFailure', ErrorMessage: 'Internal error' },
        { EventId: 'event-2' },
      ],
    });
    sqsMock.on(SendMessageBatchCommand).resolves({
      Successful: [
        { Id: 'msg-1', MessageId: 'success-1', MD5OfMessageBody: 'hash1' },
      ],
    });

    const publisher = new EventPublisher(testConfig);
    const result = await publisher.sendEvents(events, () => true);

    expect(result).toEqual([]);
    expect(eventBridgeMock.calls()).toHaveLength(1);
    expect(sqsMock.calls()).toHaveLength(1);

    // Verify EventBridge was called with both events
    const eventBridgeCall = eventBridgeMock.calls()[0];
    const eventBridgeInput = eventBridgeCall.args[0].input as any;
    expect(eventBridgeInput.Entries).toHaveLength(2);

    // Verify DLQ gets the failed event (first one)
    const sqsCall = sqsMock.calls()[0];
    const sqsInput = sqsCall.args[0].input as any;
    expect(sqsInput.Entries).toHaveLength(1);
    expect(sqsInput.Entries[0].MessageBody).toBe(JSON.stringify(event));
    expect(metricHandlerMock.addMetrics).toHaveBeenNthCalledWith(1,['uk.nhs.notify.digital.letters.sent.v1_batchSuccess', 'Count', 1]);
    expect(metricHandlerMock.addMetrics).toHaveBeenNthCalledWith(2,['uk.nhs.notify.digital.letters.sent.v1_batchFailure', 'Count', 1]);
  });

  test('should handle EventBridge send error and send all events to DLQ', async () => {
    eventBridgeMock
      .on(PutEventsCommand)
      .rejects(new Error('EventBridge error'));
    sqsMock.on(SendMessageBatchCommand).resolves({
      Successful: [
        { Id: 'msg-1', MessageId: 'success-1', MD5OfMessageBody: 'hash1' },
      ],
    });

    const publisher = new EventPublisher(testConfig);
    const result = await publisher.sendEvents(events, () => true);

    expect(result).toEqual([]);
    expect(eventBridgeMock.calls()).toHaveLength(1);
    expect(sqsMock.calls()).toHaveLength(1);
  });

  test('should return failed events when DLQ also fails', async () => {
    sqsMock.on(SendMessageBatchCommand).callsFake((params) => {
      const firstEntryId = params.Entries[0].Id;
      return Promise.resolve({
        Failed: [
          {
            Id: firstEntryId,
            Code: 'SenderFault',
            Message: 'Invalid message',
            SenderFault: true,
          },
        ],
      });
    });

    const publisher = new EventPublisher(testConfig);
    const result = await publisher.sendEvents(events, () => {
      throw new Error('Some validation error');
    });

    expect(result).toEqual([event]);
    expect(eventBridgeMock.calls()).toHaveLength(0);
    expect(sqsMock.calls()).toHaveLength(1);
  });

  test('should handle DLQ send error and return all events as failed', async () => {
    sqsMock.on(SendMessageBatchCommand).rejects(new Error('DLQ error'));

    const publisher = new EventPublisher(testConfig);
    const result = await publisher.sendEvents(events, () => {
      throw new Error('Some validation error');
    });

    expect(result).toEqual(events);
    expect(eventBridgeMock.calls()).toHaveLength(0);
    expect(sqsMock.calls()).toHaveLength(1);
  });

  test('should send to event bridge in batches', async () => {
    const largeEventArray = Array.from({ length: 25 })
      .fill(null)
      .map(() => ({
        ...event,
        id: randomUUID(),
      }));

    eventBridgeMock.on(PutEventsCommand).resolves({
      FailedEntryCount: 0,
      Entries: [{ EventId: 'success' }],
    });

    const publisher = new EventPublisher(testConfig);
    const result = await publisher.sendEvents(largeEventArray, () => true);

    expect(result).toEqual([]);
    expect(eventBridgeMock.calls()).toHaveLength(3);

    // Verify batch sizes: 10, 10, 5
    const calls = eventBridgeMock.calls();
    const firstBatchInput = calls[0].args[0].input as any;
    const secondBatchInput = calls[1].args[0].input as any;
    const thirdBatchInput = calls[2].args[0].input as any;

    expect(firstBatchInput.Entries).toHaveLength(10);
    expect(secondBatchInput.Entries).toHaveLength(10);
    expect(thirdBatchInput.Entries).toHaveLength(5);
  });

  test('should send to the DLQ in batches', async () => {
    const largeEventArray = Array.from({ length: 25 })
      .fill(null)
      .map(() => ({
        ...event,
        id: randomUUID(),
      }));

    const publisher = new EventPublisher(testConfig);
    const result = await publisher.sendEvents(largeEventArray, () => false);

    expect(result).toEqual(largeEventArray);
    expect(sqsMock.calls()).toHaveLength(3);

    // Verify batch sizes: 10, 10, 5
    const calls = sqsMock.calls();
    const firstBatchInput = calls[0].args[0].input as any;
    const secondBatchInput = calls[1].args[0].input as any;
    const thirdBatchInput = calls[2].args[0].input as any;

    expect(firstBatchInput.Entries).toHaveLength(10);
    expect(secondBatchInput.Entries).toHaveLength(10);
    expect(thirdBatchInput.Entries).toHaveLength(5);
  });

  test('should handle multiple event outcomes in one batch', async () => {
    const valid = Array.from({ length: 11 }, (_, i) => ({
      ...event,
      id: `11111111-1111-1111-1111-${i.toString().padStart(12, '0')}`,
    }));

    const invalid = Array.from({ length: 12 }, (_, i) => ({
      ...event,
      id: `22222222-2222-2222-2222-${i.toString().padStart(12, '0')}`,
    }));

    const invalidAndDlqError = Array.from({ length: 13 }, (_, i) => ({
      ...event,
      id: `33333333-3333-3333-3333-${i.toString().padStart(12, '0')}`,
    }));

    const eventBridgeError = Array.from({ length: 14 }, (_, i) => ({
      ...event,
      id: `44444444-4444-4444-4444-${i.toString().padStart(12, '0')}`,
    }));

    const eventBridgeAndDlqError = Array.from({ length: 15 }, (_, i) => ({
      ...event,
      id: `55555555-5555-5555-5555-${i.toString().padStart(12, '0')}`,
    }));

    // Combine all events and shuffle them
    const allEvents = [
      ...valid,
      ...invalid,
      ...invalidAndDlqError,
      ...eventBridgeError,
      ...eventBridgeAndDlqError,
    ].toSorted(() => randomInt(0, 3) - 1);

    sqsMock.on(SendMessageBatchCommand).resolves({
      Successful: [
        { Id: 'msg-1', MessageId: 'success-1', MD5OfMessageBody: 'hash1' },
      ],
    });

    sqsMock.on(SendMessageBatchCommand).callsFake((input) => {
      const successful: any[] = [];
      const failed: any[] = [];

      for (const entry of input.Entries) {
        if (
          entry.MessageBody?.includes('33333333-3333-3333-3333') ||
          entry.MessageBody?.includes('55555555-5555-5555-5555')
        ) {
          failed.push({
            Id: entry.Id,
            Code: 'SenderFault',
            Message: 'Invalid message',
            SenderFault: true,
          });
        } else {
          successful.push({
            Id: entry.Id,
            MessageId: `success-${entry.Id}`,
            MD5OfMessageBody: 'hash',
          });
        }
      }

      return Promise.resolve({
        Successful: successful,
        Failed: failed,
      });
    });

    eventBridgeMock.on(PutEventsCommand).callsFake((input) => {
      let failedEntryCount = 0;
      const entries: PutEventsResultEntry[] = [];

      for (const [index, entry] of input.Entries.entries()) {
        const eventData = JSON.parse(entry.Detail || '{}');
        if (
          eventData.id?.includes('44444444-4444-4444-4444') ||
          eventData.id?.includes('55555555-5555-5555-5555')
        ) {
          failedEntryCount += 1;
          entries.push({
            ErrorCode: 'SenderFault',
            ErrorMessage: 'Invalid message',
          });
        } else {
          entries.push({
            EventId: `event-${index}`,
          });
        }
      }

      return Promise.resolve({
        FailedEntryCount: failedEntryCount,
        Entries: entries,
      });
    });

    const publisher = new EventPublisher(testConfig);
    const result = await publisher.sendEvents(allEvents, (e) => {
      if (
        e.id.includes('22222222-2222-2222-2222') ||
        e.id.includes('33333333-3333-3333-3333')
      ) {
        throw new Error('Some validation error');
      }
    });

    expect(result).toHaveLength(
      invalidAndDlqError.length + eventBridgeAndDlqError.length,
    );
    expect(result).toEqual(
      expect.arrayContaining([
        ...invalidAndDlqError,
        ...eventBridgeAndDlqError,
      ]),
    );

    const sqsMockEntries = [];

    for (const call of sqsMock.calls()) {
      const batch = call.args[0].input as any;
      sqsMockEntries.push(...batch.Entries);
    }

    expect(sqsMockEntries).toHaveLength(
      invalidAndDlqError.length +
        invalid.length +
        eventBridgeError.length +
        eventBridgeAndDlqError.length,
    );

    // Verify invalid events are are sent to the DLQ with correct reason
    expect(sqsMockEntries).toEqual(
      expect.arrayContaining(
        [...invalid, ...invalidAndDlqError].map((e) =>
          expect.objectContaining({
            MessageBody: JSON.stringify(e),
            MessageAttributes: {
              DlqReason: {
                DataType: 'String',
                StringValue: 'INVALID_EVENT',
              },
            },
          }),
        ),
      ),
    );

    // Verify EventBridge failure events are sent to the DLQ with correct reason
    expect(sqsMockEntries).toEqual(
      expect.arrayContaining(
        [...eventBridgeError, ...eventBridgeAndDlqError].map((e) =>
          expect.objectContaining({
            MessageBody: JSON.stringify(e),
            MessageAttributes: {
              DlqReason: {
                DataType: 'String',
                StringValue: 'EVENTBRIDGE_FAILURE',
              },
            },
          }),
        ),
      ),
    );

    const eventBridgeMockEntries = [];

    for (const call of eventBridgeMock.calls()) {
      const batch = call.args[0].input as any;
      eventBridgeMockEntries.push(...batch.Entries);
    }

    expect(eventBridgeMockEntries).toHaveLength(
      valid.length + eventBridgeError.length + eventBridgeAndDlqError.length,
    );

    // Verify valid events are sent to the event bridge
    expect(eventBridgeMockEntries).toEqual(
      expect.arrayContaining(
        [...valid, ...eventBridgeError, ...eventBridgeAndDlqError].map((e) =>
          expect.objectContaining({
            Detail: JSON.stringify(e),
          }),
        ),
      ),
    );

    expect(metricHandlerMock.addMetrics).toHaveBeenCalled();
  });
});

describe('EventPublisher Class', () => {
  beforeEach(() => {
    eventBridgeMock.reset();
    sqsMock.reset();
    jest.clearAllMocks();
  });

  test('should throw error when eventBusArn is missing from config', () => {
    expect(
      () => new EventPublisher({ ...testConfig, eventBusArn: '' }),
    ).toThrow('eventBusArn has not been specified');
  });

  test('should throw error when dlqUrl is missing from config', () => {
    expect(() => new EventPublisher({ ...testConfig, dlqUrl: '' })).toThrow(
      'dlqUrl has not been specified',
    );
  });

  test('should throw error when logger is missing from config', () => {
    expect(
      () => new EventPublisher({ ...testConfig, logger: null as any }),
    ).toThrow('logger has not been provided');
  });

  test('should throw error when sqsClient is missing from config', () => {
    expect(
      () => new EventPublisher({ ...testConfig, sqsClient: null as any }),
    ).toThrow('sqsClient has not been provided');
  });

  test('should throw error when eventBridgeClient is missing from config', () => {
    expect(
      () =>
        new EventPublisher({ ...testConfig, eventBridgeClient: null as any }),
    ).toThrow('eventBridgeClient has not been provided');
  });

  test('should be reusable for multiple calls', async () => {
    eventBridgeMock.on(PutEventsCommand).resolves({
      FailedEntryCount: 0,
      Entries: [{ EventId: 'event-1' }],
    });

    const publisher = new EventPublisher(testConfig);

    // First call
    const result1 = await publisher.sendEvents([event], () => true);
    expect(result1).toEqual([]);

    // Second call with same publisher instance
    const result2 = await publisher.sendEvents([event2], () => true);
    expect(result2).toEqual([]);

    expect(eventBridgeMock.calls()).toHaveLength(2);
  });
});
