import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import {
  DestinationClient,
  PublishableEvent,
} from 'destinations/destination-client';

/* eslint-disable no-console */

/**
 * Internal shape expected from events sent to EventBridge.
 * Matches the CloudEvent structure used by SupplierApiLetterEvent
 * where the event itself is the detail payload.
 */
type CloudEventEnvelope = {
  source: string;
  type: string;
  time: string;
};

function buildEventBusName(environment: string): string {
  return `nhs-${environment}-dl`;
}

function batchEvents(events: PublishableEvent[]): PublishableEvent[][] {
  const batches: PublishableEvent[][] = [];
  for (let i = 0; i < events.length; i += 10) {
    batches.push(events.slice(i, i + 10));
  }
  return batches;
}

// Wait for X milliseconds
function wait(interval: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, interval);
  });
}

export async function sendEventsToEventBus(
  environment: string,
  events: PublishableEvent[],
  interval: number,
) {
  console.group('Event sending (EventBridge):');

  const eventBusName = buildEventBusName(environment);
  const batches = batchEvents(events);

  const numberOfBatches = batches.length;
  let currentBatch = 0;
  let totalMessagesSuccessfullySent = 0;

  const client = new EventBridgeClient({ region: 'eu-west-2' });

  for (const batch of batches) {
    currentBatch += 1;

    const entries = batch.map((event) => {
      const cloudEvent = event as unknown as CloudEventEnvelope;
      return {
        EventBusName: eventBusName,
        Source: cloudEvent.source,
        DetailType: cloudEvent.type,
        Detail: JSON.stringify(event),
        Time: new Date(cloudEvent.time),
      };
    });

    const command = new PutEventsCommand({ Entries: entries });

    try {
      const response = await client.send(command);

      const failed = (response.Entries ?? []).filter((e) => e.ErrorCode);
      const successCount = (response.Entries ?? []).length - failed.length;

      if (failed.length > 0) {
        console.warn('Some events failed to publish:', failed);
      }

      console.log(
        `Batch ${currentBatch} of ${numberOfBatches} sent: ${successCount} events`,
      );
      totalMessagesSuccessfullySent += successCount;
    } catch (error) {
      console.error('Error sending batch to EventBridge:', error);
    }

    // Wait before sending the next batch, but skip waiting after the last batch
    if (batch !== batches.at(-1)) {
      await wait(interval);
    }
  }

  console.log(
    `Total events successfully published: ${totalMessagesSuccessfullySent} out of ${events.length} events.`,
  );
  console.groupEnd();
}

/**
 * DestinationClient implementation that publishes events to an EventBridge event bus.
 */
export class EventBusDestinationClient implements DestinationClient {
  constructor(private readonly environment: string) {}

  async sendEvents(
    events: PublishableEvent[],
    interval: number,
  ): Promise<void> {
    return sendEventsToEventBus(this.environment, events, interval);
  }
}
