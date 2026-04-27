import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';

export type PaperLetterOptOutRow = {
  messageReference: string;
  senderId: string;
};

export function readCsvFile(filePath: string): PaperLetterOptOutRow[] {
  const fileContent = readFileSync(filePath, 'utf8');

  return parse(fileContent, {
    columns: ['messageReference', 'senderId'],
    skip_empty_lines: true,
    trim: true,
  });
}
