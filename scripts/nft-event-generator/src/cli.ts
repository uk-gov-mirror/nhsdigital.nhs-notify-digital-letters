import { generatePaperLetterOptOutEvents } from 'generators/paper-letter-opt-out-events';
import {
  LETTER_STATUSES,
  generateSupplierApiLetterEvents,
} from 'generators/supplier-api-letter-events';
import { EventBusDestinationClient } from 'destinations/send-events-to-event-bus';
import { readCsvFile } from 'utils/csv-reader';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

yargs(hideBin(process.argv))
  .command(
    'supplier-api-letter-event',
    'Generate and send supplier API letter events',
    (y) =>
      y
        .option('numberOfEvents', {
          type: 'number',
          demandOption: true,
          describe: 'Total number of events to generate',
        })
        .option('environment', {
          type: 'string',
          default: 'nft',
          describe: 'Environment name',
        })
        .option('interval', {
          type: 'number',
          default: 1000,
          describe: 'Interval between batches in ms',
        })
        .option('status', {
          type: 'string',
          choices: LETTER_STATUSES,
          default: 'ACCEPTED' as const,
          describe: 'Letter status for the generated events',
        })
        .option('id', {
          type: 'string',
          describe:
            'Fixed event id (UUID). Defaults to a new UUID per event if omitted',
        })
        .option('time', {
          type: 'string',
          describe:
            'Fixed event time (ISO 8601). Defaults to current time per event if omitted',
        })
        .option('subject', {
          type: 'string',
          describe:
            'Fixed event subject. Defaults to a generated subject per event if omitted',
        })
        .option('messageReference', {
          type: 'string',
          describe:
            'Fixed message reference (UUID) used to build subject and origin.subject. Defaults to a new UUID per event if omitted',
        }),
    (argv) => {
      const {
        environment,
        id,
        interval,
        messageReference,
        numberOfEvents,
        status,
        subject,
        time,
      } = argv;

      const events = generateSupplierApiLetterEvents({
        numberOfEvents,
        environment,
        status,
        id,
        time,
        subject,
        messageReference,
      });

      const client = new EventBusDestinationClient(environment);
      client.sendEvents(events, interval);
    },
  )
  .command(
    'paper-letter-opt-out-event',
    'Generate and send paper letter opt-out events from a CSV file',
    (y) =>
      y
        .option('csvFile', {
          type: 'string',
          demandOption: true,
          describe:
            'Path to CSV file. Each row: <messageReference UUID>,<senderId>',
        })
        .option('environment', {
          type: 'string',
          default: 'nft',
          describe: 'Environment name',
        })
        .option('interval', {
          type: 'number',
          default: 1000,
          describe: 'Interval between batches in ms',
        }),
    (argv) => {
      const { csvFile, environment, interval } = argv;

      const csvRows = readCsvFile(csvFile);
      const events = generatePaperLetterOptOutEvents({ csvRows, environment });

      const client = new EventBusDestinationClient(environment);
      client.sendEvents(events, interval);
    },
  )
  .demandCommand(
    1,
    'You must specify a command: supplier-api-letter-event or paper-letter-opt-out-event',
  )
  .help()
  .alias('help', 'h')
  .parse();
