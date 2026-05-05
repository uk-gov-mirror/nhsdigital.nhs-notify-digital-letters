#!/usr/bin/env bash


published_version=$(npm view @nhsdigital/notify-digital-letters-consumer-contracts --json 2>/dev/null | jq -r '.["dist-tags"].latest')

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Fail if there are uncommitted changes as this indicates unexpected changes to the contracts
git diff --quiet tests/pact-tests

branch_name=${BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")}
if [[ "$branch_name" != "main" ]]; then
    echo "Not publishing package because this is not the main branch"
    exit 0
fi

local_version=$(cat pact-contracts/package.json | jq -r '.version')
if [[ $local_version == $published_version ]]; then
    echo "Local version is the same as the latest published version - skipping publish"
    exit 0
fi

if ! find pact-contracts/pacts -type f -name '*.json' -print -quit | grep -q .; then
    echo "Cannot publish package: no pact .json files found under pact-contracts/pacts"
    exit 1
fi

echo "Local version is different to the latest published version - publishing new version"
npm publish ./pact-contracts
