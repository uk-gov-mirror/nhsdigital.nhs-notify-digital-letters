import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsResultEntry,
} from '@aws-sdk/client-eventbridge';
import { PublishableEvent } from 'destinations/destination-client';
import { mock } from 'jest-mock-extended';
import {
  EventBusDestinationClient,
  sendEventsToEventBus,
} from 'destinations/send-events-to-event-bus';

const environment = 'dev';

const sampleEvent = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  source: '/data-plane/supplier-api/dev/update-status',
  type: 'uk.nhs.notify.supplier-api.letter.ACCEPTED.v1',
  time: '2023-06-20T12:00:00.000Z',
};

// Factory no longer references any outer variable
jest.mock('@aws-sdk/client-eventbridge', () => {
  const originalModule = jest.requireActual('@aws-sdk/client-eventbridge');
  return {
    __esModule: true,
    ...originalModule,
    EventBridgeClient: jest.fn(),
  };
});

const mockSend = jest.fn();

const successEntry = mock<PutEventsResultEntry>({ ErrorCode: undefined });
const successfulSendResponse = { Entries: [successEntry] };

describe('sendEventsToEventBus', () => {
  beforeEach(() => {
    mockSend.mockReset();
    // Wire up the mock implementation here, after all declarations are initialised
    jest
      .mocked(EventBridgeClient)
      .mockImplementation(
        () => ({ send: mockSend }) as unknown as EventBridgeClient,
      );
  });

  it('should send the expected request to EventBridge', async () => {
    mockSend.mockResolvedValue(successfulSendResponse);

    await sendEventsToEventBus(environment, [sampleEvent], 5);

    expect(mockSend).toHaveBeenCalled();
    const putEventsCommand: PutEventsCommand = mockSend.mock.calls[0][0];

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
    mockSend.mockResolvedValue(successfulSendResponse);

    await sendEventsToEventBus(environment, events, 5);

    // Batch size is 10, so 52 events = 6 batches.
    expect(mockSend).toHaveBeenCalledTimes(6);
  });

  it('should continue sending batches if an error is raised', async () => {
    mockSend.mockRejectedValueOnce(new Error('Something went wrong!'));
    mockSend.mockResolvedValue(successfulSendResponse);

    const events: PublishableEvent[] = Array.from(
      { length: 30 },
      () => sampleEvent,
    );

    await sendEventsToEventBus(environment, events, 5);

    // Batch size is 10, so 30 events = 3 batches.
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('should warn when some events fail to publish', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failedEntry = mock<PutEventsResultEntry>({
      ErrorCode: 'InternalFailure',
    });
    mockSend.mockResolvedValue({
      Entries: [failedEntry],
    });

    await sendEventsToEventBus(environment, [sampleEvent], 5);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('EventBusDestinationClient', () => {
  beforeEach(() => {
    mockSend.mockReset();
    jest
      .mocked(EventBridgeClient)
      .mockImplementation(
        () => ({ send: mockSend }) as unknown as EventBridgeClient,
      );
  });

  it('should delegate sendEvents to sendEventsToEventBus', async () => {
    mockSend.mockResolvedValue(successfulSendResponse);

    const client = new EventBusDestinationClient(environment);
    await client.sendEvents([sampleEvent], 5);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const putEventsCommand: PutEventsCommand = mockSend.mock.calls[0][0];
    const entry = putEventsCommand.input.Entries![0];
    expect(entry.EventBusName).toBe(`nhs-${environment}-dl`);
  });
});
