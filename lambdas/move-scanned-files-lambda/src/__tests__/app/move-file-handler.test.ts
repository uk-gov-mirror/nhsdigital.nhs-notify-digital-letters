import { mock } from 'jest-mock-extended';
import { Logger } from 'utils/logger';
import { MoveFileHandler } from 'app/move-file-handler';
import { MoveScannedFilesConfig } from 'infra/config';
import * as utils from 'utils';
import {
  guardDutyNoThreadsFoundEvent,
  guardDutyThreadsFoundEvent,
} from '__tests__/constants';

jest.mock('utils', () => ({
  ...jest.requireActual('utils'),
  copyAndDeleteObjectS3: jest.fn(),
  getS3ObjectMetadata: jest.fn(),
}));

jest.mock('domain/mapper', () => ({
  createFileSafeEvent: jest.fn(
    (messageRef, senderId, letterUri, createdAt) => ({
      specversion: '1.0',
      id: 'test-id',
      source: '/test',
      type: 'uk.nhs.notify.digital.letters.print.file.safe.v1',
      time: '2024-01-01T00:00:00Z',
      data: {
        messageReference: messageRef,
        senderId,
        letterUri,
        createdAt,
      },
      subject: 'test-subject',
      traceparent: 'test-traceparent',
      recordedtime: '2024-01-01T00:00:00Z',
      severitynumber: 2,
    }),
  ),
  createFileQuarantinedEvent: jest.fn(
    (messageRef, senderId, letterUri, createdAt) => ({
      specversion: '1.0',
      id: 'test-id',
      source: '/test',
      type: 'uk.nhs.notify.digital.letters.print.file.quarantined.v1',
      time: '2024-01-01T00:00:00Z',
      data: {
        messageReference: messageRef,
        senderId,
        letterUri,
        createdAt,
      },
      subject: 'test-subject',
      traceparent: 'test-traceparent',
      recordedtime: '2024-01-01T00:00:00Z',
      severitynumber: 2,
    }),
  ),
}));

