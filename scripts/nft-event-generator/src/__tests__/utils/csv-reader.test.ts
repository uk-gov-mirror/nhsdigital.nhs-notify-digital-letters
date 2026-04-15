import path from 'node:path';
import { readCsvFile } from 'utils/csv-reader';

const SAMPLE_CSV = path.join(__dirname, '../fixtures', 'sample-opt-outs.csv');

describe('readCsvFile', () => {
  it('should parse a CSV file into CsvRow objects', () => {
    const rows = readCsvFile(SAMPLE_CSV);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      messageReference: 'c18eeaf3-76bb-496b-8130-4bf6d1346567',
      senderId: 'smoke_test_sender_mailbox',
    });
    expect(rows[1]).toEqual({
      messageReference: '207f50c2-5a79-4421-a2d5-1b137e955a07',
      senderId: 'smoke_test_sender_mailbox3',
    });
  });
});
