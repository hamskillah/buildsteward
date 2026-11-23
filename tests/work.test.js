import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initialize } from '../src/config.js';
import { validateWorkPlan, createWork, workStatus, nextWork, startWork, completeWork, reviewWork, blockWork, resumeWork, checkWork, workContext } from '../src/work.js';
const plan = {
  goal:'A working user dashboard',
  tasks:[
    {id:'design',title:'Draft dashboard layout',kind:'design',risk:'low',verification:'manual',dependsOn:[],acceptance:['Layout has documented screen states']},
    {id:'build',title:'Implement dashboard',kind:'feature',risk:'medium',verification:'automated',dependsOn:['design'],acceptance:['Dashboard renders with expected data']},
    {id:'release',title:'Build release candidate',kind:'release',risk:'high',verification:'automated',dependsOn:['build'],acceptance:['Release build and tests pass']}
  ]
};
async function fixture(cb) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'steward-work-'));
  try {await initialize(root);return await cb(root);} finally {await fs.rm(root,{recursive:true,force:true});}
}
test('work plan rejects cycles, duplicate IDs, missing criteria and unsafe manual verification',()=>{
  const cyclic=structuredClone(plan);cyclic.tasks[0].dependsOn=['release'];
  assert.throws(()=>validateWorkPlan(cyclic),/Circular/);
  const duplicate=structuredClone(plan);duplicate.tasks[1].id='design';
  assert.throws(()=>validateWorkPlan(duplicate),/Duplicate/);
  const noAcceptance=structuredClone(plan);noAcceptance.tasks[1].acceptance=[];
  assert.throws(()=>validateWorkPlan(noAcceptance),/acceptance/);
  const manual=structuredClone(plan);manual.tasks[1].verification='manual';
  assert.throws(()=>validateWorkPlan(manual),/automated/);
  assert.equal(validateWorkPlan(plan).tasks.length,3);
});
test('work lifecycle handles prerequisites, project continuity, manual review and machine check',async()=>fixture(async root=>{
  assert.equal((await createWork(root,plan)).ready[0],'design');
  await assert.rejects(()=>createWork(root,plan),/already exists/);
  await assert.rejects(()=>startWork(root,'build'),/not ready/);
  assert.equal((await nextWork(root)).task.id,'design');
  await startWork(root,'design');
  await assert.rejects(()=>startWork(root,'build'),/active task/);
  await completeWork(root,'design','Wireframe and states documented');
  assert.equal((await workStatus(root)).ready.length,0);
  await reviewWork(root,'design','Reviewed against acceptance criteria');
  assert.equal((await nextWork(root)).task.id,'build');
  await startWork(root,'build');
  assert.equal((await workContext(root)).task.id,'build');
  await completeWork(root,'build','Implemented dashboard component');
  assert.equal((await workStatus(root)).planComplete,false);
  await assert.rejects(()=>checkWork(root,'build','node-test'),/confirm-run/);
  const checked=await checkWork(root,'build','node-test',{confirmed:true,spawn:()=>({status:0,stdout:'pass',stderr:''})});
  assert.equal(checked.status,'checked');
  assert.equal(checked.check.passed,true);
  assert.equal((await nextWork(root)).task.id,'release');
  await startWork(root,'release');
  await blockWork(root,'release','Need release credentials');
  assert.deepEqual((await workStatus(root)).blocked,['release']);
  await resumeWork(root,'release');
  await startWork(root,'release');
  await completeWork(root,'release','Prepared release candidate');
  const failed=await checkWork(root,'release','node-test',{confirmed:true,spawn:()=>({status:1,stdout:'failure',stderr:''})});
  assert.equal(failed.status,'implemented');
  const passed=await checkWork(root,'release','node-test',{confirmed:true,spawn:()=>({status:0,stdout:'pass',stderr:''})});
  assert.equal(passed.status,'checked');
  const summary=await workStatus(root);
  assert.equal(summary.planComplete,true);
  assert.equal(summary.releaseReadiness,'not_assessed');
}));
test('work check runner allowlist, bounded output and missing proof are enforced',async()=>fixture(async root=>{
  const small={goal:'Fix tests',tasks:[{id:'bug',title:'Fix broken test',kind:'bugfix',risk:'medium',verification:'automated',dependsOn:[],acceptance:['Test passes']}]};
  await createWork(root,small);await startWork(root,'bug');
  await assert.rejects(()=>completeWork(root,'bug',''),/evidence/);
  await completeWork(root,'bug','Updated implementation');
  await assert.rejects(()=>checkWork(root,'bug','bash',{confirmed:true}),/Unsupported/);
  await assert.rejects(()=>reviewWork(root,'bug','manual approve'),/manual-review/);
  const result=await checkWork(root,'bug','npm-test',{confirmed:true,spawn:()=>({status:0,stdout:'supersecret',stderr:''})});
  assert.equal(result.check.passed,true);
  assert.ok(!JSON.stringify(await workContext(root)).includes('supersecret'));
  assert.ok(!JSON.stringify(result).includes('supersecret'));
}));
test('CLI work commands create, start, done, review and restore context',async()=>fixture(async root=>{
  const filename=path.join(root,'plan.json');
  await fs.writeFile(filename,JSON.stringify(plan));
  const cli=path.resolve('bin/buildsteward.js');
  const run=(...args)=>{
    const p=spawnSync(process.execPath,[cli,'--root',root,...args],{encoding:'utf8',timeout:3000});
    assert.equal(p.status,0,p.stderr);
    return JSON.parse(p.stdout).result;
  };
  assert.equal(run('work','create','--file',filename).ready[0],'design');
  assert.equal(run('work','next').task.id,'design');
  run('work','start','--id','design');
  run('work','done','--id','design','--evidence','Design exists');
  run('work','review','--id','design','--evidence','Reviewer checked');
  assert.equal(run('work','context').task.id,'build');
}));
test('three identical failed checks stop repeated no-progress test loops',async()=>fixture(async root=>{
  const small={goal:'Resolve flaky build',tasks:[{id:'fix',title:'Fix build',kind:'bugfix',risk:'medium',verification:'automated',dependsOn:[],acceptance:['Test passes']}]};
  await createWork(root,small);await startWork(root,'fix');await completeWork(root,'fix','Updated build code');
  const fail=()=>({status:1,stdout:'failure unchanged',stderr:''});
  await checkWork(root,'fix','node-test',{confirmed:true,spawn:fail});
  await checkWork(root,'fix','node-test',{confirmed:true,spawn:fail});
  const third=await checkWork(root,'fix','node-test',{confirmed:true,spawn:fail});
  assert.equal(third.status,'blocked');
  await assert.rejects(()=>checkWork(root,'fix','node-test',{confirmed:true,spawn:fail}),/implemented/);
  await resumeWork(root,'fix');
  assert.equal((await nextWork(root)).task.id,'fix');
}));

