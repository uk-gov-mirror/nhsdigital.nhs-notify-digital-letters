# TypeScript Schema Generator - Implementation Plan

## Overview

Generate TypeScript classes and types from JSON Schema definitions with full inheritance support, validation, and builder patterns. The system will process modular schemas (using `allOf` for inheritance), generate domain-specific npm packages, and provide a CloudEvents SDK with example usage.

## Project Structure

```text
src/typescript-schema-generator/
├── PLAN.md                           # This file
├── package.json                      # Package configuration
├── tsconfig.json                     # TypeScript configuration
├── src/
│   ├── scanner/
│   │   ├── domain-scanner.ts         # Scans output/ for domains and versions
│   │   └── schema-scanner.ts         # Identifies modular schemas in events/ folders
│   ├── parser/
│   │   ├── schema-parser.ts          # Parses JSON Schema files
│   │   ├── inheritance-resolver.ts   # Resolves allOf chains recursively
│   │   └── reference-resolver.ts     # Resolves $ref using cache tool
│   ├── generator/
│   │   ├── class-generator.ts        # Generates TypeScript classes
│   │   ├── interface-generator.ts    # Generates TypeScript interfaces
│   │   ├── builder-generator.ts      # Generates builder pattern classes
│   │   ├── validator-generator.ts    # Generates runtime validation code
│   │   └── index-generator.ts        # Generates barrel exports
│   ├── validation/
│   │   ├── ajv-validator.ts          # AJV-based runtime validation
│   │   └── schema-enforcer.ts        # Schema constraint enforcement
│   ├── packager/
│   │   ├── package-creator.ts        # Creates package.json per domain
│   │   └── bundler.ts                # Bundles TypeScript for distribution
│   └── cli/
│       ├── index.ts                  # CLI entry point
│       └── commands.ts               # CLI commands
├── output/
│   └── packages/
│       ├── digital-letters/          # Generated package per domain
│       │   ├── package.json
│       │   ├── tsconfig.json
│       │   ├── src/
│       │   │   ├── events/
│       │   │   │   ├── letter/
│       │   │   │   │   ├── LetterAvailable.ts
│       │   │   │   │   └── LetterAvailable.builder.ts
│       │   │   │   ├── mesh/
│       │   │   │   └── ...
│       │   │   ├── profiles/
│       │   │   │   ├── DigitalLettersProfile.ts
│       │   │   │   └── LetterProfile.ts
│       │   │   ├── data/
│       │   │   │   └── data-schemas.ts
│       │   │   └── index.ts
│       │   ├── dist/                 # Compiled output
│       │   └── tests/
│       └── [other-domain]/
├── tests/
│   ├── scanner/
│   ├── parser/
│   ├── generator/
│   ├── validation/
│   └── integration/
└── README.md

src/cloudevents-sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── client/
│   │   ├── CloudEventClient.ts       # Main SDK client
│   │   ├── CloudEventBuilder.ts      # CloudEvents builder
│   │   └── CloudEventValidator.ts    # CloudEvents validation
│   ├── transport/
│   │   ├── http-transport.ts         # HTTP transport layer
│   │   └── event-bridge-transport.ts # AWS EventBridge transport
│   ├── middleware/
│   │   ├── logging-middleware.ts     # Logging
│   │   └── tracing-middleware.ts     # Tracing/observability
│   └── index.ts
├── tests/
└── README.md

examples/cloudevents-example/
├── package.json
├── tsconfig.json
├── src/
│   ├── publisher/
│   │   └── send-event.ts             # Example event publisher
│   ├── subscriber/
│   │   └── receive-event.ts          # Example event subscriber
│   └── server/
│       └── loopback-server.ts        # Simple HTTP server for testing
└── README.md
```

## Implementation Phases

### Phase 1: Core Infrastructure (Foundation)

#### 1.1 Project Setup

- Create `src/typescript-schema-generator` directory
- Initialize `package.json` with dependencies:
  - `ajv` - JSON Schema validation
  - `ajv-formats` - Format validators
  - `@types/node` - Node.js types
  - TypeScript tooling (already in root)
