import { readConfig } from './config.js';
import { loadState, saveState, newId } from './state.js';

const HIGH_RISK = new Set(['production_deploy', 'destructive_operation', 'external_spend', 'secret_access_escalation', 'mission_pivot']);
// Conservative, exact names for routine in-scope actions. Unknown actions must
// never inherit blanket authorization from the word 'autonomous'.
const ROUTINE = new Set(['local_test','inspect_repo','run_local_tests','local_build','scoped_edit','scoped_refactor','read_documentation','install_approved_dependency']);
export function actionPolicy(config, action, target, approvals = []) {
  if (typeof action !== 'string' || !action.trim() || !target || typeof target !== 'string') throw new Error('action and target required');
  const needsExplicit = HIGH_RISK.has(action) || config.execution.approvalRequired.includes(action);
  // Routine work does not need repetitive ACC, even in approval mode.
  if (!needsExplicit && ROUTINE.has(action)) return { allowed: true, basis: 'routine_scoped', action, target };
  // Everything else, including unknown action names, requires a recorded ACC.
  // The host must still enforce permissions at the actual tool boundary.
  const applicable = approvals.find(a => a.action === action && a.target === target && a.status === 'approved' && (!a.expiresAt || Date.parse(a.expiresAt) > Date.now()));
  return applicable ? { allowed: true, basis: 'recorded_approval', approvalId: applicable.id, action, target } : { allowed: false, basis: 'approval_required', action, target };
}

export async function requestApproval(root, action, target, reason) {
  await readConfig(root);
  if (!action || !target || !reason || [action, target, reason].some(x => typeof x !== 'string' || x.length > 500)) throw new Error('action, target and reason required (max 500 chars)');
  const approvals = await loadState(root, 'approvals', []);
  const request = { id: newId('APR'), action, target, reason, status: 'pending', createdAt: new Date().toISOString(), expiresAt: null };
  approvals.push(request);
  await saveState(root, 'approvals', approvals);
  return request;
}

export async function resolveApproval(root, id, disposition, actor) {
  if (!['approved','rejected'].includes(disposition)) throw new Error('Invalid disposition');
  if (typeof actor !== 'string' || !actor.trim() || actor.length > 100) throw new Error('Actor label required');
  const approvals = await loadState(root, 'approvals', []);
  const target = approvals.find(a => a.id === id);
  if (!target) throw new Error('Approval not found');
  if (target.status !== 'pending') throw new Error('Approval already resolved');
  target.status = disposition;
  target.actorLabel = actor;
  target.resolvedAt = new Date().toISOString();
  await saveState(root, 'approvals', approvals);
  return target;
}

export async function checkAction(root, action, target) {
  const config = await readConfig(root);
  const approvals = await loadState(root, 'approvals', []);
  return actionPolicy(config, action, target, approvals);
}

export async function listApprovals(root) { return loadState(root, 'approvals', []); }
