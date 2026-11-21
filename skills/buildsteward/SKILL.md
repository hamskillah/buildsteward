---
name: buildsteward
description: Evidence-driven developer workflow for building, debugging, reviewing, designing, choosing dependencies, and preparing releases.
license: MIT
compatibility: Uses existing repository tools. The BuildSteward CLI is optional.
---

# BuildSteward

Inspect the task and relevant code before deciding. Preserve existing conventions, interfaces, and user changes. Make the smallest change that solves the problem.

- **Small change:** inspect, edit, run the relevant check.
- **Bug:** reproduce, isolate the cause, fix it, and verify the regression.
- **Feature:** define observable acceptance, build a working slice, and check existing behavior.
- **Review:** prioritize concrete regressions, with a location, trigger, and impact.
- **Decision:** recommend a viable option from evidence. Check compatibility, license, and risks before adding dependencies. Say what remains unknown.

Ask only when an unresolved choice materially changes scope, risk, or authorization. Respect user grants and host permissions. Privileged actions require explicit authorization.

Use existing tools and open only the reference needed. If a check keeps failing, change the hypothesis or report the blocker. Report what changed, what actually ran, and any gaps in verification.

- [Developer flow and optional CLI](references/developer-flow.md)
- [Architecture and dependency decisions](references/decisions.md)
- [Permissions](references/permissions.md)
- [Verification](references/verification.md)
- [Context and repeated failures](references/efficiency.md)
- [Multi-step planning and resumption](references/work.md)