- Create `tsconfig.json` extending root config
- Setup output directories

#### 1.2 Domain Scanner

**File**: `src/scanner/domain-scanner.ts`

**Responsibilities**:

- Scan `output/` directory for all domains (e.g., `digital-letters/`)
- For each domain, identify all version directories (e.g., `2025-10-draft/`)
- Return structured data: `{ domain: string, versions: string[], path: string }[]`

**Algorithm**:

1. Read `output/` directory
2. For each subdirectory:
   - Check if it contains versioned subdirectories
   - Validate structure (has `events/` folder)
   - Build domain metadata object

#### 1.3 Schema Scanner

**File**: `src/scanner/schema-scanner.ts`

**Responsibilities**:

- Within each domain/version, scan `events/` folder
- Identify modular schemas (without `.bundle` or `.flattened` suffixes)
- Group schemas by event type (3 files per event)
- Return list of modular schema paths

**Algorithm**:

1. Read `events/` directory for given domain/version
2. Filter files: keep only `*.schema.json` (exclude `.bundle.schema.json` and `.flattened.schema.json`)
3. Parse event name from filename
4. Return structured list: `{ eventName: string, schemaPath: string }[]`

### Phase 2: Schema Processing

#### 2.1 Schema Parser

**File**: `src/parser/schema-parser.ts`

**Responsibilities**:

- Load and parse JSON Schema files
- Extract metadata (title, description, type, properties)
- Identify inheritance via `allOf`
- Return typed schema object

**Key Functions**:

- `loadSchema(path: string): Promise<JSONSchema>`
- `extractMetadata(schema: JSONSchema): SchemaMetadata`
- `getInheritanceChain(schema: JSONSchema): string[]` - Extract all `$ref` in `allOf`

#### 2.2 Reference Resolver

**File**: `src/parser/reference-resolver.ts`

**CRITICAL**: Must use existing cache tool at `src/cloudevents/tools/cache/schema-cache.ts`

**Responsibilities**:

- Resolve `$ref` references (both local and remote)
- Use cache for HTTP fetches (reuse existing cache utility)
- Handle recursive references
- Build complete schema with resolved references

**Integration**:

- Import and use `fetchSchemaFromCache()` from `src/cloudevents/tools/cache/schema-cache.ts`
- For local `file://` or relative refs, resolve from filesystem
- For HTTP(S) refs, delegate to cache tool

#### 2.3 Inheritance Resolver

**File**: `src/parser/inheritance-resolver.ts`

**Responsibilities**:

- Recursively resolve `allOf` inheritance chains
- Merge properties from parent schemas
- Handle property overrides (child overrides parent)
- Detect circular inheritance
- Return flattened property map with inheritance metadata

**Algorithm**:

1. Start with target schema
2. For each `allOf` entry:
   - Resolve reference (via Reference Resolver)
   - Recursively process parent schema
   - Merge properties (child wins conflicts)
   - Track inheritance depth
3. Build complete property map with metadata:

   ```typescript
   {
     propertyName: {
       type: string,
       required: boolean,
       inherited: boolean,
       inheritedFrom: string | null,
       description: string,
       validation: ValidationRules
     }
   }
   ```

### Phase 3: Code Generation

#### 3.1 Interface Generator

**File**: `src/generator/interface-generator.ts`

**Responsibilities**:

- Generate TypeScript interfaces for schema types
- Map JSON Schema types to TypeScript types
- Handle nested objects and arrays
- Generate JSDoc comments from descriptions

**Type Mapping**:

- `string` → `string`
- `number`, `integer` → `number`
- `boolean` → `boolean`
- `array` → `T[]` or `Array<T>`
- `object` → Interface or `Record<string, unknown>`
- `const` → Literal type
- `enum` → Union of literal types
- `$ref` → Referenced interface name

#### 3.2 Class Generator

**File**: `src/generator/class-generator.ts`

**Responsibilities**:

- Generate TypeScript classes with proper inheritance
- Implement constructors with validation
- Generate getters/setters
- Include JSDoc comments
- Extend parent classes based on `allOf` chain

