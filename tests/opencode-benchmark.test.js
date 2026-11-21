import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const runner = path.resolve('benchmarks/opencode.js');

async function run(t, fails) {
  const root = await mkdtemp(path.join(tmpdir(), 'buildsteward-matrix-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const stub = path.join(root, 'opencode');
  await writeFile(stub, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('fake-1'); process.exit(0); }
if (args[args.indexOf('--dir') + 1] !== process.cwd()) process.exit(2);
if (${fails}) {
  console.log(JSON.stringify({type:'error',error:{name:'ProviderError'}}));
  process.exit(0);
}
fs.writeFileSync('assessment.json', JSON.stringify({staleRoot:'removed-pkg',nestedVersion:'2.0.0',vulnerabilityStatus:'unknown'}));
const event=(type,part)=>console.log(JSON.stringify({type,part}));
if (fs.existsSync('.agents/skills/buildsteward/SKILL.md')) event('tool_use',{tool:'skill',state:{status:'completed',input:{name:'buildsteward'}}});
if (fs.existsSync('.agents/skills/buildsteward/runtime')) event('tool_use',{tool:'bash',state:{status:'completed',input:{command:'node .agents/skills/buildsteward/runtime/bin/buildsteward.js deps project'}}});
event('step_finish',{reason:'stop',tokens:{input:100,output:10,cache:{read:2,write:0}},cost:0});
`, { mode: 0o700 });
  const out = path.join(root, 'matrix');
  const result = spawnSync(process.execPath, [runner, 'audit', 'opencode/test', out], {
    encoding: 'utf8', env: { ...process.env, PATH: root + path.delimiter + process.env.PATH },
    timeout: 30_000,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(await readFile(path.join(out, 'report.json'), 'utf8'));
}

test('OpenCode matrix prepares all three arms and records independent evidence', async t => {
  const report = await run(t, false);
  assert.equal(report.agentVersion, 'fake-1');
  assert.deepEqual(report.runs.map(r=>[r.arm,r.status,r.score.pass,r.skillUsed,r.cliUsed]), [
    ['baseline','complete',true,false,false],
    ['skill','complete',true,true,false],
    ['cli','complete',true,true,true],
  ]);
  assert.equal(report.runs[0].usage.input, 100);
});

test('provider errors stop the matrix and are never counted as task failures', async t => {
  const report = await run(t, true);
  assert.equal(report.runs[0].status, 'blocked');
  assert.equal(report.runs[0].score, null);
  assert.deepEqual(report.runs.slice(1).map(r=>r.status), ['not_run','not_run']);
});
