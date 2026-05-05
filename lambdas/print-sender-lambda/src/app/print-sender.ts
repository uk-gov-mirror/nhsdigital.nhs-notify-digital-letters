import { InvalidEvent, PDFAnalysed } from 'digital-letters-events';
import { EventPublisher, Logger } from 'utils';
import { randomUUID } from 'node:crypto';
import {
  $LetterRequestPreparedEvent,
  LetterRequestPreparedEvent,
} from '@nhsdigital/nhs-notify-event-schemas-letter-rendering';

type LetterRequestDomainId = LetterRequestPreparedEvent['data']['domainId'];

export type PrintSenderOutcome = 'sent' | 'failed';

export class PrintSender {
  constructor(
    private readonly eventPublisher: EventPublisher,
    private readonly environment: string,
    private readonly accountType: string,
    private readonly logger: Logger,
  ) {}

  async send(item: PDFAnalysed): Promise<PrintSenderOutcome> {
    try {
      const letterPreparedEvent: LetterRequestPreparedEvent = {
        id: randomUUID(),
        time: new Date().toISOString(),
        recordedtime: new Date().toISOString(),
        type: 'uk.nhs.notify.letter-rendering.letter-request.prepared.v1',
        dataschema:
          'https://notify.nhs.uk/cloudevents/schemas/letter-rendering/letter-request.prepared.1.1.5.schema.json',
        source: `/data-plane/digital-letters/${this.accountType}/${this.environment}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
        traceparent: item.traceparent,
        severitynumber: item.severitynumber,
        severitytext: 'INFO',
        subject: `client/${item.data.senderId}/letter-request/${item.data.messageReference}`,
        dataschemaversion: '1.1.5',
        plane: 'data',
        data: {
          createdAt: item.data.createdAt,
          domainId:
            `${item.data.senderId}_${item.data.messageReference}` as LetterRequestDomainId,
          pageCount: item.data.pageCount,
          requestItemPlanId: item.data.messageReference,
          sha256Hash: item.data.sha256Hash,
          status: 'PREPARED',
          url: item.data.letterUri,
          clientId: item.data.senderId,
          campaignId: 'digitalLetters',
          letterVariantId: 'notify-digital-letters-standard',
        },
      };

      await this.eventPublisher.sendEvents<LetterRequestPreparedEvent>(
        [letterPreparedEvent],
        (event, logger) => {
          const parseResult = $LetterRequestPreparedEvent.safeParse(event);
          if (!parseResult.success) {
            logger.warn({
              err: parseResult.error,
              description: 'Error parsing LetterRequestPreparedEvent event',
            });
            throw new InvalidEvent('Invalid LetterRequestPreparedEvent');
          }
        },
      );
    } catch (error) {
      this.logger.error({
        description: 'Error sending letter prepared event',
        err: error,
        messageReference: item.data.messageReference,
        senderId: item.data.senderId,
      });

      return 'failed';
    }

    return 'sent';
  }
}
