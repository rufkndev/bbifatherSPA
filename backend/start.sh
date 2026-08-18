#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
exec ./venv/bin/gunicorn --config gunicorn.conf.py main:app
