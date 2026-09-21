#!/bin/bash
set -e
cd "$(dirname "$0")/../.."
if [ ! -x local-ai/.venv/bin/python ] || [ ! -f local-ai/model-lock.json ]; then
    echo "Local Auto Events setup is missing. See docs/auto-events-local-setup.md."
    exit 1
fi
exec local-ai/.venv/bin/python scripts/local-ai/worker.py
