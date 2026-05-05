import {
  MessageRequestRejected,
  PDMResourceAvailable,
} from 'digital-letters-events';
import { Sender } from 'utils';
import { randomUUID } from 'node:crypto';
import { buildNhsAppResourceUrl } from 'domain/build-nhsapp-resource-url';

const CORE_API_FAILURE_CODE = 'DL_INTE_001';

export class MessageRequestRejectedMapper {
  private readonly nhsAppBaseUrl: string;

  constructor(nhsAppBaseUrl: string) {
    this.nhsAppBaseUrl = nhsAppBaseUrl;
  }

  public mapPdmEventToMessageRequestRejected(
    pdmResourceAvailable: PDMResourceAvailable,
    sender: Sender,
    notifyFailureCode: string,
    failureReason: string,
  ): MessageRequestRejected {
    const { data } = pdmResourceAvailable;
    const { messageReference } = data;

    return {
      ...pdmResourceAvailable,
      id: randomUUID(),
      time: new Date().toISOString(),
      recordedtime: new Date().toISOString(),
      type: 'uk.nhs.notify.digital.letters.messages.request.rejected.v1',
      dataschema:
        'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-message-request-rejected-data.schema.json',
      source: pdmResourceAvailable.source.replace(/\/pdm$/, '/messages'),
      data: {
        messageReference,
        senderId: sender.senderId,
        failureCode: notifyFailureCode,
        messageUri: buildNhsAppResourceUrl(this.nhsAppBaseUrl, data.resourceId),
        reasonCode: CORE_API_FAILURE_CODE,
        reasonText: failureReason,
      },
    };
  }
}
