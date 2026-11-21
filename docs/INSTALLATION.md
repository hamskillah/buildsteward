# BuildSteward Installation & Operations

BuildSteward works as (1) a portable, lightweight Agent Skill or (2) a skill bundled with its local Cortex CLI. The npm CLI requires **Node.js 22+**. The GitHub source route also requires Git.

## npm registry installation

```bash
npm install -g @hamskillah/buildsteward
```

Run `buildsteward` in your project terminal. The console offers project setup, inspection and an installation check. Direct commands such as `buildsteward doctor` work without opening the console and retain their JSON output.

### Setup without the console

```bash
# Run within the target project directory
buildsteward setup
```

By default, with a TTY it detects coding-agent executables when possible and asks which targets to install. If none is on PATH, you can still enter supported agent names manually. In headless mode with no detected agent, pass `--agents` explicitly. On CI/headless machines, provide explicit flags:

```bash
buildsteward setup \
  --scope project --agents opencode,codex --mode approval --graph off --yes
```

Available agents: `opencode`, `codex`, `claude`, `cursor`. `--agents` accepts a comma-separated list or `auto` to detect executables on the current PATH. Supported scopes: `project` (default) and `global`. Modes: `approval` (default) and `autonomous`. Optional graph: `off` (default), `auto`, `on`. Graph mode only controls configuration; Codebase Memory MCP must be installed/indexed separately.

Before installing, inspect planned writes with `setup --dry-run --agents codex`. A project install creates `.buildsteward/config.json` if absent, but never overwrites existing project policy. Global install does not create project configuration. Setup copies the skill and bundled runtime directly under the agent's skills folder, so it does not need a globally linked npm package afterward.

To run Cortex tools with a project-level OpenCode/Codex installation:

```bash
node .agents/skills/buildsteward/runtime/bin/buildsteward.js inspect
node .agents/skills/buildsteward/runtime/bin/buildsteward.js library search "database"
```

For Claude Code or Cursor use their `.claude/skills/` or `.cursor/skills/` location respectively. For a global installation, use the corresponding path under your home directory.

## Claude Code with an OpenCode Go model

Install the Claude Code target from the project:

```bash
buildsteward setup --agents claude --yes
```

In a shell that already holds your OpenCode Go key as `OPENCODE_GO_API_KEY`, scope the custom backend to the Claude invocation:

```bash
ANTHROPIC_BASE_URL=https://opencode.ai/inference/go/anthropic \
ANTHROPIC_AUTH_TOKEN="$OPENCODE_GO_API_KEY" \
claude --model deepseek-v4.1-flash
```

Use a session without a conflicting native Claude login or `ANTHROPIC_API_KEY`. See the [OpenCode Go instructions for Claude Code](https://opencode.ai/docs/console/harnesses/claude-code/#go) and the [verified agent matrix](../BUILD_STATUS.md).

## GitHub source and skill-only installs

### Run from a GitHub checkout

```bash
git clone https://github.com/hamskillah/buildsteward.git "$HOME/buildsteward"
```

From your target project directory, run the checked-out CLI:

```bash
node "$HOME/buildsteward/bin/buildsteward.js"
```

### GitHub skill-only installation

Requires Node.js 22.20 or later for Skills CLI 1.9.0.

```bash
npx skills add hamskillah/buildsteward --skill buildsteward
```

Open a fresh coding-agent session after installation. Check installed files with `npx skills list`. In OpenCode, `opencode debug skill` lists the skills discovered by the runtime. For a headless, single-agent install, append `-a codex -y` or replace `codex` with `opencode` or `claude-code`. Add `-g` for an account-wide install.

The Skills CLI manages installation, updates and removal for this mode. BuildSteward does not claim ownership of installations created by another installer. This mode contains instructions and references but **does not** include the executable Decision/Dependency/Memory CLI runtime.

### Pi and Hermes Agent

Pi and Hermes can use BuildSteward via the Skills CLI:

```bash
# In a project you trust; use --approve for a headless Pi run.
npx skills add hamskillah/buildsteward --skill buildsteward -a pi -y

# Install for Hermes Agent and confirm it is enabled.
npx skills add hamskillah/buildsteward --skill buildsteward -a hermes-agent -g -y --copy
hermes skills list
```

Ask the agent to use BuildSteward in its next session. These installs provide the skill. For deterministic CLI commands, use a separate copy of the CLI from source or point Hermes at a full project's existing BuildSteward bundle through [external skill directories](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills). Keep one installer per target directory.

## Diagnostics

From a source checkout, run `node bin/buildsteward.js help` for the command reference. For an installed bundle, run its CLI with `help`.

```bash
buildsteward doctor --agents opencode,codex
buildsteward doctor --scope global --agents claude
```

`doctor` reports whether skill files, ownership markers and bundled runtime exist and match BuildSteward's recorded fingerprint. Use `doctor --strict` in automated checks: it exits nonzero when a requested install is absent, tampered or incomplete. It does **not** prove agent activation. Check your agent's skills list or start a fresh session. Some host agents use skills permissions and enablement controls.

## Managed skill-only installation

If you want the BuildSteward installer to manage the skill without copying the Cortex runtime, use `--skill-only`. It can still be updated and removed by the same installer. If you only need the skill and no BuildSteward CLI at all, prefer Skills CLI installation above.

```bash
buildsteward setup --agents codex --skill-only --yes
buildsteward doctor --agents codex --strict
```

## Updates and rollback

Use the same installer with the same scope/agents to update managed skills. Managed content is fingerprinted. If it was edited by a user, the installer refuses replacement; pass `--force` only if you have reviewed the changes and want them saved to a backup first.

```bash
buildsteward setup --agents codex,opencode --yes
buildsteward rollback --agents codex,opencode --dry-run
buildsteward rollback --agents codex,opencode
```

Backups are stored under `.buildsteward/skill-backups` (project) or `~/.config/buildsteward/skill-backups` (global). Only previous BuildSteward-managed backups can be restored. Rollback requires a backup; it does not arbitrarily download old versions or replace installations from another tool.

## Uninstall

```bash
buildsteward uninstall --agents codex,opencode --dry-run
buildsteward uninstall --agents codex,opencode
```

The command **preserves project settings, checkpoints and decisions**. It moves the managed skill into a recoverable backup. Unmanaged skill folders cannot be removed by BuildSteward. Skills installed with `npx skills add` must be removed via the Skills CLI instead.

## Safety and limitations

- For repeatable installations, pin a package version on npm or a commit in a source checkout.
- The setup installs content under explicitly selected user or project directories. It does not edit `~/.config/opencode/opencode.json`, Claude settings or agent tool permissions.
- A skill file on disk cannot guarantee host activation or secure approval enforcement. `approval` records are workflow metadata and not a substitute for host-enforced permissions.
- No network is used by the installer itself. Optional `deps inspect` uses API calls when requested.
- Full setup is currently validated with local filesystem and CLI integration tests, not across every real host-agent UI.
