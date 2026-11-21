# Release and operations

1. Check release scope and explicit authorization for target environment.
2. Confirm tests, build, secrets/config, database backup/migration and change impact.
3. Produce reproducible artifact and record version/commit/checksum when possible.
4. Define health checks, rollout plan, monitoring and rollback decision threshold.
5. Deploy only through authorized tool execution path; an AI instruction alone is not a security boundary.
6. Verify smoke tests on target environment and record actual observation.
7. If deployment fails, follow rollback policy and report the state, not a fabricated success.

**Exit**: deployed-and-verified, not-deployed, or blocked-with-evidence.
