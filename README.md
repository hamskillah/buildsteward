# BuildSteward

[![Checks](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml/badge.svg)](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A developer skill for coding agents.** BuildSteward helps your agent read the existing code, make a focused change, and show the checks behind its result.

## Install the skill from GitHub

Run in your project and select your agent:

```bash
npx skills add hamskillah/buildsteward --skill buildsteward
```

Open a fresh agent session and try:

> Use BuildSteward to fix this bug. Preserve existing behavior and tell me which checks passed.

BuildSteward has been exercised in **Codex, OpenCode, Claude Code, Pi, and Hermes**. [Agent setup and compatibility](docs/INSTALLATION.md).

## Add the optional CLI from npm

```bash
npm install -g @hamskillah/buildsteward
buildsteward
```

Run `buildsteward` in your project to open the setup menu. The CLI can inspect the project, read npm lockfiles, and keep verification history for work you need to resume. [CLI setup and commands](docs/INSTALLATION.md#npm-registry-installation).

[Skill source](skills/buildsteward/SKILL.md) · [Test results](BUILD_STATUS.md) · [Benchmarks](docs/BENCHMARKS.md) · [Bahasa Indonesia](docs/QUICKSTART-ID.md)
