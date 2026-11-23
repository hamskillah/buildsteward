import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initialize } from '../src/config.js';
import { inspectProjectDependencies } from '../src/dependency-audit.js';
async function env(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'steward-deps-'));try{await initialize(root);return await fn(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
test('offline npm audit labels missing manifest and lockfile honestly',async()=>env(async root=>{
  assert.equal((await inspectProjectDependencies(root)).status,'no_npm_manifest');
  await fs.writeFile(path.join(root,'package.json'),JSON.stringify({dependencies:{react:'^19.0.0'}}));
  const result=await inspectProjectDependencies(root);
  assert.equal(result.status,'lockfile_missing');
  assert.equal(result.directCount,1);
}));
test('offline npm audit detects inconsistent direct dependency and preserves bounded previews',async()=>env(async root=>{
  await fs.writeFile(path.join(root,'package.json'),JSON.stringify({dependencies:{react:'^19.0.0'},devDependencies:{typescript:'~5.7.0'}}));
  await fs.writeFile(path.join(root,'package-lock.json'),JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:{react:'^19.0.0'},devDependencies:{typescript:'~5.7.0'}},'node_modules/react':{version:'19.0.2'}}}));
  const result=await inspectProjectDependencies(root);
  assert.equal(result.status,'inconsistent');
  assert.deepEqual(result.missing,['typescript']);
  assert.equal(result.directPreview.length,2);
  assert.ok(result.checksNotPerformed.includes('security advisory scanning'));
  const lock=JSON.parse(await fs.readFile(path.join(root,'package-lock.json'),'utf8'));
  lock.packages['node_modules/typescript']={version:'5.7.3'};
  await fs.writeFile(path.join(root,'package-lock.json'),JSON.stringify(lock));
  assert.equal((await inspectProjectDependencies(root)).status,'consistent_manifest');
  lock.packages[''].dependencies.react='^18';
  await fs.writeFile(path.join(root,'package-lock.json'),JSON.stringify(lock));
  assert.deepEqual((await inspectProjectDependencies(root)).mismatchedRanges,['react']);
}));

test('incomplete lockfiles cannot establish manifest consistency',async()=>env(async root=>{
  await fs.writeFile(path.join(root,'package.json'),JSON.stringify({dependencies:{react:'^19'}}));
  for (const lock of [
    {lockfileVersion:3},
    {lockfileVersion:3,packages:{'node_modules/react':{version:'19.0.0'}}},
    {lockfileVersion:1,dependencies:{react:{version:'19.0.0'}}}
  ]) {
    await fs.writeFile(path.join(root,'package-lock.json'),JSON.stringify(lock));
    assert.notEqual((await inspectProjectDependencies(root)).status,'consistent_manifest');
  }
}));

test('stale declarations present only in the lockfile are inconsistent', async () => env(async root => {
  await fs.writeFile(path.join(root, 'package.json'), '{}');
  await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify({
    lockfileVersion:3,
    packages:{'':{dependencies:{old:'1.0.0'}},'node_modules/old':{version:'1.0.0'}}
  }));
  const result = await inspectProjectDependencies(root);
  assert.equal(result.status, 'inconsistent');
  assert.deepEqual(result.mismatchedRanges, ['old']);
}));

test('v2 audit does not count a legacy dependency when its packages entry is missing', async () => env(async root => {
  const manifest = { dependencies: { sample: '1.2.3' } };
  const lock = {
    lockfileVersion: 2,
    packages: { '': manifest, 'node_modules/sample': { version: '1.2.3' } },
    dependencies: { sample: { version: '1.2.3' } },
  };
  const lockfile = path.join(root, 'package-lock.json');
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(manifest));
  await fs.writeFile(lockfile, JSON.stringify(lock));
  assert.equal((await inspectProjectDependencies(root)).status, 'consistent_manifest');

  delete lock.packages['node_modules/sample'];
  await fs.writeFile(lockfile, JSON.stringify(lock));
  const result = await inspectProjectDependencies(root);
  assert.equal(result.status, 'inconsistent');
  assert.equal(result.counts.lockedPackageEntries, 0);
  assert.deepEqual(result.missing, ['sample']);

  await fs.writeFile(lockfile, JSON.stringify({ lockfileVersion: 1, dependencies: lock.dependencies }));
  const legacy = await inspectProjectDependencies(root);
  assert.equal(legacy.status, 'unverified_manifest');
  assert.equal(legacy.directPreview[0].lockedVersion, '1.2.3');
}));

test('workspace links report the version of the recorded lockfile target', async () => env(async root => {
  const manifest = { workspaces: ['local'], dependencies: { 'local-pack': 'file:./local' } };
  const lock = {
    lockfileVersion: 3,
    packages: {
      '': manifest,
      'node_modules/local-pack': { resolved: 'local', link: true },
      local: { name: 'local-pack', version: '1.2.3' },
    },
  };
  const lockfile = path.join(root, 'package-lock.json');
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(manifest));
  await fs.writeFile(lockfile, JSON.stringify(lock));
  const result = await inspectProjectDependencies(root);
  assert.equal(result.status, 'consistent_manifest');
  assert.equal(result.directPreview[0].lockedVersion, '1.2.3');

  delete lock.packages.local;
  await fs.writeFile(lockfile, JSON.stringify(lock));
  const dangling = await inspectProjectDependencies(root);
  assert.equal(dangling.status, 'inconsistent');
  assert.deepEqual(dangling.missing, ['local-pack']);
}));
