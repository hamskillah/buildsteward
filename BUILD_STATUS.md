# Build status

This repository is an **implemented local foundation** for BuildSteward, not a feature-complete production agent runtime.

## Verified locally

- `npm test`: 23 tests passing on Node.js 22.16.0 (2026-11-21 environment).
- `npm run smoke`: CLI help works.
- `node scripts/check-skill.js`: frontmatter/reference/size checks pass.
- CLI round-trip: initialize project, inspect, record architectural decision, approve and list.
- Mocked network provider calls: deps.dev and OSV payload parsing, package name URL encoding, cached offline fallback and unknown-evidence states.
- Code graph `off`: no provider execution.

## Not verified here

- Live deps.dev / OSV network access (container does not have outbound npm/network access; API contracts checked against official docs).
- Real installed Codebase Memory MCP adapter end-to-end (binary not installed in this container).
- OpenCode / Codex / Claude Code installation and activation across all hosts.
- Secure authorization enforcement outside CLI: requires trusted runtime integration.
- Production deployment, security pentest, benchmarks for token consumption and engineering quality.

## Important design boundaries

- Ratings in `decide` are user/agent supplied assumptions. The engine enforces completeness, tie handling and policy flags, not truthfulness of a written URL.
- Production deploy requires actual host authorization, not just `guard` output.
- Code graph indexes are advisory and must be refreshed/checked against the current source.
- `.buildsteward/` JSON state is not a concurrent multi-user transactional store.
- Node.js 22+ is required, but only Node.js 22.16.0 was tested in this sandbox; CI targets 22/24/26.

## Installer hardening in progress

- `doctor --strict` detects missing/tampered installations and fails nonzero.
- `setup --skill-only` supports managed lightweight installs.
- Interactive setup supports explicit agent selection even when agent executables are not on PATH.
- Isolated artifact smoke test verifies an actual `npm pack` tarball, bundled CLI and installed skill.
- Live activation on each host agent and public npm publication remain unverified.

- npm packaging metadata is publication-ready for `@hamskillah/buildsteward` 0.1.0; **no npm package has been published or registry ownership verified**.
