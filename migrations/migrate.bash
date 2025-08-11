#!/usr/bin/env bash
set -euo pipefail

# Usage: ./migrate.sh <migration> <0|1>
#   migrations: 'toTS', 'fromTS', NOTE OTHERS
#   mode: 0=dry-run, 1=apply

m="${1:-}"; mode="${2:-}"
[[ -n "$m" && "$mode" =~ ^[01]$ ]] || { echo "Usage: $0 <migration> <0|1>"; exit 1; }

# creds (same as app)
export FIREBASE_ADMIN_JSON="$(jq -c . < /home/garritr01/Documents/portiaApp/auth/firebaseAdmin.json)"

# map mode to APPLY (dry run if 0, apply changes if 1)
export APPLY="$mode"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$m" in
  toTS)  python "$DIR/toTS.py" ;;
	fromTS)  python "$DIR/fromTS.py" ;;
  *)   echo "Unknown migration: $m"; exit 1 ;;
esac


