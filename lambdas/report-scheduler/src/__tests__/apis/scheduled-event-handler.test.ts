import { EventPublisher, Logger, MetricHandler, Sender } from 'utils';
import { ISenderManagement } from 'sender-management';
import { GenerateReport, validateGenerateReport } from 'digital-letters-events';
import { createHandler } from 'apis/scheduled-event-handler';

describe('scheduled-event-handler', () => {
  let mockSenderManagement: jest.Mocked<ISenderManagement>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetricHandler: jest.Mocked<MetricHandler>;

  beforeEach(() => {
    mockSenderManagement = {
      listSenders: jest.fn(),
    } as unknown as jest.Mocked<ISenderManagement>;

    mockEventPublisher = {
      sendEvents: jest.fn(),
    } as unknown as jest.Mocked<EventPublisher>;

    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Logger>;

    mockMetricHandler = {
      addMetrics: jest.fn(),
    } as unknown as jest.Mocked<MetricHandler>;

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createHandler', () => {
    it('should retrieve senders from sender management', async () => {
      mockSenderManagement.listSenders.mockResolvedValue([]);
      mockEventPublisher.sendEvents.mockResolvedValue([]);

      const handler = createHandler({
        senderManagement: mockSenderManagement,
        eventPublisher: mockEventPublisher,
        metricHandler: mockMetricHandler,
      });

      await handler();

      expect(mockSenderManagement.listSenders).toHaveBeenCalledTimes(1);
      expect(mockMetricHandler.addMetrics).toHaveBeenCalledTimes(1);
    });

    it('should publish generate report events for each sender', async () => {
      const mockDate = new Date('2024-01-15T12:00:00.000Z');
      jest.setSystemTime(mockDate);

      const mockSenders = [
        { senderId: 'sender-1' },
        { senderId: 'sender-2' },
        { senderId: 'sender-3' },
      ] as unknown as Sender[];

      mockSenderManagement.listSenders.mockResolvedValue(mockSenders);
      mockEventPublisher.sendEvents.mockResolvedValue([]);

      const handler = createHandler({
        senderManagement: mockSenderManagement,
        eventPublisher: mockEventPublisher,
        metricHandler: mockMetricHandler,
      });

      await handler();

      expect(mockEventPublisher.sendEvents).toHaveBeenCalledTimes(1);
      const [[events, validator]] = mockEventPublisher.sendEvents.mock.calls;

      expect(events).toHaveLength(3);
      expect(validator).toBeDefined();
      expect(mockMetricHandler.addMetrics).toHaveBeenCalledWith(['TotalSenders', 'Count', 3]);
    });

    it('should create events with correct structure for each sender', async () => {
      const mockDate = new Date('2024-01-15T12:00:00.000Z');
      jest.setSystemTime(mockDate);

      const mockSenders = [
        { senderId: 'test-sender-123' },
      ] as unknown as Sender[];

      mockSenderManagement.listSenders.mockResolvedValue(mockSenders);
      mockEventPublisher.sendEvents.mockResolvedValue([]);

      const handler = createHandler({
        senderManagement: mockSenderManagement,
        eventPublisher: mockEventPublisher,
        metricHandler: mockMetricHandler,
      });

      await handler();

      const [[events]] = mockEventPublisher.sendEvents.mock.calls;
      const event = events[0] as GenerateReport;

      expect(event.data.senderId).toBe('test-sender-123');
      expect(event.data.reportDate).toBe('2024-01-14');
      expect(event.specversion).toBe('1.0');
      expect(event.id).toBeDefined();
      expect(event.plane).toBe('data');
      expect(event.source).toBe(
        '/nhs/england/notify/production/primary/digitalletters/reporting',
      );
      expect(event.subject).toBe('customer/test-sender-123');
      expect(event.type).toBe(
        'uk.nhs.notify.digital.letters.reporting.generate.report.v1',
      );
      expect(event.time).toBe('2024-01-15T12:00:00.000Z');
      expect(event.severitynumber).toBe(2);
      expect(event.dataschema).toBe(
        'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-reporting-generate-report-data.schema.json',
      );
      expect(event.dataschemaversion).toBe('1.0.0');
      expect(event.datacontenttype).toBe('application/json');

      expect(() => validateGenerateReport(event, mockLogger)).not.toThrow();
      expect(mockMetricHandler.addMetrics).toHaveBeenCalledWith(['TotalSenders', 'Count', 1]);
    });

    it('should handle empty sender list', async () => {
      mockSenderManagement.listSenders.mockResolvedValue([]);
      mockEventPublisher.sendEvents.mockResolvedValue([]);

      const handler = createHandler({
        senderManagement: mockSenderManagement,
        eventPublisher: mockEventPublisher,
        metricHandler: mockMetricHandler,
      });

      await handler();

      const [[events]] = mockEventPublisher.sendEvents.mock.calls;
      expect(events).toHaveLength(0);
      expect(mockMetricHandler.addMetrics).toHaveBeenCalledWith(['TotalSenders', 'Count', 0]);
    });

    it('should handle event publisher errors', async () => {
      const mockSenders = [{ senderId: 'sender-1' }] as unknown as Sender[];
      const error = new Error('Failed to publish events');

      mockSenderManagement.listSenders.mockResolvedValue(mockSenders);
      mockEventPublisher.sendEvents.mockRejectedValue(error);

      const handler = createHandler({
        senderManagement: mockSenderManagement,
        eventPublisher: mockEventPublisher,
        metricHandler: mockMetricHandler,
      });

      await expect(handler()).rejects.toThrow('Failed to publish events');
      expect(mockMetricHandler.addMetrics).toHaveBeenCalledTimes(0);
    });

    it('should generate unique event IDs for multiple senders', async () => {
      const mockSenders = [
        { senderId: 'sender-1' },
        { senderId: 'sender-2' },
      ] as unknown as Sender[];

      mockSenderManagement.listSenders.mockResolvedValue(mockSenders);
      mockEventPublisher.sendEvents.mockResolvedValue([]);

      const handler = createHandler({
        senderManagement: mockSenderManagement,
        eventPublisher: mockEventPublisher,
        metricHandler: mockMetricHandler,
      });

      await handler();

      const [[events]] = mockEventPublisher.sendEvents.mock.calls;
      const eventIds = events.map((e) => e.id);

      expect(new Set(eventIds).size).toBe(eventIds.length);
      expect(mockMetricHandler.addMetrics).toHaveBeenCalledWith(['TotalSenders', 'Count', 2]);
    });
  });
});
