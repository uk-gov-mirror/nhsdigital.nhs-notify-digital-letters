#!/bin/bash

# This script is run before the Terraform apply command.
# It ensures all Node.js dependencies are installed, generates any required dependencies,
# and builds all Lambda functions in the workspace before Terraform provisions infrastructure.

echo "Running Pre.sh"

ROOT_DIR="$(git rev-parse --show-toplevel)"

echo "Running set-github-token.sh"

$ROOT_DIR/scripts/set-github-token.sh

echo "Completed."

# Skip dependency installation and build steps when only reading Terraform output.
# terraform output reads from S3 state backend and does not require built artefacts.
if [[ "${ACTION:-}" == "output" ]]; then
  echo "Skipping dependency installation and build steps for 'output' action."
  exit 0
fi

npm ci

npm run generate-dependencies

npm run lambda-build --workspaces --if-present

# Build Python lambdas
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

make -C "$ROOT/lambdas/mesh-acknowledge" package
make -C "$ROOT/lambdas/mesh-poll" package
make -C "$ROOT/lambdas/mesh-download" package
make -C "$ROOT/lambdas/report-sender" package
