#!/usr/bin/env bash
set -euo pipefail

echo "=== Migrations ==========================="
echo "		1 - (toTS.py)    (DEPR) - create datetime from iso '{key}' -> '{key}TS'"
echo "		2 - (fromTS.py)  (DEPR) - replace iso '{key}' w/ datetime '{key}TS'"
echo "		3 - (pseudoUTCtoUTC.py) - convert EDT masquerading as UTC to true UTC"
echo "		4 - (avgDocSize.py)			- Document size analytics (mode irrelevant, no changes)"
echo "=========================================="
read -rp "Migration: " migration

echo "=== Modes ================================"
echo "		0 - dry run for testing (check logs)"
echo "		1 - create adjacent '{key}_new' for each '{key}' altered"
echo "		2 - replace '{key}' with '{key}_new' or directly alter '{key}' & backup '{key}' w '{key}_orig"
echo "		3 - revert '{key}' back to '{key}_orig' value"
echo "		4 - drop '{key}_orig' and '{key}_new'"
echo "=========================================="
read -rp "Mode: " mode

# Validate inputs
if [[ -z "$migration" || ! "$mode" =~ ^[0-4]$ ]]; then
	echo "Invalid. Aborting."
	exit 1
fi

# summarize
echo
echo ">>> Migration: $migration"
case "$mode" in
  0) echo ">>> Mode 0: Dry run (no writes, logging only)" ;;
  1) echo ">>> Mode 1: Creating adjacent '{key}_new' fields" ;;
  2) echo ">>> Mode 2: Replacing '{key}' with new UTC, backing up in '{key}_orig'" ;;
	3) echo ">>> Mode 3: Reverting '{key}' back to '{key}_orig'" ;;
  4) echo ">>> Mode 4: Dropping all '{key}_orig' fields" ;;
esac
echo

# confirm
read -rp "Proceed with migration? [y/N] " reply
case "$reply" in
  [Yy]*) echo "Running..." ;;
  *)     echo "Cancelled."; exit 0 ;;
esac

export FIREBASE_ADMIN_JSON="$(jq -c . < /home/garritr01/Documents/portiaApp/auth/firebaseAdmin.json)" # creds
export APPLY="$mode" # mode
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" # src file parent

case "$migration" in
  1)  python "$DIR/toTS.py" ;;
	2)  python "$DIR/fromTS.py" ;;
	3)  python "$DIR/pseudoUTCtoUTC.py" ;;
	4)  python "$DIR/avgDocSize.py" ;;
  *)  echo "Unknown migration: $migration"; exit 1 ;;
esac


