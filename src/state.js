import fs from 'node:fs/promises';
import path from 'node:path';
import { stateDir, safeWriteJson } from './config.js';

export function storagePath(root, name) {
  const allowed = new Set(['decisions', 'approvals', 'checkpoint', 'progress', 'work']);
  if (!allowed.has(name)) throw new Error('Unknown state collection');
  return path.join(stateDir(root), `${name}.json`);
}

export async function loadState(root, name, fallback) {
  try { return JSON.parse(await fs.readFile(storagePath(root, name), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return structuredClone(fallback); throw error; }
}

export async function saveState(root, name, value) {
  await safeWriteJson(storagePath(root, name), value);
}

export function newId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}