test('real Node test failure still blocks after three runs with changing timing', async () => fixture(async root => {
  const small = { goal: 'Fix a repeatable assertion', tasks: [
    { id: 'fix', title: 'Fix the assertion', kind: 'bugfix', risk: 'low', verification: 'automated', dependsOn: [], acceptance: ['Test passes'] },
  ] };
  await createWork(root, small);
  await startWork(root, 'fix');
  await completeWork(root, 'fix', 'Fixture prepared');
  await fs.writeFile(path.join(root, 'sample.test.mjs'), `
    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import { setTimeout } from 'node:timers/promises';
    import { readFile, writeFile } from 'node:fs/promises';
    test('repeatable failure', async () => {
      const prior = Number(await readFile('run-count', 'utf8').catch(() => '0'));
      await writeFile('run-count', String(prior + 1));
      await setTimeout(30 * prior);
      assert.equal(1, 2);
    });
  `);
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await checkWork(root, 'fix', 'node-test', { confirmed: true }));
  assert.equal(new Set(runs.map(run => run.check.outputDigest)).size, 3);
  assert.equal(new Set(runs.map(run => run.check.failureFingerprint)).size, 1);
  assert.deepEqual(runs.map(run => run.status), ['implemented', 'implemented', 'blocked']);
}));

test('work check runs the installed npm executable and records the result', async () => fixture(async root => {
  await fs.writeFile(path.join(root,'package.json'),JSON.stringify({scripts:{test:'node verify.cjs'}}));
  await fs.writeFile(path.join(root,'verify.cjs'),'process.stdout.write("test script ran");');
  const task={id:'verify',title:'Verify npm script',kind:'test',risk:'low',verification:'automated',dependsOn:[],acceptance:['Script returns success']};
  await createWork(root,{goal:'Verify npm execution',tasks:[task]});
  await startWork(root,task.id);
  await completeWork(root,task.id,'Verification script available');
  const result=await checkWork(root,task.id,'npm-test',{confirmed:true});
  assert.equal(result.status,'checked');
}));

test('empty Node suites do not complete work or unlock dependents', async () => fixture(async root => {
  const small = structuredClone(plan);
  small.tasks = small.tasks.slice(1);
  small.tasks[0].dependsOn = [];
  await createWork(root, small);
  await startWork(root, 'build');
  await completeWork(root, 'build', 'Implementation ready');
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
    scripts: { test: 'node --test' },
  }));
  for (const runner of ['node-test', 'npm-test']) {
    const result = await checkWork(root, 'build', runner, {confirmed:true});
    assert.equal(result.check.exitCode, 0);
    assert.equal(result.check.failureKind, 'no_tests');
    assert.equal(result.check.passed, false);
    assert.equal(result.status, 'implemented');
    assert.equal((await nextWork(root)).status, 'none_ready');
  }
  await fs.writeFile(path.join(root, 'proof.test.mjs'), "import { test } from 'node:test'; test('checks work', () => {});");
  assert.equal((await checkWork(root, 'build', 'npm-test', {confirmed:true})).status, 'checked');
  assert.equal((await nextWork(root)).task.id, 'release');
}));

test('Node warning PIDs and durations do not hide repeated failures', async () => fixture(async root => {
  await createWork(root, plan);
  await startWork(root, 'design');
  await completeWork(root, 'design', 'Layout done');
  await reviewWork(root, 'design', 'Layout checked');
  await startWork(root, 'build');
  await completeWork(root, 'build', 'Implementation done');

  for (const pid of [151, 203, 255]) {
    const result = await checkWork(root, 'build', 'node-test', {
      confirmed: true,
      spawn: () => ({
        status: 1,
        stdout: `# (node:${pid}) [UNDICI-EHPA] Warning: EnvHttpProxyAgent is experimental\nnot ok 1 - regression\n# duration_ms ${pid}\n`,
        stderr: `(node:${pid + 1}) [UNDICI-EHPA] Warning: EnvHttpProxyAgent is experimental\n`,
      }),
    });
    assert.equal(result.status, pid === 255 ? 'blocked' : 'implemented');
  }
}));

test('work context prioritizes the active task over an earlier implementation', async () => fixture(async root => {
  const small = structuredClone(plan);
  small.tasks[1].dependsOn = [];
  await createWork(root, small);
  await startWork(root, 'design');
  await completeWork(root, 'design', 'Layout ready');
  assert.equal((await workContext(root)).task.id, 'design');
  await startWork(root, 'build');
  assert.equal((await nextWork(root)).task.id, 'build');
  assert.equal((await workContext(root)).task.id, 'build');
}));
