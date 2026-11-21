import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initialize, readConfig, setConfig } from '../src/config.js';
import { routeTask } from '../src/router.js';
import { evaluateDecision, recordDecision, resolveDecision } from '../src/decision.js';
import { actionPolicy, requestApproval, resolveApproval, checkAction } from '../src/approval.js';
import { recordProgress } from '../src/progress.js';
import { setCheckpoint, getCheckpoint } from '../src/checkpoint.js';
import { graphStatus, graphSearch } from '../src/graph.js';
import { listKnowledge, searchKnowledge, readKnowledge } from '../src/library.js';
import { inspectDependency } from '../src/dependency.js';

async function withProject(fn, mode = 'approval') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-test-'));
  try { await initialize(root, mode); return await fn(root); }
  finally { await fs.rm(root, {recursive:true,force:true}); }
}

const candidate = (name, changes = {}) => ({ name, gates: {compatible:true,licenseAllowed:true,securityAcceptable:true}, evidence: ['https://example.org/evidence'], ratings: {fit:5,maintenance:4,complexity:4,operational:4}, ...changes });

test('initialize with strict default; refuses overwrite', async () => {
  await withProject(async root => {
    assert.equal((await readConfig(root)).autonomy.mode, 'approval');
    await assert.rejects(() => initialize(root), {code:'EEXIST'});
    await setConfig(root,'memory.codeGraph.mode','on');
    assert.equal((await readConfig(root)).memory.codeGraph.mode,'on');
    await assert.rejects(() => setConfig(root,'memory.codeGraph.mode','invented'));
  });
});

test('task router chooses proportional workflow', () => {
  assert.equal(routeTask('Fix the authentication bug').category,'bugfix');
  assert.equal(routeTask('Rename a comment typo').path,'fast');
  assert.equal(routeTask('Choose dependency library').category,'dependency');
  assert.equal(routeTask('Build a SaaS product').path,'architectural');
});

test('decision rejects failed hard gate regardless of score', () => {
  const d = evaluateDecision({topic:'Framework', candidates:[candidate('unsafe', {gates:{compatible:true,licenseAllowed:false,securityAcceptable:true},ratings:{fit:5,maintenance:5,complexity:5,operational:5}}),candidate('safe')]});
  assert.equal(d.recommended,'safe');
  assert.equal(d.candidates[0].status,'rejected');
});

test('decision never wins with unknown evidence, and ties are challenged', () => {
  const unknown = evaluateDecision({topic:'db',candidates:[candidate('known'), candidate('unknown',{evidence:[]})]});
  assert.equal(unknown.status,'research_required');
  assert.equal(unknown.recommended,null);
  const tie = evaluateDecision({topic:'db',candidates:[candidate('a'), candidate('b')]});
  assert.equal(tie.status,'human_or_experiment_required');
  assert.equal(tie.recommended,null);
});

test('decision persistence and approval status respect mode', async () => {
  await withProject(async root => {
    const d = await recordDecision(root,{topic:'architecture',tier:'architectural',candidates:[candidate('one')]});
    assert.equal(d.authorization,'awaiting_approval');
    assert.equal(d.selected,null);
    const selected = await resolveDecision(root,d.id,'approved','user');
    assert.equal(selected.authorization,'approved');
    assert.equal(selected.selected,'one');
  });
  await withProject(async root => {
    const d = await recordDecision(root,{topic:'architecture',tier:'architectural',candidates:[candidate('one')]});
    assert.equal(d.authorization,'in_scope_decision');
    assert.equal(d.selected,'one');
  },'autonomous');
});

test('high risk action fails closed in autonomous and approval modes', async () => {
  await withProject(async root => {
    assert.equal((await checkAction(root,'production_deploy','prod')).allowed,false);
    const req = await requestApproval(root,'production_deploy','prod','Release is ready');
    assert.equal((await checkAction(root,'production_deploy','prod')).allowed,false);
    await resolveApproval(root,req.id,'approved','user-operator');
    assert.equal((await checkAction(root,'production_deploy','prod')).allowed,true);
    assert.equal((await checkAction(root,'production_deploy','other-prod')).allowed,false);
  },'autonomous');
  assert.equal(actionPolicy({autonomy:{mode:'autonomous'},execution:{approvalRequired:[]}},'local_test','repo',[]).allowed,true);
});

test('progress sentinel only stalls on repeated identical no-progress attempts', async () => {
  await withProject(async root => {
    assert.equal((await recordProgress(root,{action:'build',outcome:'no_progress',evidence:'TS1000'})).stalled,false);
    await recordProgress(root,{action:'build',outcome:'no_progress',evidence:'TS1000'});
    assert.equal((await recordProgress(root,{action:'build',outcome:'no_progress',evidence:'TS1000'})).stalled,true);
    assert.equal((await recordProgress(root,{action:'build',outcome:'progress',evidence:'fixed'})).stalled,false);
  });
});

