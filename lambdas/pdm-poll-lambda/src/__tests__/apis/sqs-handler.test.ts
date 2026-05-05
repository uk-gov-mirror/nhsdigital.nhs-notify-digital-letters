import { mock } from 'jest-mock-extended';
import { randomUUID } from 'node:crypto';
import { createHandler } from 'apis/sqs-handler';
import { EventPublisher, Logger } from 'utils';
import { Pdm } from 'app/pdm';
import {
  pdmResourceSubmittedEvent,
  pdmResourceUnavailableEvent,
  recordEvent,
} from '__tests__/test-data';

const logger = mock<Logger>();
const eventPublisher = mock<EventPublisher>();
const pdm = mock<Pdm>();

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(),
  randomBytes: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { randomBytes } = require('node:crypto');

const mockRandomUUID = randomUUID as jest.MockedFunction<typeof randomUUID>;
const mockRandomBytes = randomBytes as jest.MockedFunction<
  typeof import('node:crypto').randomBytes
>;
const mockDate = jest.spyOn(Date.prototype, 'toISOString');
mockRandomUUID.mockReturnValue('550e8400-e29b-41d4-a716-446655440001');
mockRandomBytes.mockImplementation(() => Buffer.from('aabbccdd11223344', 'hex'));
mockDate.mockReturnValue('2023-06-20T12:00:00.250Z');

const DERIVED_TRACEPARENT =
  '00-0af7651916cd43dd8448eb211c80319c-aabbccdd11223344-01';

const handler = createHandler({
  eventPublisher,
  logger,
  pdm,
  pollMaxRetries: 10,
});

