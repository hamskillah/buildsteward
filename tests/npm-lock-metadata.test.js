import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initialize, setConfig } from '../src/config.js';
import { metadataForNpmLock } from '../src/npm-lock-metadata.js';

const name = '@sample/pkg';
const version = '2.1.0';
const query = { name, version, online: true };

async function fixture(t, resolved = 'https://registry.npmjs.org/@sample/pkg/-/pkg-2.1.0.tgz') {
  const root = await mkdtemp(path.join(tmpdir(), 'steward-npm-metadata-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initialize(root);
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {
    '': { dependencies: { alias: 'npm:@sample/pkg@^2' } },
    'node_modules/alias': { name, version, resolved },
  } }));
  return root;
}

test('exact public metadata separates declared license, engine, platform, and deprecation from cache provenance', async t => {
  const root = await fixture(t);
  const data = { name, version, license: '(MIT OR Apache-2.0)', engines: { node: '>=20', npm: '>=9' },
    os: ['linux', '!win32'], cpu: ['x64'], libc: ['glibc'], deprecated: 'replace', readme: 'excluded' };
  const report = await metadataForNpmLock(root, query, { fetcher: async url => {
    assert.equal(url, 'https://registry.npmjs.org/%40sample%2Fpkg/2.1.0');
    return Response.json(data);
  } });
  assert.equal(report.status, 'publisher_metadata_collected');
  assert.equal(report.source.status, 'live');
  assert.deepEqual(report.metadata, { name, version, license: data.license, engines: data.engines,
    platform: { os: data.os, cpu: data.cpu, libc: data.libc }, deprecated: true });
  await setConfig(root, 'intelligence.externalResearch', 'never');
  const cached = await metadataForNpmLock(root, query, { fetcher: () => assert.fail('unexpected online call') });
  assert.equal(cached.source.status, 'cached');
  assert.deepEqual(cached.metadata, report.metadata);
});

test('metadata omits private tarballs and distinguishes missing declarations from wrong identity', async t => {
  const privateRoot = await fixture(t, 'https://private.invalid/pkg-2.1.0.tgz');
  const denied = await metadataForNpmLock(privateRoot, query, { fetcher: () => assert.fail('private query') });
  assert.equal(denied.status, 'unverified_registry_origin');
  const root = await fixture(t);
  const missing = await metadataForNpmLock(root, { ...query, version: 'latest' }, { fetcher: () => assert.fail('tag query') });
  assert.equal(missing.status, 'not_in_resolved_graph');
  const offline = await metadataForNpmLock(root, { name, version }, { fetcher: () => assert.fail('implicit network access') });
  assert.equal(offline.source.status, 'unavailable_offline');
  const mismatch = await metadataForNpmLock(root, query, { fetcher: async () => Response.json({ name, version: '3.0.0' }) });
  assert.equal(mismatch.status, 'unavailable');
  const incomplete = await metadataForNpmLock(root, query, { fetcher: async () => Response.json({
    name, version, license: { type: 'MIT' }, os: ['linux', 42],
  }) });
  assert.equal(incomplete.status, 'partial_evidence');
  assert.equal(incomplete.metadata.license, null);
  assert.equal(incomplete.metadata.platform.os, null);
});

test('optional checks compare exact licenses and host platform without assuming missing evidence passes', async t => {
  const root = await fixture(t);
  const host = { platform: 'linux', arch: 'arm64' };
  const report = await metadataForNpmLock(root, {
    ...query, allowLicense: 'MIT, Apache-2.0', checkPlatform: true,
  }, { host, fetcher: async () => Response.json({ name, version, license: 'MIT OR Apache-2.0',
    os: ['!win32'], cpu: ['any', '!arm64'], libc: ['glibc'] }) });
  assert.deepEqual(report.assessment, { license: 'not_allowlisted',
    host: { os: 'linux', cpu: 'arm64', osMatch: 'matches', cpuMatch: 'excluded', libc: 'not_evaluated' } });
  const mixedRule = await metadataForNpmLock(root, { ...query, online: false, checkPlatform: true },
    { host: { platform: 'linux', arch: 'x64' } });
  assert.equal(mixedRule.assessment.host.cpuMatch, 'excluded');
  const unverified = await metadataForNpmLock(root, {
    name, version: '9.9.9', allowLicense: 'MIT', checkPlatform: true,
  }, { host });
  assert.equal(unverified.assessment.license, 'unknown');
  assert.equal(unverified.assessment.host.osMatch, 'unknown');
  await assert.rejects(metadataForNpmLock(root, { ...query, allowLicense: 'MIT,' }), /Allowlist/);
});
