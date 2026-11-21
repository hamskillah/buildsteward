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

## Install BuildSteward

There are **two supported installation modes**. Both work independently, with no mandatory cloud service.

### Option A: Skill only (lightweight, no Cortex runtime)

```bash
npx skills add hamskillah/buildsteward --skill buildsteward
```

This uses the [Skills CLI](https://github.com/vercel-labs/skills) to install the portable workflow. It does **not** install the CLI or grant permissions to the host coding agent. Confirm activation in your agent's skill list. To install globally or target a specific agent, use the Skills CLI `-g` and `-a` options.

### Option B: Full local setup (skill + bundled Cortex CLI)

Requires **Node.js 22+**, Git and npm. Until an npm package is published, invoke the CLI directly from this public GitHub repository:

```bash
# Run from the project that should receive BuildSteward:
npx --yes --package=github:hamskillah/buildsteward buildsteward setup
```

The interactive wizard asks which detected coding agents to configure, whether to install at project or global scope, and (at project scope) the autonomy and optional graph mode. It never downloads or activates Codebase Memory MCP itself.

Automation / headless setup with explicit choices:

```bash
npx --yes --package=github:hamskillah/buildsteward buildsteward setup \
  --scope project --agents opencode,codex --mode approval --graph off --yes
```

Preview changes without writing anything:

```bash
npx --yes --package=github:hamskillah/buildsteward buildsteward setup \
  --scope project --agents codex --dry-run
```

**What full setup does:** copies the portable skill and a **small, self-contained local CLI runtime** into the agent's recognized skills directory. It also creates `.buildsteward/config.json` for project installs (unless it already exists). No global `npm link`, background daemon, or service is needed. Project installs are explicitly requested by the user; review files before committing an installed skill to a repository.

For `--scope global`, skill and runtime are installed under the current user's agent skill directories, but **no project config is written**. Initialize each project separately with the runtime CLI when you want a project-specific autonomy policy.

Supported agent directories (subject to each host's skill discovery configuration):

| Agent | Project | Global |
|---|---|---|
| OpenCode | `.agents/skills/buildsteward` | `~/.config/opencode/skills/buildsteward` |
| Codex | `.agents/skills/buildsteward` | `~/.agents/skills/buildsteward` |
| Claude Code | `.claude/skills/buildsteward` | `~/.claude/skills/buildsteward` |
| Cursor | `.cursor/skills/buildsteward` | `~/.cursor/skills/buildsteward` |

OpenCode and Codex can share one project-level `.agents/skills/buildsteward` directory. Host-specific permissions and runtime activation remain the responsibility of each agent; directory presence alone is not proof the skill is active.

### Doctor, update, rollback, uninstall

Use the same `npx ... buildsteward` prefix (or the CLI binary from a local checkout):

```bash
# Verify installation files and configured project state
buildsteward doctor --scope project --agents codex,opencode

# Re-run setup to update a BuildSteward-managed installation
buildsteward setup --scope project --agents codex,opencode --yes

# Restore the previous managed installation from a local backup
buildsteward rollback --scope project --agents codex,opencode

# Remove only a BuildSteward-managed installation
buildsteward uninstall --scope project --agents codex,opencode
```

For a CLI temporarily executed via `npx`, use that same full `npx --yes --package=github:hamskillah/buildsteward buildsteward` prefix, not a bare `buildsteward` unless it is on `PATH`.

Setup **does not overwrite another tool's skill installation**. Replacing a managed skill that users edited requires `--force`; previous files are backed up rather than discarded. `uninstall` does not delete the project's `.buildsteward/config.json`, project decisions, or checkpoint. `doctor` reports files and runtime presence; it cannot prove that an agent actually loaded or obeyed the skill.

See [Installation Guide](docs/INSTALLATION.md) for details, recovery, and local/offline setup.

## Running the local CLI

If you cloned the repository or installed the full bundle, the CLI can be called directly:

```bash
# From the BuildSteward source checkout:
node bin/buildsteward.js help
npm test

# Full setup bundle: adapt to installed agent and path
node .agents/skills/buildsteward/runtime/bin/buildsteward.js --root . inspect

# Common tasks
node bin/buildsteward.js --root /path/to/project init --mode approval
node bin/buildsteward.js --root /path/to/project inspect
node bin/buildsteward.js route "Fix authentication bug"
node bin/buildsteward.js library search "dependency security"
node bin/buildsteward.js decide evaluate --file examples/decision.json
node bin/buildsteward.js --root /path/to/project deps inspect --ecosystem npm --name react --version 18.2.0
```

The CLI prints compact JSON by default. The `.buildsteward/` directory holds local config, decisions, approvals, caches, and checkpoints. Add it to a consuming project's `.gitignore` if needed, and never store secrets there.

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
