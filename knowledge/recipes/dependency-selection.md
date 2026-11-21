# Dependency selection

**Inputs**: needed capability, runtime and platform, licenses, policies, implementation cost.

1. Try built-in capabilities and already-installed dependencies first.
2. Identify *exact* candidate versions. Never treat a version range as a validated release.
3. Read official API/reference and release notes; confirm compatibility with runtime, platform, and peer dependency constraints.
4. Check published metadata with deps.dev or registry; known advisories with OSV; assess license and supply-chain signals.
5. Distinguish direct advisories, transitive risk, and missing checks. Zero known advisories is not a proof of safety.
6. For critical/novel candidates, run a small compatibility proof in an isolated environment. Do not execute unknown install scripts without consideration.
7. Compare maintenance, API ergonomics, footprint, operations, migration cost, and simpler alternatives.
8. Apply hard gates first; do not score unknown security, license or compatibility as passing.
9. Select only after enough evidence. Record exact version, evidence IDs and what was not checked. Re-run local resolver/build/tests.

**Stop condition**: viable candidate chosen with the necessary checks, or explicit blocker and smallest next verification.
