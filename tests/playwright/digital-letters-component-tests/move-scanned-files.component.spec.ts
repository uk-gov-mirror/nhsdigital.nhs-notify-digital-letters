import { expect, test } from '@playwright/test';
import {
  EVENT_BUS_LOG_GROUP_NAME,
  FILE_QUARANTINE_S3_BUCKET_NAME,
  FILE_SAFE_S3_BUCKET_NAME,
  MOVE_SCANNED_FILES_DLQ_NAME,
  MOVE_SCANNED_FILES_LAMBDA_LOG_GROUP_NAME,
  PREFIX_DL_FILES,
  UNSCANNED_FILES_S3_BUCKET_NAME,
} from 'constants/backend-constants';
import { SENDER_ID_SKIPS_NOTIFY } from 'constants/tests-constants';
import { getLogsFromCloudwatch } from 'helpers/cloudwatch-helpers';
import expectToPassEventually from 'helpers/expectations';
import { expectMessageContainingString, purgeQueue } from 'helpers/sqs-helpers';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3ObjectMetadata, s3Client } from 'utils';

test.describe('Digital Letters - Move Scanned Files', () => {
  test.beforeAll(async () => {
    await purgeQueue(MOVE_SCANNED_FILES_DLQ_NAME);
  });

  test('given file without virus, when uploaded into S3 bucket and guardduty scan passes then a FileSafe event is triggered', async () => {
    test.setTimeout(800_000);
    const messageReference = uuidv4();
    const createdAt = new Date().toISOString();
    const objectKey = `${PREFIX_DL_FILES}${messageReference}.txt`;

    const body = Buffer.from('test file content');

    const params = {
      Bucket: UNSCANNED_FILES_S3_BUCKET_NAME,
      Key: objectKey,
      Body: body,
      ContentType: 'application/pdf',
      Metadata: {
        messageReference,
        senderId: SENDER_ID_SKIPS_NOTIFY,
        createdAt,
      },
    };

    await s3Client.send(new PutObjectCommand(params));

    // Verify the event is processed and a message appears in the Lambda logs
    await expectToPassEventually(async () => {
      const filteredLogs = await getLogsFromCloudwatch(
        MOVE_SCANNED_FILES_LAMBDA_LOG_GROUP_NAME,
        [
          '$.message.description  = "Moved file to destination bucket"',
          '$.message.scanStatus  = "COMPLETED"',
          `$.message.messageReference  = "${messageReference}"`,
          `$.message.senderId  = "${SENDER_ID_SKIPS_NOTIFY}"`,
        ],
      );

      expect(filteredLogs.length).toEqual(1);
    }, 240);

    // Verify the event is published in the event bus
    await expectToPassEventually(async () => {
      const expectedLetterUri = `s3://${FILE_SAFE_S3_BUCKET_NAME}/${objectKey}`;
      const eventLogEntry = await getLogsFromCloudwatch(
        EVENT_BUS_LOG_GROUP_NAME,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.print.file.safe.v1"',
          `$.details.event_detail = "*\\"messageReference\\":\\"${messageReference}\\"*"`,
          `$.details.event_detail = "*\\"senderId\\":\\"${SENDER_ID_SKIPS_NOTIFY}\\"*"`,
          `$.details.event_detail = "*\\"createdAt\\":\\"${createdAt}\\"*"`,
          `$.details.event_detail = "*\\"letterUri\\":\\"${expectedLetterUri}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toEqual(1);
    }, 240);

    await expectToPassEventually(async () => {
      const metadata = await getS3ObjectMetadata({
        Bucket: FILE_SAFE_S3_BUCKET_NAME,
        Key: objectKey,
      });
      expect(metadata).toBeDefined();
      expect(metadata?.messagereference).toEqual(messageReference);
      expect(metadata?.senderid).toEqual(SENDER_ID_SKIPS_NOTIFY);
      expect(metadata?.createdat).toEqual(createdAt);

      // check the file was deleted from the unscanned bucket
      let originalMetadata;
      try {
        originalMetadata = await getS3ObjectMetadata({
          Bucket: UNSCANNED_FILES_S3_BUCKET_NAME,
          Key: objectKey,
        });
      } catch {
        // expected error
      }
      expect(originalMetadata).toBeUndefined();
    }, 240);
  });

  test('given file with EICAR virus, when uploaded into S3 bucket and guardduty scan completes then a FileQuarantine event is triggered', async () => {
    test.setTimeout(800_000);
    const messageReference = uuidv4();
    const createdAt = new Date().toISOString();
    const objectKey = `${PREFIX_DL_FILES}${messageReference}.txt`;
    // Divided in two strings in case it could trigger any antivirus software. Lint complains about unnecessary escape \P, so ignoring it
    const part1EicarFile = 'X5O!P%@AP[4\PZX54(P^)7CC)7}$'; //eslint-disable-line
    const part2EicarFile = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

    const body = Buffer.from(part1EicarFile + part2EicarFile);

    const params = {
      Bucket: UNSCANNED_FILES_S3_BUCKET_NAME,
      Key: objectKey,
      Body: body,
      ContentType: 'application/pdf',
      Metadata: {
        messageReference,
        senderId: SENDER_ID_SKIPS_NOTIFY,
        createdAt,
      },
    };

    await s3Client.send(new PutObjectCommand(params));

    // Verify the event is processed and a message appears in the Lambda logs
    await expectToPassEventually(async () => {
      const filteredLogs = await getLogsFromCloudwatch(
        MOVE_SCANNED_FILES_LAMBDA_LOG_GROUP_NAME,
        [
          '$.message.description  = "Moved file to destination bucket"',
          '$.message.scanStatus  = "COMPLETED"',
          `$.message.messageReference  = "${messageReference}"`,
          `$.message.senderId  = "${SENDER_ID_SKIPS_NOTIFY}"`,
        ],
      );

      expect(filteredLogs.length).toEqual(1);
    }, 240);

    // Verify the event is published in the event bus
    await expectToPassEventually(async () => {
      const expectedLetterUri = `s3://${FILE_QUARANTINE_S3_BUCKET_NAME}/${objectKey}`;
      const eventLogEntry = await getLogsFromCloudwatch(
        EVENT_BUS_LOG_GROUP_NAME,
        [
          '$.message_type = "EVENT_RECEIPT"',
          '$.details.detail_type = "uk.nhs.notify.digital.letters.print.file.quarantined.v1"',
          `$.details.event_detail = "*\\"messageReference\\":\\"${messageReference}\\"*"`,
          `$.details.event_detail = "*\\"senderId\\":\\"${SENDER_ID_SKIPS_NOTIFY}\\"*"`,
          `$.details.event_detail = "*\\"createdAt\\":\\"${createdAt}\\"*"`,
          `$.details.event_detail = "*\\"letterUri\\":\\"${expectedLetterUri}\\"*"`,
        ],
      );

      expect(eventLogEntry.length).toEqual(1);
    }, 240);

    await expectToPassEventually(async () => {
      const metadata = await getS3ObjectMetadata({
        Bucket: FILE_QUARANTINE_S3_BUCKET_NAME,
        Key: objectKey,
      });
      expect(metadata).toBeDefined();
      expect(metadata?.messagereference).toEqual(messageReference);
      expect(metadata?.senderid).toEqual(SENDER_ID_SKIPS_NOTIFY);
      expect(metadata?.createdat).toEqual(createdAt);

      // check the file was deleted from the unscanned bucket
      let originalMetadata;
      try {
        originalMetadata = await getS3ObjectMetadata({
          Bucket: UNSCANNED_FILES_S3_BUCKET_NAME,
          Key: objectKey,
        });
      } catch {
        // expected error
      }
      expect(originalMetadata).toBeUndefined();
    }, 240);
  });

  test('given file without REQUIRED metadata, when uploaded into S3 bucket and guardduty scan passes then it goes to DLQ', async () => {
    test.setTimeout(160_000);
    const messageReference = uuidv4();
    const objectKey = `${PREFIX_DL_FILES}${messageReference}.txt`;

    const body = Buffer.from('test file content');

    const params = {
      Bucket: UNSCANNED_FILES_S3_BUCKET_NAME,
      Key: objectKey,
      Body: body,
      ContentType: 'application/pdf',
      Metadata: {
        messageReference,
        // senderId and createdAt are missing
      },
    };

    await s3Client.send(new PutObjectCommand(params));

    // Verify there is a message in the DLQ
    await expectMessageContainingString(
      MOVE_SCANNED_FILES_DLQ_NAME,
      objectKey,
      150,
    );
  });
});
