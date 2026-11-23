# Developer Execution Loop (bounded, resumeable)

BuildSteward is **a coding-agent skill plus a local deterministic workflow ledger**, not an LLM, background worker, sandbox, or fully autonomous coding service. An actual coding agent (OpenCode, Codex, Claude Code, etc.) performs research, implementation and review. BuildSteward stores a compact, inspectable project plan and handles task dependencies and check results.

## Workflow contract

1. Inspect the real repository and identify the requested outcome, existing conventions and current failing behavior if relevant.
2. For small tasks, use the fast path without creating a plan. For multi-step work, the agent creates a plan JSON with acceptance criteria and dependency relationships. **Do not create a plan just to comply with paperwork.**
3. Execute one ready vertical slice at a time. Check each task's real source files; use optional Codebase Memory MCP only when useful.
4. For each significant technology decision, check existing tools first; use `decide` and `deps` only when a real decision requires it.
5. Record implementation evidence; `work done` is **not** verified success.
6. Run test commands through the actual project toolchain. `work check` supports fixed runners and records exit status, duration and an output hash. A zero exit status does **not** prove every acceptance criterion or visual/security requirement is met.
7. For architecture/design/docs tasks, use `work review` for a **self-reported** manual review, not a cryptographically trusted approval.
8. On repeated identical failure, the task is blocked; examine the root cause before resuming.
9. `work context` supplies a compact next-task summary for continuation with another session/model. It is not intended to store the entire conversation.
10. A complete ledger is a completed plan, **not** automatic authorization to deploy.

## Example commands

From an initialized project root (or after `buildsteward init`):

```bash
buildsteward work create --file examples/work-plan.json
buildsteward work next
buildsteward work start --id design
# Agent inspects and designs the UI; no automatic user action here.
buildsteward work done --id design --evidence "Reviewed current UI and documented states"
buildsteward work review --id design --evidence "Layout review meets agreed criteria"
buildsteward work next
buildsteward work start --id implement
# Coding agent changes files and implements tests.
buildsteward work done --id implement --evidence "Feature and tests implemented"
buildsteward work check --id implement --runner npm-test --confirm-run
buildsteward work status
buildsteward work context
```

`--confirm-run` acknowledges that test scripts within a repository can execute arbitrary code. **It is not an OS sandbox or trusted permission grant.** Run unfamiliar repositories in an isolated environment. `work check` intentionally disallows arbitrary shell command strings, requires an explicit test runner, and does not persist raw command output (which could expose secrets).

Other supported runners: `node-test`, `go-test`, `cargo-test`, `python-test`. A failed check leaves the task open. A Node test summary reporting zero tests, including through `npm-test`, leaves the task open with `failureKind: no_tests`. Custom npm scripts without a recognized summary are assessed by exit status. Three consecutive failures with the same fingerprint on one runner block the task. For `node-test`, the fingerprint ignores test durations and process IDs in Node warnings. Block explicitly with `work block --id ID --reason TEXT` and reopen with `work resume --id ID`.

## Plan format

Refer to [`examples/work-plan.json`](../examples/work-plan.json). Each task requires a unique ID, title, kind, risk, verification mode, dependencies, and measurable acceptance criteria. Cycles, unknown dependencies and duplicate IDs are rejected. The default workflow is single-writer/single-active-task; it does not support concurrent editors or multiple worker leases. Files under `.buildsteward/` can be edited by the same user or agent and must not be treated as secure attestations.

## Use with approval/autonomous mode

- **Autonomous**: the agent may decide within granted scope; it still does not gain a bypass for privileged actions.
- **Approval**: the agent researches and proposes material decisions, then awaits explicit user acceptance. Routine implementation within previously agreed scope proceeds normally.
- `work` does not automatically call an LLM, invoke an agent binary, sign a release, merge a PR, or deploy production.
- The local approval ledger is for coordination only. `guard` returns a denial for high-risk actions even when it finds a local approval entry. The host/tool must obtain trusted human authorization separately.
