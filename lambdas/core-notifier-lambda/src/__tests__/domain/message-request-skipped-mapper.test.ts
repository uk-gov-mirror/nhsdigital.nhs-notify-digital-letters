import { mapPdmEventToMessageRequestSkipped } from 'domain/message-request-skipped-mapper';
import { randomUUID } from 'node:crypto';
import { validPdmEvent, validSender } from '__tests__/constants';

jest.mock('utils');
jest.mock('node:crypto');
const mockRandomUUID = jest.mocked(randomUUID);

describe('mapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRandomUUID.mockReturnValue('45e7d942-0d33-46d1-a678-ada01e5de9fe');
  });

  describe('mapPdmEventToMessageRequestSkipped', () => {
    it('correctly maps PDM event to MessageRequestSkipped', () => {
      const mockDate = new Date('2024-01-15T12:00:00Z');
      jest.spyOn(globalThis, 'Date').mockImplementation(() => mockDate as any);

      const result = mapPdmEventToMessageRequestSkipped(
        validPdmEvent,
        validSender,
      );

      expect(result).toEqual({
        ...validPdmEvent,
        id: '45e7d942-0d33-46d1-a678-ada01e5de9fe',
        time: '2024-01-15T12:00:00.000Z',
        recordedtime: '2024-01-15T12:00:00.000Z',
        type: 'uk.nhs.notify.digital.letters.messages.request.skipped.v1',
        source:
          '/nhs/england/notify/development/dev-12345/digitalletters/messages',
        dataschema:
          'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-message-request-skipped-data.schema.json',
        data: {
          messageReference: 'msg-ref-123',
          senderId: 'sender-123',
        },
      });

      expect(mockRandomUUID).toHaveBeenCalled();
    });
  });
});
