/* eslint-disable security/detect-non-literal-fs-filename */

import { destinationPackageName } from 'file-utils';
import { generateTypes } from 'generate-types';
import { compile } from 'json-schema-to-typescript';
import mockFs from 'mock-fs';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { eventSchemasDir } from 'utils';

jest.mock('json-schema-to-typescript');

describe('generate-types', () => {
  const outputDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    destinationPackageName,
    'types',
  );

  beforeEach(() => {
    mockFs({
      [eventSchemasDir]: {
        'one.flattened.schema.json': '{"title": "One"}',
        'two.flattened.schema.json': '{"title": "Two"}',
        'three.flattened.schema.json': '{"title": "Three"}',
      },
    });

    jest.mocked(compile).mockResolvedValue('Some TS code');

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'group').mockImplementation(() => {});
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should generate a type declaration file for each schema', async () => {
    await generateTypes();

    const typeDeclarationFiles = readdirSync(outputDir);

    expect(typeDeclarationFiles.length).toBe(4);
    expect(typeDeclarationFiles).toEqual(
      expect.arrayContaining(['index.ts', 'One.ts', 'Two.ts', 'Three.ts']),
    );
  });

  it('should create an index file exporting all generated types', async () => {
    await generateTypes();

    const indexFileContents = readFileSync(
      path.join(outputDir, 'index.ts'),
      'utf8',
    );
    expect(indexFileContents).toContain("export * from './One';");
    expect(indexFileContents).toContain("export * from './Two';");
    expect(indexFileContents).toContain("export * from './Three';");
  });
});
