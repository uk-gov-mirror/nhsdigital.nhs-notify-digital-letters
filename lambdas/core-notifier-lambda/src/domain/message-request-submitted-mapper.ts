import {
  MessageRequestSubmitted,
  PDMResourceAvailable,
} from 'digital-letters-events';
import { Sender } from 'utils';
import { randomUUID } from 'node:crypto';
import { buildNhsAppResourceUrl } from 'domain/build-nhsapp-resource-url';

export class MessageRequestSubmittedMapper {
  private readonly nhsAppBaseUrl: string;

  constructor(nhsAppBaseUrl: string) {
    this.nhsAppBaseUrl = nhsAppBaseUrl;
  }

  public mapPdmEventToMessageRequestSubmitted(
    pdmResourceAvailable: PDMResourceAvailable,
    sender: Sender,
    notifyId: string,
  ): MessageRequestSubmitted {
    const { data } = pdmResourceAvailable;
    const { messageReference } = data;

    return {
      ...pdmResourceAvailable,
      id: randomUUID(),
      time: new Date().toISOString(),
      recordedtime: new Date().toISOString(),
      type: 'uk.nhs.notify.digital.letters.messages.request.submitted.v1',
      dataschema:
        'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-message-request-submitted-data.schema.json',
      source: pdmResourceAvailable.source.replace(/\/pdm$/, '/messages'),
      data: {
        messageReference,
        senderId: sender.senderId,
        notifyId,
        messageUri: buildNhsAppResourceUrl(this.nhsAppBaseUrl, data.resourceId),
      },
    };
  }
}
