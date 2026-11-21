#!/usr/bin/env node
import { main } from '../src/cli.js';
main(process.argv.slice(2)).catch((error) => {
  const message = error?.message || String(error);
  process.stderr.write(JSON.stringify({ ok: false, error: message }) + '\n');
  process.exitCode = 1;
});
