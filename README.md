# BuildSteward

**Engineering discipline and evidence-driven decisions for AI coding agents.**

BuildSteward gives coding agents a developer-first workflow, decision records, dependency evidence, scoped permission workflow, short engineering recipes, progress-loop detection, project checkpoints and optional Codebase Memory MCP graph search.

> **Status: working foundation, not a production-ready autonomous runtime.** This repository has a functional local CLI and a portable Agent Skill. It does not independently execute development tasks, enforce permissions over an unrestricted shell, guarantee software security, or make all AI models equally capable.

## Why

A coding agent should behave like a professional product engineer: **understand → inspect → decide → design → implement → test/review → integrate → release → maintain**. Small tasks take a fast path. Risky decisions use versioned facts and hard constraints. The goal is fewer ungrounded dependencies, fewer repeated failures, and clearer verified outcomes, **without filling every model's context with a giant instruction manual**.

## What works now

| Capability | Current behavior |
|---|---|
| Portable skill | `skills/buildsteward/SKILL.md` and focused references |
| Developer routing | Classifies user tasks into fast/standard/architectural paths (heuristic) |
| Decision engine | Hard gates, adjustable profiles, missing-evidence/tie handling, decision ledger |
| Approval mode | Suggests decisions and records explicit approval/rejection workflow |
| Autonomous mode | Makes in-scope decisions when evidence is sufficient; high-risk actions require approval |
| Dependency evidence | Queries deps.dev **specific package version** + OSV, cached and offline-capable |
| Steward Library | Eight small searchable engineering recipes with source references |
| Checkpoints | Project state in `.buildsteward/checkpoint.json` |
| Progress Sentinel | Detects consecutive identical no-progress fingerprints |
| Optional memory graph | CLI adapter to existing `codebase-memory-mcp`, disabled by default |
| Tests | Node built-in test runner; no npm runtime dependencies |

## Requirements

