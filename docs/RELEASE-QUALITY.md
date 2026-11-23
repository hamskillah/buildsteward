# Release quality and trust boundaries

BuildSteward is an **engineering support skill and local CLI**, not a self-running autonomous agent. A healthy local CLI does not prove an LLM used the skill, and an approval record is not an authorization boundary if the model can edit local state.

## Required gates before merging installer changes

1. `npm run check` passes: skill format, unit/integration tests and an isolated install from the packed npm artifact.
2. GitHub Actions completes on every configured Node.js version.
3. A fresh-install test, an update of a managed install, a refused unmanaged overwrite, and a modified-file recovery test pass.
4. The documentation describes prerequisites, install scopes, how to run bundled Cortex, and how to uninstall.
5. No secret or private data is embedded in the skill, output, tests, or package archive.
6. The PR review addresses high-impact path, permissions and supply-chain changes.

## Developer loop and evidence gates

- Work-plan validation tests cover DAG cycles, missing prerequisites, state resumption and test outcomes.
- `work done` is implementation evidence, not verified success. Actual command execution must be logged as a check and interpreted against relevant acceptance criteria.
- Manual reviews are self-reported and do not prove human approval.
- Repeated identical test failures are blocked rather than looped indefinitely.
- Release readiness, trusted host authorization, visual QA and cross-agent activation remain separate gates.

## Criteria for npm publication (separate authorization)

- Choose and verify an available npm package name and publisher identity.
- Set an intentional semantic version, supported Node engines, package exports/bin and `publishConfig.access: public` where relevant.
- Use npm trusted publishing/OIDC or appropriately restricted credentials managed outside repository content.
- Re-run `npm pack --dry-run`, isolated install tests and automated release gates against the exact package to be published.
- Do not publish automatically from an unreviewed PR or reuse local approval JSON as proof of human authorization.

## Cross-agent activation matrix

| Target | Installer layout | Runtime discovery | Model task |
|---|---|---|---|
| OpenCode | Project and global | Project, passed on 1.19.6 | Passed with OpenCode Go |
| Codex | Project and global | Project, passed on 0.172.0-alpha.2 and 0.171.0 | Passed with ChatGPT login |
| Claude Code | Project and global | Native Skill tool, 2.1.330 | Passed with OpenCode Go |
| Cursor CLI | Project and global | Both scopes, passed on 2026.11.22-e9042b2 | Bundled project inventory and global skill-only read passed with Auto |
| Pi | Project skill-only | Trusted project, 1.5.2 | Passed with OpenCode Go |
| Hermes Agent | Global skill-only; project CLI tested separately | Native skill_view, `a3b993b9` | Bugfix passed; negative case reported correctly with an extra diagnostic command |

See the [build status](../BUILD_STATUS.md) for tasks, observed results and limitations. Test discovery with a fresh project. Use `opencode debug skill` or the Codex app server's `skills/list` response. Confirm that the reported path belongs to the project and that the skill is enabled where the host reports that field. To verify activation, run a fresh model session on a disposable project, ask it to use BuildSteward for a small engineering task, and record evidence of the skill being loaded, the actual checks run, and the final outcome. Record the agent version, model, permission mode and elapsed time. Installer checks and discovery results are separate from model behavior.
