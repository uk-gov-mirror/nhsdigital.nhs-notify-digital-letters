import { baseJestConfig } from '../../jest.config.base';

const config = {
  ...baseJestConfig,
  coveragePathIgnorePatterns: [
    ...(baseJestConfig.coveragePathIgnorePatterns ?? []),
    'generate-guard-functions-cli.ts',
    'src/generate-types-cli.ts',
    'src/generate-validators-cli.ts',
  ],
};

export default config;
