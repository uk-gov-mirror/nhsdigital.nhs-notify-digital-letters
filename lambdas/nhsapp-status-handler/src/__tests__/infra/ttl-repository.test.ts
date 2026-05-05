import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { nhsAppStatusEvent } from '__tests__/data';
import { TtlRepository } from 'infra/ttl-repository';

describe('TtlRepository', () => {
  let dynamoDocumentClient: any;
  let repo: TtlRepository;
  const tableName = 'table';

  beforeEach(() => {
    dynamoDocumentClient = { send: jest.fn().mockResolvedValue({}) };
    repo = new TtlRepository(tableName, dynamoDocumentClient);
  });

  it('marks item as withdrawn', async () => {
    await repo.markWithdrawn(nhsAppStatusEvent.data.messageReference);

    const updateCommand: UpdateCommand =
      dynamoDocumentClient.send.mock.calls[0][0];
    expect(updateCommand.input).toStrictEqual({
      TableName: tableName,
      Key: {
        PK: nhsAppStatusEvent.data.messageReference,
        SK: 'TTL',
      },
      ConditionExpression: 'attribute_exists(PK)',
      UpdateExpression: 'set withdrawn = :val1',
      ExpressionAttributeValues: {
        ':val1': true,
      },
      ReturnValues: 'ALL_NEW',
    });
  });

  it('returns undefined on ConditionalCheckFailedException', async () => {
    const error = new ConditionalCheckFailedException({
      message: 'ConditionalCheckFailedException',
      $metadata: {},
    });
    dynamoDocumentClient.send.mockRejectedValue(error);

    const result = await repo.markWithdrawn(
      nhsAppStatusEvent.data.messageReference,
    );

    expect(result).toBeUndefined();
  });

  it('errors on dynamo error', async () => {
    const error = new Error('fail');
    dynamoDocumentClient.send.mockRejectedValue(error);

    await expect(
      repo.markWithdrawn(nhsAppStatusEvent.data.messageReference),
    ).rejects.toThrow(error);
  });
});
