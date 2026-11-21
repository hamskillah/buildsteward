# Multi-step developer work

Activate only for tasks that really need several dependent changes. Keep the plan small and acceptance-driven; do not repeatedly regenerate it. The actual coding agent does the implementation.

- Create `work` plan JSON with dependency DAG, accepted outcome, and task-specific verification. Use the example below as a starting point.
- `work next` -> `work start --id ...` -> implement code/tests -> `work done --id ... --evidence ...` -> `work check --id ... --runner <supported> --confirm-run` for automated work.
- Use `work review` only for permitted manual verification (docs/design/architecture); review is self-reported.
- `work context` returns a bounded compact checkpoint to resume across agent/model sessions.
- When repeated test outputs fail, stop, change hypothesis, or block; do not loop forever.
- In Approval Mode ask for user approval on material decisions. Never interpret local approval JSON as permission to deploy, spend, delete production data or access new secrets.
- No test command should run on untrusted code without suitable environment isolation. `--confirm-run` is acknowledgement, not sandboxing.


Save this example as a project-local JSON file, adapt it to the actual acceptance criterion, then pass its path to `work create --file`.

```json
{
  "goal": "Fix the reported parsing regression",
  "tasks": [
    {
      "id": "parser",
      "title": "Fix parsing and add a regression test",
      "kind": "bugfix",
      "risk": "low",
      "verification": "automated",
      "dependsOn": [],
      "acceptance": ["The reported input parses and existing parser tests pass"]
    }
  ]
}
```
