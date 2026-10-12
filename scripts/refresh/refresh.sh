#!/usr/bin/env bash
#
# refresh.sh — cron-ready entry point for the Marvel Legends Chronicle
# live refresh pipeline. Runs the hobby-press reveal scanner and appends
# a timestamped summary to logs/refresh.log.
#
# Install as a daily cron job, e.g.:
#   0 8 * * * /home/hatch/workspace/marvel-legends-chronicle/scripts/refresh/refresh.sh
#
# After the scan, commit + push any changed data/v1/radar-*.json files so the
# live site picks them up. (gh-push.py is used for authed pushes.)

set -u

# Resolve repo root relative to this script: scripts/refresh/refresh.sh
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$ROOT/logs"
LOG="$LOG_DIR/refresh.log"

mkdir -p "$LOG_DIR"

{
  echo "===== refresh run: $(date -u '+%Y-%m-%d %H:%M:%S UTC') ====="
  if python3 "$ROOT/scripts/refresh/check_radar.py"; then
    echo "check_radar.py: OK"
  else
    echo "check_radar.py: FAILED (exit $?)"
  fi
  echo ""
} >> "$LOG" 2>&1

# Keep the log from growing unbounded: last ~500 runs worth of lines.
tail -n 20000 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"

exit 0
