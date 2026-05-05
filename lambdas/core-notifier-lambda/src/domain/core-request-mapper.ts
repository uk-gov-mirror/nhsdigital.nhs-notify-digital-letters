import { PDMResourceAvailable } from 'digital-letters-events';
import { Sender, logger } from 'utils';
import type { SingleMessageRequest } from 'domain/request';
import { buildNhsAppResourceUrl } from 'domain/build-nhsapp-resource-url';

export class CoreRequestMapper {
  private readonly nhsAppBaseUrl: string;

  constructor(nhsAppBaseUrl: string) {
    this.nhsAppBaseUrl = nhsAppBaseUrl;
  }

  public mapPdmEventToSingleMessageRequest(
    pdmResourceAvailable: PDMResourceAvailable,
    sender: Sender,
  ): SingleMessageRequest {
    const { data } = pdmResourceAvailable;
    const { messageReference } = data;

    const coreMessageReference = `${sender.senderId}_${messageReference}`;

    logger.info({
      description: 'Mapping resource available',
      messageReference,
      coreMessageReference,
      senderId: sender.senderId,
    });

    const request: SingleMessageRequest = {
      data: {
        type: 'Message',
        attributes: {
          routingPlanId: sender.routingConfigId!,
          messageReference: coreMessageReference,
          billingReference: sender.senderId,
          recipient: {
            nhsNumber: data.nhsNumber,
          },
          originator: {
            odsCode: data.odsCode,
          },
          personalisation: {
            digitalLetterURL: buildNhsAppResourceUrl(
              this.nhsAppBaseUrl,
              data.resourceId,
            ),
          },
        },
      },
    };
    return request;
  }
}
