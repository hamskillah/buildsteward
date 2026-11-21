import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { HOST_ACTIONS } from './approval.js';

const MAX_PENDING = 256;
const SCOPE_KEYS = ['action', 'project', 'environment', 'target'];
const validLabel = value => typeof value === 'string' && value.length > 0 && value.length <= 256 &&
  value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);

function normalizeScope(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid host scope');
  const { action, project, environment, target, amountMinor, currency } = input;
  if (!HOST_ACTIONS.includes(action) || ![project, environment, target].every(validLabel)) {
    throw new Error('Invalid host scope');
  }
  const spending = action === 'external_spend';
  const keys = spending ? [...SCOPE_KEYS, 'amountMinor', 'currency'] : SCOPE_KEYS;
  if (Reflect.ownKeys(input).length !== keys.length || !keys.every(key => Object.hasOwn(input, key)) ||
      (spending && (!Number.isSafeInteger(amountMinor) || amountMinor < 1 ||
        typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)))) {
    throw new Error('Invalid host scope fields');
  }
  return Object.freeze({ action, project, environment, target, ...(spending ? { amountMinor, currency } : {}) });
}

export function createHostAuthority({ authenticate, allow, handlers, audit, ttlMs = 300_000 }) {
  if (![authenticate, allow, audit].every(callback => typeof callback === 'function') ||
      !handlers || typeof handlers !== 'object' || !Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 900_000) {
    throw new Error('Host authority requires authentication, policy, handlers, audit and a valid TTL');
  }
  const operations = new Map();
  for (const action of HOST_ACTIONS) {
    if (Object.hasOwn(handlers, action) && typeof handlers[action] === 'function') operations.set(action, handlers[action]);
  }
  if (!operations.size) throw new Error('No privileged host handlers configured');
  const requests = new Map();
  const active = record => record.deadline > performance.now();
  const view = ({ id, requester, scope, expiresAt }) => Object.freeze({ id, requester, scope, expiresAt });
  const log = (event, record, attributes = {}) => audit(Object.freeze({ event, ...view(record), ...attributes }));

  function authorizeScope(principal, scope) {
    if (!operations.has(scope.action) || allow(principal, scope) !== true) throw new Error('Host policy denied scope');
  }

  async function authenticateOperator(operation, record, credential) {
    const actor = await authenticate(credential, Object.freeze({ operation, ...view(record) }));
    if (!validLabel(actor) || actor === record.requester) throw new Error('Independent operator authentication required');
    return actor;
  }

  async function approve(id, credential) {
    const record = requests.get(id);
    if (!record || record.status !== 'pending' || !active(record)) throw new Error('Request unavailable');
    const actor = await authenticateOperator('approve', record, credential);
    if (record.status !== 'pending' || !active(record)) throw new Error('Request unavailable');
    record.status = 'approving';
    try {
      await log('approved', record, { actor });
      if (record.status !== 'approving' || !active(record)) throw new Error('Request unavailable');
      record.actor = actor;
      record.status = 'approved';
      return view(record);
    } catch (error) {
      if (record.status === 'approving') requests.delete(id);
      throw error;
    }
  }

  async function revoke(id, credential) {
    const record = requests.get(id);
    if (!record || !active(record) || record.status === 'executing') throw new Error('Request unavailable');
    const actor = await authenticateOperator('revoke', record, credential);
    if (requests.get(id) !== record || !active(record) || record.status === 'executing') throw new Error('Request unavailable');
    record.status = 'revoked';
    requests.delete(id);
    await log('revoked', record, { actor });
  }

  function agent(principal) {
    if (!validLabel(principal)) throw new Error('Host-authenticated agent principal required');
    return Object.freeze({
      async request(input) {
        const scope = normalizeScope(input);
        authorizeScope(principal, scope);
        for (const [id, record] of requests) {
          if (!active(record) && record.status !== 'executing') requests.delete(id);
        }
        if (requests.size >= MAX_PENDING) throw new Error('Host request capacity exceeded');
        const id = randomUUID();
        const record = { id, requester: principal, scope, status: 'recording',
          deadline: performance.now() + ttlMs, expiresAt: new Date(Date.now() + ttlMs).toISOString() };
        requests.set(id, record);
        try {
          await log('requested', record);
          if (record.status !== 'recording' || !active(record)) throw new Error('Request unavailable');
          record.status = 'pending';
          return view(record);
        } catch (error) {
          requests.delete(id);
          throw error;
        }
      },
      async execute(id, input) {
        const scope = normalizeScope(input);
        authorizeScope(principal, scope);
        const record = requests.get(id);
        if (!record || record.requester !== principal || record.status !== 'approved' || !active(record) ||
            JSON.stringify(record.scope) !== JSON.stringify(scope)) throw new Error('Matching host approval required');
        record.status = 'reserved';
        try {
          await log('execution_reserved', record, { actor: record.actor });
          if (record.status !== 'reserved' || !active(record)) throw new Error('Host approval no longer active');
          authorizeScope(principal, scope);
          record.status = 'executing';
          let outcome = 'failed';
          try {
            const result = await operations.get(scope.action)(record.scope, view(record));
            outcome = 'succeeded';
            return result;
          } finally {
            try { await log('execution_finished', record, { actor: record.actor, outcome }); }
            catch { throw new Error('Host audit failed after invoking the operation; verify the outcome before retrying'); }
          }
        } finally {
          requests.delete(id);
        }
      },
    });
  }
  return Object.freeze({ agent, approve, revoke });
}
