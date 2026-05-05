# Pact Tests

This workspace contains consumer Pact tests for `uk.nhs.notify.channel.status.PUBLISHED.v1`.

Scope:

- This repository is the consumer only.
- The consumer boundary under test is schema validation using `@nhsdigital/nhs-notify-event-schemas-status-published`.
- Provider verification is local only and uses the example events shipped in the schema package.

Commands:

```bash
make test-contract
```
