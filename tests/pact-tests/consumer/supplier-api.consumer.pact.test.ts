import LetterAcceptedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.ACCEPTED.json';
import LetterCancelledEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.CANCELLED.json';
import LetterDeliveredEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.DELIVERED.json';
import LetterDispatchedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.DISPATCHED.json';
import LetterEnclosedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.ENCLOSED.json';
import LetterFailedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.FAILED.json';
import LetterForwardedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.FORWARDED.json';
import LetterPendingEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.PENDING.json';
import LetterPrintedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.PRINTED.json';
import LetterRejectedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.REJECTED.json';
import LetterReturnedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.RETURNED.json';
import {
  MatchersV3,
  MessageConsumerPact,
  asynchronousBodyHandler,
} from '@pact-foundation/pact';
import { $SupplierApiLetterEvent } from 'utils';
import {
  PACT_CONSUMER,
  PACT_SUPPLIER_API_PROVIDER,
} from '../utils/pact-config';
import { getPathFromProvider } from '../utils/path-utils';

const PACT_DIRECTORY = getPathFromProvider(PACT_SUPPLIER_API_PROVIDER);

async function handle(event: unknown) {
  $SupplierApiLetterEvent.parse(event);
}

function buildValidator(status: string, includeReason = false) {
  return {
    data: {
      origin: {
        subject: MatchersV3.regex(
          /^client\/[^/]+\/letter-request\/[^/]+$/,
          LetterAcceptedEvent.data.origin.subject,
        ),
      },
      specificationId: MatchersV3.string(
        LetterAcceptedEvent.data.specificationId,
      ),
      status,
      supplierId: MatchersV3.string(LetterAcceptedEvent.data.supplierId),
      ...(includeReason && {
        reasonCode: MatchersV3.string(LetterFailedEvent.data.reasonCode),
        reasonText: MatchersV3.string(LetterFailedEvent.data.reasonText),
      }),
    },
    time: MatchersV3.timestamp(
      "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
      LetterAcceptedEvent.time,
    ),
  };
}

describe('Pact message consumer - Supplier API events', () => {
  const messagePact = new MessageConsumerPact({
    consumer: PACT_CONSUMER,
    provider: PACT_SUPPLIER_API_PROVIDER,
    dir: PACT_DIRECTORY,
    logLevel: 'error',
    pactfileWriteMode: 'update',
  });

  it('validates a letter accepted event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_accepted')
        .withContent(buildValidator(LetterAcceptedEvent.data.status))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter returned event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_returned')
        .withContent(buildValidator(LetterReturnedEvent.data.status, true))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter failed event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_failed')
        .withContent(buildValidator(LetterFailedEvent.data.status, true))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter dispatched event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_dispatched')
        .withContent(buildValidator(LetterDispatchedEvent.data.status))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter printed event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_printed')
        .withContent(buildValidator(LetterPrintedEvent.data.status))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter rejected event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_rejected')
        .withContent(buildValidator(LetterRejectedEvent.data.status, true))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter cancelled event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_cancelled')
        .withContent(buildValidator(LetterCancelledEvent.data.status, true))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter delivered event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_delivered')
        .withContent(buildValidator(LetterDeliveredEvent.data.status))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter enclosed event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_enclosed')
        .withContent(buildValidator(LetterEnclosedEvent.data.status))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter forwarded event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_forwarded')
        .withContent(buildValidator(LetterForwardedEvent.data.status, true))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter pending event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_pending')
        .withContent(buildValidator(LetterPendingEvent.data.status))
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });
});
