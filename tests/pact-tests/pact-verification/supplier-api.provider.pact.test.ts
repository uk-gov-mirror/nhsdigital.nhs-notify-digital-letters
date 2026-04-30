import { MessageProviderPact } from '@pact-foundation/pact';

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
  PACT_CONSUMER,
  PACT_SUPPLIER_API_PROVIDER,
} from '../utils/pact-config';
import { getPactFilePath } from '../utils/path-utils';

const PACT_FILE = getPactFilePath(PACT_CONSUMER, PACT_SUPPLIER_API_PROVIDER);

describe('Supplier API provider tests', () => {
  test('verify pacts', async () => {
    const p = new MessageProviderPact({
      provider: PACT_SUPPLIER_API_PROVIDER,
      pactUrls: [PACT_FILE],
      messageProviders: {
        'SupplierApiEvent-letter_accepted': () => LetterAcceptedEvent,
        'SupplierApiEvent-letter_cancelled': () => LetterCancelledEvent,
        'SupplierApiEvent-letter_delivered': () => LetterDeliveredEvent,
        'SupplierApiEvent-letter_dispatched': () => LetterDispatchedEvent,
        'SupplierApiEvent-letter_enclosed': () => LetterEnclosedEvent,
        'SupplierApiEvent-letter_failed': () => LetterFailedEvent,
        'SupplierApiEvent-letter_forwarded': () => LetterForwardedEvent,
        'SupplierApiEvent-letter_pending': () => LetterPendingEvent,
        'SupplierApiEvent-letter_printed': () => LetterPrintedEvent,
        'SupplierApiEvent-letter_rejected': () => LetterRejectedEvent,
        'SupplierApiEvent-letter_returned': () => LetterReturnedEvent,
      },
      logLevel: 'error',
    });

    await expect(p.verify()).resolves.not.toThrow();
  });
});
