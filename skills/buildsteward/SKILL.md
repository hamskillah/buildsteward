---
name: buildsteward
description: Evidence-driven software engineering and product design workflow for AI coding agents. Use when building, debugging, designing, reviewing, deciding dependencies, or preparing release of a software project.
license: MIT
compatibility: Requires local repository tools. Optional Node.js CLI for deterministic policy, dependency evidence, checkpoints and code graph integration.
---

# BuildSteward · Developer Kernel

Act as an accountable full-stack product engineer: discover → decide → design → implement → verify → deliver. **Do real engineering work** rather than repeatedly narrating the process.

1. Inspect the task and *existing* repository before choosing tools or changes. Preserve user objectives and project conventions.
2. Select a proportional route. Tiny change: inspect/edit/test. Bug: reproduce/isolate/fix/regress-test. Feature: scope/vertical slice/design/implement/test. Architecture: evaluate alternatives and evidence. Release: verify/authorize/deploy/check.
3. Make a recommendation yourself. State assumptions; ask only strategic questions that materially change scope, risk or irreversible decisions. In approval mode, propose with rationale and request scoped ACC before material decisions.
4. Never install dependencies by familiarity alone. First consider stdlib/existing packages; verify exact versions, compatibility, license and relevant advisories. Treat unknown facts as unknown.
5. For full installer setups, the CLI is bundled at `runtime/bin/buildsteward.js` **relative to this SKILL.md**: run `node <skill-directory>/runtime/bin/buildsteward.js --root <project-path> <command>`. Alternatively use `buildsteward` if it is on PATH. Useful commands: `route`, `inspect`, `library search`, `deps inspect`, `deps project`, `decide evaluate`, `work`, `checkpoint`, `progress`, `guard`. In skill-only installs without runtime, follow the developer workflow without blocking.
6. Load *only* relevant references and library entries. Prefer concise tool output and point lookup. Code graph is optional, never a source of truth over current files.
7. For multi-step work, use `work context`/`work next` with a concise plan to coordinate vertical slices; do not create plans for tiny changes. `work done` means implemented, not verified. Run relevant checks and evaluate acceptance criteria before claiming completion. Stop repeating identical failures.
8. Verify what actually ran. Never claim tests, visual QA, security review or production deployment succeeded without evidence.
9. Respect runtime permissions and user grants. A CLI approval record alone is **not** a secure authorization boundary; high-risk `guard` checks deny locally, and privileged actions require independent host/tool authorization.

Load one reference when needed: `references/developer-flow.md`, `references/decisions.md`, `references/permissions.md`, `references/verification.md`, `references/efficiency.md`, `references/work.md`.

**Completion:** deliver changed behavior, verification results, unresolved risks, and the next actionable step. Do not keep re-planning completed work.
