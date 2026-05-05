/**
 * ExampleGenerator class for generating CloudEvents examples from JSON schemas
 *
 * This class encapsulates the logic for generating example CloudEvents from JSON schemas.
 * It can be used programmatically or via the CLI wrapper (generate-example.ts).
 */

import $RefParser from "json-schema-ref-parser";
import jsf from "json-schema-faker";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  getCachedSchema,
  clearCache as clearSchemaCache,
} from "../../cache/schema-cache.ts";

/**
 * Options for example generation
 */
export interface ExampleGeneratorOptions {
  /** Whether to enable verbose logging */
  verbose?: boolean;
}

/**
 * Result of example generation
 */
export interface GenerationResult {
  /** The generated example */
  example: any;
  /** Whether generation was successful */
  success: boolean;
  /** Error message if generation failed */
  error?: string;
}

/**
 * ExampleGenerator class for generating CloudEvents examples from JSON schemas
 */
export class ExampleGenerator {
  private options: ExampleGeneratorOptions;

  constructor(options: ExampleGeneratorOptions = {}) {
    this.options = { verbose: true, ...options };
    this.setupJsf();
  }

  /**
   * Set up json-schema-faker with custom formats
   */
  private setupJsf(): void {
    // Register a custom UUID format for jsf
    jsf.format("uuid", () => crypto.randomUUID());

    // Ensure jsf uses pattern for string generation
    jsf.option({ alwaysFakeOptionals: true });
  }

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string, ...args: any[]): void {
    if (this.options.verbose) {
      console.log(message, ...args);
    }
  }

  /**
   * Generate a cryptographically secure random integer
   */
  private randomInt(max: number): number {
    return crypto.randomInt(0, max);
  }

  /**
   * Select a random item from an array
   */
  private randomChoice<T>(arr: T[]): T {
    return arr[this.randomInt(arr.length)];
  }

  /**
   * Generate a random hexadecimal string
   */
  private randomHex(len: number): string {
    let out = "";
    for (let i = 0; i < len; i++) {
      out += this.randomChoice("0123456789abcdef".split(""));
    }
    return out;
  }

  /**
   * Generate a UUID
   */
  private uuid(): string {
    return crypto.randomUUID();
  }

  /**
   * Recursively find and set any nhsNumber property to a valid value
   */
  private setValidNhsNumber(obj: any): void {
    if (!obj || typeof obj !== "object") return;

    for (const key in obj) {
      if (key === "nhsNumber" && typeof obj[key] === "string") {
        this.log(`[GENERATE] Found nhsNumber field, setting to valid value`);
        // Set to known valid NHS number with correct checksum
        obj[key] = "9434765919";
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        // Recursively search nested objects and arrays
        this.setValidNhsNumber(obj[key]);
      }
    }
  }

  /**
   * Find conditional schemas (if/then) in allOf arrays
   */
  private findConditionals(schema: any): any[] {
    const conditionals: any[] = [];
    if (Array.isArray(schema.allOf)) {
      for (const item of schema.allOf) {
        if (item.if && item.then) {
          conditionals.push(item);
        }
        // Recursively search nested allOfs
        conditionals.push(...this.findConditionals(item));
      }
    }
    return conditionals;
  }

  /**
   * Apply CloudEvents-specific overrides to the generated example
   */
  private applyCloudEventsOverrides(
    example: any,
    dereferencedSchema: any,
    separateDataExample: any
  ): void {
    // If the main generation didn't include data field but we generated it separately, add it
    if (!example.data && separateDataExample) {
      this.log(`[GENERATE] Adding separately generated data field to main example`);
      example.data = separateDataExample;
      this.log(`[GENERATE] Data field added successfully`);
    }

    // 1. Enforce required CloudEvents profile fields if missing
    example.specversion = "1.0";

    // 2. Generate a stable type if schema didn't const it (avoid banned verbs)
    if (!example.type || typeof example.type !== "string") {
      example.type = "uk.nhs.notify.ordering.order.read.v1";
    }

    // 3. Generate IDs
    example.id = this.uuid();

    // 4. Generate source from the most specific pattern
    const sourceSchema = dereferencedSchema.properties?.source;
    if (sourceSchema?.pattern) {
      const generatedSource = jsf.generate(sourceSchema);
      if (typeof generatedSource === "string") {
        example.source = generatedSource;
      }
    }
    // 5.  Notify events are data plane and dataschemaversion
    example.plane = "data";
    example.dataschemaversion = "1.0.0";

    // 6. Generate subject from the most specific pattern
    const subjectSchema = dereferencedSchema.properties?.subject;
    const hasSpecificSubjectPattern =
      subjectSchema?.pattern && !subjectSchema.$ref;

    if (hasSpecificSubjectPattern) {
      const generatedSubject = jsf.generate(subjectSchema);
      if (typeof generatedSubject === "string") {
        example.subject = generatedSubject.toLowerCase();
      }
    } else {
      // Check for conditionals (if/then) in allOf
      const conditionals = this.findConditionals(dereferencedSchema);

      for (const conditional of conditionals) {
        const ifMatches = Object.keys(conditional.if.properties || {}).every(
          (propName) => {
            const ifPropSchema = conditional.if.properties[propName];
            const exampleValue = example[propName];
            if (ifPropSchema.pattern && exampleValue) {
              const pattern = new RegExp(ifPropSchema.pattern);
              return pattern.test(exampleValue);
            }
            return true;
          }
        );

        if (ifMatches && conditional.then?.properties?.subject?.pattern) {
          const thenSubjectSchema = conditional.then.properties.subject;
          const generatedSubject = jsf.generate(thenSubjectSchema);
          if (typeof generatedSubject === "string") {
            example.subject = generatedSubject.toLowerCase();
            break;
          }
        }
      }
    }

    // 6. Time & recordedtime: generate recent ISO times (UTC) ensuring recorded >= time
    const now = new Date();
    const timeDate = new Date(now.getTime() - 1000); // 1s earlier
    example.time = timeDate.toISOString();
    example.recordedtime = now.toISOString();

    // 7. traceparent (00-<32hex>-<16hex>-<2hex>) with sampled flag 01
    example.traceparent = `00-${this.randomHex(32)}-${this.randomHex(16)}-01`;
    if (!example.tracestate) {
      example.tracestate = "rojo=00f067aa0ba902b7";
    }

    // 8. Severity coherent pair
    const severities = [
      { text: "TRACE", number: 0 },
      { text: "DEBUG", number: 1 },
      { text: "INFO", number: 2 },
      { text: "WARN", number: 3 },
      { text: "ERROR", number: 4 },
      { text: "FATAL", number: 5 },
    ];
    const sev = this.randomChoice(severities);
    example.severitytext = sev.text;
    example.severitynumber = sev.number;

    // 9. Partition key (prefer customer segment prefix)
    const customerId = example.subject?.split("/")[1] || this.uuid();
    example.partitionkey = `customer-${customerId.substring(0, 8)}`.toLowerCase();

    // 10. Sequence: zero padded 20-digit
    const seq = crypto.randomInt(0, 1e9);
    example.sequence = seq.toString().padStart(20, "0");

    // 11. Sample rate default 1
    example.sampledrate = 1;

    // 12. Data payload enforcement
    this.log(`[GENERATE] Before data processing - example.data:`, JSON.stringify(example.data));
    this.log(`[GENERATE] Data field type:`, typeof example.data);

    if (!example.data || typeof example.data !== "object") {
      this.log(`[GENERATE] Data field is missing or not an object, setting to empty object`);
      example.data = {};
    } else {
      this.log(`[GENERATE] Data field already exists with keys:`, Object.keys(example.data));
    }

    // Set valid NHS numbers
    this.log(`[GENERATE] About to process NHS numbers in data:`, JSON.stringify(example.data));
    this.setValidNhsNumber(example.data);
    this.log(`[GENERATE] After NHS number processing - data:`, JSON.stringify(example.data));

    // 13. datacontenttype & dataschema stable defaults
    example.datacontenttype = "application/json";

    // 14. Data classification defaults
    example.dataclassification = example.dataclassification || "restricted";
    example.dataregulation = example.dataregulation || "ISO-27001";
    example.datacategory = example.datacategory || "sensitive";
  }

  /**
   * Generate an example from a dereferenced schema
   */
  private async generateFromSchema(dereferencedSchema: any): Promise<any> {
    this.log(`[GENERATE] Schema dereferenced successfully`);
    this.log(`[GENERATE] Schema properties keys:`, Object.keys(dereferencedSchema.properties || {}));

    if (dereferencedSchema.properties?.data) {
      this.log(`[GENERATE] Data property found in schema:`, JSON.stringify(dereferencedSchema.properties.data, null, 2));
    } else {
      this.log(`[GENERATE] No data property found in schema`);
    }

    this.log(`[GENERATE] Generating example with jsf...`);

    // Try to generate the data field separately first
    let separateDataExample = null;
    if (dereferencedSchema.properties?.data && typeof dereferencedSchema.properties.data === "object") {
      this.log(`[GENERATE] Attempting to generate data field separately...`);
      try {
        separateDataExample = jsf.generate(dereferencedSchema.properties.data as any);
        this.log(`[GENERATE] Data field generated separately successfully`);
      } catch (e) {
        this.log(`[GENERATE] Failed to generate data field separately:`, e);
      }
    }

    const example = jsf.generate(dereferencedSchema);

    this.log(`[GENERATE] Example generated. Type:`, typeof example);
    this.log(`[GENERATE] Example keys:`, example && typeof example === "object" ? Object.keys(example) : "Not an object");

    // Apply CloudEvents-specific overrides
    if (example && typeof example === "object") {
      this.applyCloudEventsOverrides(example, dereferencedSchema, separateDataExample);
    }

    return example;
  }

  /**
   * Generate an example from a schema path (file or URL)
   */
  async generate(schemaPath: string): Promise<GenerationResult> {
    try {
      // Add cache-busting query param if schemaPath is a URL
      let effectiveSchemaPath = schemaPath;
      try {
        const url = new URL(schemaPath);
        url.searchParams.set("_cb", Date.now().toString());
        effectiveSchemaPath = url.toString();
      } catch (e) {
        // Not a URL, use as-is
      }

      this.log(`[GENERATE] Starting schema resolution for: ${effectiveSchemaPath}`);

      // @ts-ignore - $RefParser types are incomplete
      const dereferencedSchema = await $RefParser.dereference(effectiveSchemaPath, {
        resolve: {
          file: { order: 1 },
          http: {
            order: 2,
            timeout: 10000,
            redirects: 5,
            headers: {
              "User-Agent": "nhs-notify-schema-builder/1.0",
              Accept: "application/json, application/schema+json, */*",
            },
            canRead(file: any) {
              const isHttp = /^https?:/i.test(file.url);
              return isHttp;
            },
            async read(file: any) {
              console.log(`\n========== HTTP REQUEST START ==========`);
              console.log(`[GENERATE] HTTP: Attempting to fetch URL`);
              console.log(`[GENERATE] HTTP: Full URL: ${file.url}`);

              const cached = await getCachedSchema(file.url);
              if (cached) {
                console.log(`[GENERATE] HTTP: Using cached response`);
                console.log(`========== HTTP REQUEST (CACHED) ==========\n`);
                return cached;
              }

              console.log(`[GENERATE] HTTP: Failed to fetch schema after retries`);
              throw new Error(`Failed to fetch schema from ${file.url}`);
            },
          },
        },
      });

      const example = await this.generateFromSchema(dereferencedSchema);

      return {
        example,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        example: null,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate an example and write it to a file
   */
  async generateToFile(schemaPath: string, outputPath: string): Promise<boolean> {
    const result = await this.generate(schemaPath);

    if (!result.success) {
      console.error(`Failed to generate example: ${result.error}`);
      return false;
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(result.example, null, 2));
    this.log(`Example written to ${outputPath}`);

    return true;
  }
}
