import { MessageRequestRejectedMapper } from 'domain/message-request-rejected-mapper';
import { randomUUID } from 'node:crypto';
import { validPdmEvent, validSender } from '__tests__/constants';

jest.mock('node:crypto');
const mockRandomUUID = jest.mocked(randomUUID);

describe('MessageRequestRejectedMapper', () => {
  const nhsAppBaseUrl = 'https://example.com';
  let mapper: MessageRequestRejectedMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new MessageRequestRejectedMapper(nhsAppBaseUrl);
    mockRandomUUID.mockReturnValue('45e7d942-0d33-46d1-a678-ada01e5de9fe');
  });

  describe('mapPdmEventToMessageRequestRejected', () => {
    it('correctly maps a PDM event to a MessageRequestRejected event', () => {
      const mockDate = new Date('2024-01-15T12:00:00Z');
      jest.spyOn(globalThis, 'Date').mockImplementation(() => mockDate as any);

      const result = mapper.mapPdmEventToMessageRequestRejected(
        validPdmEvent,
        validSender,
        'NOTIFY_FAILURE_001',
        'Some failure reason',
      );

      expect(result).toEqual({
        ...validPdmEvent,
        id: '45e7d942-0d33-46d1-a678-ada01e5de9fe',
        time: '2024-01-15T12:00:00.000Z',
        recordedtime: '2024-01-15T12:00:00.000Z',
        type: 'uk.nhs.notify.digital.letters.messages.request.rejected.v1',
        dataschema:
          'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-message-request-rejected-data.schema.json',
        source:
          '/nhs/england/notify/development/dev-12345/digitalletters/messages',
        data: {
          messageReference: 'msg-ref-123',
          senderId: 'sender-123',
          failureCode: 'NOTIFY_FAILURE_001',
          messageUri:
            'https://example.com/patient/digital-letters/letter?id=f5524783-e5d7-473e-b2a0-29582ff231da',
          reasonCode: 'DL_INTE_001',
          reasonText: 'Some failure reason',
        },
      });
    });
  });
});
