#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <email>"
    exit 1
fi

EMAIL="$1"

# Load MONGO_* vars from .env if present
if [ -f "$(dirname "$0")/../.env" ]; then
    set -a
    source "$(dirname "$0")/../.env"
    set +a
fi

MONGO_USER="${MONGO_USER:-missoncontrol}"
MONGO_PASSWORD="${MONGO_PASSWORD:-changeme}"
MONGO_DB="${MONGO_DB:-missoncontrol}"

RESULT=$(docker compose exec -T mongodb mongosh \
    --username "$MONGO_USER" \
    --password "$MONGO_PASSWORD" \
    --authenticationDatabase admin \
    --quiet \
    "$MONGO_DB" \
    --eval "
        const r = db.users.updateOne({ email: '$EMAIL' }, { \$set: { role: 'admin' } });
        r.matchedCount === 0 ? 'NOT_FOUND' : 'OK';
    ")

if echo "$RESULT" | grep -q "NOT_FOUND"; then
    echo "No user found with email: $EMAIL"
    exit 1
else
    echo "Promoted $EMAIL to admin."
fi