**Class Structure**:

```typescript
/**
 * {description from schema}
 * @generated from {schema path}
 */
export class LetterAvailable extends LetterProfile {
  /**
   * {property description}
   */
  private _type: string;

  constructor(data: ILetterAvailableData) {
    super(data);
    this.validate(data);
    this._type = data.type;
  }

  get type(): string {
    return this._type;
  }

  private validate(data: ILetterAvailableData): void {
    // Runtime validation using AJV
  }

  toJSON(): ILetterAvailableData {
    return {
      ...super.toJSON(),
      type: this._type
    };
  }
}
```

#### 3.3 Builder Generator

**File**: `src/generator/builder-generator.ts`

**Responsibilities**:

- Generate builder pattern classes for each event
- Provide fluent API for object construction
- Enforce required properties at compile time (using TypeScript types)
- Validate at build time

**Builder Pattern**:

```typescript
export class LetterAvailableBuilder {
  private data: Partial<ILetterAvailableData> = {};

  withType(type: string): this {
    // Validate against schema constraints (e.g., const, pattern)
    if (type !== 'uk.nhs.notify.digital.letters.letter.available.v1') {
      throw new Error('Invalid type value');
    }
    this.data.type = type;
    return this;
  }

  withSource(source: string): this {
    // Validate pattern
    const pattern = /^\/nhs\/england\/notify\/.../;
    if (!pattern.test(source)) {
      throw new Error('Invalid source pattern');
    }
    this.data.source = source;
    return this;
  }

  build(): LetterAvailable {
    // Check all required fields are present
    this.validateRequired();
    return new LetterAvailable(this.data as ILetterAvailableData);
  }

  private validateRequired(): void {
    const required = ['type', 'source', 'data', /* ... */];
    const missing = required.filter(key => !(key in this.data));
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }
}
```

#### 3.4 Validator Generator

**File**: `src/generator/validator-generator.ts`

**Responsibilities**:

- Generate AJV validators for runtime validation
- Handle custom formats and patterns
- Support validation error messages
- Cache compiled validators

