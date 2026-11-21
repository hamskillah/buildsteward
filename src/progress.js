import { createHash } from 'node:crypto';
import { readConfig } from './config.js';
import { loadState, saveState } from './state.js';
export async function recordProgress(root, { action, outcome, evidence = '' }) {
  if (typeof action !== 'string' || !action.trim() || action.length > 500) throw new Error('action required');
  if (!['progress', 'no_progress', 'blocked'].includes(outcome)) throw new Error('outcome must be progress/no_progress/blocked');
  if (typeof evidence !== 'string' || evidence.length > 2000) throw new Error('evidence must be <=2000 characters');
  const config = await readConfig(root);
  const state = await loadState(root, 'progress', { recent: [], stalled: false });
  const fingerprint = createHash('sha256').update(action.toLowerCase().trim() + '\n' + evidence.trim()).digest('hex').slice(0,16);
  const entry = { at: new Date().toISOString(), action, outcome, evidence, fingerprint };
  state.recent = [...state.recent.slice(-19), entry];
  let repeat = 0;
  for (const item of [...state.recent].reverse()) {
    if (item.outcome === 'progress' || item.fingerprint !== fingerprint || item.outcome !== 'no_progress') break;
    repeat++;
  }
  state.stalled = repeat >= config.efficiency.maxRepeatedNoProgress;
  state.recommendation = state.stalled ? 'STOP repeating. Inspect root cause, new evidence, or report blocker.' : 'Continue with verified next step.';
  await saveState(root, 'progress', state);
  return { stalled: state.stalled, repeatedWithoutProgress: repeat, recommendation: state.recommendation };
}
