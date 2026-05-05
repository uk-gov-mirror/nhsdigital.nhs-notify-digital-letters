import { ChannelStatusPublishedEvent, Logger } from 'utils';
import { TtlRepository } from 'infra/ttl-repository';
import { TtlRecord } from 'types/types';

export type TtlItem = TtlRecord | undefined;

export type TtlActionOutcome =
  | { result: 'success'; ttlItem: TtlItem }
  | { result: 'failed' };

export class TtlActions {
  constructor(
    private readonly ttlRepository: TtlRepository,
    private readonly logger: Logger,
  ) {}

  async markWithdrawn(
    item: ChannelStatusPublishedEvent,
  ): Promise<TtlActionOutcome> {
    const { messageReference } = item.data;

    let ttlItem: TtlItem;

    try {
      ttlItem = await this.ttlRepository.markWithdrawn(messageReference);
    } catch (error) {
      this.logger.warn({
        description: 'Error marking TTL withdrawn',
        messageReference,
        err: error,
      });

      return { result: 'failed' };
    }

    if (ttlItem) {
      this.logger.info({
        description: 'TTL record marked as withdrawn',
        messageReference,
      });
    } else {
      this.logger.info({
        description: 'TTL record not found',
        messageReference,
      });
    }

    return { result: 'success', ttlItem };
  }
}
