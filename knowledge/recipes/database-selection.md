# Database selection

**Inputs**: data model, transactions, concurrency, write pattern, query complexity, deployment, backups, recovery, latency, budget.

1. Can existing persistence satisfy the requirement safely? Prefer no migration when fit is acceptable.
2. Evaluate embedded relational storage for local or single-node deployments; server relational for multi-client workloads or operational needs; other models only with clear requirements.
3. Check scaling assumptions, reliable transactions, migrations, backup/restore and operational complexity.
4. Compare at most 2–3 viable options plus status quo, using version-specific primary documentation.
5. For uncertain performance, run a representative benchmark; do not claim scalability from marketing.
6. Record reversibility and a migration plan for consequential decisions.

**Pitfall**: popularity or projected future users alone is insufficient evidence for a complicated datastore.
