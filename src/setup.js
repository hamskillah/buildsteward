import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { initialize, readConfig, setConfig, stateDir } from './config.js';

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_SOURCE = path.join(SOURCE_ROOT, 'skills', 'buildsteward');
const RUNTIME_ITEMS = ['bin', 'src', 'knowledge', 'package.json'];
const MARKER = '.buildsteward-install.json';

export const AGENTS = Object.freeze({
  opencode: { command: 'opencode', project: '.agents/skills', global: '.config/opencode/skills' },
  codex: { command: 'codex', project: '.agents/skills', global: '.agents/skills' },
  claude: { command: 'claude', project: '.claude/skills', global: '.claude/skills' },
  cursor: { command: 'cursor', project: '.cursor/skills', global: '.cursor/skills' },
});

async function exists(p) { try { await fs.lstat(p); return true; } catch (e) { if (e.code==='ENOENT') return false; throw e; } }
async function isExecutableOnPath(command, environment) {
  for (const base of (environment.PATH || '').split(path.delimiter).filter(Boolean)) {
    const p = path.join(base, command);
    try { await fs.access(p, fs.constants.X_OK); return true; } catch { /* try next path */ }
  }
  return false;
}
export async function detectAgents(environment = process.env) {
  const detected=[];
  for (const [agent,info] of Object.entries(AGENTS)) if (await isExecutableOnPath(info.command, environment)) detected.push(agent);
  return detected;
}
function validateScope(scope) { if (!['project','global'].includes(scope)) throw new Error('scope must be project or global'); }
function validateMode(mode) { if (!['approval','autonomous'].includes(mode)) throw new Error('mode must be approval or autonomous'); }
function validateGraph(graph) { if (!['off','auto','on'].includes(graph)) throw new Error('graph must be off, auto or on'); }
export function installTarget(agent, scope, root, home = os.homedir()) {
  validateScope(scope);
  if (!Object.hasOwn(AGENTS,agent)) throw new Error(`Unsupported agent ${agent}; choose ${Object.keys(AGENTS).join(', ')}`);
  const base = scope === 'project' ? path.resolve(root) : path.resolve(home);
  return path.join(base, AGENTS[agent][scope], 'buildsteward');
}
function normalizeAgents(agents) {
  const all = typeof agents === 'string' ? agents.split(',') : agents;
  if (!Array.isArray(all) || !all.length) throw new Error('No agents selected: use --agents codex,opencode or --agents auto');
  const unique=[...new Set(all.map(x=>x.trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) throw new Error('No agents selected');
  unique.forEach(x=>{if (!Object.hasOwn(AGENTS,x)) throw new Error(`Unsupported agent ${x}`);});
  return unique;
}
async function payloadFingerprint(folder) {
  const fileEntries=[];
  async function visit(dir, rel='') {
    const entries=await fs.readdir(dir,{withFileTypes:true});
    for (const e of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
      if (e.name===MARKER) continue;
      const full=path.join(dir,e.name), r=path.posix.join(rel,e.name);
      if (e.isSymbolicLink()) throw new Error(`Refusing symlink inside installed skill: ${r}`);
      if (e.isDirectory()) await visit(full,r);
      else if (e.isFile()) fileEntries.push([r,createHash('sha256').update(await fs.readFile(full)).digest('hex')]);
    }
  }
  await visit(folder);
  return createHash('sha256').update(JSON.stringify(fileEntries)).digest('hex');
}
async function inspectTarget(dest) {
  if (!await exists(dest)) return {status:'missing'};
  const st=await fs.lstat(dest);
  if (!st.isDirectory() || st.isSymbolicLink()) return {status:'conflict',reason:'Path is not a regular directory'};
  const markerFile=path.join(dest,MARKER);
  if (!await exists(markerFile)) return {status:'external',reason:'No BuildSteward ownership marker'};
  try {
    const marker=JSON.parse(await fs.readFile(markerFile,'utf8'));
    if (marker.managedBy!=='buildsteward' || marker.schema!==1) return {status:'external',reason:'Unrecognized marker'};
    const fingerprint=await payloadFingerprint(dest);
    return {status: fingerprint===marker.fingerprint?'managed':'modified',marker,fingerprint};
  } catch(e) { return {status:'conflict',reason:`Unreadable marker or installed files: ${e.message}`}; }
}
async function makeStaging(dest, withRuntime) {
  const parent=path.dirname(dest);
  await fs.mkdir(parent,{recursive:true});
  // Copy to a NEW child directory. Node 22/24/26 differ in how fs.cp handles
  // `errorOnExist` when the destination is a pre-created empty directory.
  const tempDir=await fs.mkdtemp(path.join(parent,'.buildsteward-stage-'));
  const stage=path.join(tempDir,'buildsteward');
  try {
    await fs.cp(SKILL_SOURCE,stage,{recursive:true,force:false,errorOnExist:true});
    if (withRuntime) {
      const runtime=path.join(stage,'runtime');
      await fs.mkdir(runtime);
      for (const item of RUNTIME_ITEMS) await fs.cp(path.join(SOURCE_ROOT,item),path.join(runtime,item),{recursive:true});
    }
    const fingerprint=await payloadFingerprint(stage);
    await fs.writeFile(path.join(stage,MARKER),JSON.stringify({managedBy:'buildsteward',schema:1,fingerprint,withRuntime,installedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600});
    return {stage,tempDir};
  } catch(e) { await fs.rm(tempDir,{recursive:true,force:true}); throw e; }
}

function backupBase(scope, root, home) {
  return scope==='project' ? path.join(stateDir(root),'skill-backups') : path.join(home,'.config','buildsteward','skill-backups');
}
function backupPrefix(dest) {return createHash('sha256').update(dest).digest('hex').slice(0,16)+'-';}
function backupName(dest) {return `${backupPrefix(dest)}${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}

/** Plans and installs only explicit supported agent skills. Never overwrites another installer. */
export async function setupInstallation({root=process.cwd(),home=os.homedir(),scope='project',agents,mode='approval',graph='off',dryRun=false,force=false,withRuntime=true}={}) {
  validateScope(scope); validateMode(mode); validateGraph(graph);
  const chosen=normalizeAgents(agents);
  const destinations=[...new Set(chosen.map(a=>installTarget(a,scope,root,home)))];
  const before=await Promise.all(destinations.map(async dest=>({path:dest,...await inspectTarget(dest)})));
  for (const b of before) {
    if (b.status==='external'||b.status==='conflict') throw new Error(`Refusing to replace unmanaged installation at ${b.path}: ${b.reason}`);
    if (b.status==='modified'&&!force) throw new Error(`Installed skill was modified: ${b.path}. Review changes or explicitly use --force to back it up and replace it.`);
  }
  const results=[];
  const rootAbs=path.resolve(root);
  const projectConfigExists=await exists(path.join(stateDir(rootAbs),'config.json'));
  if (dryRun) return {scope,agents:chosen,mode,graph,dryRun:true,withRuntime,paths:before.map(b=>({path:b.path,action:b.status==='missing'?'install':'update',previousStatus:b.status})),projectConfig:scope==='project'?(projectConfigExists?'preserve':'create'):'not-touched'};
  // Do not overwrite an existing project policy during skill setup.
  if (scope==='project' && !projectConfigExists) {
    await initialize(rootAbs,mode);
    if(graph!=='off') await setConfig(rootAbs,'memory.codeGraph.mode',graph);
  }
  for (const b of before) {
    const {stage,tempDir}=await makeStaging(b.path,withRuntime);
    let backup=null;
    try {
      if (b.status!=='missing') {
        const backups=backupBase(scope,rootAbs,home);
        await fs.mkdir(backups,{recursive:true,mode:0o700});
        backup=path.join(backups,backupName(b.path));
        await fs.rename(b.path,backup);
      }
      try { await fs.rename(stage,b.path); }
      catch(e) { if(backup) await fs.rename(backup,b.path).catch(()=>{}); throw e; }
      results.push({path:b.path,action:b.status==='missing'?'installed':'updated',backup});
    } finally {await fs.rm(tempDir,{recursive:true,force:true}).catch(()=>{});}
  }
  return {scope,agents:chosen,mode:scope==='project'?(await readConfig(rootAbs)).autonomy.mode:null,graph:scope==='project'?(await readConfig(rootAbs)).memory.codeGraph.mode:null,withRuntime,paths:results,projectConfig:scope==='project'?(projectConfigExists?'preserved':'created'):'not-touched'};
}

export async function installationDoctor({root=process.cwd(),home=os.homedir(),scope='project',agents}={}) {
  validateScope(scope);
  const chosen=agents?normalizeAgents(agents):Object.keys(AGENTS);
  const statuses=await Promise.all(chosen.map(async agent=>{
    const p=installTarget(agent,scope,root,home);
    const found=await inspectTarget(p);
    return {agent,path:p,...found,skillExists:await exists(path.join(p,'SKILL.md')),runtimeExists:await exists(path.join(p,'runtime','bin','buildsteward.js'))};
  }));
  let config='not-configured';
  if(scope==='project') { try {const c=await readConfig(root);config={autonomy:c.autonomy.mode,graph:c.memory.codeGraph.mode};}catch(e){config=e.message;} }
  return {scope,project:path.resolve(root),node:process.version,config,agents:statuses,notes:['Skill file presence does not prove host activation. Check the agent skill list.','Approval records cannot enforce permissions on unrestricted shell tools.']};
}

export async function uninstallInstallation({root=process.cwd(),home=os.homedir(),scope='project',agents,force=false,dryRun=false}={}) {
  validateScope(scope);
  const chosen=normalizeAgents(agents);
  const targets=[...new Set(chosen.map(a=>installTarget(a,scope,root,home)))];
  const prior=await Promise.all(targets.map(async p=>({path:p,...await inspectTarget(p)})));
  for(const p of prior){
    if(['external','conflict'].includes(p.status)) throw new Error(`Refusing to remove unmanaged skill: ${p.path}`);
    if(p.status==='modified'&&!force) throw new Error(`Refusing to delete modified skill: ${p.path}; use --force only after reviewing changes`);
  }
  if(dryRun) return {dryRun:true,paths:prior.map(p=>({path:p.path,action:p.status==='missing'?'skip':'remove'}))};
  const results=[];
  for(const p of prior){
    if(p.status==='missing') results.push({path:p.path,action:'skipped'});
    else {
      // Keep a recoverable copy even when uninstalling a managed skill.
      const backups=backupBase(scope,root,home);
      await fs.mkdir(backups,{recursive:true,mode:0o700});
      const backup=path.join(backups,backupName(p.path));
      await fs.rename(p.path,backup);
      results.push({path:p.path,action:'uninstalled',backup});
    }
  }
  return {scope,paths:results,projectConfigPreserved:true};
}


export async function rollbackInstallation({root=process.cwd(),home=os.homedir(),scope='project',agents,dryRun=false,force=false}={}) {
  validateScope(scope);
  const chosen=normalizeAgents(agents);
  const targets=[...new Set(chosen.map(a=>installTarget(a,scope,root,home)))];
  const entries=[];
  for(const dest of targets){
    const current=await inspectTarget(dest);
    if(['external','conflict','missing'].includes(current.status)) throw new Error(`Cannot rollback unmanaged or missing installation: ${dest}`);
    if(current.status==='modified'&&!force) throw new Error(`Installed skill modified: ${dest}; use --force to preserve modified files in backup`);
    const backupDir=backupBase(scope,root,home);
    const prefix=backupPrefix(dest);
    const backups=(await fs.readdir(backupDir).catch(e=>{if(e.code==='ENOENT')return [];throw e;})).filter(x=>x.startsWith(prefix)).sort().reverse();
    if(!backups.length) throw new Error(`No previous managed installation backup for ${dest}`);
    const previous=path.join(backupDir,backups[0]);
    if ((await inspectTarget(previous)).status!=='managed') throw new Error(`Previous skill backup is modified or untrusted: ${previous}`);
    entries.push({path:dest,backup:previous});
  }
  if(dryRun) return {dryRun:true,paths:entries};
  const results=[];
  for(const entry of entries){
    const safe=path.join(backupBase(scope,root,home),backupName(entry.path));
    await fs.rename(entry.path,safe);
    try{ await fs.rename(entry.backup,entry.path); }
    catch(e){ await fs.rename(safe,entry.path).catch(()=>{}); throw e; }
    results.push({path:entry.path,restoredFrom:entry.backup,currentSavedAs:safe});
  }
  return {scope,paths:results};
}
