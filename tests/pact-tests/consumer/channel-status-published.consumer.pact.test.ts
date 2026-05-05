import ChannelStatusPublishedEventPaperLetterOptedOut from '@nhsdigital/nhs-notify-event-schemas-status-published/examples/ChannelStatusPublishedEvent/v1/paper_letter_opted_out.json';
import {
  MatchersV3,
  MessageConsumerPact,
  asynchronousBodyHandler,
} from '@pact-foundation/pact';
import { $ChannelStatusPublishedEvent } from 'utils';
import {
  PACT_CONSUMER,
  PACT_DIRECTORY,
  PACT_MESSAGE_DESCRIPTION,
  PACT_PROVIDER,
} from '../utils/pact-config';

async function handle(event: unknown) {
  // The schema used by the nhsapp-status-handler to validate the event.
  $ChannelStatusPublishedEvent.parse(event);
}

describe('Pact message consumer - ChannelStatusPublished event', () => {
  const messagePact = new MessageConsumerPact({
    consumer: PACT_CONSUMER,
    provider: PACT_PROVIDER,
    dir: PACT_DIRECTORY,
    logLevel: 'error',
    pactfileWriteMode: 'update',
  });

  it('validates a channel status published event', async () => {
    await expect(
      messagePact
        .expectsToReceive(PACT_MESSAGE_DESCRIPTION)
        .withContent({
          data: {
            messageReference: MatchersV3.string(
              ChannelStatusPublishedEventPaperLetterOptedOut.data
                .messageReference,
            ),
            supplierStatus:
              ChannelStatusPublishedEventPaperLetterOptedOut.data
                .supplierStatus,
          },
        })
        .verify(asynchronousBodyHandler(handle)),
    ).resolves.not.toThrow();
  });
});