describe('SQS Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pdm.resource.submitted', () => {
    it('should send pdm.resource.available event when the document is ready', async () => {
      pdm.poll.mockResolvedValueOnce({
        pdmAvailability: 'available',
        nhsNumber: '9999999999',
        odsCode: 'AB1234',
      });

      const response = await handler(recordEvent([pdmResourceSubmittedEvent]));

      expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
        [
          {
            ...pdmResourceSubmittedEvent,
            id: '550e8400-e29b-41d4-a716-446655440001',
            time: '2023-06-20T12:00:00.250Z',
            recordedtime: '2023-06-20T12:00:00.250Z',
            traceparent: DERIVED_TRACEPARENT,
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-available-data.schema.json',
            type: 'uk.nhs.notify.digital.letters.pdm.resource.available.v1',
            data: {
              messageReference: pdmResourceSubmittedEvent.data.messageReference,
              senderId: pdmResourceSubmittedEvent.data.senderId,
              resourceId: pdmResourceSubmittedEvent.data.resourceId,
              nhsNumber: '9999999999',
              odsCode: 'AB1234',
            },
          },
        ],
        expect.any(Function),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Received SQS Event of 1 record(s)',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '1 of 1 records processed successfully',
      );
      expect(response).toEqual({ batchItemFailures: [] });
    });

    it('should send pdm.resource.unavailable event when the document is not ready', async () => {
      pdm.poll.mockResolvedValueOnce({
        pdmAvailability: 'unavailable',
        nhsNumber: '9999999999',
        odsCode: 'AB1234',
      });

      const response = await handler(recordEvent([pdmResourceSubmittedEvent]));

      expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
        [
          {
            ...pdmResourceSubmittedEvent,
            id: '550e8400-e29b-41d4-a716-446655440001',
            time: '2023-06-20T12:00:00.250Z',
            recordedtime: '2023-06-20T12:00:00.250Z',
            traceparent: DERIVED_TRACEPARENT,
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-unavailable-data.schema.json',
            type: 'uk.nhs.notify.digital.letters.pdm.resource.unavailable.v1',
            data: {
              messageReference: pdmResourceSubmittedEvent.data.messageReference,
              senderId: pdmResourceSubmittedEvent.data.senderId,
              resourceId: pdmResourceSubmittedEvent.data.resourceId,
              retryCount: 0,
            },
          },
        ],
        expect.any(Function),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Received SQS Event of 1 record(s)',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '1 of 1 records processed successfully',
      );
      expect(response).toEqual({ batchItemFailures: [] });
    });
  });

  describe('pdm.resource.unavailable', () => {
    it('should send pdm.resource.available event when the document is ready', async () => {
      pdm.poll.mockResolvedValueOnce({
        pdmAvailability: 'available',
        nhsNumber: '9999999999',
        odsCode: 'AB1234',
      });

      const response = await handler(
        recordEvent([pdmResourceUnavailableEvent]),
      );

      expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
        [
          {
            ...pdmResourceUnavailableEvent,
            id: '550e8400-e29b-41d4-a716-446655440001',
            time: '2023-06-20T12:00:00.250Z',
            recordedtime: '2023-06-20T12:00:00.250Z',
            traceparent: DERIVED_TRACEPARENT,
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-available-data.schema.json',
            type: 'uk.nhs.notify.digital.letters.pdm.resource.available.v1',
            data: {
              messageReference:
                pdmResourceUnavailableEvent.data.messageReference,
              senderId: pdmResourceUnavailableEvent.data.senderId,
              resourceId: pdmResourceUnavailableEvent.data.resourceId,
              nhsNumber: '9999999999',
              odsCode: 'AB1234',
            },
          },
        ],
        expect.any(Function),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Received SQS Event of 1 record(s)',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '1 of 1 records processed successfully',
      );
      expect(response).toEqual({ batchItemFailures: [] });
    });

    it('should send pdm.resource.unavailable event when the document is not ready', async () => {
      pdm.poll.mockResolvedValueOnce({
        pdmAvailability: 'unavailable',
        nhsNumber: '9999999999',
        odsCode: 'AB1234',
      });

      const response = await handler(
        recordEvent([pdmResourceUnavailableEvent]),
      );

      expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
        [
          {
            ...pdmResourceUnavailableEvent,
            id: '550e8400-e29b-41d4-a716-446655440001',
            time: '2023-06-20T12:00:00.250Z',
            recordedtime: '2023-06-20T12:00:00.250Z',
            traceparent: DERIVED_TRACEPARENT,
            type: 'uk.nhs.notify.digital.letters.pdm.resource.unavailable.v1',
            data: {
              messageReference:
                pdmResourceUnavailableEvent.data.messageReference,
              senderId: pdmResourceUnavailableEvent.data.senderId,
              resourceId: pdmResourceUnavailableEvent.data.resourceId,
              retryCount: 2,
            },
          },
        ],
        expect.any(Function),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Received SQS Event of 1 record(s)',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '1 of 1 records processed successfully',
      );
      expect(response).toEqual({ batchItemFailures: [] });
    });

    it('should send pdm.resource.retries.exceeded event when the document is not ready after 10 retries', async () => {
      pdm.poll.mockResolvedValueOnce({
        pdmAvailability: 'unavailable',
        nhsNumber: '9999999999',
        odsCode: 'AB1234',
      });

      const testEvent = {
        ...pdmResourceUnavailableEvent,
        data: {
          ...pdmResourceUnavailableEvent.data,
          retryCount: 9,
        },
      };

      const response = await handler(recordEvent([testEvent]));

      expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
        [
          {
            ...pdmResourceUnavailableEvent,
            id: '550e8400-e29b-41d4-a716-446655440001',
            time: '2023-06-20T12:00:00.250Z',
            recordedtime: '2023-06-20T12:00:00.250Z',
            traceparent: DERIVED_TRACEPARENT,
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-retries-exceeded-data.schema.json',
            type: 'uk.nhs.notify.digital.letters.pdm.resource.retries.exceeded.v1',
            data: {
              messageReference:
                pdmResourceUnavailableEvent.data.messageReference,
              senderId: pdmResourceUnavailableEvent.data.senderId,
              resourceId: pdmResourceUnavailableEvent.data.resourceId,
              retryCount: 10,
              reasonCode: 'DL_PDMV_002',
            },
          },
        ],
        expect.any(Function),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Received SQS Event of 1 record(s)',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '1 of 1 records processed successfully',
      );
      expect(response).toEqual({ batchItemFailures: [] });
    });
  });

  describe('errors', () => {
    it('should return failed SQS records to the queue if an error occurs while calling PDM', async () => {
      pdm.poll.mockRejectedValueOnce(new Error('PDM error'));
      const event = recordEvent([pdmResourceSubmittedEvent]);

      const result = await handler(event);

      expect(logger.warn).toHaveBeenCalledWith({
        err: 'PDM error',
        description: 'Failed processing message',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });

    it('should return failed SQS records to the queue if an error occurs while processing them', async () => {
      const event = recordEvent([pdmResourceSubmittedEvent]);
      event.Records[0].body = 'not-json';

      const result = await handler(event);

      expect(logger.warn).toHaveBeenCalledWith({
        err: new SyntaxError(
          `Unexpected token 'o', "not-json" is not valid JSON`,
        ),
        description: 'Error parsing SQS record',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });

    it('should return failed items to the queue if an invalid pdm.resource.submitted event is received', async () => {
      const invalidSubmittedEvent = {
        ...pdmResourceSubmittedEvent,
        source: 'invalid pdm.resource.submitted source',
      };
      const event = recordEvent([invalidSubmittedEvent]);

      const result = await handler(event);

      expect(logger.error).toHaveBeenCalledWith({
        err: expect.arrayContaining([
          expect.objectContaining({
            instancePath: '/source',
          }),
        ]),
        description: 'Error parsing PDMResourceSubmitted event',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });

    it('should return failed items to the queue if an invalid pdm.resource.unavailable event is received', async () => {
      const invalidSubmittedEvent = {
        ...pdmResourceUnavailableEvent,
        source: 'invalid pdm.resource.unavailable source',
      };
      const event = recordEvent([invalidSubmittedEvent]);

      const result = await handler(event);

      expect(logger.error).toHaveBeenCalledWith({
        err: expect.arrayContaining([
          expect.objectContaining({
            instancePath: '/source',
          }),
        ]),
        description: 'Error parsing PDMResourceUnavailable event',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });
  });
});
