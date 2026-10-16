# Releases

## Versioning (SemVer)

| Change | Bump | Example |
|---|---|---|
| Breaking: removed or renamed agent or skill, changed artefact path or report format another agent parses, new required dependency, raised minimum Claude Code | **major** | 1.4.2 → 2.0.0 |
| Backward-compatible behaviour: new agent, skill, flag or check; stricter gate that existing valid inputs pass | **minor** | 1.0.0 → 1.1.0 |
| Fix, wording, docs, eval-only change | **patch** | 1.1.0 → 1.1.1 |

Claude Code caches plugins by version. **If `version` does not change, users do not receive the
commit.** Bump on every release.

## Tags

Each release gets a tag `<plugin>--v<version>` (for example `sdd-engineering--v1.0.0`) on the
marketplace repository. The tag must point at a commit where `plugins/<plugin>/.claude-plugin/plugin.json`
has that version and CI was green. Tags are immutable: never move or delete one.

Claude Code resolves version-constrained dependencies (`"version": "^1.0.0"`) against these tags.

## Release order

Release dependencies first, then consumers:

1. `engineering-paved-path`
2. `research-tools`
3. `architecture-review`
4. `sdd-engineering`

`scripts/release.sh` refuses to tag a plugin whose dependency ranges have no satisfying tag yet.

## Cutting a release

```
git switch main && git pull
./scripts/release.sh <plugin>          # checks, dry run, prints what it would tag
./scripts/release.sh <plugin> --yes    # creates and pushes <plugin>--v<version> (claude plugin tag --push)
./scripts/promote.sh <plugin> <version>   # pin the stable channel to the new tag (opens a branch for a PR)
```

The stable channel resolves dependencies **inside itself**. A plugin whose dependencies are not
pinned there installs as `dependency-unsatisfied`. The first promotion of a plugin therefore pins its
dependencies in the same commit:

```
./scripts/promote.sh engineering-paved-path 1.0.0 research-tools 1.0.0 architecture-review 1.0.0 sdd-engineering 1.0.0
```

`release.sh` checks:
- the tree is clean and you are on `main`;
- `CHANGELOG.md` has a `## [<version>]` section;
- `./scripts/check.sh` is green;
- every dependency range is satisfied by an existing tag;
- the tag does not exist yet.

Before tagging, review the CHANGELOG, the commit SHA and the eval results. Record the SHA in
[COST-BASELINE.md](COST-BASELINE.md) when the release was measured.

## Channels

Claude Code has no built-in channel concept, so channels are two marketplaces with different names:

| Channel | Marketplace name | Source of plugin files | Add with |
|---|---|---|---|
| latest | `dev-digest-ai-marketplace` | `main` (relative paths) | `claude plugin marketplace add Pereplut/dev-digest-ai-marketplace` |
| stable | `dev-digest-ai-marketplace-stable` | release tags (`git-subdir` sources pinned to `ref` + `sha`) | `claude plugin marketplace add https://raw.githubusercontent.com/Pereplut/dev-digest-ai-marketplace/main/channels/stable/.claude-plugin/marketplace.json` |

`channels/stable/.claude-plugin/marketplace.json` is edited only by `scripts/promote.sh` and
`scripts/rollback.sh`.

## Updating (users)

```
claude plugin marketplace update dev-digest-ai-marketplace       # refresh the catalog
claude plugin update sdd-engineering@dev-digest-ai-marketplace --scope project
/reload-plugins                                                   # or start a new session
```

Updating the catalog and updating a plugin are separate steps. Check each one on its own.

## Rollback

There is no `claude plugin rollback` command. A rollback means moving users to the stable channel,
pinned to a verified version.

**Maintainer:**

```
./scripts/rollback.sh sdd-engineering 1.0.0   # pins stable entry to sdd-engineering--v1.0.0 (+ its SHA); opens a branch
# merge the PR
```

**User:**

