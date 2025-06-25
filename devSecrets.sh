#!/usr/bin/env bash
set -euo pipefail

export FIREBASE_ADMIN_JSON="$(jq -c . < /home/garritr01/Documents/portiaApp/auth/firebaseAdmin.json)"
export LOGGER_ADMIN_JSON="$(jq -c . < /home/garritr01/Documents/portiaApp/auth/loggerAdmin.json)"
export REACT_APP_API_KEY="$(jq -r .apiKey  < /home/garritr01/Documents/portiaApp/auth/reactFirebaseAdmin.json)"
export REACT_APP_AUTH_DOMAIN="$(jq -r .authDomain < /home/garritr01/Documents/portiaApp/auth/reactFirebaseAdmin.json)"
export REACT_APP_PROJ_ID="$(jq -r .projectId < /home/garritr01/Documents/portiaApp/auth/reactFirebaseAdmin.json)"
export REACT_APP_APP_ID="$(jq -r .appId < /home/garritr01/Documents/portiaApp/auth/reactFirebaseAdmin.json)"

if [[ $# -eq 0 ]]; then
  set -- python run.py
fi

exec "$@"