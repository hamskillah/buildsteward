# Contributing

BuildSteward is developer-first, local-first, evidence-driven and token-conscious.

1. Describe the user-facing behavior, failure modes, permission boundary, and expected context overhead of a proposal.
2. Prefer extending an existing module to adding a new runtime/service.
3. Add tests for every policy and decision boundary. For network integrations, mock fetch responses, failure, stale/offline cache and data gaps.
4. Keep `SKILL.md` short; add small recipes and reference pointers rather than copying lengthy external materials.
5. Clearly separate verified facts, model-supplied judgments, and unverified assumptions.
6. Do not add background network activity, automatic indexing, telemetry or secret transmission without explicit opt-in.
7. Run `npm test` and a local CLI smoke test; document any checks that could not run.

Cross-agent compatibility and production permission enforcement require dedicated test harnesses. Don't claim broad compatibility from a successful installation alone.