**Implementation**:

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export class SchemaValidator {
  private ajv: Ajv;
  private validators = new Map<string, ValidateFunction>();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      // ... other options
    });
    addFormats(this.ajv);
  }

  validate(schemaId: string, data: unknown): ValidationResult {
    const validator = this.getValidator(schemaId);
    const valid = validator(data);
    return {
      valid,
      errors: validator.errors || []
    };
  }
}
```

#### 3.5 Index Generator

**File**: `src/generator/index-generator.ts`

**Responsibilities**:

- Generate barrel exports (`index.ts` files)
- Organize exports by category (events, profiles, data)
- Create domain-level index file

### Phase 4: Package Generation

#### 4.1 Package Creator

**File**: `src/packager/package-creator.ts`

**Responsibilities**:

- Generate `package.json` for each domain package
- Set package name: `@nhs-notify/{domain}-events` (e.g., `@nhs-notify/digital-letters-events`)
- Configure dependencies
- Setup build scripts
- Include metadata (version, description, author, license)

**Package.json Template**:

```json
{
  "name": "@nhs-notify/digital-letters-events",
  "version": "2025.10.0-draft",
  "description": "TypeScript event types for NHS Notify Digital Letters",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x"
  },
  "keywords": ["nhs-notify", "digital-letters", "cloudevents", "events"],
  "license": "MIT"
}
```

#### 4.2 Package Builder

**File**: `src/packager/bundler.ts`

**Responsibilities**:

- Compile TypeScript to JavaScript
- Generate type declarations (.d.ts)
- Bundle for distribution
- Run tests before publishing

### Phase 5: Testing Infrastructure

#### 5.1 Unit Tests

- Test each generator independently
- Test inheritance resolution with complex chains
- Test validation logic
- Test builder pattern enforcement

**Test Files**:

- `tests/scanner/domain-scanner.test.ts`
- `tests/scanner/schema-scanner.test.ts`
- `tests/parser/schema-parser.test.ts`
- `tests/parser/inheritance-resolver.test.ts`
- `tests/parser/reference-resolver.test.ts`
- `tests/generator/class-generator.test.ts`
- `tests/generator/builder-generator.test.ts`
- `tests/generator/validator-generator.test.ts`

#### 5.2 Integration Tests

- Test full generation pipeline
- Test generated code compiles
- Test generated classes can be instantiated
- Test builders enforce constraints
- Test validation catches errors

**Test Scenarios**:

1. Generate from real schemas in `output/digital-letters/`
2. Create instances using builders
3. Validate against schema
4. Test inheritance chain (3+ levels)
5. Test circular reference detection

#### 5.3 Generated Code Tests

**File**: `output/packages/{domain}/tests/`

For each generated class, create tests:

```typescript
describe('LetterAvailable', () => {
  it('should create instance with valid data', () => {
    const event = new LetterAvailableBuilder()
      .withType('uk.nhs.notify.digital.letters.letter.available.v1')
      .withSource('/nhs/england/notify/development/primary/digitalletters/letter')
      .withData(/* ... */)
      .build();

    expect(event).toBeInstanceOf(LetterAvailable);
    expect(event.type).toBe('uk.nhs.notify.digital.letters.letter.available.v1');
  });

  it('should reject invalid type value', () => {
    expect(() => {
      new LetterAvailableBuilder()
        .withType('invalid.type')
        .build();
    }).toThrow();
  });

  it('should enforce required fields', () => {
    expect(() => {
      new LetterAvailableBuilder()
        .withType('uk.nhs.notify.digital.letters.letter.available.v1')
        // Missing required fields
        .build();
    }).toThrow('Missing required fields');
  });
});
```

### Phase 6: CloudEvents SDK

#### 6.1 SDK Core

**File**: `src/cloudevents-sdk/src/client/CloudEventClient.ts`

**Responsibilities**:

- Integrate with CloudEvents SDK (<https://github.com/cloudevents/sdk-javascript>)
- Wrap generated event classes in CloudEvents envelope
- Handle serialization/deserialization
- Support multiple transport protocols

**Key Features**:

- Type-safe event creation
- Automatic CloudEvents metadata
- Transport abstraction
- middleware support

**Usage Example**:

```typescript
import { CloudEventClient } from '@nhs-notify/cloudevents-sdk';
import { LetterAvailable } from '@nhs-notify/digital-letters-events';

const client = new CloudEventClient({
  transport: 'http',
  endpoint: 'https://eventbridge.amazonaws.com'
});

const event = new LetterAvailable({
  type: 'uk.nhs.notify.digital.letters.letter.available.v1',
  source: '/nhs/england/notify/development/primary/digitalletters/letter',
  data: { /* ... */ }
});

await client.send(event);
```

#### 6.2 Transport Layer

**Files**:

- `src/cloudevents-sdk/src/transport/http-transport.ts`
- `src/cloudevents-sdk/src/transport/event-bridge-transport.ts`

**Responsibilities**:

- HTTP/HTTPS transport with configurable endpoints
- AWS EventBridge integration
- Retry logic and error handling
- Transport-specific configuration

#### 6.3 middleware

**Files**:

- `src/cloudevents-sdk/src/middleware/logging-middleware.ts`
- `src/cloudevents-sdk/src/middleware/tracing-middleware.ts`

**Responsibilities**:

- Logging (structured logs)
- Tracing (correlation IDs, distributed tracing)
- Metrics collection
- Custom middleware support

### Phase 7: Example Project

#### 7.1 Loopback Server

**File**: `examples/cloudevents-example/src/server/loopback-server.ts`

**Responsibilities**:

- Simple HTTP server (Express or native Node.js)
- Receives CloudEvents via POST
- Validates and deserializes events
- Echoes back or stores for retrieval

#### 7.2 Publisher Example

**File**: `examples/cloudevents-example/src/publisher/send-event.ts`

**Demonstrates**:

- Creating event using builder
- Sending via SDK
- Error handling
- Logging

#### 7.3 Subscriber Example

**File**: `examples/cloudevents-example/src/subscriber/receive-event.ts`

**Demonstrates**:

- Receiving CloudEvents
- Deserializing to typed classes
- Validation
- Processing

## Dependencies

### Core Dependencies

- **AJV** (^8.12.0) - JSON Schema validation
- **AJV-formats** (^2.1.1) - Additional format validators
- **cloudevents** (^7.0.0) - CloudEvents SDK for JavaScript

### Development Dependencies

- **typescript** (^5.x) - Already in root
- **@types/node** (^20.x) - Already in root
- **jest** (^30.x) - Already in root
- **ts-jest** (^29.x) - Already in root

### SDK Dependencies

- **axios** or **node-fetch** - HTTP transport
- **@aws-sdk/client-eventbridge** - AWS EventBridge transport (optional)

## CLI Interface

```bash
# Generate TypeScript packages for all domains
npm run generate

