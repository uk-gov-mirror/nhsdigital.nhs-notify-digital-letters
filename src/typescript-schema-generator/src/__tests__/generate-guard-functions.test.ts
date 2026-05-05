/* eslint-disable security/detect-non-literal-fs-filename */

import { destinationPackageName } from 'file-utils';
import { generateGuardFunctions } from 'generate-guard-functions';
import mockFs from 'mock-fs';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { eventSchemasDir } from 'utils';

jest.mock('json-schema-to-typescript');

describe('generate-guard-functions', () => {
  const outputDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    destinationPackageName,
    'guard-functions',
  );

  beforeEach(() => {
    mockFs({
      [eventSchemasDir]: {
        'one.flattened.schema.json': '{"title": "One"}',
        'two.flattened.schema.json': '{"title": "Two"}',
        'three.flattened.schema.json': '{"title": "Three"}',
      },
    });

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'group').mockImplementation(() => {});
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should generate a guard function file for each schema', async () => {
    await generateGuardFunctions();

    const typeDeclarationFiles = readdirSync(outputDir);

    expect(typeDeclarationFiles.length).toBe(4);
    expect(typeDeclarationFiles).toEqual(
      expect.arrayContaining([
        'index.ts',
        'OneGuard.ts',
        'TwoGuard.ts',
        'ThreeGuard.ts',
      ]),
    );
  });

  it('should create an index file exporting all generated guard function', async () => {
    await generateGuardFunctions();

    const indexFileContents = readFileSync(
      path.join(outputDir, 'index.ts'),
      'utf8',
    );
    expect(indexFileContents).toContain("export * from './OneGuard';");
    expect(indexFileContents).toContain("export * from './TwoGuard';");
    expect(indexFileContents).toContain("export * from './ThreeGuard';");
  });
});
