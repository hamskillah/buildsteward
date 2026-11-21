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

Two additional fixtures exercise engineering judgment. `review` grades a concrete contract violation and rejects edits to review inputs. `compat` checks that a new feature preserves the exact legacy output, using a verifier outside the agent workspace. The prompts specify outcomes and scope.

For each attempt record the Git commit, task, arm, agent and model versions, elapsed time, functional score, observed skill and CLI use, tool calls, retries, and provider-reported input, output, and cached tokens. Inspect logs for actions outside the task and for whether the agent actually ran its checks. Repeat with fresh sessions and rotate arm order. Report unknown metrics as unknown. Keep a separate treatment if you explicitly require use of BuildSteward, since the default prompt is the same in every arm.

## Run all three arms with OpenCode

With OpenCode and Git on PATH, run from the source checkout:

```bash
node benchmarks/opencode.js bugfix opencode-go/deepseek-v4.1-flash ./run-01
node benchmarks/opencode.js audit opencode-go/deepseek-v4.1-flash ./run-02 cli,baseline,skill
```

Use a fresh output directory for every matrix. The optional final argument rotates arm order. For Go, set `OPENCODE_API_KEY` in the environment. A supported free model can run without a key when quota is available. Run only in a disposable OS environment or container with scoped provider credentials. The tool permission rules are shared across all arms. Both the agent and the grader can execute model-edited JavaScript with the process user's permissions, so separate fixture directories alone do not provide isolation.

The machine-readable report contains independent task scores, tool counts, observed skill and CLI use, elapsed time, and OpenCode-normalized token counts and OpenCode's estimated cost. OpenCode 1.19.6 reports regular input, cached input reads and writes, regular output, reasoning, and total separately. Missing metrics are null. Each arm has a 65-second limit and separate home, OpenCode profile, and Git project. Raw events and stderr are private files under the output directory. Review them before sharing. An unfinished run with no step or tool activity is recorded as `blocked` and skips the remaining arms. An unfinished run with observed activity is recorded as `incomplete` and the matrix continues. Both statuses leave the task score unset. Runs that complete without selecting the skill are still valid observations about availability; use explicit activation as a separate experiment.

An OpenCode 1.19.6 pilot with `opencode/deepseek-v4.1-flash-free` on 2026-11-21 reached the provider but was rejected for exhausted free usage. It produced no task or token comparison.

