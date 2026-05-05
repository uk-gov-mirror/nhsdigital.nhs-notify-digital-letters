import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { messageDownloadedEvent } from '__tests__/data';
import { TtlRepository } from 'infra/ttl-repository';

jest.useFakeTimers();

const randomNumber = 0.42;
const shardCount = 3;
const ttlWaitTimeSeconds = 24 * 60 * 60;
const expectedShard = Math.floor(randomNumber * shardCount);
jest.spyOn(Math, 'random').mockReturnValue(randomNumber);

describe('TtlRepository', () => {
  let logger: any;
  let dynamoClient: any;
  let senderRepository: any;
  let repo: TtlRepository;
  const tableName = 'table';

  beforeEach(() => {
    logger = { info: jest.fn(), error: jest.fn() };
    dynamoClient = { send: jest.fn().mockResolvedValue({}) };
    senderRepository = {
      getSender: jest
        .fn()
        .mockResolvedValue({ fallbackWaitTimeSeconds: ttlWaitTimeSeconds }),
    };
    repo = new TtlRepository(
      tableName,
      logger,
      dynamoClient,
      shardCount,
      senderRepository,
    );
  });

  afterAll(() => {
    jest.mocked(Math.random).mockRestore();
  });

  it('logs and inserts item', async () => {
    const now = new Date('2020-01-01T12:00:00').getTime();
    jest.setSystemTime(now);
    const expectedTtlSeconds = Math.round(now / 1000) + ttlWaitTimeSeconds;
    const expectedTtlDate = new Date(expectedTtlSeconds * 1000)
      .toISOString()
      .split('T')[0];
    const expectedDateOfExpiry = `${expectedTtlDate}#${expectedShard}`;

    await repo.insertTtlRecord(messageDownloadedEvent);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('Inserting item'),
      }),
    );

    expect(senderRepository.getSender).toHaveBeenCalledWith({
      senderId: messageDownloadedEvent.data.senderId,
    });

    const putCommand: PutCommand = dynamoClient.send.mock.calls[0][0];
    expect(putCommand.input).toStrictEqual({
      TableName: tableName,
      Item: {
        PK: `${messageDownloadedEvent.data.senderId}_${messageDownloadedEvent.data.messageReference}`,
        SK: 'TTL',
        dateOfExpiry: expectedDateOfExpiry,
        event: messageDownloadedEvent,
        ttl: expectedTtlSeconds,
      },
    });
  });

  it('logs an error and throws on dynamo error', async () => {
    const error = new Error('fail');
    dynamoClient.send.mockRejectedValue(error);

    await expect(repo.insertTtlRecord(messageDownloadedEvent)).rejects.toThrow(
      error,
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('Failed to insert TTL record'),
        err: error,
      }),
    );
  });

  it('GSI PK is formatted as YYYY-MM-DD#<int>', async () => {
    let gsiPk: string | undefined;
    dynamoClient.send.mockImplementation((cmd: PutCommand) => {
      gsiPk = (cmd.input.Item as any).dateOfExpiry;
      return Promise.resolve({});
    });

    await repo.insertTtlRecord(messageDownloadedEvent);

    expect(gsiPk).toMatch(/^\d{4}-\d{2}-\d{2}#\d{1,2}$/);
  });

  it('throws and logs error when sender not retrieved', async () => {
    senderRepository.getSender.mockResolvedValue(null);

    await expect(repo.insertTtlRecord(messageDownloadedEvent)).rejects.toThrow(
      `Sender ${messageDownloadedEvent.data.senderId} could not be retrieved`,
    );

    expect(logger.error).toHaveBeenCalledWith({
      description: `Sender ${messageDownloadedEvent.data.senderId} could not be retrieved`,
    });
  });
});
