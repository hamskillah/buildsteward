import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const MARKERS = ['package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','pyproject.toml','requirements.txt','Cargo.toml','go.mod','pom.xml','Dockerfile','docker-compose.yml','compose.yaml','.github/workflows','README.md'];
export async function inspectProject(root) {
  const found = [];
  for (const marker of MARKERS) {
    try { await fs.access(path.join(root, marker)); found.push(marker); }
    catch { /* absent */ }
  }
  const stack = [found.includes('package.json') && 'node', found.includes('go.mod') && 'go', found.includes('Cargo.toml') && 'rust', found.includes('pyproject.toml') && 'python', found.includes('pom.xml') && 'java'].filter(Boolean);
  let packageName = null;
  if (found.includes('package.json')) {
    try { const pkg = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')); packageName = pkg.name || null; }
    catch { /* malformed or missing metadata does not block inspection */ }
  }
  const git = spawnSync('git', ['status', '--short', '--untracked-files=no'], { cwd: root, encoding: 'utf8', timeout: 2500, maxBuffer: 100_000 });
  return {
    root,
    stack, packageName, markers: found,
    git: git.status === 0 ? { cleanTrackedFiles: git.stdout.trim() === '', modifiedPreview: git.stdout.trim().split('\n').filter(Boolean).slice(0, 10) } : { status: 'unavailable' },
    instruction: 'Inspect task-relevant files; do not infer complete architecture from markers alone.'
  };
}
