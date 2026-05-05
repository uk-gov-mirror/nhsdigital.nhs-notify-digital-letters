import { baseJestConfig } from '../../jest.config.base';

const config = {
  ...baseJestConfig,
  collectCoverage: false,
  testTimeout: 60_000,
};

export default config;
