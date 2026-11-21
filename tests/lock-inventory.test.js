import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inventoryNpmLock } from '../src/npm-lock-inventory.js';

async function project(lock, fn) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'steward-lock-'));
  try { if(lock!==undefined) await fs.writeFile(path.join(dir,'package-lock.json'), JSON.stringify(lock)); await fn(dir); }
  finally {await fs.rm(dir,{recursive:true,force:true});}
}

test('inventory retains nested versions, scopes, aliases, and conditional flags without claiming security',async()=>{
  const lock={lockfileVersion:3,packages:{'':{},
    'node_modules/foo':{version:'1.0.0'},
    'node_modules/foo/node_modules/foo':{version:'2.0.0',optional:true,os:['linux']},
    'node_modules/@scope/tool':{name:'@other/real',version:'3.0.0',dev:true},
    'node_modules/workspace':{resolved:'packages/workspace',link:true},
    'packages/workspace':{version:'1.0.0'}
  }};
  await project(lock,async dir=>{
    const result=await inventoryNpmLock(dir);
    assert.equal(result.status,'partial');
    assert.equal(result.counts.entries,4);
    assert.equal(result.entries.find(x=>x.path==='node_modules/foo/node_modules/foo').version,'2.0.0');
    assert.deepEqual(result.entries.find(x=>x.path==='node_modules/foo/node_modules/foo').os,['linux']);
    assert.equal(result.entries.find(x=>x.path==='node_modules/@scope/tool').name,'@other/real');
    assert.equal(result.entries.find(x=>x.path==='node_modules/workspace').status,'unresolved_link');
    assert.ok(result.checksNotPerformed.includes('vulnerability scanning'));
  });
});

test('inventory refuses missing, unsupported, and malformed lockfiles',async()=>{
  await project(undefined,async dir=>assert.equal((await inventoryNpmLock(dir)).status,'lockfile_missing'));
  await project({lockfileVersion:1,dependencies:{}},async dir=>assert.equal((await inventoryNpmLock(dir)).status,'unsupported_lockfile_version'));
  for(const lock of [{lockfileVersion:3},{lockfileVersion:3,packages:[]},{lockfileVersion:3,packages:{'node_modules/x':{version:'1'}}}])
    await project(lock,async dir=>assert.equal((await inventoryNpmLock(dir)).status,'invalid_lockfile'));
});

test('inventory bounds output and marks unresolved entries rather than inferring versions',async()=>{
  const packages={'':{}};
  for(let i=0;i<130;i++) packages[`node_modules/pkg${i}`]={version:'1.0.0'};
  packages['node_modules/missing']={};
  await project({lockfileVersion:3,packages},async dir=>{
    const result=await inventoryNpmLock(dir);
    assert.equal(result.counts.entries,131);
    assert.equal(result.counts.unresolved,1);
    assert.equal(result.entries.length,100);
    assert.equal(result.truncated,true);
  });
});

test('CLI exposes offline inventory without initializing project state',async()=>{
  await project({lockfileVersion:3,packages:{'':{},'node_modules/a':{version:'1.2.3'}}},async dir=>{
    const res=spawnSync(process.execPath,[path.resolve('bin/buildsteward.js'),'--root',dir,'deps','inventory'],{encoding:'utf8'});
    assert.equal(res.status,0,res.stderr);
    assert.equal(JSON.parse(res.stdout).result.entries[0].version,'1.2.3');
    assert.deepEqual(await fs.readdir(dir),['package-lock.json']);
  });
});

test('malformed JSON and oversized lockfiles are rejected before inventory',async()=>{
  await project(undefined,async dir=>{
    const file=path.join(dir,'package-lock.json');
    await fs.writeFile(file,'{bad');
    assert.equal((await inventoryNpmLock(dir)).reason,'invalid_json');
    await fs.writeFile(file,Buffer.alloc(8_000_001,32));
    await assert.rejects(()=>inventoryNpmLock(dir),/exceeds 8 MB/);
  });
});
