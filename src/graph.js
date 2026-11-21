import { spawnSync } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { readConfig } from './config.js';

function execute(spawn, binary, args, cwd, timeout) {
  return spawn(binary, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 200_000, shell: false });
}

function queryProvider(spawn, binary, tool, parameters, root) {
  const result = execute(spawn, binary, ['cli', tool, JSON.stringify(parameters)], root, 8000);
  if (result.error) throw new Error(`Graph query unavailable: ${result.error.code ?? result.error.message}`);
  if (result.status !== 0) throw new Error(`Graph query failed: ${(result.stderr || result.stdout || '').slice(0, 500)}`);
  return result.stdout;
}

export async function graphStatus(root, { spawn = spawnSync } = {}) {
  const config = await readConfig(root);
  const { mode, provider } = config.memory.codeGraph;
  if (mode === 'off') return { mode, provider, available: null, active: false, note: 'Code graph disabled; use file/git search.' };
  const version = execute(spawn, provider, ['--help'], root, 2000);
  const available = !version.error && version.status === 0;
  if (!available) return { mode, provider, available, active: false, note: 'Graph provider is unavailable; use file/git search.' };
  try {
    const projects = JSON.parse(queryProvider(spawn, provider, 'list_projects', { limit: 1, format: 'json' }, root));
    if (!Array.isArray(projects?.projects)) throw new Error('Graph provider returned an invalid project list');
    return { mode, provider, available, active: true, note: 'The provider responded; verify graph results against current source files.' };
  } catch (error) {
    return { mode, provider, available, active: false, note: error.message };
  }
}

function validProject(project) {
  return typeof project === 'string' && project.length > 0 && project.length <= 120 && !/[\x00-\x1f\x7f]/.test(project);
}

async function selectProject(spawn, binary, root) {
  let list;
  try {
    list = JSON.parse(queryProvider(spawn, binary, 'list_projects', { limit: 100, format: 'json' }, root));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Graph provider returned an invalid project list');
    throw error;
  }
  if (!Array.isArray(list?.projects) || list.projects.length > 100) throw new Error('Graph provider returned an invalid project list');
  if (list.has_more !== false) throw new Error('Graph project list is incomplete; provide --project explicitly');
  const canonicalRoot = await realpath(root);
  const names = new Set();
  for (const entry of list.projects) {
    if (!validProject(entry?.name) || typeof entry.root_path !== 'string' || !isAbsolute(entry.root_path)) continue;
    const canonicalProject = await realpath(entry.root_path).catch(() => null);
    if (canonicalProject === canonicalRoot) names.add(entry.name);
  }
  if (names.size !== 1) throw new Error('Expected one indexed graph project for this root; index it or provide --project explicitly');
  return [...names][0];
}

export async function graphSearch(root, query, project, { spawn = spawnSync } = {}) {
  const config = await readConfig(root);
  if (config.memory.codeGraph.mode === 'off') throw new Error('Graph is off. Enable via config set memory.codeGraph.mode on');
  if (typeof query !== 'string' || !query.trim() || query.length > 300) throw new Error('Query length must be 1..300');
  if (project !== undefined && !validProject(project)) throw new Error('Invalid project');
  const { provider } = config.memory.codeGraph;
  const selected = project ?? await selectProject(spawn, provider, root);
  const namePattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const output = queryProvider(spawn, provider, 'search_graph', {
    project: selected, name_pattern: namePattern, format: 'json', limit: 12, max_output_tokens: 1200,
  }, root);
  return { provider, project: selected, output: output.slice(0, 8000), truncated: output.length > 8000,
    caveat: 'Verify snippets and graph relations in current repository source.' };
}
