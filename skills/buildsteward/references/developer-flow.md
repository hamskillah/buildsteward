# Developer Flow (choose a path, never run every path by default)

- **Fast**: local edit → relevant quick check → done.
- **Bugfix**: observe/reproduce → isolate root cause → patch → regression checks → done.
- **Feature**: objective/acceptance criteria → inspect repo → design relevant contracts & UI → implement end-to-end vertical slice → verify → integrate.
- **Architecture**: collect constraints → compare simplest viable choices → check hard gates → record decision → stage migration → verify.
- **Release**: permissions → CI/build/security/config → rollout → health/smoke checks → rollback if needed.

Logical hats are Product Engineer, Architect, UI/UX Designer, Full-Stack Developer, QA, Security, DevOps, Maintainer and TL. Use hats selectively; do not spawn agents for every hat. Tests and security belong throughout development. Respect existing codebase over fashionable replacements.

Use the optional CLI when it provides evidence or state the task needs. Run `buildsteward` from PATH or `node <skill-directory>/runtime/bin/buildsteward.js --root <project-path> <command>` from a full install. If the runtime or its project state is unavailable, use existing repository tools. Initialize only when the task needs it and the user’s scope allows it.
