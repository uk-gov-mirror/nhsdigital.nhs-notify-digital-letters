/**
 * CLI handler for update-readme
 *
 * This module orchestrates the full README update workflow:
 * 1. Generate YAML index from workspace structure
 * 2. Render README.md from the index
 */

import { realpathSync } from "fs";
import { dirname, resolve } from "path";
import { handleCli as generateIndexCli } from "./generate-readme-index-cli.ts";
import { handleCli as renderReadmeCli } from "./render-readme-cli.ts";

/**
 * Result of CLI execution
 */
export interface CliResult {
  /** Exit code (0 for success, non-zero for error) */
  exitCode: number;
  /** Error message if any */
  error?: string;
}

/**
 * CLI handler that updates README tables
 *
 * @param args - Command line arguments (typically process.argv.slice(2))
 * @param rootDir - Root directory of the project (typically __dirname/../../../)
 * @returns Promise resolving to CLI result with exit code
 */
export async function handleCli(
  args: string[],
  rootDir: string
): Promise<CliResult> {
  console.log("📝 Updating README tables...\n");

  try {
    // Step 1: Generate index
    const indexResult = generateIndexCli(args, rootDir);
    if (indexResult.exitCode !== 0) {
      return indexResult;
    }
    console.log("");

    // Step 2: Render README
    const renderResult = renderReadmeCli(rootDir);
    if (renderResult.exitCode !== 0) {
      return renderResult;
    }

    console.log("\n✅ README tables updated successfully!");
    console.log(
      "💡 Edit readme-metadata.yaml to customize labels and purposes"
    );

    return { exitCode: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error:", message);
    return { exitCode: 1, error: message };
  }
}

// Execute CLI if this module is run directly.
// istanbul ignore next - CLI entry point, difficult to test in Jest
if (process.argv[1]?.endsWith("update-readme-cli.ts")) {
  // Derive rootDir from process.argv[1] (3 levels up: tools/generator/readme-generator)
  const mainPath = realpathSync(process.argv[1]);
  const rootDir = resolve(dirname(mainPath), "../../..");
  const args = process.argv.slice(2);

  handleCli(args, rootDir)
    .then((result) => {
      process.exit(result.exitCode);
    })
    .catch((err) => {
      console.error("Unexpected error:", err);
      process.exit(1);
    });
}
