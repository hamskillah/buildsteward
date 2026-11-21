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
  run(process.execPath, ['--input-type=module', '-e',
    "import { createHostAuthority } from '@hamskillah/buildsteward/src/host-authority.js'; if (typeof createHostAuthority !== 'function') throw new Error('Missing host authority export');",
  ], {cwd:prefix});
  const linked=path.join(prefix,'node_modules','.bin',process.platform==='win32'?'buildsteward.cmd':'buildsteward');
  if(!run(linked,['help'],{cwd:temp}).includes('BuildSteward')) throw new Error('Installed npm executable failed');
  if (process.platform !== 'win32') {
    const globalPrefix = path.join(temp, 'global');
    run(npm, ['install', '--global', '--prefix', globalPrefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', archive], {
      cwd: temp,
      env: { ...process.env, npm_config_userconfig: path.join(temp, 'empty-npmrc'), npm_config_cache: path.join(temp, 'cache') },
    });
    const globalBin = path.join(globalPrefix, 'bin');
    await fs.access(path.join(globalBin, 'buildsteward'), fs.constants.X_OK);
    const result = JSON.parse(run('buildsteward', ['inspect'], {
      cwd: temp, env: { ...process.env, PATH: globalBin + path.delimiter + (process.env.PATH || '') },
    }));
    if (!result.ok || result.result.root !== await fs.realpath(temp)) throw new Error('Global buildsteward command failed');
  }
  const pkg=path.join(prefix,'node_modules','@hamskillah','buildsteward');
  const agents='opencode,codex,claude,cursor';
  const layout={
    project:['.agents/skills','.claude/skills','.cursor/skills'],
    global:['.config/opencode/skills','.agents/skills','.claude/skills','.cursor/skills'],
  };
  for (const scope of ['project','global']) {
    for (const skillOnly of [true,false]) {
      const projectRoot=await fs.mkdtemp(path.join(temp,'layout-'));
      const home=await fs.mkdtemp(path.join(temp,'home-'));
      const options={cwd:projectRoot,env:{...process.env,HOME:home,USERPROFILE:home}};
      const flags=['--scope',scope,'--agents',agents];
      run(linked,['setup',...flags,'--yes',...(skillOnly?['--skill-only']:[])],options);
      const check=()=>JSON.parse(run(linked,['doctor',...flags],options)).result;
      const health=check();
      if (!health.healthy || health.agents.length!==4 ||
          health.agents.some(agent=>agent.runtimeExists===skillOnly)) {
        throw new Error(`Incorrect installation layout for ${scope}, skill-only=${skillOnly}`);
      }
      const skillRoot=scope==='project'?projectRoot:home;
      const skillPaths=layout[scope].map(directory=>path.join(skillRoot,directory,'buildsteward','SKILL.md'));
      for (const skillPath of skillPaths) {
        if (!(await fs.readFile(skillPath,'utf8')).includes('name: buildsteward')) {
          throw new Error(`Missing skill content at ${skillPath}`);
        }
      }
      run(linked,['uninstall',...flags],options);
      for (const skillPath of skillPaths) {
        const removed=await fs.stat(skillPath).then(()=>false,error=>{
          if (error.code==='ENOENT') return true;
          throw error;
        });
        if (!removed) throw new Error(`Uninstall left skill content at ${skillPath}`);
      }
      if (check().agents.some(agent=>agent.skillExists)) {
        throw new Error(`Installed skill remains after uninstall in ${scope}`);
      }
    }
  }
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
  const unconfigured = path.join(temp, 'bundle-setup-target');
  await fs.mkdir(unconfigured);
  const bundleSetup = spawnSync(process.execPath, [
    installedRuntime, '--root', unconfigured, 'setup', '--agents', 'codex', '--yes',
  ], { encoding: 'utf8', timeout: 10_000 });
  if (bundleSetup.status !== 1 || !bundleSetup.stderr.includes('Skill source is unavailable') ||
      (await fs.readdir(unconfigured)).length !== 0) {
    throw new Error('Bundled setup should report missing skill source before writing files');
  }
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
