# Release quality and trust boundaries

BuildSteward is an **engineering support skill and local CLI**, not a self-running autonomous agent. A healthy local CLI does not prove an LLM used the skill, and an approval record is not an authorization boundary if the model can edit local state.

## Required gates before merging installer changes

1. `npm run check` passes: skill format, unit/integration tests and an isolated install from the packed npm artifact.
2. GitHub Actions completes on every configured Node.js version.
3. A fresh-install test, an update of a managed install, a refused unmanaged overwrite, and a modified-file recovery test pass.
4. The documentation describes prerequisites, install scopes, how to run bundled Cortex, and how to uninstall.
5. No secret or private data is embedded in the skill, output, tests, or package archive.
6. The PR review addresses high-impact path, permissions and supply-chain changes.

## Criteria for npm publication (separate authorization)

- Choose and verify an available npm package name and publisher identity.
- Remove the development-only `private: true` guard **only as part of an authorized publication change**.
- Set an intentional semantic version, supported Node engines, package exports/bin and `publishConfig.access: public` where relevant.
- Use npm trusted publishing/OIDC or appropriately restricted credentials managed outside repository content.
- Re-run `npm pack --dry-run`, isolated install tests and automated release gates against the exact package to be published.
- Do not publish automatically from an unreviewed PR or reuse local approval JSON as proof of human authorization.

## Cross-agent activation matrix

| Target | Location tested by installer | Activation proven in live agent? |
|---|---|---|
| OpenCode | `.agents/skills/`, `~/.config/opencode/skills/` | Not yet |
| Codex | `.agents/skills/`, `~/.agents/skills/` | Not yet |
| Claude Code | `.claude/skills/`, `~/.claude/skills/` | Not yet |
| Cursor | `.cursor/skills/`, `~/.cursor/skills/` | Not yet |

The file paths are covered by installer tests. Live activation, actual model behavior and host permission enforcement require host-specific end-to-end testing before those claims can be made.
