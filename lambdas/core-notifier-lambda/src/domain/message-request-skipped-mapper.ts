import {
  MessageRequestSkipped,
  PDMResourceAvailable,
} from 'digital-letters-events';
import { Sender } from 'utils';
import { randomUUID } from 'node:crypto';

// The linter won't allow this to be a class if the public function is not using "this"
export function mapPdmEventToMessageRequestSkipped(
  pdmResourceAvailable: PDMResourceAvailable,
  sender: Sender,
): MessageRequestSkipped {
  const { data } = pdmResourceAvailable;
  const { messageReference } = data;

  return {
    ...pdmResourceAvailable,
    id: randomUUID(),
    time: new Date().toISOString(),
    recordedtime: new Date().toISOString(),
    type: 'uk.nhs.notify.digital.letters.messages.request.skipped.v1',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-message-request-skipped-data.schema.json',
    source: pdmResourceAvailable.source.replace(/\/pdm$/, '/messages'),
    data: {
      messageReference,
      senderId: sender.senderId,
    },
  };
}
