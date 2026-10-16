#!/usr/bin/env bash
# Pin the stable channel entries of one or more plugins to existing release tags, on a new branch,
# ready for a PR. Several pairs go in one commit: the stable channel resolves dependencies inside
# itself, so a plugin and the dependencies it needs are pinned together.
#   ./scripts/promote.sh <plugin> <version> [<plugin> <version> ...]
# Also used by rollback.sh (a rollback is a promote to an older, verified version).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
(( $# >= 2 && $# % 2 == 0 )) || { echo "usage: promote.sh <plugin> <version> [<plugin> <version> ...]" >&2; exit 2; }
ACTION="${PROMOTE_ACTION:-promote}"
die() { echo "$ACTION: $*" >&2; exit 1; }

[[ -z "$(git status --porcelain)" ]] || die "working tree is not clean"
git fetch --tags --quiet origin || die "cannot fetch tags from origin"

# Resolve and check every pair before touching git.
PAIRS=()
while (( $# )); do
  PLUGIN="$1"; VERSION="$2"; shift 2
  TAG="$PLUGIN--v$VERSION"
  SHA="$(git rev-parse -q --verify "refs/tags/$TAG^{commit}")" || die "tag $TAG does not exist"
  TAGGED_VERSION="$(git show "$SHA:plugins/$PLUGIN/.claude-plugin/plugin.json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')"
  [[ "$TAGGED_VERSION" == "$VERSION" ]] || die "$TAG points at a commit whose plugin.json says $TAGGED_VERSION"
  PAIRS+=("$PLUGIN $VERSION $SHA")
done

if (( ${#PAIRS[@]} == 1 )); then read -r P V _ <<<"${PAIRS[0]}"; BRANCH="channel/stable-$P-$V"; else BRANCH="channel/stable-$(date -u +%Y%m%d-%H%M%S)"; fi
git switch -c "$BRANCH" origin/main
SUMMARY=()
for pair in "${PAIRS[@]}"; do
  read -r P V SHA <<<"$pair"
  node scripts/pin-stable.mjs "$P" "$V" "$SHA"
  SUMMARY+=("$P $V (${SHA:0:12})")
done
if command -v claude >/dev/null; then claude plugin validate channels/stable || die "stable channel does not validate"; fi
git add channels/stable/.claude-plugin/marketplace.json
git commit -m "chore(channel): $ACTION stable: $(IFS=,; echo "${SUMMARY[*]}" | sed 's/,/, /g')"
echo
echo "$ACTION: committed on $BRANCH. Push it and open a PR:"
echo "  git push -u origin $BRANCH"
echo
PLUGIN="$(read -r P _ <<<"${PAIRS[-1]}"; echo "$P")"
echo "After merge, users move to the stable channel with:"
echo "  claude plugin disable $PLUGIN@dev-digest-ai-marketplace --scope project"
echo "  claude plugin marketplace add https://raw.githubusercontent.com/Pereplut/dev-digest-ai-marketplace/main/channels/stable/.claude-plugin/marketplace.json --scope project"
echo "  claude plugin install $PLUGIN@dev-digest-ai-marketplace-stable --scope project"
echo "  /reload-plugins   # then run the smoke eval"
