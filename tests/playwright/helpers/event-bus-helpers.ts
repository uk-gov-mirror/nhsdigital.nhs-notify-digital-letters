import {
  ENV,
  EVENT_BUS_ARN,
  EVENT_BUS_DLQ_URL,
} from 'constants/backend-constants';
import {
  EventPublisher,
  MetricHandler,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';

const metricHandler = new MetricHandler(`nhs-${ENV}-dl-component-test`, [
  { Name: 'Environment', Value: ENV },
]);
const eventPublisher = new EventPublisher({
  eventBusArn: EVENT_BUS_ARN,
  dlqUrl: EVENT_BUS_DLQ_URL,
  logger,
  sqsClient,
  eventBridgeClient,
  metricHandler,
});

export default eventPublisher;