# Generate for specific domain
npm run generate -- --domain digital-letters

# Generate for specific version
npm run generate -- --domain digital-letters --version 2025-10-draft

# Watch mode (regenerate on schema changes)
npm run generate:watch

# Build packages
npm run build:packages

# Test generated code
npm run test:generated

# Publish packages
npm run publish:packages
```

## Configuration

**File**: `src/typescript-schema-generator/config.json`

```json
{
  "inputDir": "../../output",
  "outputDir": "./output/packages",
  "cache": {
    "enabled": true,
    "tool": "../../src/cloudevents/tools/cache/schema-cache.ts"
  },
  "generation": {
    "generateClasses": true,
    "generateInterfaces": true,
    "generateBuilders": true,
    "generateValidators": true,
    "includeTests": true
  },
  "packages": {
    "scope": "@nhs-notify",
    "nameSuffix": "-events",
    "registry": "https://npm.pkg.github.com"
  },
  "typescript": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  }
}
```

## Makefile Integration

Add to root `Makefile`:

```makefile
.PHONY: generate-types
generate-types:
 cd src/typescript-schema-generator && npm run generate

.PHONY: build-packages
build-packages:
 cd src/typescript-schema-generator && npm run build:packages

.PHONY: test-generated
test-generated:
 cd src/typescript-schema-generator && npm run test:generated

.PHONY: publish-packages
publish-packages:
 cd src/typescript-schema-generator && npm run publish:packages
```

## Inheritance Example

Given schemas:

1. `nhs-notify-profile.schema.json` (base CloudEvents)
2. `digital-letters-profile.schema.json` (extends #1)
3. `digital-letters-letter-profile.schema.json` (extends #2)
4. `uk.nhs.notify.digital.letters.letter.available.v1.schema.json` (extends #3)

Generated TypeScript:

```typescript
// Base interface
export interface INhsNotifyProfile {
  id: string;
  type: string;
  source: string;
  specversion: string;
  // ... other CloudEvents properties
}

// Base class
export class NhsNotifyProfile implements INhsNotifyProfile {
  constructor(data: INhsNotifyProfile) { /* ... */ }
}

// Extends base
export class DigitalLettersProfile extends NhsNotifyProfile {
  constructor(data: IDigitalLettersProfile) {
    super(data);
    // Additional validation for digital letters
  }
}

// Extends digital letters
export class LetterProfile extends DigitalLettersProfile {
  constructor(data: ILetterProfile) {
    super(data);
    // Additional validation for letters
  }
}

// Final concrete event
export class LetterAvailable extends LetterProfile {
  constructor(data: ILetterAvailableData) {
    super(data);
    // Event-specific validation
  }
}
```

## Package Publishing

### GitHub Packages

Configure in generated `package.json`:

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com/@nhs-notify"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/RossBugginsNHS/nhs-notify-digital-letters.git"
  }
}
```

### npm Registry (Alternative)

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

## Error Handling

