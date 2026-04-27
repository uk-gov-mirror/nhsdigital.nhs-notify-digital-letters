import { baseJestConfig } from '../jest.config.base';

const config = {
  ...baseJestConfig,
  roots: ['<rootDir>/nft-event-generator'],
  modulePaths: ['<rootDir>/nft-event-generator/src'],
  moduleNameMapper: {
    // Map local subpath aliases that would otherwise resolve to the 'utils'
    // workspace package before the local nft-event-generator source is checked.
    '^utils/(.+)$': '<rootDir>/nft-event-generator/src/utils/$1',
  },
  collectCoverageFrom: [
    'nft-event-generator/src/**/*.{ts,js}',
    '!nft-event-generator/src/**/*.d.ts',
    '!nft-event-generator/src/**/__tests__/**',
    '!nft-event-generator/src/**/*.test.ts',
    '!nft-event-generator/src/**/*.spec.ts',
    '!nft-event-generator/src/cli.ts',
  ],
  coverageDirectory: 'nft-event-generator/coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
