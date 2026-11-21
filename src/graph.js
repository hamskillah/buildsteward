import { spawnSync } from 'node:child_process';
import { readConfig } from './config.js';

function present(binary) {
  const result = spawnSync(binary, ['--help'], { encoding: 'utf8', timeout: 2000, maxBuffer: 150_000 });
  return !result.error || result.error?.code !== 'ENOENT';
}
export async function graphStatus(root) {
  const config = await readConfig(root);
  const binary = config.memory.codeGraph.provider;
  const enabled = config.memory.codeGraph.mode !== 'off';
  return { mode: config.memory.codeGraph.mode, provider: binary, available: enabled ? present(binary) : null, active: enabled && present(binary), note: enabled ? 'Graph data is advisory; verify it against current source files.' : 'Code graph disabled; use file/git search.' };
}
export async function graphSearch(root, query, project) {
  const config = await readConfig(root);
  if (config.memory.codeGraph.mode === 'off') throw new Error('Graph is off. Enable via config set memory.codeGraph.mode on');
  if (typeof query !== 'string' || !query.trim() || query.length > 300) throw new Error('Query length must be 1..300');
  if (project !== undefined && (typeof project !== 'string' || project.length > 120)) throw new Error('Invalid project');
  // Current CBM CLI supports --name-pattern, --project and --format json.
  // Escape a user term as a literal regex to avoid accidental broad graph queries.
  const literalPattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const args = ['cli', 'search_graph', '--name-pattern', literalPattern, '--format', 'json'];
  if (project) args.push('--project', project);
  const result = spawnSync(config.memory.codeGraph.provider, args, { cwd: root, encoding: 'utf8', timeout: 8000, maxBuffer: 200_000 });
  if (result.error) throw new Error(`Graph query unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Graph query failed: ${(result.stderr || result.stdout).slice(0,500)}`);
  return { provider: config.memory.codeGraph.provider, output: result.stdout.slice(0, 8000), caveat: 'Verify snippets and graph relations in current repository source.' };
}
