import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { randomUUID } from 'node:crypto';
import { Logger } from '../logger';
import { MetricHandler } from '../cloudwatch/metric-handler';

type DlqReason = 'INVALID_EVENT' | 'EVENTBRIDGE_FAILURE';

const MAX_BATCH_SIZE = 10;

export interface EventPublisherDependencies {
  eventBusArn: string;
  dlqUrl: string;
  logger: Logger;
  sqsClient: SQSClient;
  eventBridgeClient: EventBridgeClient;
  metricHandler: MetricHandler;
}

type PublishableEvent = { id: string; source: string; type: string };

type EventValidationFunction<T> = (event: T, logger: Logger) => void;

export class EventPublisher {
  private readonly eventBridge: EventBridgeClient;

  private readonly sqs: SQSClient;

  private readonly config: EventPublisherDependencies;

  private readonly logger: Logger;

  private readonly metricHandler: MetricHandler;

  constructor(config: EventPublisherDependencies) {
    if (!config.eventBusArn) {
      throw new Error('eventBusArn has not been specified');
    }
    if (!config.dlqUrl) {
      throw new Error('dlqUrl has not been specified');
    }
    if (!config.logger) {
      throw new Error('logger has not been provided');
    }
    if (!config.sqsClient) {
      throw new Error('sqsClient has not been provided');
    }
    if (!config.eventBridgeClient) {
      throw new Error('eventBridgeClient has not been provided');
    }
    if (!config.metricHandler) {
      throw new Error('metricHandler has not been provided');
    }

    this.config = config;
    this.logger = config.logger;
    this.eventBridge = config.eventBridgeClient;
    this.sqs = config.sqsClient;
    this.metricHandler = config.metricHandler;

  }

  private async sendToEventBridge<T extends PublishableEvent>(
    events: T[],
  ): Promise<T[]> {
    const failedEvents: T[] = [];
    this.logger.info({
      description: `Sending ${events.length} events to EventBridge`,
      eventCount: events.length,
    });

    for (let i = 0; i < events.length; i += MAX_BATCH_SIZE) {
      const batch = events.slice(i, i + MAX_BATCH_SIZE);
      this.logger.info({
        description: `Sending batch of ${batch.length} events to EventBridge`,
        batchSize: batch.length,
      });

      try {
        const entries = batch.map((event) => ({
          Source: event.source,
          DetailType: event.type,
          Detail: JSON.stringify(event),
          EventBusName: this.config.eventBusArn,
        }));

        const response = await this.eventBridge.send(
          new PutEventsCommand({ Entries: entries }),
        );

        const successfulCount = batch.length - (response.FailedEntryCount || 0);
        const failedEntryCount = response.FailedEntryCount || 0;
        this.logger.info({
          description: 'EventBridge batch sent',
          batchSize: batch.length,
          failedEntryCount: failedEntryCount,
          successfulCount: successfulCount,
        });

        if (successfulCount > 0) {
          this.metricHandler.addMetrics([`${entries[0].DetailType}_batchSuccess`, 'Count', successfulCount]);
        }

        if (failedEntryCount > 0) {
          this.metricHandler.addMetrics([`${entries[0].DetailType}_batchFailure`, 'Count', failedEntryCount]);
        }


        if (failedEntryCount && response.Entries) {
          for (const [idx, entry] of response.Entries.entries()) {
            if (entry.ErrorCode) {
              this.logger.warn({
                description: 'Event failed to send to EventBridge',
                errorCode: entry.ErrorCode,
                errorMessage: entry.ErrorMessage,
                eventId: batch[idx].id,
              });
              failedEvents.push(batch[idx]);
            }
          }
        }
      } catch (error) {
        this.logger.warn({
          description: 'EventBridge send error',
          err: error,
          batchSize: batch.length,
        });
        failedEvents.push(...batch);
      }
    }

    return failedEvents;
  }

  private async sendToDLQ<T extends PublishableEvent>(
    events: T[],
    reason: DlqReason,
  ): Promise<T[]> {
    const failedDlqs: T[] = [];

    this.logger.warn({
      description: 'Sending failed events to DLQ',
      eventCount: events.length,
      reason,
    });

    for (let i = 0; i < events.length; i += MAX_BATCH_SIZE) {
      const batch = events.slice(i, i + MAX_BATCH_SIZE);
      const idToEventMap = new Map<string, T>();

      const entries = batch.map((event) => {
        const id = randomUUID();
        idToEventMap.set(id, event);
        return {
          Id: id,
          MessageBody: JSON.stringify(event),
          MessageAttributes: {
            DlqReason: {
              DataType: 'String',
              StringValue: reason,
            },
          },
        };
      });

      try {
        const response = await this.sqs.send(
          new SendMessageBatchCommand({
            QueueUrl: this.config.dlqUrl,
            Entries: entries,
          }),
        );

        if (response.Failed)
          for (const failedEntry of response.Failed) {
            const failedEvent =
              failedEntry.Id && idToEventMap.get(failedEntry.Id);
            if (failedEvent) {
              this.logger.warn({
                description: 'Event failed to send to DLQ',
                errorCode: failedEntry.Code,
                errorMessage: failedEntry.Message,
                eventId: failedEvent.id,
              });
              failedDlqs.push(failedEvent);
            }
          }
      } catch (error) {
        this.logger.warn({
          description: 'DLQ send error',
          err: error,
          batchSize: batch.length,
        });
        failedDlqs.push(...batch);
      }
    }

    if (failedDlqs.length > 0) {
      this.logger.error({
        description: 'Failed to send events to DLQ',
        failedEventCount: failedDlqs.length,
      });
    }

    return failedDlqs;
  }

  public async sendEvents<T extends PublishableEvent>(
    events: T[],
    eventValidator: EventValidationFunction<T>,
  ): Promise<T[]> {
    if (events.length === 0) {
      this.logger.info({ description: 'No events to send' });
      return [];
    }

    const validEvents: T[] = [];
    const invalidEvents: T[] = [];

    for (const event of events) {
      try {
        eventValidator(event, this.logger);
        validEvents.push(event);
      } catch {
        invalidEvents.push(event);
      }
    }

    this.logger.info({
      description: 'Event validation completed',
      validEventCount: validEvents.length,
      invalidEventCount: invalidEvents.length,
      totalEventCount: events.length,
    });

    const totalFailedEvents: T[] = [];

    if (invalidEvents.length > 0) {
      const failedDlqSends = await this.sendToDLQ(
        invalidEvents,
        'INVALID_EVENT',
      );
      totalFailedEvents.push(...failedDlqSends);
    }

    if (validEvents.length > 0) {
      const failedSends = await this.sendToEventBridge(validEvents);
      if (failedSends.length > 0) {
        const failedDlqSends = await this.sendToDLQ(
          failedSends,
          'EVENTBRIDGE_FAILURE',
        );
        totalFailedEvents.push(...failedDlqSends);
      }
    }

    return totalFailedEvents;
  }
}
