# Architecture and developer workflow

BuildSteward is a **local-first tool-assisted engineering discipline**, not a new LLM, autonomous runtime, CI system, or custom package registry.

## Contract between modules

1. **Skill Layer** instructs an AI agent to do the real developer work: inspect, discover, design, build, test, review, release and maintain. A tiny task skips irrelevant stages.
2. **Developer Router** proposes a fast, standard or architectural path; this is intentionally heuristic and never substitutes for repo inspection.
3. **Cortex Decision Engine** validates hard constraints, missing evidence, user-provided ratings and decision status. It does not fetch facts itself or claim subjective ratings are proven.
4. **Dependency Intelligence** reads version-specific deps.dev and OSV data. It returns facts plus *checks not performed*, not a fabricated security score.
5. **Steward Library** contains short, atomic engineering playbooks and source links. Retrieval selects specific topics; do not load the entire library into agent context.
6. **Project State** stores decisions, scoped approvals, checkpoints and progress fingerprints in local JSON. Optional CBM graph is a read-only navigation aid.
7. **Execution Guardian** provides a decision policy signal and stagnation warnings. Production tool permission enforcement remains the responsibility of the host/runtime.

No required cloud service, vector DB, background daemon, native dependency, or graph server is introduced.

## Developer task paths

**Fast path:** inspect affected context → minimal edit → relevant check → concise delivery.

**Bug path:** reproduce or inspect evidence → isolate → minimal fix → relevant regression verification → delivery.

**Feature path:** user outcome/acceptance criteria → inspect repo → minimal design and API/data contracts → end-to-end vertical slice → automated tests and relevant UI/UX inspection → integration → delivery.

**Architectural path:** requirements → hard constraints → 2–3 serious alternatives → source/version-backed evidence → challenge significant assumptions → recommendation → authority policy → staged implementation → migration/compatibility checks.

**Release path:** target permissions → build/test/config/security checks → package → authorized rollout → smoke/health checks → rollback on failure → outcome report.

Developer hats (TL, product, architect, designer, full-stack, QA, security, DevOps, maintainer) are logical perspectives, not forced subagent spawns.

## Permission boundaries

Decision approval and action approval are intentionally separate. An architectural recommendation approved by a human is not an automatic grant for production deploy or spending. Approval records have exact `action` and `target` binding; target mismatches are denied.

Current approval files are coordination artifacts and **can be modified by any process with write access to the project**. A true security boundary needs a host adapter that the agent cannot bypass (e.g., tool permissions, isolated credentials, human-owned approval channel). Do not use the ledger as authorization for privileged code execution in an adversarial environment.

## Token flow

- L0: skill metadata.
- L1: short main `SKILL.md`.
- L2: exactly one matching reference or library topic if necessary.
- L3: compact facts from CLI or code graph. Deep logs/primary source only if diagnosing uncertainty.

CLI defaults to single-line JSON. Checkpoint state is intentionally short and stable across model changes.

## Dependency evidence contract

For each exact `ecosystem/name/version`, return:
- source URI, observed timestamp, cache/live/offline/unavailable state;
- published metadata, license identifier list and direct advisory IDs if available;
- OSV known vulnerability IDs if available;
- explicit missing checks (lockfile resolution, transitive graph, license compatibility, runtime test, maintenance health).

Future research connectors must comply with user policy, record evidence provenance, validate output, and never allow retrieved content to execute instructions.

## Intentional exclusions (not silently complete)

- No authenticated human-approval channel.
- No direct deployment or project builder orchestration.
- No built-in MCP server; CLI adapter to CBM is optional.
- No broad transitive dependency analysis or automatic candidate discovery yet.
- No hosted memory store, agent cloud scheduler, visual testing automation or automatic PRs.
- No benchmark-based cross-model consistency claim until measured.

These are engineering boundaries, not hidden functionality.
