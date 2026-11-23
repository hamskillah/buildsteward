import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { graphComposerLock } from '../src/composer-lock-graph.js';

const cli = fileURLToPath(new URL('../bin/buildsteward.js', import.meta.url));

test('CLI maps exact Composer edges and leaves ambiguous runtime dependencies unresolved', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-composer-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  assert.equal((await graphComposerLock(root)).status, 'lockfile_missing');
  const filename = path.join(root, 'composer.lock');
  await fs.writeFile(filename, '{"packages":[]}');
  assert.equal((await graphComposerLock(root)).reason, 'missing_package_lists');
  const lock = {
    packages: [
      { name: 'demo/root', version: '1.0.0', require: {
        'demo/transitive': '^2', 'ext-mbstring': '*', 'demo/virtual': '^1', 'demo/dev': '*', 'demo/missing': '*',
      } },
      { name: 'demo/transitive', version: 'v2.4.0', require: [] },
      { name: 'demo/other', version: '1.0.0', provide: { 'demo/virtual': '1.0.0' } },
    ],
    'packages-dev': [{ name: 'demo/dev', version: '1.2.0', require: { 'demo/transitive': '^2' } }],
  };
  await fs.writeFile(filename, JSON.stringify(lock));
  const { result } = JSON.parse(execFileSync(process.execPath, [cli, '--root', root, 'deps', 'graph', '--ecosystem', 'packagist']));
  assert.equal(result.ecosystem, 'packagist');
  assert.match(result.lockfileDigest, /^[a-f0-9]{64}$/);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.edges.map(edge => edge.status), [
    'resolved', 'platform_requirement', 'unresolved_provide_or_replace', 'dev_only_target', 'missing_target', 'resolved',
  ]);
  assert.equal(result.edges[0].package.version, 'v2.4.0');
  lock['packages-dev'].push({ name: 'Demo/Transitive', version: '2.0.0' });
  await fs.writeFile(filename, JSON.stringify(lock));
  const duplicate = await graphComposerLock(root);
  assert.equal(duplicate.counts.duplicateNames, 1);
  assert.equal(duplicate.edges[0].status, 'ambiguous_target');
});
