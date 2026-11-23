/**
 * Bounded developer workflow ledger. It coordinates work performed by an agent;
 * it is not a model, execution sandbox, human authorization authority or CI.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { readConfig } from './config.js';
import { loadState, saveState, storagePath } from './state.js';

const ID = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;
const KINDS = new Set(['feature','bugfix','refactor','design','architecture','test','security','documentation','release','maintenance']);
const VERIFY = new Set(['automated','manual']);
const FINISHED = new Set(['checked','reviewed']);
const RUNNERS = Object.freeze({
  'npm-test': ['npm',['test']],
  'node-test': [process.execPath,['--test','--test-reporter=tap']],
  'go-test': ['go',['test','./...']],
  'cargo-test': ['cargo',['test']],
  'python-test': ['python3',['-m','unittest','discover']]
});
const now = () => new Date().toISOString();
function validText(v, max = 500) { return typeof v === 'string' && !!v.trim() && v.length <= max; }
function validateTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) throw new Error('Task must be an object');
  if (!ID.test(task.id || '')) throw new Error('Task ID must be short and alphanumeric');
  if (!validText(task.title, 160)) throw new Error(`Task ${task.id}: title required`);
  if (!KINDS.has(task.kind)) throw new Error(`Task ${task.id}: unknown kind`);
  if (!['low','medium','high'].includes(task.risk)) throw new Error(`Task ${task.id}: risk low|medium|high required`);
  if (!VERIFY.has(task.verification)) throw new Error(`Task ${task.id}: verification automated|manual required`);
  if (task.verification==='manual' && !['design','architecture','documentation'].includes(task.kind)) throw new Error(`Task ${task.id}: code/release/security tasks require automated checks`);
  if (!Array.isArray(task.dependsOn) || task.dependsOn.length > 12 || task.dependsOn.some(x=>typeof x!=='string'||!ID.test(x))) throw new Error(`Task ${task.id}: invalid dependencies`);
  if (!Array.isArray(task.acceptance) || task.acceptance.length < 1 || task.acceptance.length > 8 || task.acceptance.some(x=>!validText(x,300))) throw new Error(`Task ${task.id}: measurable acceptance criteria required`);
}
export function validateWorkPlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Plan must be an object');
  if (!validText(input.goal,1000)) throw new Error('Plan goal required');
  if (!Array.isArray(input.tasks) || input.tasks.length < 1 || input.tasks.length > 32) throw new Error('Plan needs 1..32 tasks');
  input.tasks.forEach(validateTask);
  const byId = new Map(input.tasks.map(t=>[t.id,t]));
  if (byId.size !== input.tasks.length) throw new Error('Duplicate task ID');
  const seen = new Set(), active = new Set();
  function visit(id) {
    if (active.has(id)) throw new Error(`Circular dependency involving ${id}`);
    if (seen.has(id)) return;
    const task = byId.get(id);
    if (!task) throw new Error(`Unknown dependency: ${id}`);
    active.add(id);
    for (const dep of task.dependsOn) visit(dep);
    active.delete(id); seen.add(id);
  }
  for (const id of byId.keys()) visit(id);
  return {goal:input.goal, tasks:input.tasks.map(t=>({id:t.id,title:t.title,kind:t.kind,risk:t.risk,verification:t.verification,dependsOn:[...t.dependsOn],acceptance:[...t.acceptance],status:'pending',evidence:[],checks:[]}))};
}
export async function createWork(root, input) {
  await readConfig(root);
  const plan = validateWorkPlan(input);
  const dest = storagePath(root,'work');
  try { await fs.access(dest); throw new Error('Work plan already exists; preserve existing state or explicitly archive it outside BuildSteward.'); }
  catch(e) { if(e.code!=='ENOENT') throw e; }
  const state = {schema:1,goal:plan.goal,createdAt:now(),updatedAt:now(),tasks:plan.tasks};
  await saveState(root,'work',state);
  return summarize(state);
}
async function get(root) {
  await readConfig(root);
  const state = await loadState(root,'work',null);
  if (!state || state.schema!==1 || !Array.isArray(state.tasks)) throw new Error('No valid work plan. Create with work create --file plan.json');
  return state;
}
function ready(state, task) { return task.status==='pending' && task.dependsOn.every(id=>FINISHED.has(state.tasks.find(x=>x.id===id)?.status)); }
function summarize(state) {
  const statusCounts = state.tasks.reduce((o,t)=>(o[t.status]=(o[t.status]||0)+1,o),{});
  const readyIds = state.tasks.filter(t=>ready(state,t)).map(t=>t.id);
  const active = state.tasks.filter(t=>t.status==='active').map(t=>t.id);
  const blocked = state.tasks.filter(t=>t.status==='blocked').map(t=>t.id);
  const done = state.tasks.filter(t=>FINISHED.has(t.status)).length;
  return {goal:state.goal,total:state.tasks.length,done,statusCounts,ready:active.length?[]:readyIds,active,blocked,planComplete:done===state.tasks.length,releaseReadiness:'not_assessed',note:'Completion of the work ledger does not prove production readiness, security or user acceptance.'};
}
export async function workStatus(root) { return summarize(await get(root)); }
export async function nextWork(root) {
  const state=await get(root);
  if(state.tasks.some(t=>t.status==='active')) return {status:'active_task_exists',task:state.tasks.find(t=>t.status==='active')};
  const task=state.tasks.find(t=>ready(state,t));
  return task ? {status:'ready',task:{id:task.id,title:task.title,kind:task.kind,risk:task.risk,acceptance:task.acceptance,verification:task.verification}} : {status:'none_ready',summary:summarize(state)};
}
function selectTask(state,id) { const task=state.tasks.find(t=>t.id===id); if(!task)throw new Error(`Unknown task ${id}`);return task; }
export async function startWork(root,id) {
  const state=await get(root),task=selectTask(state,id);
  if(state.tasks.some(t=>t.status==='active')) throw new Error('Finish or block current active task before starting another');
  if(!ready(state,task)) throw new Error('Task is not ready: complete prerequisites first');
  task.status='active';task.startedAt=now();state.updatedAt=now();await saveState(root,'work',state);
  return {id,status:task.status,acceptance:task.acceptance};
}
export async function completeWork(root,id,evidence) {
  if(!validText(evidence,1000)) throw new Error('Explain implementation evidence, max 1000 characters');
  const state=await get(root),task=selectTask(state,id);
  if(task.status!=='active') throw new Error('Only active tasks may be submitted');
  task.status='implemented';task.evidence.push({type:'implementation',at:now(),summary:evidence});state.updatedAt=now();await saveState(root,'work',state);
  return {id,status:task.status,next:task.verification==='automated'?'Run work check with an explicit supported test runner':'Run work review with a human review note',verified:false};
}
export async function reviewWork(root,id,evidence) {
  if(!validText(evidence,1000)) throw new Error('Review evidence is required');
  const state=await get(root),task=selectTask(state,id);
  if(task.status!=='implemented'||task.verification!=='manual') throw new Error('Only implemented manual-review tasks may be reviewed');
  task.status='reviewed';task.completedAt=now();task.evidence.push({type:'manual_review',at:now(),summary:evidence});state.updatedAt=now();await saveState(root,'work',state);
  return {id,status:task.status,trust:'self_reported',note:'Review note is not independently authenticated.'};
}
export async function blockWork(root,id,reason) {
  if(!validText(reason,1000)) throw new Error('Reason required');
  const state=await get(root),task=selectTask(state,id);
  if(!['active','implemented'].includes(task.status)) throw new Error('Only active/implemented tasks may be blocked');
  task.status='blocked';task.evidence.push({type:'blocker',at:now(),summary:reason});state.updatedAt=now();await saveState(root,'work',state);
  return {id,status:task.status,reason};
}
export async function resumeWork(root,id) {
  const state=await get(root),task=selectTask(state,id);
  if(task.status!=='blocked') throw new Error('Task is not blocked');
  task.status='pending';state.updatedAt=now();await saveState(root,'work',state);
  return {id,status:task.status};
}
export async function checkWork(root,id,runner,{confirmed=false,timeoutMs=60000,spawn=spawnSync}={}) {
  const state=await get(root),task=selectTask(state,id);
  if(task.status!=='implemented'||task.verification!=='automated') throw new Error('Only implemented automated-check tasks may be tested');
  if(!Object.hasOwn(RUNNERS,runner)) throw new Error('Unsupported check runner');
  if(!confirmed) throw new Error('Use --confirm-run to acknowledge that project test scripts can execute arbitrary code');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>180000) throw new Error('Timeout must be 1000..180000ms');
  // No shell; fixed executable/args only. Projects are still untrusted and test scripts
  // can execute arbitrary code. Run trusted projects with OS sandbox when required.
  const [binary,args]=process.platform==='win32' && runner==='npm-test'
    ? [process.execPath, [process.env.npm_execpath || path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js'), 'test']]
    : RUNNERS[runner];
  const start=Date.now();
  const env={...process.env};
  delete env.NODE_TEST_CONTEXT;
  const result=spawn(binary,args,{cwd:path.resolve(root),encoding:'utf8',timeout:timeoutMs,maxBuffer:262144,windowsHide:true,shell:false,env});
  const output=(result.stdout||'')+'\n'+(result.stderr||'');
  const succeeded=!result.error && result.status===0;
  const testCounts=succeeded && (runner==='node-test' || runner==='npm-test')
    ? [...stripVTControlCharacters(result.stdout || '').matchAll(/^(?:#|ℹ) tests (\d+)[ \t]*\r?$/gm)]
    : [];
  const noTests=testCounts.length>0 && testCounts.every(count=>Number(count[1])===0);
  const passed=succeeded && !noTests;
  const record={at:now(),runner,exitCode:typeof result.status==='number'?result.status:null,elapsedMs:Date.now()-start,passed,outputDigest:createHash('sha256').update(output).digest('hex'),failureKind:result.error?.code || (noTests ? 'no_tests' : null)};
  if (!passed && runner === 'node-test') {
    const stableOutput = output
      .replace(/^(?:ℹ |# |[ \t]+)duration_ms:?[ \t]+[\d.eE+-]+[ \t]*\r?$/gm, 'duration_ms')
      .replace(/^((?:# )?\(node:)\d+(\) (?:\[[^\]\r\n]+\] )?[A-Za-z]*Warning:)/gm, '$1<PID>$2');
    record.failureFingerprint = createHash('sha256').update(JSON.stringify([record.exitCode, record.failureKind, stableOutput])).digest('hex');
  }
  task.checks.push(record);
  if(passed){task.status='checked';task.completedAt=now();}
  else if(task.checks.slice(-3).length===3 && task.checks.slice(-3).every(c=>!c.passed && c.runner===runner && (c.failureFingerprint ?? c.outputDigest)===(record.failureFingerprint ?? record.outputDigest))) {
    task.status='blocked';
    task.evidence.push({type:'stagnation',at:now(),summary:'Three repeated equivalent failing test outputs. Change hypothesis before resuming.'});
  }
  state.updatedAt=now();await saveState(root,'work',state);
  return {id,status:task.status,check:record,next:task.status==='blocked'?'Review repeated failure before resume':passed?'Check acceptance criteria and proceed':noTests?'Add tests and rerun the check':'Inspect failure and change implementation',note:'Exit code proves the command ran successfully, not full acceptance, security, or deploy readiness. Raw output is not stored to avoid capturing secrets.'};
}
export async function workContext(root) {
  const state=await get(root), summary=summarize(state);
  const focused=state.tasks.find(t=>t.status==='active')
    ?? state.tasks.find(t=>t.status==='implemented')
    ?? state.tasks.find(t=>ready(state,t));
  return {goal:state.goal,progress:`${summary.done}/${summary.total}`,task:focused?{id:focused.id,title:focused.title,status:focused.status,kind:focused.kind,acceptance:focused.acceptance,verification:focused.verification}:null,blocked:summary.blocked,notes:['Load only the files relevant to this task.','Check current source; prior working state is advisory.','Do not claim verification unless the relevant commands ran.']};
}
