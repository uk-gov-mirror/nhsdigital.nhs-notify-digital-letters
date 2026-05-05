import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
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
        },
        diagnostics: {
          ignoreCodes: [1343], // Ignore TS1343: import.meta errors
        },
      },
    ],
  },
  collectCoverageFrom: [
    'tools/**/*.{ts,js,cjs}',
    '!tools/**/*.d.ts',
    '!tools/**/__tests__/**',
    '!tools/**/*.test.ts',
    '!tools/**/*.spec.ts',
    '!tools/builder/build-schema.ts',
    '!tools/generator/generate-example.ts',
    '!tools/generator/manual-bundle-schema.ts',
    '!tools/validator/validate.ts',
  ],
  coverageDirectory: 'coverage',
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
  testTimeout: 10000,
};

export default config;
