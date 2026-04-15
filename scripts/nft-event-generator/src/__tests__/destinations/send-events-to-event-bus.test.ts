import {
  PutEventsCommand,
  PutEventsResultEntry,
} from '@aws-sdk/client-eventbridge';
import { PublishableEvent } from 'destinations/destination-client';
import { mock } from 'jest-mock-extended';
import { sendEventsToEventBus } from 'destinations/send-events-to-event-bus';
/* eslint-disable no-console */
const environment = 'dev';

const sampleEvent = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  source: '/data-plane/supplier-api/dev/update-status',
  type: 'uk.nhs.notify.supplier-api.letter.ACCEPTED.v1',
  time: '2023-06-20T12:00:00.000Z',
};

const mockEventBridgeClient = { send: jest.fn() };
jest.mock('@aws-sdk/client-eventbridge', () => {
  const originalModule = jest.requireActual('@aws-sdk/client-eventbridge');

  return {
    __esModule: true,
    ...originalModule,
    EventBridgeClient: jest.fn(() => mockEventBridgeClient),
  };
});

const successEntry = mock<PutEventsResultEntry>({ ErrorCode: undefined });
const successfulSendResponse = { Entries: [successEntry] };

describe('sendEventsToEventBus', () => {
  beforeEach(() => {
    mockEventBridgeClient.send.mockReset();
  });

  it('should send the expected request to EventBridge', async () => {
    mockEventBridgeClient.send.mockResolvedValue(successfulSendResponse);

    await sendEventsToEventBus(environment, [sampleEvent], 5);

    expect(mockEventBridgeClient.send).toHaveBeenCalled();
    const putEventsCommand: PutEventsCommand =
      mockEventBridgeClient.send.mock.calls[0][0];

    expect(putEventsCommand.input.Entries).toHaveLength(1);
    const entry = putEventsCommand.input.Entries![0];
    expect(entry.EventBusName).toBe(`nhs-${environment}-dl`);
    expect(entry.Source).toBe(sampleEvent.source);
    expect(entry.DetailType).toBe(sampleEvent.type);
    expect(entry.Detail).toBe(JSON.stringify(sampleEvent));
  });

  it('should send a request for each batch of messages', async () => {
    const events: PublishableEvent[] = Array.from(
      { length: 52 },
      () => sampleEvent,
    );
    mockEventBridgeClient.send.mockResolvedValue(successfulSendResponse);

    await sendEventsToEventBus(environment, events, 5);

    // Batch size is 10, so 52 events = 6 batches.
    expect(mockEventBridgeClient.send).toHaveBeenCalledTimes(6);
  });

  it('should continue sending batches if an error is raised', async () => {
    mockEventBridgeClient.send.mockRejectedValueOnce(
      new Error('Something went wrong!'),
    );
    mockEventBridgeClient.send.mockResolvedValue(successfulSendResponse);

    const events: PublishableEvent[] = Array.from(
      { length: 30 },
      () => sampleEvent,
    );

    await sendEventsToEventBus(environment, events, 5);

    // Batch size is 10, so 30 events = 3 batches.
    expect(mockEventBridgeClient.send).toHaveBeenCalledTimes(3);
  });

  it('should warn when some events fail to publish', async () => {
    const failedEntry = mock<PutEventsResultEntry>({
      ErrorCode: 'InternalFailure',
    });
    mockEventBridgeClient.send.mockResolvedValue({
      Entries: [failedEntry],
    });

    await sendEventsToEventBus(environment, [sampleEvent], 5);

    expect(console.warn).toHaveBeenCalled();
  });
});
