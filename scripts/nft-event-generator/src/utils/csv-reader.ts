import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type PaperLetterOptOutRow = {
  messageReference: string;
  senderId: string;
};

export function readCsvFile(filePath: string): PaperLetterOptOutRow[] {
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.endsWith('.csv')) {
    throw new Error(`Invalid file path: must be a .csv file`);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is validated above
  const fileContent = readFileSync(resolvedPath, 'utf8');

  return parse(fileContent, {
    columns: ['messageReference', 'senderId'],
    skip_empty_lines: true,
    trim: true,
  });
}
