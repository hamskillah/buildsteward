import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initialize, setConfig } from '../src/config.js';
import { graphSearch, graphStatus } from '../src/graph.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-graph-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await initialize(root);
  await setConfig(root, 'memory.codeGraph.mode', 'on');
  return root;
}

const ok = data => ({ status: 0, stdout: JSON.stringify(data) });

test('graph selects only the index for the current checkout and passes a literal pattern', async t => {
  const root = await fixture(t);
  const otherRoot = await fixture(t);
  const spawn = (binary, args, options) => {
    assert.equal(binary, 'codebase-memory-mcp');
    assert.equal(options.cwd, root);
    if (args[1] === 'list_projects') {
      assert.deepEqual(JSON.parse(args[2]), { limit: 100, format: 'json' });
      return ok({ projects: [
        { name: 'other', root_path: otherRoot }, { name: 'this-index', root_path: root },
      ], has_more: false });
    }
    assert.equal(args[1], 'search_graph');
    return ok(JSON.parse(args[2]));
  };
  const answer = await graphSearch(root, 'a.*[b]\\c', undefined, { spawn });
  const output = JSON.parse(answer.output);
  assert.equal(answer.project, 'this-index');
  assert.equal(output.project, 'this-index');
  assert.equal(output.name_pattern, 'a\\.\\*\\[b\\]\\\\c');
  assert.equal(output.limit, 12);
});

test('graph requires an explicit project for ambiguous or incomplete discovery', async t => {
  const root = await fixture(t);
  const projects = ['a', 'b'].map(name => ({ name, root_path: root }));
  const fake = has_more => () => ok({ projects, has_more });
  await assert.rejects(graphSearch(root, 'name', undefined, { spawn: fake(true) }), /incomplete/);
  await assert.rejects(graphSearch(root, 'name', undefined, { spawn: fake(false) }), /Expected one indexed/);
  const result = await graphSearch(root, 'name', 'chosen-index', { spawn: (_binary, args) => {
    assert.equal(args[1], 'search_graph');
    return ok(JSON.parse(args[2]));
  } });
  assert.equal(result.project, 'chosen-index');
});

test('graph status separates an installed binary from a reachable provider', async t => {
  const root = await fixture(t);
  const spawn = (_binary, args) => args[0] === '--help' ? ok(null) : { status: 1, stderr: 'daemon unavailable' };
  const status = await graphStatus(root, { spawn });
  assert.equal(status.available, true);
  assert.equal(status.active, false);
  assert.match(status.note, /daemon unavailable/);
});
