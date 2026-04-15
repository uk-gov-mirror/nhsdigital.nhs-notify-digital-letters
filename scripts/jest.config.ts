import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/nft-event-generator'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          allowImportingTsExtensions: true,
          module: 'commonjs',
          target: 'ES2020',
          moduleResolution: 'node',
          noEmit: true,
          typeRoots: ['../node_modules/@types'],
        },
        diagnostics: {
          ignoreCodes: [1343], // Ignore TS1343: import.meta errors
        },
      },
    ],
  },
  modulePaths: ['<rootDir>/nft-event-generator/src'],
  collectCoverageFrom: [
    'nft-event-generator/src/**/*.{ts,js}',
    '!nft-event-generator/src/**/*.d.ts',
    '!nft-event-generator/src/**/__tests__/**',
    '!nft-event-generator/src/**/*.test.ts',
    '!nft-event-generator/src/**/*.spec.ts',
    '!nft-event-generator/src/cli.ts',
  ],
  coverageDirectory: 'nft-event-generator/coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(.*)\\.ts$': '$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 10_000,
};

export default config;