```
# 1. Disable the latest-channel copies of the plugin AND its dependencies. Otherwise both channels'
#    copies are enabled, only one of each name loads, and which one is not defined. Dependents first:
#    a plugin another enabled plugin still needs refuses to be disabled.
for p in sdd-engineering architecture-review research-tools engineering-paved-path; do
  claude plugin disable "$p@dev-digest-ai-marketplace" --scope project
done
# 2. Add the stable channel and install from it (its dependencies come from the same channel).
claude plugin marketplace add https://raw.githubusercontent.com/Pereplut/dev-digest-ai-marketplace/main/channels/stable/.claude-plugin/marketplace.json --scope project
claude plugin install sdd-engineering@dev-digest-ai-marketplace-stable --scope project
# 3. Check: the -stable ids enabled at the pinned version, the latest ones disabled.
claude plugin list --json
/reload-plugins   # or start a new session; then run a short workflow
```

**Users already on the stable channel** need no reinstall when the channel is rolled back. Refresh
the catalog, then update; `plugin update` moves *down* to the pinned version:

```
claude plugin marketplace update dev-digest-ai-marketplace-stable
claude plugin update sdd-engineering@dev-digest-ai-marketplace-stable --scope project   # 1.1.0 -> 1.0.0
```

**Plugin data.** These plugins write nothing to `${CLAUDE_PLUGIN_DATA}`; their state lives in the
target repository (`specs/`, `.sdd/`), so a rollback does not touch it. Plugin data is keyed by
plugin id, and `x@dev-digest-ai-marketplace-stable` is a different id from
`x@dev-digest-ai-marketplace`. A plugin that did keep data would start empty on the other channel.
Its latest-channel data stays, because `disable` keeps it, and so does `uninstall --keep-data`.

**Returning to latest:** fix forward, release a new version, then:

```
claude plugin uninstall sdd-engineering@dev-digest-ai-marketplace-stable --scope project --keep-data
claude plugin prune --scope project -y                    # stable dependencies; -y outside a TTY (removing the marketplace also drops them)
claude plugin marketplace remove dev-digest-ai-marketplace-stable --scope project
for p in engineering-paved-path research-tools architecture-review sdd-engineering; do   # dependencies first
  claude plugin enable "$p@dev-digest-ai-marketplace" --scope project
done
claude plugin update sdd-engineering@dev-digest-ai-marketplace --scope project
```

The rehearsed command sequence and its results are recorded below after each rehearsal.

## Rehearsal log

| Date | From → to | Result |
|---|---|---|
| 2026-10-16 | **On `main`.** Stable `sdd-engineering` 1.1.0 → 1.0.0 via `./scripts/rollback.sh sdd-engineering 1.0.0` (PR #3, `2ab6659`); then back to latest 1.1.0 | 1. Maintainer: `rollback.sh` pinned `sdd-engineering--v1.0.0` (`dc0752a`), changed 2 lines, and passed validation and `check-stable-deps`. Merged as #3. 2. User on latest: disable the four latest entries, dependents first (`engineering-paved-path` refused while `architecture-review` needed it; the order is fixed in the steps above); add stable from the `main` raw URL; install. Got stable 1.1.0, before the rollback merged. 3. After #3: `marketplace update` + `plugin update` went 1.1.0 → 1.0.0 (the update downgrades). Only the four `-stable` ids loaded, `plugin_errors` none. 4. Smoke: spec-creator dispatched, report has `## Spec written` but no `## Requirement coverage`, which is 1.0.0's behaviour ($0.56). 5. Return: uninstall `--keep-data`, `prune -y`, remove the stable marketplace, enable dependencies first, `update`: latest 1.1.0, no errors. Plugin data: none written by these plugins. One invalid smoke run is not counted: `git stash -u` had reverted `.claude/settings.json`, so the latest channel loaded instead ($0.57). |
| 2026-10-16 | latest `sdd-engineering` 1.1.0 → stable 1.0.0 → latest 1.1.0, in a fresh repository, from the **PR #1 branch's** raw URL (stable not yet merged to `main`) | Stable install: `sdd-engineering@…-stable` 1.0.0 with its 3 dependencies from the stable channel, pinned to `dc0752a`; `plugin_errors` none. With only `sdd-engineering` disabled, the latest-channel dependencies stayed enabled next to the stable ones and each name loaded once, undefined which: the user steps now disable all four. Return: uninstall + `prune` + enable + update, back to 1.1.0. No plugin data to keep (none written). |
