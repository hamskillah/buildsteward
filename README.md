# BuildSteward

[![Checks](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml/badge.svg)](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Give your coding agent a repeatable engineering workflow.** BuildSteward brings project inspection, dependency evidence, and verifiable work logs to the agent you already use.

## Install from npm

Install once with Node.js 22 or later:

```bash
npm install -g @hamskillah/buildsteward
```

From any project, launch the console:

```bash
buildsteward
```

Choose **Install or update the skill**, confirm the detected agent or enter its name, then open a fresh agent session. Try:

> Use BuildSteward to fix this bug. Reproduce it before changing code, then show the checks you ran.

The CLI is published as [`@hamskillah/buildsteward`](https://www.npmjs.com/package/@hamskillah/buildsteward).

## What you can do

| When you need to… | Start with |
|---|---|
| Understand an unfamiliar project | `buildsteward inspect` |
| See direct and nested packages recorded in an npm lockfile | `buildsteward deps inventory` |
| Trace which packages request an npm dependency | `buildsteward deps graph` |
| Detect stale root lockfile declarations | `buildsteward deps project` |
| Resume tracked project work with its verification history | `buildsteward work status` |
| Check whether your agent's skill files are installed | `buildsteward doctor` |

Work tracking requires a work plan. Lockfile consistency and inventory are local checks. Advisory lookup is a separate command. See the [CLI and setup guide](docs/INSTALLATION.md) and [developer workflow](docs/DEVELOPER-WORKFLOW.md).

## Agent compatibility

Explicit skill use was verified in **Codex, OpenCode, Pi, Claude Code, and Hermes**. The built-in installer targets Codex, OpenCode, Claude Code, and Cursor. Pi and Hermes use the portable skill installer. See the [tested versions and scenarios](BUILD_STATUS.md) and [agent-specific setup](docs/INSTALLATION.md).

## GitHub source and skill-only installs

For a source checkout or the portable skill, see the separate [GitHub instructions](docs/INSTALLATION.md#github-source-and-skill-only-installs).

## How it works

- **Skill:** Guides the agent to inspect, decide, implement, and verify in proportion to the task.
- **Local CLI:** Stores work plans, decisions, and check evidence in the project and emits JSON from direct commands for scripts and agents.
- **Permissions:** The agent host controls execution. BuildSteward evaluates requests and records outcomes locally. See [security boundaries](SECURITY.md).

[Quickstart bahasa Indonesia](docs/QUICKSTART-ID.md) · [Architecture](docs/ARCHITECTURE.md) · [Benchmarks](docs/BENCHMARKS.md) · [Contributing](CONTRIBUTING.md)
