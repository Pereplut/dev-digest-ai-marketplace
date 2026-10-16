#!/usr/bin/env bash
# Release one plugin: verify, then create and push the <plugin>--v<version> tag via `claude plugin tag`.
#   ./scripts/release.sh <plugin>          dry run (default)
#   ./scripts/release.sh <plugin> --yes    create and push the tag
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PLUGIN="${1:?usage: release.sh <plugin> [--yes]}"
YES="${2:-}"
DIR="plugins/$PLUGIN"
MANIFEST="$DIR/.claude-plugin/plugin.json"
[[ -f "$MANIFEST" ]] || { echo "no such plugin: $PLUGIN" >&2; exit 1; }
VERSION="$(node -p "require('./$MANIFEST').version")"
TAG="$PLUGIN--v$VERSION"
die() { echo "release: $*" >&2; exit 1; }

[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]] || die "not on main"
[[ -z "$(git status --porcelain)" ]] || die "working tree is not clean"
git fetch --tags --quiet origin || die "cannot fetch tags from origin"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || die "main is not in sync with origin/main"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "tag $TAG already exists (tags are immutable; bump the version)"
grep -q "^## \[$VERSION\]" "$DIR/CHANGELOG.md" || die "$DIR/CHANGELOG.md has no '## [$VERSION]' section"

# Dependencies must already be released: some existing tag must satisfy each range.
node scripts/check-deps-released.mjs "$PLUGIN" || die "release dependencies first (docs/RELEASES.md#release-order)"

./scripts/check.sh || die "./scripts/check.sh failed"

echo
echo "release: $TAG at $(git rev-parse HEAD)"
( cd "$DIR" && claude plugin tag --dry-run )
if [[ "$YES" == "--yes" ]]; then
  ( cd "$DIR" && claude plugin tag --push -m "Release $TAG" )
  echo "released $TAG -> $(git rev-parse "$TAG^{commit}")"
  echo "next: ./scripts/promote.sh $PLUGIN $VERSION   (pin the stable channel)"
else
  echo "dry run only. Re-run with --yes to create and push $TAG."
fi
