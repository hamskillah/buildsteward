import { readConfig } from './config.js';
import { loadState, saveState, newId } from './state.js';

const PROFILES = {
  general: { fit: 35, maintenance: 20, complexity: 25, operational: 20 },
  security: { fit: 25, maintenance: 25, complexity: 15, operational: 35 },
  ui: { fit: 35, maintenance: 20, complexity: 30, operational: 15 },
  infrastructure: { fit: 30, maintenance: 20, complexity: 20, operational: 30 }
};
const GATES = ['compatible', 'licenseAllowed', 'securityAcceptable'];

export function evaluateDecision(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Decision input object required');
  const { topic, candidates, profile = 'general', tier = 'comparative' } = input;
  if (typeof topic !== 'string' || !topic.trim() || topic.length > 250) throw new Error('Invalid decision topic');
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 12) throw new Error('Supply 1..12 candidates');
  if (!PROFILES[profile]) throw new Error('Unknown evaluation profile');
  if (!['routine', 'comparative', 'architectural', 'critical'].includes(tier)) throw new Error('Unknown decision tier');
  const weights = PROFILES[profile];
  const results = candidates.map(c => {
    if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 120) throw new Error('Candidate must have a name');
    const gateValues = GATES.map(key => c.gates?.[key]);
    if (gateValues.some(v => v === false)) return { name: c.name, status: 'rejected', reason: 'hard_gate_failed', failedGates: GATES.filter(g => c.gates?.[g] === false) };
    if (gateValues.some(v => v !== true)) return { name: c.name, status: 'insufficient_evidence', reason: 'unknown_hard_gate', missingGates: GATES.filter(g => c.gates?.[g] !== true) };
    if (!Array.isArray(c.evidence) || c.evidence.length === 0 || !c.evidence.every(ev => typeof ev === 'string' && ev.trim().length > 0)) return { name: c.name, status: 'insufficient_evidence', reason: 'missing_evidence' };
    if (!c.ratings || Object.keys(weights).some(k => !Number.isInteger(c.ratings[k]) || c.ratings[k] < 1 || c.ratings[k] > 5)) return { name: c.name, status: 'insufficient_evidence', reason: 'missing_ratings' };
    const score = Math.round(Object.entries(weights).reduce((sum, [k, weight]) => sum + (c.ratings[k] / 5) * weight, 0) * 100) / 100;
    return { name: c.name, status: 'eligible', score, evidence: c.evidence.slice(0, 8) };
  });
  const eligible = results.filter(r => r.status === 'eligible').sort((a,b) => b.score - a.score || a.name.localeCompare(b.name));
  const winner = eligible[0];
  // No automatic winner when a candidate hasn't been evaluated fully. Prevents cherry-picking.
  const incomplete = results.some(r => r.status === 'insufficient_evidence');
  const tie = eligible.length > 1 && Math.abs(eligible[0].score - eligible[1].score) <= 2;
  return {
    topic, profile, tier,
    status: incomplete ? 'research_required' : !winner ? 'no_eligible_candidate' : tie ? 'human_or_experiment_required' : 'recommended',
    recommended: (!incomplete && !tie) ? winner?.name || null : null,
    candidates: results,
    weights,
    caveat: 'Candidate ratings are supplied estimates, not independently verified facts. Evidence references require human/tool validation.'
  };
}

export function needsApproval(config, decision) {
  return config.autonomy.mode === 'approval' && config.autonomy.decisionApproval.includes(decision.tier);
}

export async function recordDecision(root, input) {
  const config = await readConfig(root);
  const result = evaluateDecision(input);
  const ready = result.status === 'recommended';
  const approval = ready && needsApproval(config, result);
  const record = { id: newId('DEC'), time: new Date().toISOString(), ...result, authorization: !ready ? 'blocked_on_research' : approval ? 'awaiting_approval' : 'in_scope_decision', selected: ready && !approval ? result.recommended : null };
  const decisions = await loadState(root, 'decisions', []);
  if (!Array.isArray(decisions)) throw new Error('Invalid decision store');
  decisions.push(record);
  await saveState(root, 'decisions', decisions);
  return record;
}

export async function listDecisions(root) {
  return loadState(root, 'decisions', []);
}

export async function resolveDecision(root, id, disposition, actor, selection = null, reason = null) {
  if (!['approved', 'rejected'].includes(disposition)) throw new Error('Invalid decision disposition');
  if (typeof actor !== 'string' || !actor.trim() || actor.length > 100) throw new Error('Actor label required');
  const records = await loadState(root, 'decisions', []);
  const record = records.find(item => item.id === id);
  if (!record) throw new Error('Decision not found');
  if (record.authorization !== 'awaiting_approval') throw new Error('Decision is not awaiting approval');
  const chosen = selection || record.recommended;
  if (disposition === 'approved' && !record.candidates.some(candidate => candidate.status === 'eligible' && candidate.name === chosen)) throw new Error('Selected candidate is not eligible');
  if (disposition === 'approved' && chosen !== record.recommended && (!reason || !reason.trim())) throw new Error('Override requires a reason');
  record.authorization = disposition === 'approved' ? 'approved' : 'rejected';
  record.selected = disposition === 'approved' ? chosen : null;
  record.resolvedAt = new Date().toISOString();
  record.actorLabel = actor;
  if (reason) record.resolutionReason = reason;
  await saveState(root, 'decisions', records);
  return record;
}
