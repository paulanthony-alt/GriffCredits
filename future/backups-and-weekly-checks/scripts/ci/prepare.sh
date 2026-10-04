#!/usr/bin/env bash
# Shared setup for workflows that touch the live database.
# Checks the required secrets, then exports PROJECT_ID, FIREBASE_PROJECT_ID and
# GOOGLE_APPLICATION_CREDENTIALS (service-account key written to $RUNNER_TEMP)
# for the following steps. Usage: prepare.sh [--need-backup-password]
set -euo pipefail

if [ -z "${FIREBASE_SERVICE_ACCOUNT:-}" ]; then
  echo "::error::The FIREBASE_SERVICE_ACCOUNT repository secret is missing (SETUP.md, step 6)."
  exit 1
fi
if [ "${1:-}" = "--need-backup-password" ] && [ -z "${BACKUP_PASSWORD:-}" ]; then
  echo "::error::The BACKUP_PASSWORD repository secret is missing (SETUP.md, 'Backups')."
  exit 1
fi

project_id=$(grep -E '^VITE_FIREBASE_PROJECT_ID=' .env.production | cut -d= -f2- | tr -d '"'"'"' \r')
if [ -z "$project_id" ]; then
  echo "::error::VITE_FIREBASE_PROJECT_ID is missing from .env.production."
  exit 1
fi

key_file="$RUNNER_TEMP/service-account.json"
printf '%s' "$FIREBASE_SERVICE_ACCOUNT" > "$key_file"
chmod 600 "$key_file"
{
  echo "PROJECT_ID=$project_id"
  echo "FIREBASE_PROJECT_ID=$project_id"
  echo "GOOGLE_APPLICATION_CREDENTIALS=$key_file"
} >> "$GITHUB_ENV"
