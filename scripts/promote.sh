#!/usr/bin/env bash
# Pin the stable channel entry of <plugin> to an existing release tag, on a new branch, ready for a PR.
#   ./scripts/promote.sh <plugin> <version>
# Also used by rollback.sh (a rollback is a promote to an older, verified version).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PLUGIN="${1:?usage: promote.sh <plugin> <version>}"
VERSION="${2:?usage: promote.sh <plugin> <version>}"
ACTION="${PROMOTE_ACTION:-promote}"
TAG="$PLUGIN--v$VERSION"
die() { echo "$ACTION: $*" >&2; exit 1; }

[[ -z "$(git status --porcelain)" ]] || die "working tree is not clean"
git fetch --tags --quiet origin || die "cannot fetch tags from origin"
SHA="$(git rev-parse -q --verify "refs/tags/$TAG^{commit}")" || die "tag $TAG does not exist"
TAGGED_VERSION="$(git show "$SHA:plugins/$PLUGIN/.claude-plugin/plugin.json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')"
[[ "$TAGGED_VERSION" == "$VERSION" ]] || die "$TAG points at a commit whose plugin.json says $TAGGED_VERSION"

BRANCH="channel/stable-$PLUGIN-$VERSION"
git switch -c "$BRANCH" origin/main
node scripts/pin-stable.mjs "$PLUGIN" "$VERSION" "$SHA"
if command -v claude >/dev/null; then claude plugin validate channels/stable || die "stable channel does not validate"; fi
git add channels/stable/.claude-plugin/marketplace.json
git commit -m "chore(channel): $ACTION stable $PLUGIN to $VERSION ($TAG, ${SHA:0:12})"
echo
echo "$ACTION: committed on $BRANCH. Push it and open a PR:"
echo "  git push -u origin $BRANCH"
echo
echo "After merge, users move to the stable channel with:"
echo "  claude plugin disable $PLUGIN@dev-digest-ai-marketplace --scope project"
echo "  claude plugin marketplace add https://raw.githubusercontent.com/Pereplut/dev-digest-ai-marketplace/main/channels/stable/.claude-plugin/marketplace.json --scope project"
echo "  claude plugin install $PLUGIN@dev-digest-ai-marketplace-stable --scope project"
echo "  /reload-plugins   # then run the smoke eval"
