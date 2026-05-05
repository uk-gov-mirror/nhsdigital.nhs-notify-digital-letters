import type { SQSRecord } from 'aws-lambda';
import { Logger } from 'utils';
import {
  PDMResourceAvailable,
  validatePDMResourceAvailable,
} from 'digital-letters-events';

export const parseSqsRecord = (
  sqsRecord: SQSRecord,
  logger: Logger,
): PDMResourceAvailable => {
  const childLogger = logger.child({ messageId: sqsRecord.messageId });
  childLogger.info({
    description: 'Parsing SQS Record',
  });

  const sqsEventBody = JSON.parse(sqsRecord.body);
  const sqsEventDetail = sqsEventBody.detail;

  validatePDMResourceAvailable(sqsEventDetail, childLogger);

  childLogger.info({
    description: 'Parsed valid PDMResourceAvailable Event',
    messageReference: sqsEventDetail.data.messageReference,
    senderId: sqsEventDetail.data.senderId,
    resourceId: sqsEventDetail.data.resourceId,
  });

  return sqsEventDetail;
};
