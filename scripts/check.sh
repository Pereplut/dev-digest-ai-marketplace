#!/usr/bin/env bash
# Every check a pull request must pass. CI runs exactly this.
#   ./scripts/check.sh [--no-validate] [--no-index]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
VALIDATE=1 INDEX=1
for a in "$@"; do
  case "$a" in
    --no-validate) VALIDATE=0 ;;
    --no-index) INDEX=0 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done
fail=0
step() { echo; echo "== $*"; }

if [[ $VALIDATE == 1 ]]; then
  if command -v claude >/dev/null; then
    step "claude plugin validate --strict (marketplace)"
    claude plugin validate --strict . || fail=1
    for dir in plugins/*/; do
      step "claude plugin validate --strict $dir"
      claude plugin validate --strict "$dir" || fail=1
    done
  else
    echo "claude CLI not found: skipping validate (CI installs it)" >&2
    fail=1
  fi
fi

step "manifest consistency"
node scripts/check-manifests.mjs || fail=1

step "portability + English-only lint"
node scripts/lint-portability.mjs || fail=1

step "python unit tests"
python3 -m unittest discover -s test/python -q || fail=1

step "node unit tests"
node --test "test/js/**/*.test.mjs" || fail=1

if [[ $INDEX == 1 ]]; then
  step "build catalog index"
  node scripts/build-index.mjs --out .tmp/site-index || fail=1
fi

echo
if [[ $fail == 0 ]]; then echo "check: all green"; else echo "check: FAILED"; fi
exit $fail
