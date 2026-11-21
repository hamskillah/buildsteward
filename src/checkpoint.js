import { readConfig } from './config.js';
import { loadState, saveState } from './state.js';

export async function setCheckpoint(root, input) {
  await readConfig(root);
  const allowed = ['goal','completed','next','blockers','changedFiles','verification'];
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Checkpoint object required');
  for (const key of Object.keys(input)) if (!allowed.includes(key)) throw new Error('Unexpected checkpoint field: '+key);
  for (const name of ['goal','next']) if (typeof input[name] !== 'string' || !input[name].trim() || input[name].length > 1000) throw new Error(name + ' must be nonempty text <=1000');
  for (const name of ['completed','blockers','changedFiles','verification']) if (!Array.isArray(input[name]) || input[name].length > 50 || input[name].some(s => typeof s !== 'string' || s.length > 500)) throw new Error(name + ' must be short string array');
  const state = { ...input, savedAt: new Date().toISOString() };
  await saveState(root, 'checkpoint', state);
  return state;
}
export async function getCheckpoint(root) { await readConfig(root); return loadState(root, 'checkpoint', { status: 'missing', note: 'No project checkpoint yet' }); }
