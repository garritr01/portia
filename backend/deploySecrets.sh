#!/usr/bin/env bash
set -euo pipefail

# Define backenv from json
FIREBASE_ADMIN_JSON="$(jq -c . < firebaseAdmin.json)"
LOGGER_ADMIN_JSON="$(jq -c . < loggerAdmin.json)"

# Define frontenv for json... by key
REACT_APP_API_KEY="$(jq -r .apiKey < reactFirebaseAdmin.json)"
REACT_APP_AUTH_DOMAIN="$(jq -r .authDomain < reactFirebaseAdmin.json)"
REACT_APP_PROJ_ID="$(jq -r .projectId < reactFirebaseAdmin.json)"
REACT_APP_APP_ID="$(jq -r .appId < reactFirebaseAdmin.json)"

# push them up to Fly
fly secrets set \
  FIREBASE_ADMIN_JSON="$FIREBASE_ADMIN_JSON" \
  LOGGER_ADMIN_JSON="$LOGGER_ADMIN_JSON" \
  REACT_APP_API_KEY="$REACT_APP_API_KEY" \
  REACT_APP_AUTH_DOMAIN="$REACT_APP_AUTH_DOMAIN" \
  REACT_APP_PROJ_ID="$REACT_APP_PROJ_ID" \
  REACT_APP_APP_ID="$REACT_APP_APP_ID"

# and deploy
fly deploy
