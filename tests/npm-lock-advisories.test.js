import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initialize, setConfig } from '../src/config.js';
import { advisoriesForNpmLock } from '../src/npm-lock-advisories.js';

const publicPackage = (name, version, declarations = {}) => ({
  version, resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`, ...declarations,
});
const rejectFetch = () => assert.fail('unexpected fetch');

async function fixture(t, packages) {
  const root = await mkdtemp(path.join(tmpdir(), 'steward-osv-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initialize(root);
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages }));
  return root;
}

test('OSV queries exact direct and nested npm versions without sending private dependency names', async t => {
  const root = await fixture(t, {
    '': { dependencies: { layer: '^2', shared: '^2', private: '^1' } },
    'node_modules/layer': publicPackage('layer', '2.0.0', { dependencies: { shared: '^1' } }),
    'node_modules/layer/node_modules/shared': publicPackage('shared', '1.0.0'),
    'node_modules/shared': publicPackage('shared', '2.0.0'),
    'node_modules/private': { version: '1.0.0', resolved: 'https://private.invalid/private-1.0.0.tgz' },
  });
  const empty = await advisoriesForNpmLock(root, {}, { fetcher: rejectFetch });
  assert.equal(empty.source.status, 'unavailable_offline');
  assert.ok(empty.packages.every(pkg => pkg.status === 'unknown'));
  const report = await advisoriesForNpmLock(root, { online: true }, { fetcher: async (url, request) => {
    assert.equal(url, 'https://api.osv.dev/v1/querybatch');
    assert.equal(request.method, 'POST');
    const payload = JSON.parse(request.body);
    assert.deepEqual(payload.queries.map(query => [query.package.ecosystem, query.package.name, query.version]), [
      ['npm', 'layer', '2.0.0'], ['npm', 'shared', '1.0.0'], ['npm', 'shared', '2.0.0'],
    ]);
    return Response.json({ results: [{}, { vulns: [{ id: 'OSV-TEST-1' }] }, {}] });
  } });
  assert.equal(report.status, 'partial_evidence');
  assert.equal(report.counts.skippedRegistryEdges, 1);
  assert.deepEqual(report.packages[1].advisoryIds, ['OSV-TEST-1']);
  assert.equal(report.packages[2].status, 'no_advisories_reported');
  await setConfig(root, 'intelligence.externalResearch', 'never');
  const cached = await advisoriesForNpmLock(root, { online: true }, { fetcher: rejectFetch });
  assert.equal(cached.source.status, 'cached');
  assert.deepEqual(cached.packages, report.packages);
});

test('OSV rejects mismatched, malformed and rate-limited evidence and never clears paginated findings', async t => {
  const root = await fixture(t, {
    '': { dependencies: { item: '^1' } }, 'node_modules/item': publicPackage('item', '1.0.0'),
  });
  for (const response of [
    Response.json({ results: [] }),
    Response.json({ results: [{ error: 'unknown' }] }),
    Response.json({}, { status: 429 }),
  ]) {
    const report = await advisoriesForNpmLock(root, { online: true }, { fetcher: async () => response });
    assert.equal(report.source.status, 'unavailable');
    assert.equal(report.packages[0].status, 'unknown');
  }
  const report = await advisoriesForNpmLock(root, { online: true }, { fetcher: async () => Response.json({
    results: [{ next_page_token: 'cursor', vulns: [{ id: 'OSV-TEST-2' }] }],
  }) });
  assert.equal(report.status, 'partial_evidence');
  assert.equal(report.packages[0].status, 'partial');
  assert.deepEqual(report.packages[0].advisoryIds, ['OSV-TEST-2']);
});

test('OSV counts the whole graph and caps one request and the response preview at 100 identities', async t => {
  const names = Array.from({ length: 102 }, (_, i) => 'package-' + i);
  const packages = {
    '': { dependencies: Object.fromEntries(names.map(name => [name, '1'])) },
    ...Object.fromEntries(names.map(name => ['node_modules/' + name, publicPackage(name, '1.0.0')])),
  };
  const root = await fixture(t, packages);
  const result = await advisoriesForNpmLock(root, { online: true }, { fetcher: async (_url, request) => {
    const queries = JSON.parse(request.body).queries;
    assert.equal(queries.length, 100);
    return Response.json({ results: queries.map(() => ({})) });
  } });
  assert.equal(result.counts.eligibleIdentities, 102);
  assert.equal(result.counts.checkedIdentities, 100);
  assert.equal(result.status, 'partial_evidence');
});
