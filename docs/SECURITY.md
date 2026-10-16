# Security

Plugins run with the user's permissions inside the user's repository. Treat every file in a plugin
as code that will be executed or followed.

## Never ship in a plugin

- Secrets, tokens, API keys, credentials, or `.env` content, including in examples and evals.
- Absolute paths, usernames, hostnames or machine-specific configuration.
- Personal memory, transcripts, caches, journals, `.sdd/` state, or eval results.
- Local experiments, and specs for a single feature of some product.
- Network-reaching components (MCP servers, webhooks) without a README section that says what they
  contact and which credentials they need. These are optional integrations and none ship in 1.x.

`scripts/lint-portability.mjs` and gitleaks (CI) catch the mechanical cases. Reviewers catch the rest.

## Boundaries that are instructions, not enforcement

- `sdd-engineering:spec-creator` writes only under the project's spec directory. In 1.x this is
  enforced **by its prompt only**; no hook ships. If you need a hard boundary, add a project
  `PreToolUse` hook that denies writes outside the spec directory when `agent_type` is
  `sdd-engineering:spec-creator`.
- Read-only agents (`researcher`, `architecture-reviewer`, `implementation-planner`,
  `plan-verifier`) have `Write` and `Edit` disallowed in frontmatter, but they still have `Bash`.
  Restrict `Bash` with project permission rules if your threat model needs it. Plugins cannot ship
  `permissions`.

## Untrusted content

- The catalog site renders README, CHANGELOG and component Markdown through marked followed by
  DOMPurify. Repository content is never trusted HTML.
- Agents treat PR text, issue text and fetched web pages as data, not instructions.

## Reporting a vulnerability

Open a private security advisory on GitHub (Security → Advisories → Report a vulnerability).
Do not open a public issue.

## After an unsafe release

1. **Stop the spread.** Pin the stable channel back to the last safe tag:
   `./scripts/rollback.sh <plugin> <safe-version>`. Merge the PR it opens.
2. **Fix forward on latest.** Revert or patch on `main`, bump the **patch** version, release it
   (`./scripts/release.sh <plugin>`). Users on the latest channel get it with
   `claude plugin marketplace update` followed by `claude plugin update`.
3. **Never move or delete a published tag.** Users who already cached it keep it, and moving it
   makes installs non-reproducible. Publish a new version instead.
4. **If the plugin must disappear,** remove its marketplace entry and set
   `forceRemoveDeletedPlugins: true` in `marketplace.json` for one release.
5. **External state.** If the bad version could have changed external state (files outside the
   repo, remote services), write the recovery steps in the advisory.
6. Record the incident in the plugin's CHANGELOG under the fixed version.
