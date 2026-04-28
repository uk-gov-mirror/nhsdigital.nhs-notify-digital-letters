import { MessageProviderPact } from '@pact-foundation/pact';
import path from 'node:path';

import LetterAcceptedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.ACCEPTED.json';
import LetterReturnedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.RETURNED.json';
import LetterFailedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.FAILED.json';
import LetterDispatchedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.DISPATCHED.json';
import LetterPrintedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.PRINTED.json';
import LetterRejectedEvent from '@nhsdigital/nhs-notify-event-schemas-supplier-api/schemas/examples/letter.REJECTED.json';

import { PACT_CONSUMER } from '../utils/pact-config';

const PACT_PROVIDER = 'supplier-api';
const PACT_DIRECTORY = path.resolve(__dirname, '../.pacts/supplier-api');
const PACT_FILE = path.join(
  PACT_DIRECTORY,
  `${PACT_CONSUMER}-${PACT_PROVIDER}.json`,
);

describe('Supplier API provider tests', () => {
  test('verify pacts', async () => {
    const p = new MessageProviderPact({
      provider: PACT_PROVIDER,
      pactUrls: [PACT_FILE],
      messageProviders: {
        'SupplierApiEvent-letter_accepted': () => LetterAcceptedEvent,
        'SupplierApiEvent-letter_returned': () => LetterReturnedEvent,
        'SupplierApiEvent-letter_failed': () => LetterFailedEvent,
        'SupplierApiEvent-letter_dispatched': () => LetterDispatchedEvent,
        'SupplierApiEvent-letter_printed': () => LetterPrintedEvent,
        'SupplierApiEvent-letter_rejected': () => LetterRejectedEvent,
      },
      logLevel: 'error',
    });

    await expect(p.verify()).resolves.not.toThrow();
  });
});
