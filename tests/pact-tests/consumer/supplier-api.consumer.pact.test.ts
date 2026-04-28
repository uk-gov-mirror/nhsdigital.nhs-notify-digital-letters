
import LetterAccpectedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.ACCEPTED.json';
import LetterReturnedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.RETURNED.json';
import LetterFailedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.FAILED.json';
import LetterDispatchedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.DISPATCHED.json';
import LetterPrintedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.PRINTED.json';
import LetterRejectedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.REJECTED.json';
import {
  MatchersV3,
  MessageConsumerPact,
  asynchronousBodyHandler,
} from '@pact-foundation/pact';
import { $SupplierApiLetterEvent } from 'utils';
import path from 'node:path';
import {
  PACT_CONSUMER,
} from '../utils/pact-config';

const PACT_DIRECTORY = path.resolve(
  __dirname,
  '../.pacts/supplier-api',
);

async function handle(event: unknown) {
  $SupplierApiLetterEvent.parse(event);
}

describe('Pact message consumer - Supplier API events', () => {
    const messagePact = new MessageConsumerPact({
    consumer: PACT_CONSUMER,
    provider: "supplier-api",
    dir: PACT_DIRECTORY,
    logLevel: 'error',
    pactfileWriteMode: 'update',
  });

  it('validates a letter accepted event', async () => {
    await expect(
      messagePact
        .expectsToReceive("SupplierApiEvent-letter_accepted")
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterAccpectedEvent.data.origin.subject,
              ),
            },
            specificationId: MatchersV3.string(LetterAccpectedEvent.data.specificationId),
            status: LetterAccpectedEvent.data.status,
            supplierId: MatchersV3.string(LetterAccpectedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", LetterAccpectedEvent.time),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter returned event', async () => {
    await expect(
      messagePact
        .expectsToReceive("SupplierApiEvent-letter_returned")
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterReturnedEvent.data.origin.subject,
              ),
            },
            reasonCode: MatchersV3.string(LetterReturnedEvent.data.reasonCode),
            reasonText: MatchersV3.string(LetterReturnedEvent.data.reasonText),
            specificationId: MatchersV3.string(LetterReturnedEvent.data.specificationId),
            status: LetterReturnedEvent.data.status,
            supplierId: MatchersV3.string(LetterReturnedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", LetterReturnedEvent.time),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter failed event', async () => {
    await expect(
      messagePact
        .expectsToReceive("SupplierApiEvent-letter_failed")
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterFailedEvent.data.origin.subject,
              ),
            },
            reasonCode: MatchersV3.string(LetterFailedEvent.data.reasonCode),
            reasonText: MatchersV3.string(LetterFailedEvent.data.reasonText),
            specificationId: MatchersV3.string(LetterFailedEvent.data.specificationId),
            status: LetterFailedEvent.data.status,
            supplierId: MatchersV3.string(LetterFailedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", LetterFailedEvent.time),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter dispatched event', async () => {
    await expect(
      messagePact
        .expectsToReceive("SupplierApiEvent-letter_dispatched")
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterDispatchedEvent.data.origin.subject,
              ),
            },
            specificationId: MatchersV3.string(LetterDispatchedEvent.data.specificationId),
            status: LetterDispatchedEvent.data.status,
            supplierId: MatchersV3.string(LetterDispatchedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", LetterDispatchedEvent.time),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter printed event', async () => {
    await expect(
      messagePact
        .expectsToReceive("SupplierApiEvent-letter_printed")
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterPrintedEvent.data.origin.subject,
              ),
            },
            specificationId: MatchersV3.string(LetterPrintedEvent.data.specificationId),
            status: LetterPrintedEvent.data.status,
            supplierId: MatchersV3.string(LetterPrintedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", LetterPrintedEvent.time),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter rejected event', async () => {
    await expect(
      messagePact
        .expectsToReceive("SupplierApiEvent-letter_rejected")
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterRejectedEvent.data.origin.subject,
              ),
            },
            reasonCode: MatchersV3.string(LetterRejectedEvent.data.reasonCode),
            reasonText: MatchersV3.string(LetterRejectedEvent.data.reasonText),
            specificationId: MatchersV3.string(LetterRejectedEvent.data.specificationId),
            status: LetterRejectedEvent.data.status,
            supplierId: MatchersV3.string(LetterRejectedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", LetterRejectedEvent.time),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });
});