describe('MoveFileHandler', () => {
  const mockLogger = mock<Logger>();
  const mockConfig: MoveScannedFilesConfig = {
    eventPublisherEventBusArn: 'arn:aws:events:test',
    eventPublisherDlqUrl: 'https://sqs.test',
    environment: 'test',
    keyPrefixUnscannedFiles: 'dl/',
    unscannedFileS3BucketName: 'unscanned-bucket',
    safeFileS3BucketName: 'safe-bucket',
    quarantineFileS3BucketName: 'quarantine-bucket',
    dlMetricsNamespace: 'test-namespace',
  };

  const mockCopyAndDeleteObjectS3 = jest.mocked(utils.copyAndDeleteObjectS3);
  const mockGetS3ObjectMetadata = jest.mocked(utils.getS3ObjectMetadata);

  let handler: MoveFileHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new MoveFileHandler(mockLogger, mockConfig);
    mockCopyAndDeleteObjectS3.mockResolvedValue();
    mockGetS3ObjectMetadata.mockResolvedValue({
      messagereference: 'msg-ref-123',
      senderid: 'sender-456',
      createdat: '2024-01-01T00:00:00Z',
    });
  });

  describe('isEventForDigitalLetters', () => {
    it('returns true when event is for digital letters bucket and prefix', () => {
      const eventDetail = {
        ...guardDutyNoThreadsFoundEvent.detail,
        s3ObjectDetails: {
          ...guardDutyNoThreadsFoundEvent.detail.s3ObjectDetails,
          bucketName: 'unscanned-bucket',
          objectKey: 'dl/test-file.pdf',
        },
      };

      const result = handler.isEventForDigitalLetters(eventDetail);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('returns false when bucket name does not match', () => {
      const eventDetail = {
        ...guardDutyNoThreadsFoundEvent.detail,
        s3ObjectDetails: {
          ...guardDutyNoThreadsFoundEvent.detail.s3ObjectDetails,
          bucketName: 'wrong-bucket',
          objectKey: 'dl/test-file.pdf',
        },
      };

      const result = handler.isEventForDigitalLetters(eventDetail);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith({
        description:
          'Received scan result for file not in unscanned bucket, ignoring event.',
        expectedUnscannedBucketName: 'unscanned-bucket',
        expectedKeyPrefix: 'dl/',
        receivedBucketName: 'wrong-bucket',
        receivedObjectKey: 'dl/test-file.pdf',
      });
    });

    it('returns false when object key does not start with prefix', () => {
      const eventDetail = {
        ...guardDutyNoThreadsFoundEvent.detail,
        s3ObjectDetails: {
          ...guardDutyNoThreadsFoundEvent.detail.s3ObjectDetails,
          bucketName: 'unscanned-bucket',
          objectKey: 'other/test-file.pdf',
        },
      };

      const result = handler.isEventForDigitalLetters(eventDetail);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith({
        description:
          'Received scan result for file not in unscanned bucket, ignoring event.',
        expectedUnscannedBucketName: 'unscanned-bucket',
        expectedKeyPrefix: 'dl/',
        receivedBucketName: 'unscanned-bucket',
        receivedObjectKey: 'other/test-file.pdf',
      });
    });

    it('returns false when both bucket and prefix are wrong', () => {
      const eventDetail = {
        ...guardDutyNoThreadsFoundEvent.detail,
        s3ObjectDetails: {
          ...guardDutyNoThreadsFoundEvent.detail.s3ObjectDetails,
          bucketName: 'wrong-bucket',
          objectKey: 'wrong-prefix/test-file.pdf',
        },
      };

      const result = handler.isEventForDigitalLetters(eventDetail);

      expect(result).toBe(false);
    });
  });

  describe('extractMetadata', () => {
    it('extracts metadata successfully when all required fields are present', async () => {
      const objectDetails = {
        bucketName: 'test-bucket',
        objectKey: 'test-key',
      };

      mockGetS3ObjectMetadata.mockResolvedValue({
        messagereference: 'msg-ref-123',
        senderid: 'sender-456',
        createdat: '2024-06-01T12:00:00Z',
      });

      const result = await handler.extractMetadata(objectDetails);

      expect(mockGetS3ObjectMetadata).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key',
      });
      expect(result).toEqual({
        senderId: 'sender-456',
        messageReference: 'msg-ref-123',
        createdAt: '2024-06-01T12:00:00Z',
      });
    });

    it('returns null when message-reference is missing', async () => {
      const objectDetails = {
        bucketName: 'test-bucket',
        objectKey: 'test-key',
      };

      mockGetS3ObjectMetadata.mockResolvedValue({
        'sender-id': 'sender-456',
        'created-at': '2024-06-01T12:00:00Z',
      });

      const result = await handler.extractMetadata(objectDetails);

      expect(result).toBeNull();
    });

    it('returns null when sender-id is missing', async () => {
      const objectDetails = {
        bucketName: 'test-bucket',
        objectKey: 'test-key',
      };

      mockGetS3ObjectMetadata.mockResolvedValue({
        'message-reference': 'msg-ref-123',
        'created-at': '2024-06-01T12:00:00Z',
      });

      const result = await handler.extractMetadata(objectDetails);

      expect(result).toBeNull();
    });

    it('returns null when created-at is missing', async () => {
      const objectDetails = {
        bucketName: 'test-bucket',
        objectKey: 'test-key',
      };

      mockGetS3ObjectMetadata.mockResolvedValue({
        'message-reference': 'msg-ref-123',
        'sender-id': 'sender-456',
      });

      const result = await handler.extractMetadata(objectDetails);

      expect(result).toBeNull();
    });

    it('returns null when metadata is undefined', async () => {
      const objectDetails = {
        bucketName: 'test-bucket',
        objectKey: 'test-key',
      };

      // need to test the condition where no metadata is returned. leaving just undefined produces a lint error, removing undefined then causes typecheck error.
      mockGetS3ObjectMetadata.mockResolvedValue(undefined as never);

      const result = await handler.extractMetadata(objectDetails);

      expect(result).toBeNull();
    });
  });

  describe('createObjectsFromData', () => {
    const metadata = {
      senderId: 'sender-123',
      messageReference: 'msg-ref-456',
      createdAt: '2024-06-01T12:00:00Z',
    };

    it('creates FileSafe event when scan completed with no threats', () => {
      const result = handler.createObjectsFromData(
        'COMPLETED',
        'dl/test-file.pdf',
        guardDutyNoThreadsFoundEvent.detail,
        metadata,
      );

      expect(result.source).toEqual({
        Bucket: 'unscanned-bucket',
        Key: 'dl/test-file.pdf',
      });
      expect(result.destination).toEqual({
        Bucket: 'safe-bucket',
        Key: 'dl/test-file.pdf',
      });
      expect(result.eventToPublish.fileSafe).toBeDefined();
      expect(result.eventToPublish.fileSafe!.data.messageReference).toBe(
        'msg-ref-456',
      );
      expect(result.eventToPublish.fileSafe!.data.senderId).toBe('sender-123');
      expect(result.eventToPublish.fileSafe!.data.letterUri).toBe(
        's3://safe-bucket/dl/test-file.pdf',
      );
      expect(result.eventToPublish.fileQuarantined).toBeUndefined();
    });

    it('creates FileQuarantined event when threats are found', () => {
      const scanDetail = {
        ...guardDutyThreadsFoundEvent.detail,
        scanResultDetails: {
          scanResultStatus: 'THREATS_FOUND' as const,
          threats: [{ name: 'EICAR-Test-File' }],
        },
      };

      const result = handler.createObjectsFromData(
        'COMPLETED',
        'dl/infected-file.pdf',
        scanDetail,
        metadata,
      );

      expect(result.source).toEqual({
        Bucket: 'unscanned-bucket',
        Key: 'dl/infected-file.pdf',
      });
      expect(result.destination).toEqual({
        Bucket: 'quarantine-bucket',
        Key: 'dl/infected-file.pdf',
      });
      expect(result.eventToPublish.fileQuarantined).toBeDefined();
      expect(result.eventToPublish.fileQuarantined?.data.messageReference).toBe(
        'msg-ref-456',
      );
      expect(result.eventToPublish.fileQuarantined?.data.senderId).toBe(
        'sender-123',
      );
      expect(result.eventToPublish.fileQuarantined?.data.letterUri).toBe(
        's3://quarantine-bucket/dl/infected-file.pdf',
      );
      expect(result.eventToPublish.fileSafe).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith({
        description: 'File scan did not complete successfully',
        scanStatus: 'COMPLETED',
        scanResultDetails: scanDetail.scanResultDetails,
        key: 'd-file.pdf',
        messageReference: 'msg-ref-456',
        senderId: 'sender-123',
      });
    });

    it('creates FileQuarantined event when scan status is not COMPLETED', () => {
      const result = handler.createObjectsFromData(
        'FAILED',
        'dl/failed-scan.pdf',
        guardDutyNoThreadsFoundEvent.detail,
        metadata,
      );

      expect(result.destination.Bucket).toBe('quarantine-bucket');
      expect(result.eventToPublish.fileQuarantined).toBeDefined();
      expect(result.eventToPublish.fileSafe).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith({
        description: 'File scan did not complete successfully',
        scanStatus: 'FAILED',
        scanResultDetails:
          guardDutyNoThreadsFoundEvent.detail.scanResultDetails,
        key: 'd-scan.pdf',
        messageReference: 'msg-ref-456',
        senderId: 'sender-123',
      });
    });
  });

  describe('handle', () => {
    it('processes safe file successfully', async () => {
      const result = await handler.handle(guardDutyNoThreadsFoundEvent.detail);

      expect(result).not.toBeNull();
      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockGetS3ObjectMetadata).toHaveBeenCalledWith({
        Bucket: 'unscanned-bucket',
        Key: 'dl/sample.pdf',
      });
      expect(mockCopyAndDeleteObjectS3).toHaveBeenCalledWith(
        { Bucket: 'unscanned-bucket', Key: 'dl/sample.pdf' },
        { Bucket: 'safe-bucket', Key: 'dl/sample.pdf' },
      );
      expect(result?.fileSafe).toBeDefined();
      expect(result?.fileQuarantined).toBeUndefined();
    });

    it('processes infected file successfully', async () => {
      const result = await handler.handle(guardDutyThreadsFoundEvent.detail);

      expect(mockCopyAndDeleteObjectS3).toHaveBeenCalledWith(
        { Bucket: 'unscanned-bucket', Key: 'dl/sample.pdf' },
        { Bucket: 'quarantine-bucket', Key: 'dl/sample.pdf' },
      );
      expect(result?.fileQuarantined).toBeDefined();
      expect(result?.fileSafe).toBeUndefined();
    });

    it('returns null when event is not for digital letters', async () => {
      const scanResult = {
        ...guardDutyNoThreadsFoundEvent,
        detail: {
          ...guardDutyNoThreadsFoundEvent.detail,
          s3ObjectDetails: {
            ...guardDutyNoThreadsFoundEvent.detail.s3ObjectDetails,
            bucketName: 'wrong-bucket',
            objectKey: 'dl/file.pdf',
          },
        },
      };

      const result = await handler.handle(scanResult.detail);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith({
        description: 'Scan result event is not valid, skipping processing.',
        sourceBucket: 'wrong-bucket',
        key: 'dl/file.pdf',
      });
      expect(mockCopyAndDeleteObjectS3).not.toHaveBeenCalled();
    });

    it('returns null when metadata extraction fails', async () => {
      const scanResult = {
        ...guardDutyNoThreadsFoundEvent,
        detail: {
          ...guardDutyNoThreadsFoundEvent.detail,
          s3ObjectDetails: {
            ...guardDutyNoThreadsFoundEvent.detail.s3ObjectDetails,
            bucketName: 'unscanned-bucket',
            objectKey: 'dl/file-without-metadata.pdf',
          },
        },
      };

      mockGetS3ObjectMetadata.mockResolvedValue({});

      const result = await handler.handle(scanResult.detail);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith({
        description:
          'Failed to extract required metadata from scanned file, skipping processing.',
        subkey: 'tadata.pdf',
      });
      expect(mockCopyAndDeleteObjectS3).not.toHaveBeenCalled();
    });
  });
});