The original pilot covers a regression fix and offline dependency assessment. Its fixture checks validate the grader. Evidence about whether the skill improves agent outcomes comes from matched live runs across models and tasks. See [prior exploratory results](../BUILD_STATUS.md#instabox-verification).

## OpenCode Go pilot results

On 2026-11-21, OpenCode 1.19.6 ran the published fixtures at commit `a446d19` on Linux using OpenCode Go. Each model and task had one attempt per arm. The table shows the actual run order for each matrix. Total and cached-read tokens are separate fields from OpenCode; the cached-read column is already included in total. CLI use covers the harness's successful dependency commands.

| Model | Task | Arm | Result | Total tokens | Cached read | Tool calls | Seconds | Skill used | CLI used |
|---|---|---|---|---:|---:|---:|---:|---|---|
| DeepSeek V4.1 Flash | Audit | Baseline | Pass | 42,194 | 34,816 | 10 | 24.15 | No | No |
| DeepSeek V4.1 Flash | Audit | Skill | Pass | 52,875 | 44,544 | 8 | 22.69 | Yes | No |
| DeepSeek V4.1 Flash | Audit | Skill + CLI | Pass | 36,988 | 29,184 | 8 | 19.22 | Yes | Yes |
| DeepSeek V4.1 Flash | Bugfix | Skill | Pass | 46,431 | 38,656 | 8 | 25.34 | Yes | No |
| DeepSeek V4.1 Flash | Bugfix | Skill + CLI | Pass | 43,886 | 36,736 | 8 | 19.94 | Yes | No |
| DeepSeek V4.1 Flash | Bugfix | Baseline | Pass | 45,583 | 38,912 | 10 | 21.73 | No | No |
| GLM-5.3-Flash | Audit | Skill + CLI | Pass | 30,025 | 20,672 | 6 | 20.68 | No | Yes |
| GLM-5.3-Flash | Audit | Baseline | Pass | 35,457 | 26,112 | 6 | 21.79 | No | No |
| GLM-5.3-Flash | Audit | Skill | Pass | 43,715 | 30,464 | 8 | 25.40 | Yes | No |
| GLM-5.3-Flash | Bugfix | Baseline | Pass | 41,776 | 34,816 | 8 | 19.90 | No | No |
| GLM-5.3-Flash | Bugfix | Skill | Pass | 65,854 | 56,576 | 10 | 25.79 | Yes | No |
| GLM-5.3-Flash | Bugfix | Skill + CLI | Pass | 61,911 | 47,872 | 8 | 19.33 | Yes | No |

All 12 attempts passed the independent fixture grader. Both models used fewer total tokens in the bundled arm on the audit fixture, where both used the CLI. On bugfix, the bundled arm used fewer total tokens for DeepSeek and more for GLM, with no observed CLI call in either case. OpenCode estimated USD 0.02690 across these runs. The aggregate includes cached requests and should be treated as a client-side estimate. One attempt per arm leaves model variance, cache effects and differences on harder tasks unmeasured. The pilot does not establish general token savings or improved task completion.

## Claude Code compatibility with OpenCode Go

Claude Code 2.1.330 used DeepSeek V4.1 Flash through the [OpenCode Go Anthropic-compatible gateway](https://opencode.ai/docs/console/harnesses/claude-code/). An exploratory bundled-arm audit passed the independent grader in 55.53 seconds. Its event stream recorded skill discovery and activation. The attempted CLI commands in that audit produced no verified CLI result. The environment was replaced before the other two arms could be verified, so that trial has no usable cross-arm comparison.

A separate targeted smoke test used a fresh `audit` fixture in the bundled arm and explicitly requested skill activation followed by `node .claude/skills/buildsteward/runtime/bin/buildsteward.js deps inventory`. Claude Code ran in print mode with the `Read`, `Skill` and `Bash` tools available and a permission rule for that inventory command. Its stream showed skill discovery, a native `Skill` call, and a successful tool result containing the lockfile digest. The run completed in 13.69 seconds. This verifies the installed skill and one bundled CLI path with the Go gateway.

## Compare revisions of the skill

Run the same updated benchmark from one checkout and vary only the installed skill. A final argument of `skill` runs that arm by itself. Set `BUILDSTEWARD_BENCH_SKILL` to the previous revision's skill directory for one run. Unset it to use the skill in the current checkout. Keep the model, prompt and runtime settings fixed.

```bash
previous=$(mktemp -d)
git archive d2de17b skills/buildsteward | tar -x -C "$previous"
BUILDSTEWARD_BENCH_SKILL="$previous/skills/buildsteward" node benchmarks/opencode.js review opencode-go/deepseek-v4.1-flash ./review-old skill
node benchmarks/opencode.js review opencode-go/deepseek-v4.1-flash ./review-short skill
```

Repeat using `compat` and reverse the order. Use fresh output paths and record the observed skill activation along with the result. Total tokens include cached reads. Keep that in mind when comparing runs or reporting estimates.

For a separate comparison of how the two revisions behave after activation, set `BUILDSTEWARD_BENCH_REQUIRE_SKILL=1` for both single-arm runs. This adds the same activation request to both prompts. Check that the native skill call was observed in each run before comparing behavior after activation.

### Initial comparison

OpenCode 1.19.6 with DeepSeek V4.1 Flash on Go completed all six attempts. The previous entrypoint was 3,654 bytes and the revised one was 1,629 bytes. Each row reports one run per revision. Tokens are total, including cached reads.

| Fixture | Activation request | Previous tokens | Revised tokens | Activation observed | Grader |
|---|---|---:|---:|---|---|
| Review | None | 45,816 | 35,593 | Revised only | Both passed |
| Compatibility | None | 47,040 | 65,346 | Both | Both passed |
| Review | Explicit | 44,484 | 41,805 | Both | Both passed |

The explicit review used fewer total tokens with the shorter skill. The compatibility feature used more. The unprompted review exercised different activation behavior between revisions. This sample establishes the fixtures work with both skill revisions and does not establish a consistent token saving.
