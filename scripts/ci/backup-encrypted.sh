#!/usr/bin/env bash
# Takes a backup of the live database and encrypts it with BACKUP_PASSWORD.
# Usage: backup-encrypted.sh <output.json.enc>
set -euo pipefail
out="$1"
plain="$RUNNER_TEMP/backup.json"
npx tsx scripts/backup.ts "$plain"
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_PASSWORD -in "$plain" -out "$out"
rm -f "$plain"
echo "Encrypted backup written to $out ($(stat -c %s "$out") bytes)."