1. **Schema Validation Errors**: Clear messages indicating which constraint failed
2. **Circular References**: Detect and report with path
3. **Missing References**: List missing schemas and suggest fixes
4. **Type Conflicts**: Report when inheritance creates type conflicts
5. **Build Errors**: Aggregate errors from code generation

## Performance Considerations

1. **Caching**: Reuse existing HTTP cache tool for remote schemas
2. **Incremental Generation**: Only regenerate changed schemas
3. **Parallel Processing**: Generate multiple domains/versions in parallel
4. **Lazy Loading**: Load schemas on-demand during resolution

## Versioning Strategy

- Package versions match schema versions (e.g., `2025.10.0-draft`)
- Support multiple versions concurrently
- Deprecation warnings for old versions
- Migration guides between versions

## Documentation

Auto-generate:

1. README.md for each package
2. API documentation (TypeDoc)
3. Usage examples
4. Migration guides
5. Schema changelog

---

## Questions Requiring Clarification

1. **Package Naming Convention**: Should packages be `@nhs-notify/digital-letters-events` or `@nhs-notify/events-digital-letters`? Or use domain as scope: `@nhs-notify-digital-letters/events`?

2. **Version Format**: Should we use the version from the folder name (e.g., `2025-10-draft`) or extract from schema files? How should we handle `draft` vs stable versions?

3. **CloudEvents Base Schema**: The schemas reference `https://notify.nhs.uk/cloudevents/schemas/common/2025-11-draft/nhs-notify-profile.schema.json`. Is this URL accessible? Should we vendor these base schemas?

4. **Multiple Versions**: Should we generate separate packages for each version (e.g., `@nhs-notify/digital-letters-events-2025-10`) or include all versions in one package with namespace separation?

5. **Data Schema References**: Events reference data schemas (e.g., `digital-letter-base-data.schema.json`). Should these be generated as separate classes or inline interfaces?

6. **Const Values**: For `const` properties (like `type`), should builders auto-populate these or still require them to be set explicitly?

7. **Registry**: Where should packages be published? GitHub Packages, npm, both, or internal registry?

8. **Enum Handling**: How should we handle enums? As TypeScript enums or union types?

9. **Optional Properties**: JSON Schema doesn't have optional - it uses `required` array. Should we use TypeScript `?` for non-required properties?

10. **Validation Performance**: Should validation be optional (opt-in) or always run? Consider performance impact.

11. **Browser Support**: Should generated packages work in browser or Node.js only?

12. **Source Maps**: Should we generate source maps for generated code?

## Additional Considerations

### Security

- Sanitize generated code to prevent code injection
- Validate schema sources (prevent arbitrary code execution)
- Review dependencies for vulnerabilities
- Consider signed schemas

### Maintenance

- Automated CI/CD pipeline for regeneration on schema changes
- Version compatibility matrix
- Deprecation policy
- Breaking change detection

### Extensibility

- Plugin system for custom generators
- Custom validation rules
- Transform hooks (pre/post generation)
- Custom transport implementations

### Observability

- Generation metrics (time, files generated, errors)
- Runtime validation metrics
- Event publishing metrics
- Distributed tracing integration

### Testing Strategy

- Schema compatibility tests (new vs old versions)
- Property-based testing for validators
- Fuzzing for edge cases
- Load testing for SDK

### Documentation Needs

- Architecture decision records (ADRs)
- Contributor guidelines
- Schema authoring best practices
- Migration guides between major versions

### Interoperability

- Consider Python/Go/Java code generation in future
- Ensure JSON serialization is compatible
- CloudEvents specification compliance
- OpenAPI/AsyncAPI integration

### Developer Experience

- VSCode extension for schema editing
- JSON Schema IntelliSense
- Debug mode with verbose logging
- Quick start templates

### Governance

- Schema review process
- Breaking change approval
- Version lifecycle management
- Cross-domain event coordination

### Performance Optimization

- Lazy property access for large objects
- Streaming validation for large payloads
- Connection pooling for transport
- Batch event sending

### Future Enhancements

- GraphQL schema generation
- Protobuf support
- Event replay/debugging tools
- Schema evolution tools (auto-migration)
- Visual schema editor
