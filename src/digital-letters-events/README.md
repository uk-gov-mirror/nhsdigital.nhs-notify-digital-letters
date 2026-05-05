# digital-letters-events

<!-- vale Vale.Avoid = NO -->
<!-- vale Vale.Terms = NO -->
This package contains the automatically-generated code that the
[typescript-schema-generator](../typescript-schema-generator/) and the
[python-schema-generator](../python-schema-generator/) tools produce.
<!-- vale Vale.Avoid = YES -->
<!-- vale Vale.Terms = YES -->

The source files in this package should not be edited directly. If changes are
required, update the schemas in the
[src/cloudevents/domains](../cloudevents/domains) directory and use the
`typescript-schema-generator` and `python-schema-generator` tools to regenerate
them.

## Using this Package

### TypeScript

#### Using Event Types

The event types can be used by simply installing the
`digital-letters-events` package as a dependency and then importing
the desired type:

```typescript
import { PDMResourceSubmitted } from 'digital-letters-events';

const pdmResourceSubmittedEvent: PDMResourceSubmitted = {
    type: 'uk.nhs.notify.digital.letters.pdm.resource.submitted.v1',
    plane : 'data',
    dataschemaversion: '1.0.0',
    source:
      '/nhs/england/notify/staging/dev-647563337/digitalletters/pdm',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-submitted-data.schema.json',
    specversion: '1.0',
    id: '0249e529-f947-4012-819e-b634eb71be79',
    subject:
      'customer/7ff8ed41-cd5f-20e4-ef4e-34f96d8cc8ac/75027ace-9b8c-bcfe-866e-6c24242cffc3/q58dnxk5e/4cbek805wwx/yiaw7bl0d/her/1ccb7eb8-c6fe-0a42-279a-2a0e48ff1ca9/zk',
    time: '2025-11-21T16:01:52.268Z',
    datacontenttype: 'application/json',
    traceparent: '00-ee4790eb6821064c645406abe918b3da-3a4e6957ce2a15de-01',
    tracestate: 'nisi quis',
    partitionkey: 'customer-7ff8ed41',
    recordedtime: '2025-11-21T16:01:53.268Z',
    sampledrate: 1,
    sequence: '00000000000350773861',
    severitytext: 'INFO',
    severitynumber: 2,
    dataclassification: 'restricted',
    dataregulation: 'ISO-27001',
    datacategory: 'non-sensitive',
    data: {
      messageReference: 'incididunt Ut aute laborum',
      senderId: 'officia voluptate culpa Ut dolor',
      resourceId: 'a2bcbb42-ab7e-42b6-88d6-74f8d3ca4a09',
      retryCount: 97_903_257,
    },
  };
```

#### Using Event Validator Functions

Validator functions for an event can be used by importing the default export
from the relevant JS file in
[`validators`](validators/):

```typescript
import eventValidator from 'digital-letters-events/PDMResourceSubmitted.js';

const event = {};

const isEventValid = eventValidator(event);
if (isEventValid) {
  console.log('Event is valid!');
} else {
  console.error('Validation failure!', eventValidator.errors);
  throw new Error('Event validation failed');
}
```

Note: You will need to make sure the
[`allowJs`](https://www.typescriptlang.org/tsconfig/#allowJs) option is set in
your package's `tsconfig.json` in order to import the JS files.

### Python

#### Using Event Models

The Pydantic models can be used by installing the `digital-letters-events` package and importing the desired model:

```python
from digital_letters_events import PDMResourceSubmitted

try:
    # Validate and parse an event
    event_data = {
        "type": "uk.nhs.notify.digital.letters.pdm.resource.submitted.v1",
        "plane": "data",
        "dataschemaversion": '1.0',
        "source": "/nhs/england/notify/staging/dev-647563337/digitalletters/pdm",
        "dataschema": "https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-pdm-resource-submitted-data.schema.json",
        "specversion": "1.0",
        "id": "0249e529-f947-4012-819e-b634eb71be79",
        "subject": "customer/7ff8ed41-cd5f-20e4-ef4e-34f96d8cc8ac/75027ace-9b8c-bcfe-866e-6c24242cffc3/q58dnxk5e/4cbek805wwx/yiaw7bl0d/her/1ccb7eb8-c6fe-0a42-279a-2a0e48ff1ca9/zk",
        "time": "2025-11-21T16:01:52.268Z",
        "datacontenttype": "application/json",
        "traceparent": "00-ee4790eb6821064c645406abe918b3da-3a4e6957ce2a15de-01",
        "tracestate": "nisi quis",
        "partitionkey": "customer-7ff8ed41",
        "recordedtime": "2025-11-21T16:01:53.268Z",
        "sampledrate": 1,
        "sequence": "00000000000350773861",
        "severitytext": "INFO",
        "severitynumber": 2,
        "dataclassification": "restricted",
        "dataregulation": "ISO-27001",
        "datacategory": "non-sensitive",
        "data": {
            "messageReference": "incididunt Ut aute laborum",
            "senderId": "officia voluptate culpa Ut dolor",
            "resourceId": "a2bcbb42-ab7e-42b6-88d6-74f8d3ca4a09",
            "retryCount": 97_903_257,
        },
    }

    # Create and validate the event
    event = PDMResourceSubmitted(**event_data)

    # Access validated fields
    print(event.id)
    print(event.type)
    print(event.data.messageReference)
except Exception as e:
    print(e)
    raise ValueError("Error processing event") from e
```
