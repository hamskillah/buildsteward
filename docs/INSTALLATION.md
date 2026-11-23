# Installing BuildSteward

## GitHub source and skill-only installs

From the project directory, using Node.js 22.20 or later:

```bash
npx skills add hamskillah/buildsteward --skill buildsteward
```

Choose your agent and start a fresh session. Ask it to use BuildSteward on your task. Use `npx skills list` to check the installed files. OpenCode can show discovered skills with `opencode debug skill`.

For a headless install, append `-a codex -y` and replace `codex` with the Skills CLI target you need, such as `opencode`, `claude-code`, or `pi`. Pi headless runs may need project trust via `--approve`. For Hermes, use `-a hermes-agent -g -y --copy` and check `hermes skills list`. Use the Skills CLI for updates and removal of skills it installed.

### Run from a GitHub checkout

Clone the repository, then run the checkout's CLI from your project:

```bash
git clone https://github.com/hamskillah/buildsteward.git "$HOME/buildsteward"
node "$HOME/buildsteward/bin/buildsteward.js"
```

See the [dependency command reference](DEPENDENCY-INVENTORY.md) for the current checkout.

## npm registry installation

Requires Node.js 22 or later:

```bash
npm install -g @hamskillah/buildsteward
```

Run `buildsteward` from your project and choose **Install or update the skill**. For a direct, non-interactive setup and verification:

```bash
buildsteward setup --agents codex --yes
buildsteward doctor --agents codex --strict
```

Installer targets are `codex`, `opencode`, `claude`, and `cursor`. Use `--scope global` for account-wide installation and `--skill-only` to omit the bundled CLI. Use the same installer for a given skill directory. A full project install creates project settings only if they are absent. The current source also skips creating project settings for a skill-only install.

`doctor` checks files and fingerprints, and validates project settings for a bundled project install. Check activation in a fresh agent session. Run `buildsteward help` for commands including `inspect`, `deps inventory`, and `work status`.

### Updates, rollback, and removal

Rerun setup with the same scope and agent selection to update. The current source skips an identical installation. To preview the operation, append `--dry-run`.

```bash
buildsteward rollback --agents codex
buildsteward uninstall --agents codex
```

Rollback uses an existing managed backup. Uninstall moves managed skill files to a backup and preserves project settings and work history. Replacing modified managed files requires `--force` and saves a backup.

### Optional Codebase Memory provider

After installing Codebase Memory MCP and indexing the project:

```bash
buildsteward config set memory.codeGraph.mode on
buildsteward graph status
buildsteward graph search "SymbolName"
```

Current source selects the unique index matching the checkout. Use `--project NAME` if the match is unavailable or ambiguous. Verify results against the source files.

[Agent test results](../BUILD_STATUS.md) · [Developer workflow](DEVELOPER-WORKFLOW.md) · [Security](../SECURITY.md)
