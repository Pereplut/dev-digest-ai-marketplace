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
claude plugin disable sdd-engineering@dev-digest-ai-marketplace --scope project
claude plugin marketplace add https://raw.githubusercontent.com/Pereplut/dev-digest-ai-marketplace/main/channels/stable/.claude-plugin/marketplace.json --scope project
claude plugin install sdd-engineering@dev-digest-ai-marketplace-stable --scope project
/reload-plugins
# run the smoke eval / a short workflow
```

Plugin data in `${CLAUDE_PLUGIN_DATA}` is kept across disable and update, and is removed only on
the last uninstall without `--keep-data`. The SDD plugins keep their state in the target
repository (`specs/`, `.sdd/`), so a rollback does not touch it.

**Returning to latest:** fix forward, release a new version, then re-enable the latest entry and
uninstall the stable one:

```
claude plugin uninstall sdd-engineering@dev-digest-ai-marketplace-stable --scope project --keep-data
claude plugin enable sdd-engineering@dev-digest-ai-marketplace --scope project
claude plugin update sdd-engineering@dev-digest-ai-marketplace --scope project
```

The rehearsed command sequence and its results are recorded below after each rehearsal.

## Rehearsal log

| Date | From → to | Result |
|---|---|---|
| — | — | not yet rehearsed |
