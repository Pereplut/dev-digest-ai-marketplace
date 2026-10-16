#!/usr/bin/env bash
# Roll the stable channel of <plugin> back to an earlier verified release. Never moves or deletes tags.
#   ./scripts/rollback.sh <plugin> <version>
# Full procedure (maintainer + user steps, returning to latest): docs/RELEASES.md#rollback
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN="${1:?usage: rollback.sh <plugin> <version>}"
VERSION="${2:?usage: rollback.sh <plugin> <version>}"
CURRENT="$(node -p "require('$ROOT/plugins/$PLUGIN/.claude-plugin/plugin.json').version")"
echo "rollback: stable channel of $PLUGIN -> $VERSION (latest on main is $CURRENT)"
PROMOTE_ACTION=rollback exec "$ROOT/scripts/promote.sh" "$PLUGIN" "$VERSION"
