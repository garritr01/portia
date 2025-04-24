#!/usr/bin/env bash
set -euo pipefail

export FIREBASE_ADMIN_JSON="$(jq -c . < /mnt/c/Users/garri/Documents/SS2025/CIS658-WA/portiaApp/auth/firebaseAdmin.json)"
export LOGGER_ADMIN_JSON="$(jq -c . < /mnt/c/Users/garri/Documents/SS2025/CIS658-WA/portiaApp/auth/loggerAdmin.json)"
export REACT_APP_API_KEY="$(jq -r .apiKey  < /mnt/c/Users/garri/Documents/SS2025/CIS658-WA/portiaApp/auth/reactFirebaseAdmin.json)"
export REACT_APP_AUTH_DOMAIN="$(jq -r .authDomain < /mnt/c/Users/garri/Documents/SS2025/CIS658-WA/portiaApp/auth/reactFirebaseAdmin.json)"
export REACT_APP_PROJ_ID="$(jq -r .projectId < /mnt/c/Users/garri/Documents/SS2025/CIS658-WA/portiaApp/auth/reactFirebaseAdmin.json)"
export REACT_APP_APP_ID="$(jq -r .appId < /mnt/c/Users/garri/Documents/SS2025/CIS658-WA/portiaApp/auth/reactFirebaseAdmin.json)"

if [[ $# -eq 0 ]]; then
  set -- python run.py
fi

exec "$@"