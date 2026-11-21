# Architecture review

1. Start with current system boundaries, invariants and existing patterns.
2. Define external contracts, data ownership, failure modes, trust boundaries, scaling and operations.
3. Prefer modular simplicity and reversible steps; avoid gratuitous services, queues, and frameworks.
4. Write a short ADR only when the decision is consequential or difficult to reverse.
5. Identify tests and migration/rollback steps before a breaking change.
6. For significant designs, challenge one key assumption with evidence; do not initiate recursive debate loops.
7. Deliver implementation slices with clear contracts and verifiable acceptance criteria.

**Stop**: constraints met, tradeoffs documented, and actionable slice ready.
