import { spawnSync } from 'node:child_process';
import { copyFile, cp, lstat, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const guidance = 'Use any installed project workflow or tools that help. Stay in this project. Do not install anything or use network tools.';
const tasks = {
  bugfix: {
    files: ['totals.mjs', 'totals.test.mjs'],
    mutable: 'totals.mjs',
    prompt: 'Fix sum([]) to return 0 while preserving non-empty sums. Change only totals.mjs. Reproduce the failure and rerun node --test after the fix. Report what passed.',
  },
  audit: {
    files: ['package.json', 'package-lock.json'],
    mutable: 'assessment.json',
    prompt: 'Review the npm manifest and lockfile offline. Write only assessment.json with three string fields: staleRoot (stale root dependency name), nestedVersion (recorded version of nested-pkg), and vulnerabilityStatus (safe, vulnerable, or unknown based on the available evidence). Explain any limits in your response.',
  },
};
const arms = new Set(['baseline', 'skill', 'cli']);

async function regularFile(file, max) {
  const info = await lstat(file).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!info?.isFile() || info.size > max) return null;
  return readFile(file);
}

async function prepare(taskId, arm, directory) {
  if (!arms.has(arm)) throw new Error('Expected baseline, skill, or cli.');
  const task = tasks[taskId];
  await mkdir(directory, { mode: 0o700 });
  for (const file of task.files) {
    await copyFile(path.join(import.meta.dirname, 'fixtures', taskId, file), path.join(directory, file));
  }
  if (arm === 'skill') {
    for (const location of ['.agents', '.claude']) {
      const skills = path.join(directory, location, 'skills');
      await mkdir(skills, { recursive: true });
      await cp(path.join(root, 'skills/buildsteward'), path.join(skills, 'buildsteward'), { recursive: true });
    }
  }
  if (arm === 'cli') {
    const install = spawnSync(process.execPath, [
      path.join(root, 'bin/buildsteward.js'), '--root', directory, 'setup',
      '--agents', 'codex,opencode,claude', '--yes',
    ], { encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024 });
    if (install.status !== 0) throw new Error(install.error?.message || install.stderr || 'Skill setup failed.');
  }
  return { task: taskId, arm, directory, prompt: task.prompt + ' ' + guidance };
}

async function score(taskId, directory) {
  const task = tasks[taskId];
  const allowed = new Set([...task.files, task.mutable, '.agents', '.claude', '.buildsteward', '.git']);
  const unexpectedEntries = (await readdir(directory)).filter(name => !allowed.has(name)).sort();
  const protectedFilesIntact = (await Promise.all(task.files.filter(file => file !== task.mutable).map(async file => {
    const original = await readFile(path.join(import.meta.dirname, 'fixtures', taskId, file));
    const actual = await regularFile(path.join(directory, file), 64 * 1024);
    return !!actual?.equals(original);
  }))).every(Boolean);
  const output = await regularFile(path.join(directory, task.mutable), 64 * 1024);
  if (!protectedFilesIntact || !output || unexpectedEntries.length) {
    return { task: taskId, pass: false, protectedFilesIntact, unexpectedEntries, evaluated: false };
  }
  if (taskId === 'bugfix') {
    const test = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'totals.test.mjs'], {
      cwd: directory, timeout: 10_000, encoding: 'utf8', maxBuffer: 64 * 1024,
      env: { PATH: process.env.PATH || '' },
    });
    const summary = test.stdout || '';
    const ranBothTests = /^# tests 2$/m.test(summary) && /^# pass 2$/m.test(summary) && /^# fail 0$/m.test(summary);
    return { task: taskId, pass: !test.error && test.status === 0 && ranBothTests, protectedFilesIntact, testExit: test.status, ranBothTests };
  }
  let assessment;
  try { assessment = JSON.parse(output.toString('utf8')); }
  catch { return { task: taskId, pass: false, protectedFilesIntact, reportValid: false }; }
  if (!assessment || Array.isArray(assessment) || typeof assessment !== 'object' ||
      Object.keys(assessment).length !== 3) {
    return { task: taskId, pass: false, protectedFilesIntact, reportValid: false };
  }
  const findings = {
    staleRoot: assessment?.staleRoot === 'removed-pkg',
    nestedVersion: assessment?.nestedVersion === '2.0.0',
    vulnerabilityStatus: assessment?.vulnerabilityStatus === 'unknown',
  };
  return { task: taskId, pass: Object.values(findings).every(Boolean), protectedFilesIntact, findings };
}

try {
  const [command, task, ...args] = process.argv.slice(2);
  if (!Object.hasOwn(tasks, task) || !((command === 'prepare' && args.length === 2) ||
      (command === 'score' && args.length === 1))) {
    throw new Error('Usage: run.js prepare <bugfix|audit> <baseline|skill|cli> <new-dir> or run.js score <bugfix|audit> <dir>');
  }
  const directory = path.resolve(args.at(-1));
  const result = command === 'prepare' ? await prepare(task, args[0], directory) : await score(task, directory);
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