- Node.js 22 or newer and an accessible repository directory.
- Optional: Internet for live dependency evidence.
- Optional: [Codebase Memory MCP](https://github.com/DeusData/codebase-memory-mcp) installed separately for graph search.

No `npm install` is necessary to run the local CLI.

## Quick start

```bash
# From inside the downloaded BuildSteward directory:
node bin/buildsteward.js help
npm test

# Initialize an existing project, using an absolute or relative path:
node bin/buildsteward.js --root /path/to/project init --mode approval

# Optional: full autonomous decision mode
node bin/buildsteward.js --root /path/to/project config set autonomy.mode autonomous

# Inspect repo and select task workflow
node bin/buildsteward.js --root /path/to/project inspect
node bin/buildsteward.js route "Fix authentication bug"

# Browse small relevant knowledge articles
node bin/buildsteward.js library search "dependency security"
node bin/buildsteward.js library show dependency-selection --detail

# Evaluate candidate technologies; example scores are illustrative, not verified facts
node bin/buildsteward.js decide evaluate --file examples/decision.json
node bin/buildsteward.js --root /path/to/project decide record --file examples/decision.json

# Research an *exact published version* (requires network or cache)
node bin/buildsteward.js --root /path/to/project deps inspect --ecosystem npm --name react --version 18.2.0

# Continue work between agents/sessions
node bin/buildsteward.js --root /path/to/project checkpoint save --file examples/checkpoint.json
node bin/buildsteward.js --root /path/to/project checkpoint show
```

The CLI prints **compact JSON** by default to reduce token overhead. Add `--pretty` to a command for human-readable output. CLI configuration and local evidence cache are kept in the target project's `.buildsteward/` directory; that directory is excluded by this repository's `.gitignore`, but other projects must add it to their ignore rules if desired. Do not store secrets in checkpoint/evidence fields.

## Agent Skills installation

The portable skill is in [`skills/buildsteward/`](skills/buildsteward/). Copy it to the agent's documented Agent Skills location, for example a compatible project's `.agents/skills/buildsteward/`. Host-specific discovery and tool permissions differ across agents. The skill remains useful without the CLI, but deterministic checks and local state require the CLI commands available on PATH (or a wrapper with its actual absolute path).

To make the CLI available on PATH in your local development environment:

```bash
# Inside BuildSteward repo
npm link
buildsteward help
```

`npm link` modifies your local npm global links. It is optional. This repository is **not published** to npm or GitHub by these commands.

## Modes

- `approval`: agent selects and recommends a material decision, then records an ACC/rejection before marking the decision approved. Routine work within previously approved scope should not generate repeated questions.
- `autonomous`: agent may finalize an evidence-backed, in-scope decision. Production deployments, destructive operations, external spend, secret-scope escalation, and mission pivots still require **separate explicit authorization**.

Example decision approval flow:

```bash
buildsteward --root /path/to/project decide record --file examples/decision.json
buildsteward --root /path/to/project decide list
buildsteward --root /path/to/project decide approve DEC-REPLACE_WITH_ID --actor user
```

Example action-guard workflow:

```bash
buildsteward --root /path/to/project guard --action production_deploy --target production
buildsteward --root /path/to/project approvals request --action production_deploy --target production --reason "Approved release candidate"
buildsteward --root /path/to/project approvals approve APR-REPLACE_WITH_ID --actor user
buildsteward --root /path/to/project guard --action production_deploy --target production
```

**Security caveat:** CLI approval ledgers are **workflow state, not cryptographic proof that a human approved**. An unrestricted AI agent with shell access can edit files or run `approvals approve` itself. Secure execution requires permission enforcement at the agent host / tool boundary. Never claim this CLI prevents all unauthorized production actions.

## Dependency Intelligence

`deps inspect` uses:
- [deps.dev v3 GetVersion](https://docs.deps.dev/api/v3/) for published version metadata, declared license identifiers and known *direct* advisory keys.
- [OSV query](https://google.github.io/osv.dev/api/) for version-specific known vulnerabilities.

Network errors, stale cache and unavailable fields are explicitly marked. It **does not** substitute for a complete lockfile/SBOM audit, supply-chain investigation, legal license analysis, local compatibility/build tests, or transitive vulnerability checking. Empty advisory results do not prove a package is safe.

Decision candidate scoring uses **user/agent supplied ratings**, and mere presence of an evidence URL does not mean the claim was verified. The engine enforces gate completeness and tie/uncertainty rules but cannot replace skilled judgment. Inspect the evidence before choosing ratings.

## Optional Code Graph

```bash
buildsteward --root /path/to/project config set memory.codeGraph.mode on
buildsteward --root /path/to/project graph status
buildsteward --root /path/to/project graph search Handler --project your-indexed-project
buildsteward --root /path/to/project config set memory.codeGraph.mode off
```

The provider is [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp). This is an **adapter**, not a bundled graph indexer. Index repositories using the provider's official instructions; we never auto-index or download its binary. Graph results are advisory and should be checked against current source.

## Structure

```text
bin/                  CLI executable
src/                  Deterministic local modules
skills/buildsteward/  Portable low-context skill + focused references
knowledge/            Short indexed engineering recipes, not a giant prompt
examples/             Decision and checkpoint templates
tests/                Functional tests, offline API mocks
docs/                 Architecture and safety boundaries
```

## Engineering principles

1. Developer-first, task-proportional workflows.
2. Existing code and user intent before replacement technology.
3. Hard constraints and evidence before weighted scores.
4. Precise source provenance, version and known unknowns.
5. Autonomous choices are separated from authority to execute external operations.
6. Progressive disclosure and deterministic tooling to conserve context.
7. Results are verified only when checks actually ran.
8. Code graph is optional and can be disabled without losing core functionality.
9. Stop stalled retries and expose actionable blockers.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [SECURITY.md](SECURITY.md). Use `npm test` to validate changes. New research integrations require timeouts, bounded output, provenance and offline behavior. Do not bundle large scraped datasets or copyrighted documentation.

## License

MIT. See [LICENSE](LICENSE). External references, APIs and optional providers retain their own licensing and terms.
