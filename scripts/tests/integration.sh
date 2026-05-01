#!/bin/bash

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

npm install
npx playwright install --with-deps > /dev/null

cd tests/playwright

npm run test:component${PLAYWRIGHT_SHARD:+ -- --shard="$PLAYWRIGHT_SHARD"}
