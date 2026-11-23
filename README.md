# BuildSteward

**A developer skill for coding agents that work in existing codebases.**

Give your agent a bug, a feature, or a diff to review. BuildSteward guides it to read the relevant code, preserve the behavior people rely on, and report the checks it actually ran.

[![Checks](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml/badge.svg)](https://github.com/hamskillah/buildsteward/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Quickstart](#quickstart) · [Example workflows](#example-workflows) · [Optional CLI](#optional-cli-from-npm) · [Bahasa Indonesia](docs/QUICKSTART-ID.md)

## Quickstart

**Install the skill from GitHub.** Run this in your project with Node.js 22.20 or later, then select your agent.

```bash
npx skills add hamskillah/buildsteward --skill buildsteward
```

Open a fresh agent session and try this on a real issue:

> Use BuildSteward to investigate this bug. Keep the fix scoped and show which checks passed.

Explicit skill use has been tested in **Codex, OpenCode, Claude Code, Cursor CLI, Pi, and Hermes**. [Agent-specific setup](docs/INSTALLATION.md) · [Verified results](BUILD_STATUS.md)

## Example workflows

### Fix a bug without widening the diff

> Use BuildSteward to investigate why saving a profile clears its email preference. Keep other preferences intact.

Start from the behavior the user reported. Reproduce it, trace the relevant update path, and verify that the fix handles the failing case and preserves neighboring behavior.

### Add a feature while preserving existing callers

> Use BuildSteward to add optional currency formatting. Existing callers should keep getting the exact same output.

In the repository’s [compatibility fixture](benchmarks/fixtures/compat/contract.md), the existing call still returns `Tea: 2.50`. Supplying a currency adds only the suffix, yielding `Tea: 2.50 IDR`. The [grader](benchmarks/fixtures/compat/verify.mjs) checks both call styles independently.

### Review a change for real regressions

> Use BuildSteward to review this diff for behavior changes. For each finding, give the location, what triggers it, and the user impact.

A useful finding gives the maintainer enough information to confirm and fix it. The [review fixture](benchmarks/fixtures/review/contract.md) grades a concrete contract violation while keeping the review inputs intact.

## How the skill works

Small changes follow a short path: inspect, edit, and run the relevant check. Bigger changes start with an observable acceptance criterion and a working slice. For decisions such as adding a dependency, the skill asks for evidence about compatibility, licensing, and risk. If a check keeps failing, it directs the agent to change its hypothesis or report the blocker.

The skill uses your existing repository tools and points the agent to a focused reference when it needs more guidance. [Read the skill](skills/buildsteward/SKILL.md) · [Developer workflow](docs/DEVELOPER-WORKFLOW.md)

## Optional CLI from npm

Install the CLI separately if you want local project inspection, npm and Composer lockfile evidence, or verification history across sessions. Requires Node.js 22 or later.

```bash
npm install -g @hamskillah/buildsteward
buildsteward
```

Run `buildsteward` from your project to open the setup menu. [CLI setup and commands](docs/INSTALLATION.md#npm-registry-installation)

## What has been tested

The [benchmark suite](docs/BENCHMARKS.md) covers bug fixes, code reviews, backward compatibility, and decisions about dependencies, architecture, accessibility, and releases. The initial OpenCode Go comparison passed all 12 bugfix and dependency-review attempts across two models. Token usage varied by task and configuration. [Agent test results](BUILD_STATUS.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)
