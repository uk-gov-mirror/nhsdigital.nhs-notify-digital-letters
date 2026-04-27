import { logger } from 'utils';
import { CoreRequestMapper } from 'domain/core-request-mapper';
import { validPdmEvent, validSender } from '__tests__/constants';

jest.mock('utils');

const mockLogger = jest.mocked(logger);

describe('CoreRequestMapper', () => {
  const nhsAppBaseUrl = 'https://example.com';

  let mapper: CoreRequestMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new CoreRequestMapper(nhsAppBaseUrl);
  });

  describe('mapPdmEventToSingleMessageRequest', () => {
    it('correctly maps PDM event to SingleMessageRequest', () => {
      const result = mapper.mapPdmEventToSingleMessageRequest(
        validPdmEvent,
        validSender,
      );

      expect(result).toEqual({
        data: {
          type: 'Message',
          attributes: {
            routingPlanId: 'routing-config-123',
            messageReference: 'sender-123_msg-ref-123',
            billingReference: 'sender-123',
            recipient: {
              nhsNumber: '9991234566',
            },
            originator: {
              odsCode: 'A12345',
            },
            personalisation: {
              digitalLetterURL:
                'https://example.com/patient/digital-letters/letter?id=f5524783-e5d7-473e-b2a0-29582ff231da',
            },
          },
        },
      });
    });

    it('logs an info message with the messageReference and senderId', () => {
      mapper.mapPdmEventToSingleMessageRequest(validPdmEvent, validSender);

      expect(mockLogger.info).toHaveBeenCalledWith({
        description: 'Mapping resource available',
        coreMessageReference: 'sender-123_msg-ref-123',
        messageReference: 'msg-ref-123',
        senderId: 'sender-123',
      });
    });
  });
});
