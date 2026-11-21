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

## InstaBox verification

A fresh Linux guest at commit `a29efb3` passed all 43 tests, the isolated tarball installer checks, and release preflight on Node 22.23.3 and npm 10.9.9.

OpenCode 1.19.6 with `opencode/deepseek-v4.1-flash-free` completed an explicit BuildSteward activation smoke test. The event log showed a successful skill load, a successful bundled `inspect` call, and an answer matching the package name returned by the CLI.

A separate JavaScript empty-array regression started with failing tests in two fresh projects. Each run allowed only the fixture edit, focused reads, and the test command. The skill arm explicitly requested BuildSteward. Both produced independently verified passing tests.

| Single run per arm | Input tokens | Output tokens | Cached reads | Seconds |
|---|---:|---:|---:|---:|
| Baseline | 4,596 | 497 | 30,848 | 14 |
| Skill only | 5,751 | 589 | 43,008 | 12 |

The runtime reported $0 model cost in both arms. The skill arm used more tokens for this small task. A single prompt pair cannot establish a general performance or token-efficiency trend.

### Authenticated cross-agent checks

The same two tasks ran in fresh project fixtures on InstaBox against commit `a29efb3`. Each run explicitly requested BuildSteward. OpenCode, Pi, Claude Code, and Hermes used OpenCode Go with DeepSeek V4.1 Flash. Claude Code used the Go Anthropic Messages gateway with a custom model ID. Codex used a ChatGPT-authenticated session.

| Agent | Skill load evidence | Bugfix and offline lockfile | Read-only negative case |
|---|---|---|---|
| Codex CLI 0.171.0 | Read installed `SKILL.md` | Pass | Pass |
| OpenCode 1.19.6 | Successful native `skill` tool call | Pass | Pass |
| Pi 1.5.2 | Read installed `SKILL.md` with project trust enabled | Pass | Pass |
| Claude Code 2.1.330 | Native `Skill` tool | Pass | Pass |
| Hermes Agent `a3b993b9` | Native `skill_view` tool | Pass | Correct result with an extra read-only command |

In the bugfix runs, each agent reproduced the empty-list regression, changed only `totals.js` among tracked files, and ran the tests again. Independent reruns passed both tests. The agent traces included both dependency CLI calls and the reports identified `removed-pkg` and nested `nested-pkg@2.0.0`, with advisory coverage outside the scope of the offline commands.

In the negative runs, each agent ran the failing test once, ran a release guard check that returned `allowed: false`, reported both outcomes, and left tracked files unchanged. The fixture still failed on an independent rerun. This exercises reporting and the local guard's decision. Enforcement by a production host remains a separate capability.

In separate unprompted exploratory runs, Codex, OpenCode, and Pi ran the same bugfix and reported the correct lockfile findings. The traces showed Codex and OpenCode choosing BuildSteward without being asked. Pi completed the task without reading or calling the skill. Automatic invocation is therefore only observed for the two specific runs, and explicit invocation remains the portable way to request BuildSteward.

Claude Code logged an `unrecognized_model` notice for the custom model ID and returned successful model results for both tasks. In the Hermes negative case, the runtime issued one additional read-only diagnostic command even though the prompt restricted shell work to the test and guard. The test still failed as expected, the guard denied deployment, and tracked files stayed unchanged.

Hermes consumed the installed BuildSteward skill from its configured skill directory and called the project CLI. The Skills CLI `hermes-agent` target also installed the skill into an isolated Hermes home, where `hermes skills list` reported it enabled.

Pi used a skill-only install plus the standalone CLI. Headless Pi discovered the project skill with `--approve` on the controlled fixture and skipped it when project trust was unresolved. Keep skill-only and bundled installs in separate project fixtures when they target the same `.agents/skills/buildsteward` directory.

## npm release

The npm registry exposes `@hamskillah/buildsteward@0.1.0` as `latest`. Its integrity metadata matches the tarball packed from commit `892667c`. A clean global install from the public registry passed after initial tarball download retries. The installed `buildsteward` command opened the terminal console, installed the Codex skill, and reported it ready.

## Not verified or not implemented
- An authenticated Cursor run remains unverified. Automatic skill selection is not established across tasks or agents.
- Live deps.dev/OSV network access and real Codebase Memory MCP provider: unavailable to offline local tests.
- Trusted host-enforced approval, credentials isolation, production deployment, security pentest, comprehensive transitive dependency/lockfile vulnerability scanning.
- Independent end-to-end LLM task execution: developer loop coordinates work performed by the coding agent, but does not launch models or execute arbitrary project plans autonomously.
- Cross-model token and correctness benchmarking is pending. The OpenCode comparison above is one exploratory run per arm. Assisted scenarios covered repeated failures, stale local approval and offline dependency inventory.

## Trust boundaries

The local work ledger and approval records are **not tamper-resistant**, not suitable for concurrent agents, and not reliable evidence of human authorization. A `work check` zero exit status proves only that the configured test runner returned success. A complete work plan does not mean a production release has passed security/operational gates. See `docs/DEVELOPER-WORKFLOW.md` and `docs/HOST-AUTHORIZATION.md`.
