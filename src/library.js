import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(here, '../knowledge/index.json');
const terms = (text) => (String(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
export async function listKnowledge() { return JSON.parse(await fs.readFile(indexPath,'utf8')); }
export async function searchKnowledge(query, limit = 5) {
  if (!query || typeof query !== 'string' || query.length > 500) throw new Error('Query required <=500 characters');
  const entries = await listKnowledge();
  const q = new Set(terms(query));
  return entries.map(e => {
    const title = new Set(terms(e.title));
    const tags = new Set(terms(e.tags.join(' ')));
    const summary = new Set(terms(e.summary));
    let score = 0;
    for (const t of q) score += (title.has(t) ? 5 : 0) + (tags.has(t) ? 3 : 0) + (summary.has(t) ? 1 : 0);
    return { id: e.id, title: e.title, summary: e.summary, tags: e.tags, score };
  }).filter(e => e.score > 0).sort((a,b) => b.score - a.score).slice(0, Math.min(limit, 10));
}
export async function readKnowledge(id, detail = false) {
  const index = await listKnowledge();
  const entry = index.find(e => e.id === id);
  if (!entry) throw new Error('Unknown knowledge id');
  if (!detail) return entry;
  const filename = path.resolve(here, '../knowledge/recipes', `${entry.id}.md`);
  return { ...entry, body: await fs.readFile(filename, 'utf8') };
}
