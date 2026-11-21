#!/usr/bin/env node
// Ensure the *published artifact* works without relying on source files or npm registry access.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function run(command, args, opts={}) {
  const result=spawnSync(command,args,{encoding:'utf8',timeout:30000,...opts});
  if(result.error || result.status!==0) throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message||result.stderr||result.stdout}`);
  return result.stdout.trim();
}
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'buildsteward-package-smoke-'));
try {
  const work=path.resolve(import.meta.dirname,'..');
  const npm=process.platform==='win32'?'npm.cmd':'npm';
  const packOutput=run(npm,['pack','--json','--pack-destination',temp],{cwd:work});
  const metadata=JSON.parse(packOutput)[0];
  if(!metadata?.filename) throw new Error('npm pack did not produce a tarball');
  const archive=path.join(temp,metadata.filename);
  // Verify npm actually links the package binary, not only direct Node invocation.
  const prefix=path.join(temp,'installed');
  await fs.mkdir(prefix);
  run(npm,['install','--ignore-scripts','--offline','--no-audit','--no-fund','--prefix',prefix,archive],{cwd:temp,env:{...process.env,npm_config_userconfig:path.join(temp,'empty-npmrc'),npm_config_cache:path.join(temp,'cache')}});
  const linked=path.join(prefix,'node_modules','.bin',process.platform==='win32'?'buildsteward.cmd':'buildsteward');
  if(!run(linked,['help'],{cwd:temp}).includes('BuildSteward')) throw new Error('Installed npm executable failed');
  run('tar',['-xzf',archive,'-C',temp]);
  const pkg=path.join(temp,'package');
  const skill=await fs.readFile(path.join(pkg,'skills','buildsteward','SKILL.md'),'utf8');
  if(!skill.includes('name: buildsteward')) throw new Error('Skill missing from packaged artifact');
  const runtime=path.join(pkg,'bin','buildsteward.js');
  const help=run(process.execPath,[runtime,'help'],{cwd:pkg});
  if(!help.includes('BuildSteward')) throw new Error('Packed CLI failed to start');
  const project=path.join(temp,'project');
  await fs.mkdir(project);
  const installed=JSON.parse(run(process.execPath,[runtime,'--root',project,'setup','--agents','codex','--yes'],{cwd:pkg}));
  if(!installed.ok) throw new Error('Installer failed in isolated artifact');
  const installedRuntime=path.join(project,'.agents','skills','buildsteward','runtime','bin','buildsteward.js');
  const inspected=JSON.parse(run(process.execPath,[installedRuntime,'--root',project,'inspect'],{cwd:project}));
  if(!inspected.ok) throw new Error('Copied Cortex runtime is unusable');
  const doctor=JSON.parse(run(process.execPath,[runtime,'--root',project,'doctor','--agents','codex','--strict'],{cwd:pkg}));
  if(!doctor.ok || doctor.result.healthy!==true) throw new Error('Doctor did not validate packaged install');
  await fs.writeFile(path.join(project,'package-lock.json'),JSON.stringify({lockfileVersion:3,packages:{'':{},'node_modules/example':{version:'1.2.3'}}}));
  const inventory=JSON.parse(run(process.execPath,[installedRuntime,'--root',project,'deps','inventory'],{cwd:project}));
  if(inventory.result.entries[0]?.version!=='1.2.3') throw new Error('Packaged npm inventory failed');
  // Verify the packed, installed Cortex actually contains the developer work engine.
  const sample={goal:'Check packed work runtime',tasks:[{id:'docs',title:'Document setup',kind:'documentation',risk:'low',verification:'manual',dependsOn:[],acceptance:['Documentation checked']}]};
  const plan=path.join(project,'sample-plan.json');
  await fs.writeFile(plan,JSON.stringify(sample));
  const created=JSON.parse(run(process.execPath,[installedRuntime,'--root',project,'work','create','--file',plan],{cwd:project}));
  if(!created.ok || created.result.ready[0]!=='docs') throw new Error('Packed developer work engine did not initialize');
  const context=JSON.parse(run(process.execPath,[installedRuntime,'--root',project,'work','context'],{cwd:project}));
  if(context.result.task.id!=='docs') throw new Error('Packed developer work engine cannot resume');
  console.log(JSON.stringify({ok:true,artifact:metadata.filename,files:metadata.files?.length,bytes:metadata.size,isolatedSetup:true}));
} finally {
  await fs.rm(temp,{recursive:true,force:true});
}
