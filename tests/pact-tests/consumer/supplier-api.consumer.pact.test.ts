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
import path from 'node:path';
import { PACT_CONSUMER } from '../utils/pact-config';

const PACT_DIRECTORY = path.resolve(__dirname, '../.pacts/supplier-api');

async function handle(event: unknown) {
  $SupplierApiLetterEvent.parse(event);
}

describe('Pact message consumer - Supplier API events', () => {
  const messagePact = new MessageConsumerPact({
    consumer: PACT_CONSUMER,
    provider: 'supplier-api',
    dir: PACT_DIRECTORY,
    logLevel: 'error',
    pactfileWriteMode: 'update',
  });

  it('validates a letter accepted event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_accepted')
        .withContent({
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
            status: LetterAcceptedEvent.data.status,
            supplierId: MatchersV3.string(LetterAcceptedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterAcceptedEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter returned event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_returned')
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
            specificationId: MatchersV3.string(
              LetterReturnedEvent.data.specificationId,
            ),
            status: LetterReturnedEvent.data.status,
            supplierId: MatchersV3.string(LetterReturnedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterReturnedEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter failed event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_failed')
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
            specificationId: MatchersV3.string(
              LetterFailedEvent.data.specificationId,
            ),
            status: LetterFailedEvent.data.status,
            supplierId: MatchersV3.string(LetterFailedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterFailedEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter dispatched event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_dispatched')
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterDispatchedEvent.data.origin.subject,
              ),
            },
            specificationId: MatchersV3.string(
              LetterDispatchedEvent.data.specificationId,
            ),
            status: LetterDispatchedEvent.data.status,
            supplierId: MatchersV3.string(
              LetterDispatchedEvent.data.supplierId,
            ),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterDispatchedEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter printed event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_printed')
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterPrintedEvent.data.origin.subject,
              ),
            },
            specificationId: MatchersV3.string(
              LetterPrintedEvent.data.specificationId,
            ),
            status: LetterPrintedEvent.data.status,
            supplierId: MatchersV3.string(LetterPrintedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterPrintedEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter rejected event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_rejected')
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
            specificationId: MatchersV3.string(
              LetterRejectedEvent.data.specificationId,
            ),
            status: LetterRejectedEvent.data.status,
            supplierId: MatchersV3.string(LetterRejectedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterRejectedEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter cancelled event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_cancelled')
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterCancelledEvent.data.origin.subject,
              ),
            },
            reasonCode: MatchersV3.string(LetterCancelledEvent.data.reasonCode),
            reasonText: MatchersV3.string(LetterCancelledEvent.data.reasonText),
            specificationId: MatchersV3.string(
              LetterCancelledEvent.data.specificationId,
            ),
            status: LetterCancelledEvent.data.status,
            supplierId: MatchersV3.string(LetterCancelledEvent.data.supplierId),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterCancelledEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter delivered event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_delivered')
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterDeliveredEvent.data.origin.subject,
              ),
            },
            specificationId: MatchersV3.string(
              LetterDeliveredEvent.data.specificationId,
            ),
            status: LetterDeliveredEvent.data.status,
            supplierId: MatchersV3.string(LetterDeliveredEvent.data.supplierId),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterDeliveredEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter enclosed event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_enclosed')
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterEnclosedEvent.data.origin.subject,
              ),
            },
            specificationId: MatchersV3.string(
              LetterEnclosedEvent.data.specificationId,
            ),
            status: LetterEnclosedEvent.data.status,
            supplierId: MatchersV3.string(LetterEnclosedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterEnclosedEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter forwarded event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_forwarded')
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterForwardedEvent.data.origin.subject,
              ),
            },
            reasonCode: MatchersV3.string(LetterForwardedEvent.data.reasonCode),
            reasonText: MatchersV3.string(LetterForwardedEvent.data.reasonText),
            specificationId: MatchersV3.string(
              LetterForwardedEvent.data.specificationId,
            ),
            status: LetterForwardedEvent.data.status,
            supplierId: MatchersV3.string(LetterForwardedEvent.data.supplierId),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterForwardedEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });

  it('validates a letter pending event', async () => {
    await expect(
      messagePact
        .expectsToReceive('SupplierApiEvent-letter_pending')
        .withContent({
          data: {
            origin: {
              subject: MatchersV3.regex(
                /^client\/[^/]+\/letter-request\/[^/]+$/,
                LetterPendingEvent.data.origin.subject,
              ),
            },
            specificationId: MatchersV3.string(
              LetterPendingEvent.data.specificationId,
            ),
            status: LetterPendingEvent.data.status,
            supplierId: MatchersV3.string(LetterPendingEvent.data.supplierId),
          },
          time: MatchersV3.timestamp(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            LetterPendingEvent.time,
          ),
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });
});
