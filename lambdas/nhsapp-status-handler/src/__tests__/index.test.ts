import * as indexModule from 'index';

jest.mock('apis/sqs-trigger-lambda', () => ({
  createHandler: jest.fn(() => jest.fn()),
}));

jest.mock('container', () => ({
  createContainer: jest.fn(() => ({})),
}));

describe('index', () => {
  it('should export handler', () => {
    expect(indexModule.handler).toBeDefined();
  });
});
