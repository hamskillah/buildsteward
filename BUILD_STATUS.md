# Verified results

`npm run check` covers skill structure, CLI behavior, benchmark scoring, and installation from a freshly packed npm artifact. The [CI workflow](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml) runs on Node.js 22, 24, and 26.

## Agent compatibility

Explicit activation was exercised on fresh project fixtures. Every agent below passed the bugfix and offline lockfile tasks. The bugfix was verified by rerunning the tests separately.

| Agent | Version | Activation evidence |
|---|---|---|
| Codex CLI | 0.171.0 | Read installed `SKILL.md` |
| OpenCode | 1.19.6 | Native skill tool call |
| Claude Code | 2.1.330 | Native skill tool call and bundled `deps inventory` |
| Pi | 1.5.2 | Read installed `SKILL.md` with project trust enabled |
| Hermes Agent | `a3b993b9` | Native `skill_view` and project CLI call |

In the read-only checks, agents reported the failing test and the release guard's denial. Independent checks confirmed tracked files stayed unchanged. Hermes issued one additional read-only diagnostic command. Automatic skill selection varies by agent and task. Cursor has an installer target and has yet to pass an authenticated activation test.

## npm release

npm `0.1.0` passed a clean registry install, Codex skill setup, and an installation check.

## Additional checks

- Codebase Memory MCP 0.12.1 located a known symbol using both automatic and explicit project selection.
- Live OpenCode and Claude Code results, including mixed token outcomes, are in the [benchmark report](docs/BENCHMARKS.md).

The local work and approval records support coordination. The agent host controls privileged tools and execution. See [security boundaries](SECURITY.md).
