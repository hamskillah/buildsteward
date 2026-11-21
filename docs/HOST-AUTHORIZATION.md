# Trusted host authorization

BuildSteward provides an embeddable authorization component for a trusted host. The project CLI and bundled skills do not set up a privileged host service or authenticate operators.

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


## Embed in a trusted host

Import `createHostAuthority` from `@hamskillah/buildsteward/src/host-authority.js` in a host process under an identity and deployment the agent cannot modify. Install the module from a trusted artifact. Use its two interfaces on separate channels.

| Interface | Who can call it | Responsibility |
|---|---|---|
| `authority.agent(principal).request(scope)` and `.execute(id, scope)` | The tool transport for an authenticated agent principal | Bind the principal from the host session. Forward only the request or execute inputs. |
| `authority.approve(id, credential)` and `.revoke(id, credential)` | The separate operator channel | Validate the operator credential and require confirmation of the exact challenge. |

Provide `authenticate(credential, challenge)`, a host function that returns an authenticated human ID only after verifying the requested operation, requester, scope, ID and expiry. Provide a synchronous policy `allow(principal, scope)` and action-specific `handlers`. For each action the handler must derive its parameters from the approved scope and host-owned state. A spending scope includes the exact amount in minor units and a three-letter currency code. The other actions bind action, project, environment and target. Use canonical target IDs defined by the host.

Provide an `audit(event)` callback that resolves only after the trusted audit sink has saved the event. Do not expose the approval callbacks, audit store, operation credentials, or direct execution path to the agent. A request expires within five minutes by default. Grants are single-use within one host process and disappear on restart. Run one authority instance per tool service. If the service is distributed, use a shared transactional authorization store before offering equivalent guarantees.

Revocation stops a grant before the handler starts. A started handler can have effects even if execution fails, connectivity drops, or the final audit write fails. Use the host request ID for downstream idempotency and reconcile ambiguous outcomes before retrying. The library leaves operator identity, native coding-agent permissions and transport isolation to the deploying host. Current tests exercise the library behind injected boundaries. Production deployment and real coding-agent enforcement require verification of the actual integration.
