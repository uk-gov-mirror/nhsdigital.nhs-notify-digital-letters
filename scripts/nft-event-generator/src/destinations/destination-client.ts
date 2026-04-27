/**
 * Minimum shape required by all destination clients.
 * Each publishable event must carry the defined properties, where the `id`
 * is used as a unique identifier within a batch.
 */
export type PublishableEvent = {
  id: string;
  source: string;
  type: string;
  time: string;
};

/**
 * Common interface for all event destinations (SQS, EventBridge, etc.).
 * Implementations are responsible for batching, retries and back-off.
 */
export interface DestinationClient {
  sendEvents(events: PublishableEvent[], interval: number): Promise<void>;
}
