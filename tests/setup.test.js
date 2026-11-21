import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setupInstallation, installationDoctor, uninstallInstallation, rollbackInstallation, installTarget, detectAgents } from '../src/setup.js';
import { readConfig } from '../src/config.js';

async function temporary(fn) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(),'buildsteward-setup-'));
  const root = path.join(temp,'project'), home=path.join(temp,'home');
  await fs.mkdir(root);await fs.mkdir(home);
  try {await fn({temp,root,home});} finally { await fs.rm(temp,{recursive:true,force:true}); }
}
const read = (p)=>fs.readFile(p,'utf8');

test('project setup installs runtime and shared skill for OpenCode + Codex without overwriting settings',async()=>{
  await temporary(async ({root,home})=>{
    const plan=await setupInstallation({root,home,scope:'project',agents:'opencode,codex',mode:'autonomous',graph:'auto',dryRun:true});
    assert.equal(plan.paths.length,1);
    assert.equal(plan.projectConfig,'create');
    assert.equal((await fs.readdir(root)).length,0,'dry run must not write anything');
    const installed=await setupInstallation({root,home,scope:'project',agents:'opencode,codex',mode:'autonomous',graph:'auto'});
    assert.equal(installed.paths.length,1);
    assert.equal(installed.projectConfig,'created');
    assert.equal((await readConfig(root)).autonomy.mode,'autonomous');
    assert.equal((await readConfig(root)).memory.codeGraph.mode,'auto');
    const p=installTarget('codex','project',root,home);
    assert.equal(p,installTarget('opencode','project',root,home));
    assert.match(await read(path.join(p,'SKILL.md')),/Developer Kernel/);
    const cli=path.join(p,'runtime','bin','buildsteward.js');
    const result=spawnSync(process.execPath,[cli,'--root',root,'inspect'],{encoding:'utf8',timeout:4000});
    assert.equal(result.status,0,result.stderr);
    assert.equal(JSON.parse(result.stdout).ok,true);
    const health=await installationDoctor({root,home,agents:'codex,opencode'});
    assert.equal(health.agents[0].status,'managed');
    assert.equal(health.agents[1].runtimeExists,true);
    await setupInstallation({root,home,agents:'codex',mode:'approval',graph:'off'});
    assert.equal((await readConfig(root)).autonomy.mode,'autonomous','setup must preserve previous config');
  });
});

test('setup refuses another installer and does not delete user changes',async()=>{
  await temporary(async ({root,home})=>{
    const p=installTarget('claude','project',root,home);
    await fs.mkdir(p,{recursive:true});
    await fs.writeFile(path.join(p,'SKILL.md'),'do not overwrite');
    await assert.rejects(()=>setupInstallation({root,home,agents:'claude'}),/unmanaged/);
    assert.equal(await read(path.join(p,'SKILL.md')),'do not overwrite');
    await assert.rejects(()=>uninstallInstallation({root,home,agents:'claude'}),/unmanaged/);
    await fs.rm(p,{recursive:true});
    await setupInstallation({root,home,agents:'claude'});
    await fs.appendFile(path.join(p,'SKILL.md'),'\nuser customization');
    await assert.rejects(()=>setupInstallation({root,home,agents:'claude'}),/modified/);
    await assert.rejects(()=>uninstallInstallation({root,home,agents:'claude'}),/modified/);
    assert.match(await read(path.join(p,'SKILL.md')),/user customization/);
    const removed=await uninstallInstallation({root,home,agents:'claude',force:true});
    assert.equal(removed.paths[0].action,'uninstalled');
    assert.match(await read(path.join(removed.paths[0].backup,'SKILL.md')),/user customization/);
    assert.equal(await fs.readdir(path.dirname(p)).then(x=>x.includes('buildsteward')),false);
  });
});

test('global mode uses home-specific paths and does not initialize unrelated project',async()=>{
  await temporary(async ({root,home})=>{
    await setupInstallation({root,home,scope:'global',agents:'codex,claude',mode:'approval'});
    assert.ok(await read( path.join(installTarget('claude','global',root,home),'SKILL.md')));
    assert.ok(await read( path.join(installTarget('codex','global',root,home),'SKILL.md')));
    await assert.rejects(()=>readConfig(root),/not initialized/);
    const plan=await uninstallInstallation({root,home,scope:'global',agents:'codex,claude',dryRun:true});
    assert.equal(plan.paths.length,2);
    assert.equal(plan.paths[0].action,'remove');
    const uninstalled=await uninstallInstallation({root,home,scope:'global',agents:'codex,claude'});
    assert.equal(uninstalled.paths.length,2);
    assert.equal((await installationDoctor({root,home,scope:'global',agents:'codex'})).agents[0].skillExists,false);
  });
});

test('CLI setup and doctor are usable non-interactively',async()=>{
  await temporary(async ({root,home})=>{
    const cli=path.resolve('bin/buildsteward.js');
    const env={...process.env,HOME:home};
    const run=(...args)=>spawnSync(process.execPath,[cli,'--root',root,...args],{encoding:'utf8',env,timeout:4000});
    const dry=run('setup','--agents','cursor','--scope','project','--dry-run');
    assert.equal(dry.status,0,dry.stderr);
    assert.equal(JSON.parse(dry.stdout).result.dryRun,true);
    const installed=run('setup','--agents','cursor','--scope','project','--mode','approval','--yes');
    assert.equal(installed.status,0,installed.stderr);
    const doctor=run('doctor','--agents','cursor');
    assert.equal(doctor.status,0,doctor.stderr);
    assert.equal(JSON.parse(doctor.stdout).result.agents[0].status,'managed');
    const uninstalled=run('uninstall','--agents','cursor');
    assert.equal(uninstalled.status,0,uninstalled.stderr);
  });
});

test('agent detection ignores unavailable tools and only uses executable path entries', async()=>{
  await temporary(async ({temp})=>{
    const bin=path.join(temp,'bin');await fs.mkdir(bin);
    const command=path.join(bin,'codex');await fs.writeFile(command,'#!/bin/sh\nexit 0\n'); await fs.chmod(command,0o755);
    assert.deepEqual(await detectAgents({PATH:bin}),['codex']);
    assert.deepEqual(await detectAgents({PATH:path.join(temp,'missing')}),[]);
  });
});


test('rollback restores a previous managed skill while backing up current version',async()=>{
  await temporary(async({root,home})=>{
    const p=installTarget('codex','project',root,home);
    await setupInstallation({root,home,agents:'codex',withRuntime:false});
    assert.equal(await fs.readdir(p).then(x=>x.includes('runtime')),false);
    await setupInstallation({root,home,agents:'codex',withRuntime:true});
    assert.equal(await fs.readdir(p).then(x=>x.includes('runtime')),true);
    const planned=await rollbackInstallation({root,home,agents:'codex',dryRun:true});
    assert.equal(planned.paths.length,1);
    const restored=await rollbackInstallation({root,home,agents:'codex'});
    assert.equal(restored.paths.length,1);
    assert.equal(await fs.readdir(p).then(x=>x.includes('runtime')),false);
    assert.equal((await installationDoctor({root,home,agents:'codex'})).agents[0].status,'managed');
  });
});
