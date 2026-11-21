# Trusted host authorization boundary (design contract)

**Status:** architectural contract only; there is no production authorization service in this repository.

BuildSteward cannot prove that a human approved a privileged operation merely because local JSON says `approved`. A coding agent with unrestricted shell access can edit that JSON or invoke `approvals approve` itself. This is why `guard` *always returns `allowed: false`* for high-risk actions (production deployment, destructive operations, spending, secret-scope escalation, mission pivots), including after a local ledger entry is approved.

## Required production host controls

1. **Outside-agent enforcement:** The real action/tool must be behind a host permission boundary the agent cannot bypass. Do not give the agent the same credentials or unrestricted shell route to the protected operation.
2. **Independent identity:** The host authenticates a human through a separate, trusted channel. `--actor user` is not authentication.
3. **Narrow scope:** Grants bind the concrete action, repository/environment, target, limits and expiry, rather than a blanket 'autonomous' setting.
4. **Revocation:** The host invalidates grants and prevents reuse after expiry, revocation or execution as applicable.
5. **Audit:** The trusted host records requester, approver, scope and outcome in its own append-only or otherwise protected store.
6. **Fail closed:** Unknown action names, targets, disconnected approval authorities and unverified grants must deny execution.
7. **Test bypasses:** Try editing local state, self-approving, reusing an old grant, altering targets, and bypassing the adapter via direct shell. Tests must prove that the **host** blocks those paths before advertising secure autonomous deployment.

BuildSteward's CLI remains a decision/coordination aid. No security guarantee is made for external tools not controlled by a trusted host. The coding agent's native permission mechanisms must be configured independently.
