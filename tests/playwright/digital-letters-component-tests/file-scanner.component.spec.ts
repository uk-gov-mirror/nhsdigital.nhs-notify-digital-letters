import { expect, test } from '@playwright/test';
import {
  ENV,
  FILE_SCANNER_DLQ_NAME,
  PREFIX_DL_FILES,
  REGION,
} from 'constants/backend-constants';
import eventPublisher from 'helpers/event-bus-helpers';
import expectToPassEventually from 'helpers/expectations';
import { expectMessageContainingString, purgeQueue } from 'helpers/sqs-helpers';
import { v4 as uuidv4 } from 'uuid';
import {
  getS3ObjectBufferFromUri,
  getS3ObjectMetadata,
  putDataS3,
} from 'utils';
import { validateItemDequeued } from 'digital-letters-events';

const DOCUMENT_REFERENCE_BUCKET = `nhs-${process.env.AWS_ACCOUNT_ID}-${REGION}-${ENV}-dl-pii-data`;
const UNSCANNED_FILES_BUCKET = `nhs-${process.env.AWS_ACCOUNT_ID}-${REGION}-main-acct-digi-unscanned-files`;

test.describe('File Scanner', () => {
  test.beforeAll(async () => {
    await purgeQueue(FILE_SCANNER_DLQ_NAME);
    test.setTimeout(250_000);
  });
});

test('should extract PDF from DocumentReference and store in unscanned bucket with metadata', async () => {
  const messageReference = uuidv4();
  const senderId = 'TEST_SENDER_001';
  const documentReferenceKey = `${PREFIX_DL_FILES}${messageReference}`;

  const pdfContent = Buffer.from('Sample PDF content for test');
  const documentReference = {
    resourceType: 'DocumentReference',
    id: messageReference,
    content: [
      {
        attachment: {
          contentType: 'application/pdf',
          data: pdfContent.toString('base64'),
        },
      },
    ],
  };

  await putDataS3(documentReference, {
    Bucket: DOCUMENT_REFERENCE_BUCKET,
    Key: documentReferenceKey,
  });

  const eventId = uuidv4();
  const messageUri = `s3://${DOCUMENT_REFERENCE_BUCKET}/${documentReferenceKey}`;
  const eventTime = new Date().toISOString();

  await eventPublisher.sendEvents(
    [
      {
        id: eventId,
        plane: 'data',
        dataschemaversion: '1.0.0',
        specversion: '1.0',
        source: `/nhs/england/notify/development/dev-1/digitalletters/queue`,
        subject: `message/${messageReference}`,
        type: 'uk.nhs.notify.digital.letters.queue.item.dequeued.v1',
        time: eventTime,
        recordedtime: eventTime,
        severitynumber: 2,
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        datacontenttype: 'application/json',
        dataschema:
          'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-queue-item-dequeued-data.schema.json',
        severitytext: 'INFO',
        data: {
          messageReference,
          senderId,
          messageUri,
        },
      },
    ],
    validateItemDequeued,
  );

  await expectToPassEventually(async () => {
    const expectedKey = `${PREFIX_DL_FILES}${messageReference}.pdf`;
    const expectedUri = `s3://${UNSCANNED_FILES_BUCKET}/${expectedKey}`;

    const storedPdf = await getS3ObjectBufferFromUri(expectedUri);
    expect(storedPdf).toBeDefined();
    expect(storedPdf.toString()).toEqual(pdfContent.toString());

    const metadata = await getS3ObjectMetadata({
      Bucket: UNSCANNED_FILES_BUCKET,
      Key: expectedKey,
    });
    expect(metadata).toBeDefined();
    expect(metadata?.messagereference).toEqual(messageReference);
    expect(metadata?.senderid).toEqual(senderId);
    expect(metadata?.createdat).toBeDefined();
  }, 120);
});

test('should handle validation errors by sending messages to DLQ', async () => {
  test.setTimeout(160_000);
  const messageReference = uuidv4();
  const senderId = 'TEST_SENDER_002';
  const documentReferenceKey = `document-reference/${messageReference}`;

  const documentReference = {
    resourceType: 'DocumentReference',
    id: messageReference,
    content: [],
  };

  await putDataS3(documentReference, {
    Bucket: DOCUMENT_REFERENCE_BUCKET,
    Key: documentReferenceKey,
  });

  const eventId = uuidv4();
  const messageUri = `s3://${DOCUMENT_REFERENCE_BUCKET}/${documentReferenceKey}`;
  const eventTime = new Date().toISOString();

  await eventPublisher.sendEvents(
    [
      {
        id: eventId,
        specversion: '1.0',
        plane: 'data',
        dataschemaversion: '1.0.0',
        source: `/nhs/england/notify/development/dev-1/digitalletters/queue`,
        subject: `message/${messageReference}`,
        type: 'uk.nhs.notify.digital.letters.queue.item.dequeued.v1',
        time: eventTime,
        recordedtime: eventTime,
        severitynumber: 2,
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        datacontenttype: 'application/json',
        dataschema:
          'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-queue-item-dequeued-data.schema.json',
        severitytext: 'INFO',
        data: {
          messageReference,
          senderId,
          messageUri,
        },
      },
    ],
    validateItemDequeued,
  );

  // Verify the file was NOT processed successfully
  await expectToPassEventually(async () => {
    const expectedKey = `${ENV}/${messageReference}.pdf`;
    const expectedUri = `s3://${UNSCANNED_FILES_BUCKET}/${expectedKey}`;
    await expect(getS3ObjectBufferFromUri(expectedUri)).rejects.toThrow();
  }, 150);
  // Verify there is a message in the DLQ
  await expectMessageContainingString(FILE_SCANNER_DLQ_NAME, eventId, 150);
});
