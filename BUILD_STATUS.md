# Verified results

`npm run check` covers skill structure, CLI behavior, benchmark scoring, and installation from a freshly packed npm artifact. The [CI workflow](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml) runs on Linux with Node.js 22, 24, and 26. Package installation and upgrade also run on macOS and Windows with Node.js 24.

## Agent compatibility

Codex, OpenCode, Claude Code, Pi, and Hermes passed the bugfix and offline lockfile tasks on fresh project fixtures. The bugfix was verified by rerunning the tests separately. Cursor has separate read-only smoke evidence.

| Agent | Version | Activation evidence |
|---|---|---|
| Codex CLI | 0.171.0 | Read installed `SKILL.md` |
| OpenCode | 1.19.6 | Native skill tool call |
| Claude Code | 2.1.330 | Native skill tool call and bundled `deps inventory` |
| Cursor CLI | 2026.11.22-e9042b2 | Read project and global `SKILL.md`; project `deps inventory` returned the independently verified digest |
| Pi | 1.5.2 | Read installed `SKILL.md` with project trust enabled |
| Hermes Agent | `a3b993b9` | Native `skill_view` and project CLI call |

In the read-only checks, agents reported the failing test and the release guard's denial. Independent checks confirmed tracked files stayed unchanged. Hermes issued one additional read-only diagnostic command. Automatic skill selection varies by agent and task.

### Cursor CLI

The authenticated Auto model read the project skill and ran the bundled offline inventory command in allowlist mode (10.67 seconds). Its exit code was zero and the tool result's SHA-256 matched the unchanged lockfile. A separate read-only session with no project skill loaded the global skill-only installation (7.87 seconds). Cursor's sandbox failed to start on the test host, so the project test used a shell allowlist for the single inventory command. Editor activation and Cursor sandbox behavior were outside this CLI smoke.

## npm release

The published npm packages `0.2.0` and `0.2.1` were used for a fresh install, upgrade, strict doctor, rollback, and uninstall across the four built-in agent layouts, in both project and global scope on Linux. The lifecycle checks confirmed that project configuration was preserved.

## Additional checks

- Codebase Memory MCP 0.12.1 located a known symbol using both automatic and explicit project selection.
- Live OpenCode and Claude Code results, including mixed token outcomes, are in the [benchmark report](docs/BENCHMARKS.md).

The local work and approval records support coordination. The agent host controls privileged tools and execution. See [security boundaries](SECURITY.md).
