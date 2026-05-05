import { PDFAnalysed } from 'digital-letters-events';
import { EventPublisher, Logger } from 'utils';
import { PrintSender } from 'app/print-sender';
import { LetterRequestPreparedEvent } from '@nhsdigital/nhs-notify-event-schemas-letter-rendering';

describe('PrintSender', () => {
  let mockEventPublisher: jest.Mocked<EventPublisher>;
  let mockLogger: jest.Mocked<Logger>;
  let printSender: PrintSender;

  const mockPDFAnalysed: PDFAnalysed = {
    id: 'test-id',
    time: '2024-01-01T00:00:00Z',
    recordedtime: '2024-01-01T00:00:00Z',
    type: 'uk.nhs.notify.digital.letters.print.pdf.analysed.v1',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-pdf-analysed-data.schema.json',
    source:
      '/nhs/england/notify/production/primary/data-plane/digitalletters/print',
    plane: 'data',
    dataschemaversion: '1.0.0',
    datacontenttype: 'application/json',
    specversion: '1.0',
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    severitynumber: 2,
    subject: 'test-subject',
    data: {
      senderId: 'test-sender',
      messageReference: 'test-ref-123',
      pageCount: 5,
      sha256Hash:
        '3f4146a1d0b5dac26562ff7dc6248573f4e996cf764a0f517318ff398dcfa792',
      letterUri: 's3://bucket/letter.pdf',
      createdAt: '2024-01-01T00:00:00Z',
    },
  };

  beforeEach(() => {
    mockEventPublisher = {
      sendEvents: jest.fn(),
    } as unknown as jest.Mocked<EventPublisher>;

    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    printSender = new PrintSender(
      mockEventPublisher,
      'test-env',
      'test-account',
      mockLogger,
    );
  });

  describe('send', () => {
    it('should successfully send a letter prepared event', async () => {
      const result = await printSender.send(mockPDFAnalysed);

      expect(result).toBe('sent');
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'uk.nhs.notify.letter-rendering.letter-request.prepared.v1',
            source: '/data-plane/digital-letters/test-account/test-env',
            traceparent: mockPDFAnalysed.traceparent,
            severitynumber: mockPDFAnalysed.severitynumber,
            subject: `client/${mockPDFAnalysed.data.senderId}/letter-request/${mockPDFAnalysed.data.messageReference}`,
            data: expect.objectContaining({
              domainId: `${mockPDFAnalysed.data.senderId}_${mockPDFAnalysed.data.messageReference}`,
              pageCount: mockPDFAnalysed.data.pageCount,
              requestItemPlanId: mockPDFAnalysed.data.messageReference,
              sha256Hash: mockPDFAnalysed.data.sha256Hash,
              status: 'PREPARED',
              url: mockPDFAnalysed.data.letterUri,
              clientId: mockPDFAnalysed.data.senderId,
              campaignId: 'digitalLetters',
              letterVariantId: 'notify-digital-letters-standard',
            }),
          }),
        ]),
        expect.any(Function),
      );
    });

    it('should generate valid event with required fields', async () => {
      await printSender.send(mockPDFAnalysed);

      const [[events]] = mockEventPublisher.sendEvents.mock.calls;
      const event = events[0] as LetterRequestPreparedEvent;

      expect(event.id).toBeDefined();
      expect(event.time).toBeDefined();
      expect(event.recordedtime).toBeDefined();
      expect(event.data.createdAt).toBeDefined();
      expect(event.specversion).toBe('1.0');
      expect(event.plane).toBe('data');
    });

    it('should return failed when event publisher throws error', async () => {
      const error = new Error('EventBridge error');
      mockEventPublisher.sendEvents.mockRejectedValue(error);

      const result = await printSender.send(mockPDFAnalysed);

      expect(result).toBe('failed');
      expect(mockLogger.error).toHaveBeenCalledWith({
        description: 'Error sending letter prepared event',
        err: error,
        messageReference: mockPDFAnalysed.data.messageReference,
        senderId: mockPDFAnalysed.data.senderId,
      });
    });

    it('should return failed when event validation fails', async () => {
      const invalidInput = {
        ...mockPDFAnalysed,
        data: {} as any,
      };

      mockEventPublisher.sendEvents.mockImplementation(
        async (events, validator) => {
          validator(events[0], mockLogger);
          return [];
        },
      );

      const result = await printSender.send(invalidInput);

      expect(result).toBe('failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error sending letter prepared event',
          err: expect.any(Error),
        }),
      );
    });

    it('should pass validation function to event publisher', async () => {
      await printSender.send(mockPDFAnalysed);

      const [[, validationFn]] = mockEventPublisher.sendEvents.mock.calls;

      expect(validationFn).toBeDefined();
      expect(typeof validationFn).toBe('function');
    });

    it('should use provided environment and account in event source', async () => {
      const customSender = new PrintSender(
        mockEventPublisher,
        'staging',
        'staging-account',
        mockLogger,
      );

      await customSender.send(mockPDFAnalysed);

      const [[events, eventValidator]] =
        mockEventPublisher.sendEvents.mock.calls;
      const event = events[0] as LetterRequestPreparedEvent;
      expect(() => eventValidator(event, mockLogger)).not.toThrow();

      expect(event.source).toBe(
        '/data-plane/digital-letters/staging-account/staging',
      );
    });
  });
});
