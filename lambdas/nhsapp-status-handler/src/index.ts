import { createHandler } from 'apis/sqs-trigger-lambda';
import { createContainer } from 'container';

export const handler = createHandler(createContainer());

export default handler;
