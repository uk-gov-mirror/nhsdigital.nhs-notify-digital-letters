# NFT Event Generator

This script generates events and sends them in batches of 10 to the AWS EventBridge event bus: **`nhs-<environment>-dl`** (where `<environment>` is the environment specified at the command line).

It supports two event types, each invoked as a subcommand:

- **`supplier-api-letter-event`** – generates `SupplierApiLetterEvent` events (mirrors the `LetterEvent` consumed by `print-status-handler`)
- **`paper-letter-opt-out-event`** – generates `PaperLetterOptedOut` channel status events, reading input from a CSV file

## Common features

- Custom environments (e.g. `pr293`, `main`, `nft`)
- Controlled delay between batches of maximum 10 messages

---

## Subcommand: `supplier-api-letter-event`

Generates a configurable number of supplier API letter events with dynamic or fixed field values.

### CLI Options

| Option               | Type   | Required | Default       | Description                                                                                                                                                                      |
|----------------------|--------|----------|---------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--numberOfEvents`   | number | ✅        |               | Total number of events to generate and send                                                                                                                                      |
| `--environment`      | string | ❌        | `nft`         | Target environment (e.g. `main`, `nft`, `pr283`)                                                                                                                                |
| `--interval`         | number | ❌        | `1000`        | Delay between batches in milliseconds                                                                                                                                            |
| `--status`           | string | ❌        | `ACCEPTED`    | Letter status for generated events. One of: `ACCEPTED`, `REJECTED`, `PRINTED`, `DISPATCHED`, `FAILED`, `RETURNED`, `PENDING`, `ENCLOSED`, `CANCELLED`, `FORWARDED`, `DELIVERED` |
| `--id`               | string | ❌        | *(generated)* | Fixed event `id` (uuid). If omitted, a new uuid is generated per event                                                                                                          |
| `--time`             | string | ❌        | *(generated)* | Fixed event `time` (ISO 8601). If omitted, the current time is used per event                                                                                                   |
| `--subject`          | string | ❌        | *(generated)* | Fixed event `subject`. If omitted, a subject is built from `messageReference`                                                                                                   |
| `--messageReference` | string | ❌        | *(generated)* | Fixed message reference (uuid) embedded in `subject` and `data.origin.subject`. If omitted, a new uuid is generated per event                                                   |

### Examples

Generate 2 events in the `nft` environment with a 2-second interval between batches:

```shell
npm start -- supplier-api-letter-event --environment nft --numberOfEvents 2 --interval 2000
```

Generate events with a specific status:

```shell
npm start -- supplier-api-letter-event --environment pr293 --numberOfEvents 5 --status PRINTED
```

Generate events with a fixed `messageReference` (useful for targeting a specific letter request):

```shell
npm start -- supplier-api-letter-event --environment pr293 --numberOfEvents 1 --messageReference aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
```

---

## Subcommand: `paper-letter-opt-out-event`

Reads a CSV file and generates one `PaperLetterOptedOut` channel status event per row.

### CSV format

The CSV file must have two columns per row (no header):

| Column | Description                     |
|--------|---------------------------------|
| 1      | `messageReference` (uuid)       |
| 2      | `senderId`                      |

Example `opt-outs.csv`:

```csv
aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee,sender-001
11111111-2222-3333-4444-555555555555,sender-002
```

The `messageReference` field in each generated event is built as `<senderId>_<messageReference>`.

### CLI Options

| Option          | Type   | Required | Default       | Description                                        |
|-----------------|--------|----------|---------------|----------------------------------------------------|
| `--csvFile`     | string | ✅        |               | Path to the CSV file (`messageReference,senderId`) |
| `--environment` | string | ❌        | `nft`         | Target environment (e.g. `main`, `nft`, `pr283`)   |
| `--interval`    | number | ❌        | `1000`        | Delay between batches in milliseconds              |

### Examples

Send opt-out events from a CSV file to the `nft` environment:

```shell
npm start -- paper-letter-opt-out-event --environment nft --csvFile ./opt-outs.csv
```

Send to a PR environment with a custom batch interval:

```shell
npm start -- paper-letter-opt-out-event --environment pr293 --csvFile ./opt-outs.csv --interval 500
```

---

## Running via Make

To run this script from anywhere in the repository:

```shell
make perf-test
```

The make command runs the following script (configured in `package.json`):

```shell
"start:nft": "npm start -- supplier-api-letter-event --environment nft --numberOfEvents 2 --interval 2000"
```

## Help

To see all available options for a subcommand:

```shell
npm start -- supplier-api-letter-event --help
npm start -- paper-letter-opt-out-event --help
```
