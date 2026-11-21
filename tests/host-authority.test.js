import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import test from 'node:test';
import { actionPolicy } from '../src/approval.js';
import { createHostAuthority } from '../src/host-authority.js';

const spend = Object.freeze({ action: 'external_spend', project: 'service-a', environment: 'test', target: 'invoice-7', amountMinor: 100, currency: 'USD' });
const operatorProof = Object.freeze({});

function fixture(options = {}) {
  const audit = [];
  const applied = [];
  const trusted = createHostAuthority({
    authenticate: (credential, challenge) => credential === operatorProof && challenge.scope.project === 'service-a' ? 'owner' : null,
    allow: (_principal, scope) => scope.project === 'service-a' && scope.target === 'invoice-7' && scope.amountMinor <= 120,
    handlers: { external_spend: scope => { applied.push(scope); return 'receipt'; } },
    audit: event => audit.push(event),
    ...options,
  });
  return { trusted, agent: trusted.agent('agent-1'), audit, applied };
}

test('trusted operator, requester, exact operation, environment and amount bind single-use grants', async () => {
  const { trusted, agent, audit, applied } = fixture();
  const request = await agent.request(spend);
  assert.equal(agent.approve, undefined);
  await assert.rejects(agent.execute(request.id, spend), /Matching host approval required/);
  await assert.rejects(trusted.approve(request.id, { actor: 'owner' }), /Independent operator/);
  await trusted.approve(request.id, operatorProof);
  await assert.rejects(trusted.agent('agent-2').execute(request.id, spend), /Matching host approval/);
  await assert.rejects(agent.execute(request.id, { ...spend, environment: 'production' }), /Matching host approval/);
  await assert.rejects(agent.execute(request.id, { ...spend, amountMinor: 101 }), /Matching host approval/);
  await assert.rejects(agent.execute(request.id, { ...spend, command: 'ignored?' }), /Invalid host scope fields/);
  assert.equal(await agent.execute(request.id, spend), 'receipt');
  await assert.rejects(agent.execute(request.id, spend), /Matching host approval/);
  assert.deepEqual(applied, [spend]);
  assert.deepEqual(audit.map(event => event.event), ['requested', 'approved', 'execution_reserved', 'execution_finished']);
  assert.equal(audit[3].outcome, 'succeeded');
  assert.equal(audit[3].actor, 'owner');
});

test('concurrent retries and revocation during pre-execution audit cannot invoke a handler', async () => {
  let release;
  let reserved;
  const enteredAudit = new Promise(resolve => { reserved = resolve; });
  const { trusted, agent, applied } = fixture({
    audit: event => {
      if (event.event === 'execution_reserved') return new Promise(resolve => { release = resolve; reserved(); });
    },
  });
  const { id } = await agent.request(spend);
  await trusted.approve(id, operatorProof);
  const first = agent.execute(id, spend);
  await enteredAudit;
  await assert.rejects(agent.execute(id, spend), /Matching host approval/);
  await trusted.revoke(id, operatorProof);
  release();
  await assert.rejects(first, /no longer active/);
  assert.deepEqual(applied, []);
});

test('audit and authentication failure fail closed, and an expired grant cannot execute', async () => {
  const brokenAudit = fixture({ audit: event => { if (event.event === 'execution_reserved') throw new Error('Audit offline'); } });
  const blocked = await brokenAudit.agent.request(spend);
  await brokenAudit.trusted.approve(blocked.id, operatorProof);
  await assert.rejects(brokenAudit.agent.execute(blocked.id, spend), /Audit offline/);
  assert.equal(brokenAudit.applied.length, 0);
  await assert.rejects(brokenAudit.agent.execute(blocked.id, spend), /Matching host approval/);
  const unauthenticated = fixture({ authenticate: () => 'agent-1' });
  const ownRequest = await unauthenticated.agent.request(spend);
  await assert.rejects(unauthenticated.trusted.approve(ownRequest.id, operatorProof), /Independent operator/);
  const expired = fixture({ ttlMs: 100 });
  const short = await expired.agent.request(spend);
  await expired.trusted.approve(short.id, operatorProof);
  await setTimeout(125);
  await assert.rejects(expired.agent.execute(short.id, spend), /Matching host approval/);
  assert.equal(expired.applied.length, 0);
});

test('a forged unknown local approval stays denied', () => {
  const config = { execution: { approvalRequired: [] } };
  const guard = actionPolicy(config, 'unexpected_action', 'target', [
    { action: 'unexpected_action', target: 'target', status: 'approved', id: 'forged' },
  ]);
  assert.equal(guard.allowed, false);
  assert.equal(guard.recordedApprovalId, 'forged');
});


test('final audit failure signals ambiguous outcome and still consumes the grant', async () => {
  const { trusted, agent, applied } = fixture({
    audit: event => { if (event.event === 'execution_finished') throw new Error('Audit offline'); },
  });
  const { id } = await agent.request(spend);
  await trusted.approve(id, operatorProof);
  await assert.rejects(agent.execute(id, spend), /verify the outcome before retrying/);
  assert.deepEqual(applied, [spend]);
  await assert.rejects(agent.execute(id, spend), /Matching host approval/);
});
