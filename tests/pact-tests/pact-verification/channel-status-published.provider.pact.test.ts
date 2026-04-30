import { MessageProviderPact } from '@pact-foundation/pact';

import ChannelStatusPublishedEventPaperLetterOptedOut from '@nhsdigital/nhs-notify-event-schemas-status-published/examples/ChannelStatusPublishedEvent/v1/paper_letter_opted_out.json';
import { getPactFilePath } from '../utils/path-utils';
import {
  PACT_CONSUMER,
  PACT_MESSAGE_DESCRIPTION,
  PACT_STATUS_PUBLISHED_PROVIDER,
} from '../utils/pact-config';

const PACT_FILE = getPactFilePath(
  PACT_CONSUMER,
  PACT_STATUS_PUBLISHED_PROVIDER,
);

describe('Channel status published provider tests', () => {
  test('verify pacts', async () => {
    const p = new MessageProviderPact({
      provider: PACT_STATUS_PUBLISHED_PROVIDER,
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