test('project checkpoint rejects unexpected fields', async () => {
  await withProject(async root => {
    const input = {goal:'build auth',completed:['inspect'],next:'write test',blockers:[],changedFiles:[],verification:[]};
    await setCheckpoint(root,input);
    assert.equal((await getCheckpoint(root)).next,'write test');
    await assert.rejects(() => setCheckpoint(root,{...input, secrets:'whoops'}));
  });
});

test('knowledge search selectively retrieves relevant recipe', async () => {
  assert.ok((await listKnowledge()).length >= 6);
  const hit = (await searchKnowledge('database concurrency'))[0];
  assert.equal(hit.id,'database-selection');
  assert.match((await readKnowledge(hit.id,true)).body,/concurrency/i);
});

test('optional code graph must not execute when off', async () => {
  await withProject(async root => {
    assert.equal((await graphStatus(root)).active,false);
    await assert.rejects(() => graphSearch(root,'foo'),/Graph is off/);
  });
});

test('dependency evidence accepts versioned sources and distinguishes unavailable data', async () => {
  await withProject(async root => {
    const fetched = [];
    const fetcher = async (url, init) => {
      fetched.push({url, init});
      return {ok:true,text:async()=>url.includes('deps.dev') ? JSON.stringify({licenses:['MIT'],isDeprecated:false,advisoryKeys:[]}) : JSON.stringify({vulns:[{id:'OSV-EXAMPLE'}]})};
    };
    const result = await inspectDependency(root,{ecosystem:'npm',name:'@scope/pkg',version:'1.2.3'},{fetcher});
    assert.equal(result.status,'evidence_collected');
    assert.equal(result.sources[0].status,'live');
    assert.equal(result.knownOsvVulnerabilities[0],'OSV-EXAMPLE');
    assert.match(fetched[0].url,/%40scope%2Fpkg/);
    const cached = await inspectDependency(root,{ecosystem:'npm',name:'@scope/pkg',version:'1.2.3',offline:true},{fetcher:()=>{throw Error('should not fetch');}});
    assert.equal(cached.sources[1].status,'cached');
  });
});

test('dependency offline mode marks uncached data unknown', async () => {
  await withProject(async root => {
    const result = await inspectDependency(root,{ecosystem:'pypi',name:'some-pkg',version:'1.0.0',offline:true});
    assert.equal(result.status,'incomplete_evidence');
    assert.equal(result.knownOsvVulnerabilities,null);
  });
});

test('insufficient evidence cannot be approved or selected', async () => {
  await withProject(async root => {
    const d = await recordDecision(root,{topic:'new runtime',tier:'architectural',candidates:[candidate('risky',{gates:{compatible:true,licenseAllowed:true}})]});
    assert.equal(d.authorization,'blocked_on_research');
    assert.equal(d.selected,null);
    await assert.rejects(() => resolveDecision(root,d.id,'approved','user'));
  });
});

test('dependency maven group:artifact uses a safe encoded URL', async () => {
  await withProject(async root => {
    let firstUrl;
    const fetcher = async (url) => {
      firstUrl ??= url;
      return {ok:true,text:async()=>url.includes('deps.dev') ? JSON.stringify({licenses:['Apache-2.0'],advisoryKeys:[]}) : JSON.stringify({vulns:[]})};
    };
    const r = await inspectDependency(root,{ecosystem:'maven',name:'org.example:library',version:'1.0.0'},{fetcher});
    assert.equal(r.status,'evidence_collected');
    assert.match(firstUrl,/org.example%3Alibrary/);
  });
});

test('cli integration: init, decision record, approve, and inspect', async () => {
  const {spawnSync} = await import('node:child_process');
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'steward-cli-test-'));
  const cli = path.resolve('bin/buildsteward.js');
  const run = (...args) => {
    const p = spawnSync(process.execPath,[cli,'--root',root,...args],{encoding:'utf8',timeout:3000});
    assert.equal(p.status,0,p.stderr);
    return JSON.parse(p.stdout).result;
  };
  try {
    assert.equal(run('init','--mode','approval').mode,'approval');
    const d = run('decide','record','--file',path.resolve('examples/decision.json'));
    assert.equal(d.authorization,'awaiting_approval');
    assert.equal(run('decide','approve',d.id,'--actor','human').selected,'SQLite');
    assert.equal(run('decide','list').length,1);
    assert.ok(Array.isArray(run('inspect').markers));
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
