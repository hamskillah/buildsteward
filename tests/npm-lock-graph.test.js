import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { graphNpmLock } from '../src/npm-lock-graph.js';

async function fixture(t, packages, version = 3) {
  const root = await mkdtemp(path.join(tmpdir(), 'steward-dep-graph-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: version, packages }));
  return root;
}

test('npm graph retains nested versions and resolves scoped, hoisted, peer, dev, and alias dependencies', async t => {
  const root = await fixture(t, {
    '': { dependencies: { app: '^1', 'core-alias': 'npm:@test/core@^2' }, devDependencies: { test: '*' } },
    'node_modules/app': { version: '1.1.0', dependencies: { shared: '2', '@one/hoisted': '*' }, peerDependencies: { runtime: '1' } },
    'node_modules/app/node_modules/shared': { version: '2.0.0', dependencies: { '@one/hoisted': '*' } },
    'node_modules/app/node_modules/runtime': { version: '9.0.0' },
    'node_modules/runtime': { version: '1.0.0' },
    'node_modules/shared': { version: '1.0.0' },
    'node_modules/@one/hoisted': { version: '3.0.0', dependencies: { shared: '1' } },
    'node_modules/core-alias': { name: '@test/core', version: '2.2.0' },
    'node_modules/test': { version: '4.0.0' },
  });
  const raw = execFileSync(process.execPath, ['bin/buildsteward.js', '--root', root, 'deps', 'graph'], { encoding: 'utf8' });
  const { result: report } = JSON.parse(raw);
  assert.equal(report.status, 'mapped');
  assert.equal(report.counts.resolved, 8);
  assert.match(report.lockfileDigest, /^[\da-f]{64}$/);
  assert.deepEqual(report.edges.find(edge => edge.name === 'core-alias').package, { name: '@test/core', version: '2.2.0' });
  assert.deepEqual(report.edges.filter(edge => edge.name === 'shared').map(edge => [edge.to, edge.package.version]), [
    ['node_modules/app/node_modules/shared', '2.0.0'],
    ['node_modules/shared', '1.0.0'],
  ]);
  assert.equal(report.edges.find(edge => edge.kind === 'peerDependencies').to, 'node_modules/runtime');
});

test('npm graph separates optional absences from malformed, missing, and unsupported edges', async t => {
  const root = await fixture(t, {
    '': {
      dependencies: { local: '*', archive: 'https://example.org/custom.tgz', missing: '^2', optional: '^1', invalid: 3 },
      optionalDependencies: { optional: '^2' },
      peerDependencies: { plugin: '*' },
      peerDependenciesMeta: { plugin: { optional: true } },
    },
    'node_modules/local': { link: true, resolved: 'packages/local' },
    'packages/local': { version: '1.0.0' },
    'node_modules/archive': { version: '1.0.0', resolved: 'https://example.org/custom.tgz' },
  }, 2);
  const report = await graphNpmLock(root);
  assert.equal(report.status, 'partial');
  assert.deepEqual(Object.fromEntries(report.edges.map(edge => [edge.name, edge.status])), {
    local: 'unresolved_link', archive: 'unsupported_source', missing: 'missing_target', invalid: 'invalid_declaration',
    optional: 'optional_missing', plugin: 'optional_missing',
  });
  assert.equal(report.counts.optionalMissing, 2);
});

test('npm graph counts edges beyond the preview and rejects unsupported schemas', async t => {
  const declarations = Object.fromEntries(Array.from({ length: 101 }, (_, index) => ['pkg-' + index, '^1']));
  const root = await fixture(t, { '': { dependencies: declarations } });
  const report = await graphNpmLock(root);
  assert.equal(report.edges.length, 100);
  assert.equal(report.counts.unresolved, 101);
  assert.equal(report.truncated, true);
  assert.equal((await graphNpmLock(await fixture(t, { '': {} }, 1))).status, 'unsupported_lockfile_version');
});
