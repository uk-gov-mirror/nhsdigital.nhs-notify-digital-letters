/**
 * CLI handler for generate-docs
 * Handles argument parsing and invocation of the DocsGenerator class
 */

import path from 'path';
import fs from 'fs';
import type { DocsGeneratorConfig, DocsGenerationResult } from './docs-generator-types.ts';
import { DocsGenerator } from './docs-generator.ts';

/**
 * CLI execution result
 */
export interface CliResult {
  exitCode: number;
  error?: string;
  result?: DocsGenerationResult;
}

/**
 * Parse and validate CLI arguments
 */
export function parseCliArgs(args: string[]): { config: DocsGeneratorConfig; error?: string } {
  if (args.length < 2) {
    return {
      config: { inputDir: '', outputDir: '' },
      error: 'Missing required arguments',
    };
  }

  const inputDir = path.resolve(args[0]);
  const outputDir = path.resolve(args[1]);

  return {
    config: {
      inputDir,
      outputDir,
      verbose: args.includes('--verbose') || args.includes('-v'),
    },
  };
}

/**
 * Validate that the input directory exists
 */
export function validateInputDir(inputDir: string): { valid: boolean; error?: string } {
  if (!fs.existsSync(inputDir)) {
    return {
      valid: false,
      error: `Input directory does not exist: ${inputDir}`,
    };
  }

  return { valid: true };
}

/**
 * Ensure the output directory exists, creating it if necessary
 */
export function ensureOutputDir(outputDir: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Failed to create output directory: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Print CLI usage information
 */
export function printUsage(): void {
  console.error('Usage: tsx generate-docs-cli.ts <input-dir> <output-dir>');
  console.error('Example: tsx generate-docs-cli.ts ./output ./docs');
}

/**
 * Handle CLI invocation
 * This function is testable without spawning processes
 */
export async function handleCli(args: string[]): Promise<CliResult> {
  // Parse arguments
  const { config, error: parseError } = parseCliArgs(args);
  if (parseError) {
    printUsage();
    return { exitCode: 1, error: parseError };
  }

  console.log('Input directory:', config.inputDir);
  console.log('Output directory:', config.outputDir);

  // Validate input directory
  const { valid, error: validateError } = validateInputDir(config.inputDir);
  if (!valid) {
    console.error(validateError);
    return { exitCode: 1, error: validateError };
  }

  // Ensure output directory exists
  const { success: dirSuccess, error: dirError } = ensureOutputDir(config.outputDir);
  if (!dirSuccess) {
    console.error(dirError);
    return { exitCode: 1, error: dirError };
  }

  // Generate documentation using DocsGenerator
  try {
    const generator = new DocsGenerator({
      inputDir: config.inputDir,
      outputDir: config.outputDir,
      verbose: true,
    });

    const result = await generator.generate();

    if (!result.success) {
      console.error('Documentation generation failed:', result.error);
      return { exitCode: 1, error: result.error, result };
    }

    return { exitCode: 0, result };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Failed to generate documentation:', errorMessage);
    return { exitCode: 1, error: errorMessage };
  }
}

// istanbul ignore next - CLI entry point, difficult to test in Jest
if (process.argv[1]?.endsWith('generate-docs-cli.ts')) {
  handleCli(process.argv.slice(2)).then((result) => {
    process.exit(result.exitCode);
  }).catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
}
