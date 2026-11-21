# Build status

BuildSteward has a working **portable Agent Skill, local Cortex CLI, guided installer, and bounded developer-workflow ledger**. It is **not** a standalone LLM or a production-enforced agent runtime.

## Verified locally

- `npm run check`: 43 automated tests passed on Node.js 24.22.3 against commit `7fcd671`. The GitHub Actions matrix passed on Node.js 22, 24 and 26 for the PR that produced this commit.
- Skill frontmatter/reference/size checks pass; compact SKILL.md remains under the project's guard.
- Isolated test from the **packed npm artifact**: skill + runtime install, `doctor --strict`, project inspection, work-plan creation and compact context work from the installed runtime.
- Installed the npm tarball offline and verified `setup`, `doctor --strict` and `uninstall` for all four installer targets, in project and global scopes, with and without the bundled CLI. This exercises filesystem layout and command behavior.
- Developer work plan rejects missing acceptance criteria, dependency cycles, duplicate IDs and inappropriate manual verification.
- Developer lifecycle supports prerequisites, one active slice, implementation evidence, explicit test runners, bounded retry stagnation, blocking/resume, manual review states and compact cross-session context.
- `deps project` checks npm manifest/lockfile consistency without network access; do not mistake this for security auditing.
- High-risk `guard` checks **always deny** without trusted host authorization, even after a local approval ledger is marked approved.
- Dependency metadata: deps.dev and OSV parsing plus offline cache are tested with mocks.

- Agent discovery was verified with Codex CLI 0.172.0-alpha.2 (`skills/list` reported BuildSteward enabled) and OpenCode 1.19.6 (`opencode debug skill --pure` listed the installed skill). The Skills CLI 1.9.0 installed from the public GitHub repository and listed Codex, OpenCode, and Claude Code targets.

## Not verified or not implemented

- npm registry publication: npm publisher login was verified and the package dry run passed. The package is held for further build and agent validation.
- Model tasks using the skill and real Claude Code/Cursor discovery remain unverified.
- Live deps.dev/OSV network access and real Codebase Memory MCP provider: unavailable to offline local tests.
- Trusted host-enforced approval, credentials isolation, production deployment, security pentest, comprehensive transitive dependency/lockfile vulnerability scanning.
- Independent end-to-end LLM task execution: developer loop coordinates work performed by the coding agent, but does not launch models or execute arbitrary project plans autonomously.
- Cross-model token and correctness benchmarking is pending. Assisted scenarios covered repeated failures, stale local approval and offline dependency inventory.

## Trust boundaries

The local work ledger and approval records are **not tamper-resistant**, not suitable for concurrent agents, and not reliable evidence of human authorization. A `work check` zero exit status proves only that the configured test runner returned success. A complete work plan does not mean a production release has passed security/operational gates. See `docs/DEVELOPER-WORKFLOW.md` and `docs/HOST-AUTHORIZATION.md`.
