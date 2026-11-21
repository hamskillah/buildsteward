# Build status

BuildSteward has a working **portable Agent Skill, local Cortex CLI, guided installer, and bounded developer-workflow ledger**. It is **not** a standalone LLM or a production-enforced agent runtime.

## Verified locally

- `npm run check`: 31 automated tests pass on local Node.js 22.16.0 (2026-11-21 test environment).
- Skill frontmatter/reference/size checks pass; compact SKILL.md remains under the project's guard.
- Isolated test from the **packed npm artifact**: skill + runtime install, `doctor --strict`, project inspection, work-plan creation and compact context work from the installed runtime.
- Developer work plan rejects missing acceptance criteria, dependency cycles, duplicate IDs and inappropriate manual verification.
- Developer lifecycle supports prerequisites, one active slice, implementation evidence, explicit test runners, bounded retry stagnation, blocking/resume, manual review states and compact cross-session context.
- `deps project` checks npm manifest/lockfile consistency without network access; do not mistake this for security auditing.
- High-risk `guard` checks **always deny** without trusted host authorization, even after a local approval ledger is marked approved.
- Dependency metadata: deps.dev and OSV parsing plus offline cache are tested with mocks.

## Not verified or not implemented

- npm registry publication: local machine has no npm publisher authentication; a trusted publisher must be configured/authorized.
- Real activated OpenCode/Codex/Claude Code/Cursor hosts: those executables are unavailable in this test environment.
- Live deps.dev/OSV network access and real Codebase Memory MCP provider: unavailable to offline local tests.
- Trusted host-enforced approval, credentials isolation, production deployment, security pentest, comprehensive transitive dependency/lockfile vulnerability scanning.
- Independent end-to-end LLM task execution: developer loop coordinates work performed by the coding agent, but does not launch models or execute arbitrary project plans autonomously.
- Cross-model token/correctness benchmarking and visual UI tests have not been run.

## Trust boundaries

The local work ledger and approval records are **not tamper-resistant**, not suitable for concurrent agents, and not reliable evidence of human authorization. A `work check` zero exit status proves only that the configured test runner returned success. A complete work plan does not mean a production release has passed security/operational gates. See `docs/DEVELOPER-WORKFLOW.md` and `docs/HOST-AUTHORIZATION.md`.
