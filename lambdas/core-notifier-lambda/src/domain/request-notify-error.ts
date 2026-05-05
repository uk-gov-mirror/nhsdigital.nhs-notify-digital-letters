/**
 * To represent an HTTP status not 2xx returned from Notify API when sending a Single Message Request.
 * Note that 429 and 422 are handled separately in the Notify API client.
 */
export class RequestNotifyError extends Error {
  readonly cause: Error;

  readonly correlationId: string;

  readonly errorCode: string;

  readonly failureReason: string;

  constructor(
    cause: Error,
    correlationId: string,
    errorCode: string,
    failureReason: string,
  ) {
    super('Error received from Core Notify API');

    this.cause = cause;
    this.correlationId = correlationId;
    this.errorCode = errorCode;
    this.failureReason = failureReason;
  }
}
