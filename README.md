# BuildSteward

[![Checks](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml/badge.svg)](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**A practical engineering skill for coding agents.** BuildSteward helps your agent inspect the project before editing, weigh dependencies with evidence, and report the checks it actually ran.

## Get started

With Node.js 22.20 or later, run this from your project:

```bash
npx skills add hamskillah/buildsteward --skill buildsteward
```

Choose your agent, then open a fresh session. Try: “Use BuildSteward to review this project’s dependency choices. Start with local evidence and tell me what still needs verification.”

Start with the skill alone. Add the [optional local CLI](docs/INSTALLATION.md#full-setup-from-public-github-source) when you want persistent work plans, decision records, or npm lockfile inventory.

[Installation and troubleshooting](docs/INSTALLATION.md) · [Quickstart bahasa Indonesia](docs/QUICKSTART-ID.md) · [Verified build status](BUILD_STATUS.md)

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
| Developer work ledger | Bounded task DAG, compact resume context, explicit verification and loop recovery |
| Offline npm lockfile tools | Manifest consistency and bounded inventory of nested package records |
| Progress Sentinel | Detects consecutive identical no-progress fingerprints |
| Optional memory graph | CLI adapter to existing `codebase-memory-mcp`, disabled by default |
| Tests | Node built-in test runner; no npm runtime dependencies |

## Optional CLI and managed setup

The full setup installs the skill and a local CLI that work without a hosted BuildSteward service. This setup is managed separately from the Skills CLI. Choose one installer per agent and scope.

### Full setup (skill + bundled Cortex CLI)

Requires **Node.js 22+**, Git and npm. Until an npm package is published, invoke the CLI directly from this public GitHub repository:

```bash
# Run from the project that should receive BuildSteward:
npx --yes --package=github:hamskillah/buildsteward buildsteward setup
```

The interactive wizard proposes detected coding agents and allows explicit selection even if none are found on PATH, whether to install at project or global scope, and (at project scope) the autonomy and optional graph mode. It never downloads or activates Codebase Memory MCP itself.

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

Setup **does not overwrite another tool's skill installation**. Replacing a managed skill that users edited requires `--force`; previous files are backed up rather than discarded. `uninstall` does not delete the project's `.buildsteward/config.json`, project decisions, or checkpoint. `doctor` reports files and runtime presence; `doctor --strict` exits with an error for missing or modified installs (useful in CI). Neither mode proves an agent actually loaded or obeyed the skill.

See [Installation Guide](docs/INSTALLATION.md) for details, recovery, and local/offline setup. Review [Release Quality Gates](docs/RELEASE-QUALITY.md) for the distinction between tested installation files and actual model/agent behavior.

### Optional CLI skill-only setup

If you need a managed skill installation without a bundled Cortex runtime, pass `--skill-only` to `buildsteward setup`. For a pure skill experience without the BuildSteward CLI, prefer `npx skills add` instead. These installers own different files; do not update a Skills CLI installation with the BuildSteward installer.

```bash
npx --yes --package=github:hamskillah/buildsteward buildsteward setup --agents codex --skill-only --yes
```

**Installation guarantees:** `doctor --strict` verifies files and install fingerprints, not host activation. The installer does not automatically enable an agent's permission policies, and approval ledger entries are not trusted authorization tokens. Runtime directory scanning is intentionally not a substitute for checking your actual agent configuration.

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
node bin/buildsteward.js --root /path/to/project deps project
# For actual multi-step development tasks, see docs/DEVELOPER-WORKFLOW.md
node bin/buildsteward.js --root /path/to/project work create --file examples/work-plan.json
node bin/buildsteward.js --root /path/to/project work next
node bin/buildsteward.js --root /path/to/project work context
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

**Security caveat:** High-risk `guard` checks always deny locally, even after an approval record exists. A trusted host/tool must independently authorize privileged execution. CLI approval ledgers are **workflow state, not cryptographic proof that a human approved**. An unrestricted AI agent with shell access can edit files or run `approvals approve` itself. Secure execution requires permission enforcement at the agent host / tool boundary. Never claim this CLI prevents all unauthorized production actions.

## Developer Execution Loop

For multi-step features and repairs, BuildSteward now coordinates bounded engineering tasks through a dependency-aware work ledger. The **coding agent** still inspects, designs, implements and reviews the actual code; the ledger provides one active slice, compact cross-session context, tests and stuck-loop control. `work done` means implementation submitted, **not verified**. See [Developer Workflow](docs/DEVELOPER-WORKFLOW.md) and [example plan](examples/work-plan.json). Tiny tasks should skip this ledger.

## Dependency Intelligence

`deps inventory` lists up to 100 npm v2/v3 lockfile package entries offline, preserving nested install paths and recording optional/platform flags. It reports unresolved links and missing versions, a full entry count and the lockfile SHA-256. Names inferred from install paths can be aliases; this is not dependency-edge resolution or a security scan.

`deps project` checks npm manifest vs lockfile consistency **offline**. Lockfile v1 or a lockfile without root declarations yields `unverified_manifest` when no inconsistency was detected; this is not a pass. It does not perform vulnerability analysis, license review or full transitive scanning. `deps inspect` uses:
- [deps.dev v3 GetVersion](https://docs.deps.dev/api/v3/) for published version metadata, declared license identifiers and known *direct* advisory keys.
- [OSV query](https://google.github.io/osv.dev/api/) for version-specific known vulnerabilities.

Network errors, stale cache and unavailable fields are explicitly marked. It **does not** substitute for a complete lockfile/SBOM audit, supply-chain investigation, legal license analysis, local compatibility/build tests, or transitive vulnerability checking. Empty advisory results do not prove a package is safe.

Decision candidate scoring uses **user/agent supplied ratings**, and mere presence of an evidence URL does not mean the claim was verified. The engine enforces gate completeness and tie/uncertainty rules but cannot replace skilled judgment. Inspect the evidence before choosing ratings.

See [Trusted Host Authorization](docs/HOST-AUTHORIZATION.md) for the privileged-execution boundary.

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
