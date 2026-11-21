import fs from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_CONFIG = Object.freeze({
  schema: 1,
  autonomy: { mode: 'approval', decisionApproval: ['architectural', 'critical'] },
  developer: { workflow: 'adaptive', verifyResults: true },
  intelligence: { externalResearch: 'when_needed', cacheHours: 24 },
  memory: { codeGraph: { mode: 'off', provider: 'codebase-memory-mcp' } },
  efficiency: { output: 'compact', maxRepeatedNoProgress: 3 },
  execution: { approvalRequired: ['production_deploy', 'destructive_operation', 'external_spend', 'secret_access_escalation', 'mission_pivot'] }
});

export const stateDir = (root) => path.join(root, '.buildsteward');
export const configPath = (root) => path.join(stateDir(root), 'config.json');

export function validateConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema !== 1) throw new Error('Unsupported config schema');
  if (!['autonomous', 'approval'].includes(value.autonomy?.mode)) throw new Error('autonomy.mode must be autonomous or approval');
  if (!['off', 'auto', 'on'].includes(value.memory?.codeGraph?.mode)) throw new Error('memory.codeGraph.mode must be off, auto or on');
  if (!['when_needed', 'never'].includes(value.intelligence?.externalResearch)) throw new Error('Unsupported intelligence.externalResearch');
  if (!Number.isInteger(value.efficiency?.maxRepeatedNoProgress) || value.efficiency.maxRepeatedNoProgress < 1 || value.efficiency.maxRepeatedNoProgress > 20) throw new Error('maxRepeatedNoProgress must be 1..20');
  if (!Number.isFinite(value.intelligence?.cacheHours) || value.intelligence.cacheHours < 0 || value.intelligence.cacheHours > 168) throw new Error('cacheHours must be 0..168');
  if (!Array.isArray(value.execution?.approvalRequired) || !value.execution.approvalRequired.every(x => typeof x === 'string')) throw new Error('Invalid approvalRequired');
  if (!Array.isArray(value.autonomy?.decisionApproval) || !value.autonomy.decisionApproval.every(x => ['routine','comparative','architectural','critical'].includes(x))) throw new Error('Invalid decisionApproval');
  return value;
}

export async function readConfig(root) {
  let text;
  try { text = await fs.readFile(configPath(root), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') throw new Error('Project not initialized; run init first'); throw error; }
  return validateConfig(JSON.parse(text));
}

export async function safeWriteJson(filename, value, { exclusive = false } = {}) {
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const content = JSON.stringify(value, null, 2) + '\n';
  if (exclusive) { await fs.writeFile(filename, content, { flag: 'wx', mode: 0o600 }); return; }
  const tmp = `${filename}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  try { await fs.writeFile(tmp, content, { flag: 'wx', mode: 0o600 }); await fs.rename(tmp, filename); }
  finally { await fs.rm(tmp, { force: true }).catch(() => {}); }
}

export async function initialize(root, mode = 'approval') {
  if (!['autonomous', 'approval'].includes(mode)) throw new Error('Mode must be autonomous or approval');
  const config = structuredClone(DEFAULT_CONFIG);
  config.autonomy.mode = mode;
  await safeWriteJson(configPath(root), config, { exclusive: true });
  return { root, config: configPath(root), mode, existingFilesUntouched: true };
}

export async function setConfig(root, key, value) {
  const paths = {
    'autonomy.mode': ['autonomy','mode'],
    'memory.codeGraph.mode': ['memory','codeGraph','mode'],
    'intelligence.externalResearch': ['intelligence','externalResearch'],
    'efficiency.output': ['efficiency','output']
  };
  if (!paths[key]) throw new Error('Unsupported config key');
  const config = await readConfig(root);
  const parts = paths[key];
  let current = config;
  for (const p of parts.slice(0, -1)) current = current[p];
  current[parts.at(-1)] = value;
  validateConfig(config);
  await safeWriteJson(configPath(root), config);
  return { key, value };
}
