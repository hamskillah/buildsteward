import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import { runConsole } from '../src/console.js';

async function session(t, answers, defaults = []) {
  const root = await mkdtemp(path.join(tmpdir(), 'buildsteward-console-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let display = '';
  await runConsole({
    root,
    input: Readable.from(answers),
    output: new Writable({ write(chunk, _enc, done) { display += chunk; done(); } }),
    detect: async () => defaults,
    showHelp() { display += 'Command reference\n'; },
  });
  return { root, display };
}

test('opening and exiting the console leaves the project untouched', async t => {
  const { root, display } = await session(t, ['4\n', '0\n']);
  assert.match(display, /BuildSteward/);
  assert.match(display, /Command reference/);
  assert.deepEqual(await readdir(root), []);
});

test('console installs to the project using detected defaults and shows its status', async t => {
  const { root, display } = await session(t, ['1\n', '\n', '3\n', '0\n'], ['codex']);
  const skill = await readFile(path.join(root, '.agents/skills/buildsteward/SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: buildsteward/m);
  assert.match(display, /Installed for codex/);
  assert.match(display, /codex: ready/);
});

test('console handles an invalid agent and an explicit cancellation without writes', async t => {
  const { root, display } = await session(t, ['1\n', 'unknown\n', '1\n', 'cancel\n', '0\n']);
  assert.match(display, /Unsupported agent/);
  assert.match(display, /Installation cancelled/);
  assert.deepEqual(await readdir(root), []);
});
