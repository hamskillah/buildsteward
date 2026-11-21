# BuildSteward

[![Checks](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml/badge.svg)](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml)

**Give your coding agent an engineering workflow.** BuildSteward teaches it to inspect before editing, weigh dependencies with evidence, and report the checks it actually ran.

## Install and try it

From your project directory, with Node.js 22.20 or later:

```bash
npx skills add hamskillah/buildsteward --skill buildsteward
```

Choose your agent, open a fresh session, and ask:

> Use BuildSteward to fix this bug. Reproduce it first and show which checks pass after the fix.

This installs the skill from GitHub. Explicit invocation has been tested in **Codex, OpenCode, Pi, Claude Code, and Hermes**. See the [tested versions and scenarios](BUILD_STATUS.md).

## Optional CLI

Add the local CLI if you need persistent work plans, decision records, or offline npm lockfile inventory. See [setup and troubleshooting](docs/INSTALLATION.md). Use one installer per skill directory.

The agent and its host control execution and permissions. BuildSteward records decisions and checks locally. See [security boundaries](SECURITY.md).

[Quickstart bahasa Indonesia](docs/QUICKSTART-ID.md) · [Benchmark](docs/BENCHMARKS.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE)
