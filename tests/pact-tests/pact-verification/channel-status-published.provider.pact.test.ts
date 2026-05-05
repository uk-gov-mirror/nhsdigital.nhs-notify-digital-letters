import { MessageProviderPact } from '@pact-foundation/pact';

import ChannelStatusPublishedEventPaperLetterOptedOut from '@nhsdigital/nhs-notify-event-schemas-status-published/examples/ChannelStatusPublishedEvent/v1/paper_letter_opted_out.json';

import {
  PACT_FILE,
  PACT_MESSAGE_DESCRIPTION,
  PACT_PROVIDER,
} from '../utils/pact-config';

describe('Channel status published provider tests', () => {
  test('verify pacts', async () => {
    const p = new MessageProviderPact({
      provider: PACT_PROVIDER,
      pactUrls: [PACT_FILE],
      messageProviders: {
        [PACT_MESSAGE_DESCRIPTION]: () =>
          ChannelStatusPublishedEventPaperLetterOptedOut,
      },
      logLevel: 'error',
    });

    await expect(p.verify()).resolves.not.toThrow();
  });
});
