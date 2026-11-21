import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initialize, readConfig, safeWriteJson, configPath } from '../src/config.js';
import { graphSearch, graphStatus } from '../src/graph.js';

test('graph passes literal metacharacters and rejects failed provider health checks', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-graph-'));
  try {
    await initialize(root);
    const provider = path.join(root, 'provider');
    await fs.writeFile(provider, '#!/usr/bin/env node\nif(process.argv.includes("--help")) process.exit(1);\nprocess.stdout.write(JSON.stringify(process.argv.slice(2)));\n', {mode:0o755});
    const config = await readConfig(root);
    config.memory.codeGraph.mode = 'on';
    config.memory.codeGraph.provider = provider;
    await safeWriteJson(configPath(root), config);
    assert.equal((await graphStatus(root)).available, false);
    const output = JSON.parse((await graphSearch(root, 'a.*[b]\\c')).output);
    assert.equal(output[output.indexOf('--name-pattern') + 1], 'a\\.\\*\\[b\\]\\\\c');
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
