import path from 'node:path';

export const PACT_CONSUMER = 'digital-letters';
export const PACT_PROVIDER = 'status-published';
export const PACT_MESSAGE_DESCRIPTION =
  'ChannelStatusPublishedEvent-paper_letter_opted_out';
export const PACT_DIRECTORY = path.resolve(
  __dirname,
  '../.pacts/status-published',
);
export const PACT_FILE = path.join(
  PACT_DIRECTORY,
  `${PACT_CONSUMER}-${PACT_PROVIDER}.json`,
);
