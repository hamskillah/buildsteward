# Token & Loop Discipline

- Context L0 discovery metadata, L1 short SKILL.md, L2 single task recipe, L3 source-backed evidence only if needed.
- Search before reading large files; ask tools for compact result; keep full logs out of prompt unless diagnosing.
- Do not repeatedly read same file or reconsider settled choices without new evidence.
- After a milestone, store checkpoint: goal, completed, next, blockers, changed files and verification.
- Track a failure fingerprint (action + error evidence). Repeated unchanged failures → inspect a new cause, use graph selectively, or stop with blocker.
- On graph off/unavailable, fall back to Git/grep/direct code. Never require a network fetch or graph query for a simple edit.
