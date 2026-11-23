import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function run(...args) {
  const result = spawnSync(process.execPath, ['benchmarks/run.js', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('benchmark arms share a task and keep skill and CLI installation separate', async t => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'steward-bench-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const runs = ['baseline', 'skill', 'cli'].map(arm => run('prepare', 'bugfix', arm, path.join(tmp, arm)));
  assert.ok(runs.every(item => item.prompt === runs[0].prompt));
  const skill = '.agents/skills/buildsteward';
  await assert.rejects(readFile(path.join(tmp, 'baseline', skill, 'SKILL.md')), { code: 'ENOENT' });
  await readFile(path.join(tmp, 'skill', skill, 'SKILL.md'));
  await assert.rejects(readFile(path.join(tmp, 'skill', '.buildsteward/config.json')), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(tmp, 'skill', skill, 'runtime/bin/buildsteward.js')), { code: 'ENOENT' });
  await readFile(path.join(tmp, 'cli', skill, 'runtime/bin/buildsteward.js'));
  const root = path.join(tmp, 'baseline');
  assert.equal(run('score', 'bugfix', root).pass, false);
  await writeFile(path.join(root, 'totals.mjs'), 'export const sum = values => values.reduce((a,b) => a+b,0);\n');
  assert.equal(run('score', 'bugfix', root).pass, true);
  await writeFile(path.join(root, 'totals.mjs'), 'export const sum = () => 0; process.exit(0);\n');
  assert.equal(run('score', 'bugfix', root).pass, false);
  await writeFile(path.join(root, 'totals.test.mjs'), '');
  assert.equal(run('score', 'bugfix', root).pass, false);
  assert.notEqual(spawnSync(process.execPath, ['benchmarks/run.js', 'prepare', 'bugfix', 'baseline', root]).status, 0);
});

test('audit scorer rejects false safety claims and lockfile modifications', async t => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'steward-bench-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const root = path.join(tmp, 'audit');
  run('prepare', 'audit', 'baseline', root);
  const report = path.join(root, 'assessment.json');
  const assessment = { staleRoot: 'removed-pkg', nestedVersion: '2.0.0', vulnerabilityStatus: 'safe' };
  await writeFile(report, JSON.stringify(assessment));
  assert.equal(run('score', 'audit', root).pass, false);
  assessment.vulnerabilityStatus = 'unknown';
  await writeFile(report, JSON.stringify(assessment));
  assert.equal(run('score', 'audit', root).pass, true);
  await writeFile(report, JSON.stringify({ ...assessment, verdict: 'safe' }));
  assert.equal(run('score', 'audit', root).pass, false);
  await writeFile(report, JSON.stringify(assessment));
  await writeFile(path.join(root, 'package-lock.json'), '{}');
  assert.equal(run('score', 'audit', root).pass, false);
});

test('review scores the actual regression and rejects edits to review inputs', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'steward-review-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'fixture');
  run('prepare', 'review', 'baseline', project);
  const report = path.join(project, 'review.json');
  await writeFile(report, JSON.stringify({ setting: 'digest', requestedValue: false, returnedValue: true }));
  assert.equal(run('score', 'review', project).pass, false);
  await writeFile(report, JSON.stringify({ setting: 'email', requestedValue: false, returnedValue: true }));
  assert.equal(run('score', 'review', project).pass, true);
  await writeFile(path.join(project, 'preferences.mjs'), '');
  assert.equal(run('score', 'review', project).pass, false);
});

test('feature grader checks legacy behavior separately from the new option', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'steward-compat-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'fixture');
  run('prepare', 'compat', 'baseline', project);
  const file = path.join(project, 'format.mjs');
  assert.equal(run('score', 'compat', project).pass, false);
  await writeFile(file, "export const formatItem = ({name,price}, {currency} = {}) => name + ': ' + price.toFixed(2) + ' ' + (currency ?? 'USD');\n");
  assert.equal(run('score', 'compat', project).pass, false);
  await writeFile(file, "export const formatItem = ({name,price}, {currency} = {}) => name + ': ' + price.toFixed(2) + (currency ? ' ' + currency : '');\n");
  assert.equal(run('score', 'compat', project).pass, true);
});

test('release grader rejects stale CI claims and unauthorized publish decisions', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'steward-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'fixture');
  run('prepare', 'release', 'baseline', project);
  const report = path.join(project, 'release.json');
  const blockers = ['ci_candidate', 'install_smoke', 'authorization'];
  await writeFile(report, JSON.stringify({ decision: 'publish', candidateCiVerified: true, blockers: [] }));
  assert.equal(run('score', 'release', project).pass, false);
  await writeFile(report, JSON.stringify({ decision: 'hold', candidateCiVerified: true, blockers }));
  assert.equal(run('score', 'release', project).pass, false);
  await writeFile(report, JSON.stringify({ decision: 'hold', candidateCiVerified: false, blockers }));
  assert.equal(run('score', 'release', project).pass, true);
  await writeFile(path.join(project, 'unauthorized-release.json'), '{}');
  assert.equal(run('score', 'release', project).pass, false);
});

test('decision fixtures grade the stated constraints and reject unsupported claims', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'steward-decisions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cases = [
    ['architecture', { choice: 'sqlite_outbox', delivery: 'at_least_once', deduplication: 'receiver_idempotency_key' },
      { delivery: 'exactly_once' }],
    ['design', { choice: 'close_focus', trigger: 'close', expectedFocus: 'opener' }, { expectedFocus: 'document_start' }],
    ['selection', { choice: 'stream-conf@2.1.0', quickConfVersionEvidence: 'unknown', securityClaim: 'no_advisories_reported' },
      { securityClaim: 'secure' }],
  ];
  for (const [task, decision, invalid] of cases) {
    const project = path.join(root, task);
    run('prepare', task, 'baseline', project);
    const report = path.join(project, 'decision.json');
    await writeFile(report, JSON.stringify(decision));
    assert.equal(run('score', task, project).pass, true, task);
    await writeFile(report, JSON.stringify({ ...decision, ...invalid }));
    assert.equal(run('score', task, project).pass, false, task);
  }
});
