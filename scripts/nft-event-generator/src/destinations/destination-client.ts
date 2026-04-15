/**
 * Minimum shape required by all destination clients.
 * Each publishable event must carry an `id` so the sending implementation
 * can use it as a unique identifier within a batch.
 */
export type PublishableEvent = { id: string };

/**
 * Common interface for all event destinations (SQS, EventBridge, etc.).
 * Implementations are responsible for batching, retries and back-off.
 */
export interface DestinationClient {
  sendEvents(events: PublishableEvent[], interval: number): Promise<void>;
}
