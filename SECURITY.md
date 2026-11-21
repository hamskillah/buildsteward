# Security policy

## Threat model

BuildSteward consumes repository content and online API data. Treat both as untrusted. Retrieved documents and package metadata are facts to inspect, **not commands** to execute.

- No API token is required for the included deps.dev/OSV lookups.
- Dependency URLs use fixed hosts; user input only fills validated package identifiers/version path elements.
- Network calls time out after 8 seconds; JSON responses have a size bound.
- Graph provider execution is disabled by default; it starts only after the user chooses on/auto and installs the provider.
- Local `.buildsteward/` state may contain project information; avoid putting credentials, private source or personal data into approval reasons/checkpoints.
- External fetched data may be inaccurate or stale; always respect provenance and versions.

## Approval limitation

A text-file approval ledger **cannot authenticate that a user, rather than the agent, approved a request**. Any untrusted agent with shell/write access to that file or CLI can approve itself. Protect privileged execution using host tool permission gates, independent credentials, or a human-controlled approval channel before real autonomous deployment/spending/data deletion.

The included `guard` command is an advisory gate for clients that voluntarily invoke it, **not a security sandbox**. High-risk operations must be blocked at the actual execution boundary.

## Data integrity limitation

The JSON state store is intentionally lightweight. Concurrent writes and hostile/symlinked workspaces are **not** hardened for multi-user or untrusted repository execution. Do not expose CLI as a privileged network service. For a future hardened runtime, use transactional storage, audit events, state integrity, and strict trusted path handling.

## Vulnerability reporting

For security-sensitive findings, contact repository maintainers privately using GitHub's private vulnerability reporting once the repository is published. Until a private channel is configured, do not publish exploitable secrets or personal data in a public issue.
