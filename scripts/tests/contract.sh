#!/usr/bin/env bash

set -euo pipefail

schema_packages=(
    "@nhsdigital/nhs-notify-event-schemas-status-published"
    "@nhsdigital/nhs-notify-event-schemas-supplier-api"
)

cd "$(git rev-parse --show-toplevel)"

for schema_package in "${schema_packages[@]}"; do
    if npm outdated "$schema_package" >/dev/null 2>&1; then
        outdated_status=0
    else
        outdated_status=$?
    fi

    if [[ $outdated_status -eq 1 ]]; then
        echo "The provider schema package ($schema_package) is outdated."
        echo "Please run npm update $schema_package to update to the latest version and re-run."
        echo
        exit 1
    fi

    if [[ $outdated_status -gt 1 ]]; then
        echo "Failed to check provider schema package version (npm outdated exited with status $outdated_status)."
        exit $outdated_status
    fi
done

npm run test:contract
