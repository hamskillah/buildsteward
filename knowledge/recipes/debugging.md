# Root-cause debugging

1. Record expected behavior, observed behavior, environment and exact failure evidence.
2. Reproduce using minimal steps if feasible. If not reproducible, label the uncertainty.
3. Narrow the failing boundary by inspecting relevant logs, tests, and call sites; optionally query a fresh code graph.
4. Form a falsifiable hypothesis. Run the smallest diagnostic that distinguishes explanations.
5. Patch root cause, not just symptom; add a regression check where appropriate.
6. Run relevant tests, lint/type checks, and integration checks proportional to change risk.
7. If unchanged error+action repeats, use Progress Sentinel: stop, change hypothesis, or report blocker.

**Do not** blindly reinstall dependencies or repeatedly modify unrelated files.
