# engineering-paved-path

Paved-path engineering skills for Claude Code: where backend and frontend code belongs, and how to
review web code for security. Every skill is project-agnostic doctrine; each one tells the agent to
read the target repository's own rules first and to let them win where they differ.

## Components

| Component | Type | Invocation | What it answers |
|---|---|---|---|
| `onion-architecture` | skill | `/engineering-paved-path:onion-architecture` (also auto-invoked) | Which onion / ports-and-adapters ring a backend file belongs to, what it may import, where ORMs, HTTP clients, LLM SDKs and git libraries must sit behind a port, and how to add a new external system |
| `react-code-organization` | skill | `/engineering-paved-path:react-code-organization` (also auto-invoked) | Where React / Next.js App Router code belongs: folders, splitting, business-logic layers, constants, types, hooks, the `'use client'` seam, Data Access Layer, Server Actions |
| `security` | skill | `/engineering-paved-path:security` (also auto-invoked) | OWASP Top 10:2025 web security: confidence-based review, auth/authorization, input handling, uploads, secrets, API endpoints, with checklists and unsafe/safe examples |

Other plugins reference these skills by their namespaced names, for example
`engineering-paved-path:onion-architecture`.

## Install

```
/plugin marketplace add Pereplut/dev-digest-ai-marketplace
/plugin install engineering-paved-path@dev-digest-ai-marketplace
```

No dependencies.

## Use

The skills load automatically when a request matches their descriptions ("where should this
adapter go?", "is this route safe?", "should this be a hook?"). Load one explicitly with its slash
name, or from another agent with the `Skill` tool:

```
/engineering-paved-path:onion-architecture  Where does a call to the payments SDK belong?
```

## What it reads from the target repository

`onion-architecture` and `react-code-organization` end with a **Project overlay** section that
directs the agent to:

- agent instructions — `AGENTS.md` / `CLAUDE.md`, root and package-level;
- architecture docs — `docs/`, ADRs;
- boundary tool configs — dependency-cruiser, ESLint `no-restricted-imports` /
  `import/no-restricted-paths` / `eslint-plugin-boundaries` zones, ast-grep rules;
- the installed framework version (`package.json` / lockfile) for version-tagged Next.js rules.

Repository rules override the generic doctrine, and the agent cites the file it took each rule from.

## Limitations

- Examples are TypeScript (Node backend, React / Next.js frontend). The onion doctrine is
  language-agnostic; the enforcement tooling named is JavaScript-ecosystem.
- The `security` skill's examples target React + Express + MongoDB + JWT; principles transfer,
  snippets may not.
- Skills give guidance; they do not enforce anything. Enforcement comes from the project's own
  linters and boundary checks.
- Next.js rules tagged **[v16]** do not apply to 15.x codebases.

## Attribution

All three skills were originally authored as project-local skills and generalized for this
marketplace. Their research sources are kept in each skill: `onion-architecture/README.md`,
`react-code-organization/README.md`, `security/references.md` (OWASP and the community security
skills it draws on).
