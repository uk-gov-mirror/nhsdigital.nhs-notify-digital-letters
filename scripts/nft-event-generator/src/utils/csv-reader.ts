import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';

export type PaperLetterOptOutRow = {
  messageReference: string;
  senderId: string;
};

export function readCsvFile(filePath: string): PaperLetterOptOutRow[] {
  const fileContent = readFileSync(filePath, 'utf8');

  const records = parse(fileContent, {
    columns: false,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((row) => ({
    messageReference: row[0],
    senderId: row[1],
  }));
}
