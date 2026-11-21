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
