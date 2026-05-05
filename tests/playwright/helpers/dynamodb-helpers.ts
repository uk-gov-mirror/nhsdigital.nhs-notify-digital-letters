import {
  DeleteItemCommand,
  DeleteItemCommandOutput,
  DynamoDBClient,
  PutItemCommand,
  PutItemCommandOutput,
} from '@aws-sdk/client-dynamodb';
import { QueryCommand, QueryCommandOutput } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { REGION, TTL_TABLE_NAME } from 'constants/backend-constants';
import { TtlDynamodbRecord } from 'utils';

const dynamoDbClient = new DynamoDBClient({ region: REGION });

export async function getTtl(senderId: string, messageReference: string) {
  const pk = `${senderId}_${messageReference}`;
  const params = {
    TableName: TTL_TABLE_NAME,
    KeyConditionExpression: `PK = :pk`,
    ExpressionAttributeValues: {
      ':pk': pk,
    },
  };
  const request = new QueryCommand(params);
  const { Items }: QueryCommandOutput = await dynamoDbClient.send(request);

  return Items ?? [];
}

export async function putTtl(ttlItem: TtlDynamodbRecord) {
  const params = {
    TableName: TTL_TABLE_NAME,
    Item: marshall(ttlItem),
  };
  const request = new PutItemCommand(params);
  const output: PutItemCommandOutput = await dynamoDbClient.send(request);

  return output.$metadata.httpStatusCode;
}

export async function deleteTtl(senderId: string, messageReference: string) {
  const pk = `${senderId}_${messageReference}`;
  const params = {
    TableName: TTL_TABLE_NAME,
    Key: {
      PK: {
        S: pk,
      },
      SK: {
        S: 'TTL',
      },
    },
  };
  const request = new DeleteItemCommand(params);
  const output: DeleteItemCommandOutput = await dynamoDbClient.send(request);

  return output.$metadata.httpStatusCode;
}
