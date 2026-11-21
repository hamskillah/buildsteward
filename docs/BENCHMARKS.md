# Compare BuildSteward with a baseline

The benchmark kit prepares the same fixture and prompt in three configurations. Run each agent yourself in a disposable environment, then score the resulting files independently.

| Arm | Project installation |
|---|---|
| `baseline` | Fixture only |
| `skill` | Fixture and BuildSteward skill, no bundled CLI |
| `cli` | Fixture, skill, and bundled CLI |

From a BuildSteward source checkout, create fresh directories:

```bash
bench_root=$(mktemp -d)
for arm in baseline skill cli; do
  node benchmarks/run.js prepare bugfix "$arm" "$bench_root/$arm"
done
```

Start a new agent session in each printed directory and give it the printed `prompt` verbatim. Keep the model, agent version, permissions, time and token budgets consistent. Use an isolated agent profile without a globally installed BuildSteward skill or another copy on PATH. Keep harness logs outside the fixture. If the agent requires a Git repository, initialize Git separately in every arm. The fixture installer targets the Codex, OpenCode and Claude Code project layouts.

Grade each workspace from the BuildSteward checkout:

```bash
for arm in baseline skill cli; do
  node benchmarks/run.js score bugfix "$bench_root/$arm"
done
```

Use `audit` in place of `bugfix` to test an offline assessment with known lockfile inconsistencies. The grader rejects edits to protected fixture inputs, unexpected top-level output, and unsupported vulnerability claims. Bugfix grading executes JavaScript from the fixture, so grade inside the same disposable environment. The grader checks task outcomes. It does not sandbox fixture code or provide a tamper-resistant result. Check the JSON `pass` field for the outcome. A nonzero command exit indicates a tool or invocation error.

For each attempt record the Git commit, task, arm, agent and model versions, elapsed time, functional score, observed skill and CLI use, tool calls, retries, and provider-reported input, output, and cached tokens. Inspect logs for actions outside the task and for whether the agent actually ran its checks. Repeat with fresh sessions and rotate arm order. Report unknown metrics as unknown. Keep a separate treatment if you explicitly require use of BuildSteward, since the default prompt is the same in every arm.

The first kit covers a regression fix and offline dependency assessment. Its fixture checks validate the grader. Evidence about whether the skill improves agent outcomes comes from matched live runs across models and tasks. See [prior exploratory results](../BUILD_STATUS.md#instabox-verification).
