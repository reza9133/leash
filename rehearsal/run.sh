#!/usr/bin/env bash
# Offline rehearsal of the live run: the real contract runs in the local test runner, a stub plays genlayer-js and
# the network, and scripts/e2e.mjs runs against it unchanged. It checks the script's logic, not the real AI.
#   bash rehearsal/run.sh                                   all scenarios, the model approves, the audit approves
#   REVIEW_MODE=escalate bash rehearsal/run.sh --only review,veto
#   AUDIT_MODE=reject bash rehearsal/run.sh --only challenge
# REVIEW_MODE: approve | escalate | reject      AUDIT_MODE: approve | reject
set -e
here="$(cd "$(dirname "$0")/.." && pwd)"
work="$here/.rehearsal-tmp"
rm -rf "$work"
mkdir -p "$work"
cp -r "$here/scripts" "$work/scripts"
ln -s "$here/contracts" "$work/contracts"
cp -r "$here/rehearsal/stub/node_modules" "$work/node_modules"
cp "$here/package.json" "$work/package.json"
export REHEARSAL_ROOT="$here"
export OWNER_KEY=0x$(printf '1%.0s' $(seq 1 64))
export AGENT_KEY=0x$(printf '2%.0s' $(seq 1 64))
export LEASH_ADDRESS=0x$(printf 'ab%.0s' $(seq 1 20))
export REPORT_DIR="$here/reports/rehearsal"
cd "$work"
node scripts/e2e.mjs "$@"
