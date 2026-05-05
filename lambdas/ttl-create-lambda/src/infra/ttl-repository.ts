import { PutCommand, PutCommandOutput } from '@aws-sdk/lib-dynamodb';
import { MESHInboxMessageDownloaded } from 'digital-letters-events';
import { ISenderManagement } from 'sender-management';
import { Logger } from 'utils';

interface IDynamoCaller {
  send: (updateCommand: PutCommand) => Promise<PutCommandOutput>;
}

export class TtlRepository {
  constructor(
    private readonly tableName: string,
    private readonly logger: Logger,
    private readonly dynamoClient: IDynamoCaller,
    private readonly shardCount: number,
    private readonly senderRepository: ISenderManagement,
  ) {}

  public async insertTtlRecord(item: MESHInboxMessageDownloaded) {
    const sender = await this.senderRepository.getSender({
      senderId: item.data.senderId,
    });
    if (!sender) {
      this.logger.error({
        description: `Sender ${item.data.senderId} could not be retrieved`,
      });
      throw new Error(`Sender ${item.data.senderId} could not be retrieved`);
    }

    const ttlTime =
      Math.round(Date.now() / 1000) + sender.fallbackWaitTimeSeconds;

    this.logger.info({
      description: 'Inserting item into TTL table',
      PK: `${item.data.senderId}_${item.data.messageReference}`,
      ttlTime,
    });

    try {
      await this.putTtlRecord(item, ttlTime);
    } catch (error) {
      this.logger.error({
        description: 'Failed to insert TTL record into DynamoDB',
        err: error,
      });
      throw error;
    }
  }

  private async putTtlRecord(
    event: MESHInboxMessageDownloaded,
    ttlTime: number,
  ) {
    // GSI PK utilising write sharding YYYY-MM-DD#<RANDOM_INT_BETWEEN_0_AND_[shardCount]>
    const ttlGsiPk = `${
      new Date(ttlTime * 1000).toISOString().split('T')[0]
      // eslint-disable-next-line sonarjs/pseudo-random
    }#${Math.floor(Math.random() * this.shardCount)}`;
    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `${event.data.senderId}_${event.data.messageReference}`,
          SK: 'TTL',
          ttl: ttlTime,
          dateOfExpiry: ttlGsiPk,
          event,
        },
      }),
    );
  }
}

export default TtlRepository;
