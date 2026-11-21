import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const fixtureRunner = path.join(import.meta.dirname, 'run.js');
const arms = ['baseline', 'skill', 'cli'];
const timeoutMs = 65_000;
const cli = 'node .agents/skills/buildsteward/runtime/bin/buildsteward.js';
const dependencyCommands = [`${cli} deps project`, `${cli} deps inventory`];

function succeededDependencyCall(call) {
  if (call.tool !== 'bash' || call.state.metadata?.exit !== 0 || !dependencyCommands.includes(call.state.input?.command)) return false;
  try {
    const report = JSON.parse(call.state.output);
    return report?.ok === true && report.result?.ecosystem === 'npm';
  } catch { return false; }
}

function fixture(...args) {
  const child = spawnSync(process.execPath, [fixtureRunner, ...args], {
    encoding: 'utf8', timeout: 20_000, maxBuffer: 128 * 1024,
  });
  if (child.status !== 0) throw new Error(child.error?.message || child.stderr || 'Fixture command failed.');
  return JSON.parse(child.stdout);
}

function summarize(stdout) {
  const events = stdout.split('\n').flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const steps = events.filter(event => event?.type === 'step_finish').map(event => event.part ?? {});
  const calls = events.filter(event => event?.type === 'tool_use').map(event => event.part ?? {});
  const successful = calls.filter(call => call.state?.status === 'completed');
  const totals = {};
  const counters = {
    input: step => step.tokens?.input,
    output: step => step.tokens?.output,
    reasoning: step => step.tokens?.reasoning,
    total: step => step.tokens?.total,
    cachedRead: step => step.tokens?.cache?.read,
    cachedWrite: step => step.tokens?.cache?.write,
    estimatedCost: step => step.cost,
  };
  for (const [key, select] of Object.entries(counters)) {
    const values = steps.map(select);
    totals[key] = values.length && values.every(Number.isFinite)
      ? values.reduce((sum, value) => sum + value, 0) : null;
  }
  return {
    stopped: steps.at(-1)?.reason === 'stop',
    agentErrors: events.filter(event => event?.type === 'error').length,
    skillUsed: successful.some(call => call.tool === 'skill' && call.state.input?.name === 'buildsteward'),
    cliUsed: successful.some(succeededDependencyCall),
    toolCalls: calls.length,
    toolErrors: calls.filter(call => call.state?.status === 'error').length,
    usage: steps.length ? totals : null,
  };
}

async function runArm({ task, model, arm, output }) {
  const directory = path.join(output, arm);
  await mkdir(directory, { mode: 0o700 });
  const project = path.join(directory, 'project');
  const { prompt } = fixture('prepare', task, arm, project);
  const env = { OPENCODE_DISABLE_AUTOUPDATE: 'true' };
  for (const name of [
    'PATH', 'SYSTEMROOT', 'TMPDIR',
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
    'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy',
    'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
    'OPENCODE_API_KEY',
  ]) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  for (const name of ['CONFIG', 'DATA', 'STATE', 'CACHE']) {
    env[`XDG_${name}_HOME`] = path.join(directory, name.toLowerCase());
  }
  const home = path.join(directory, 'home');
  await mkdir(home, { mode: 0o700 });
  env.HOME = home;
  env.USERPROFILE = home;
  const git = spawnSync('git', ['init', '-q', '--template='], {
    cwd: project, env, encoding: 'utf8', timeout: 5000, maxBuffer: 4096,
  });
  if (git.status !== 0) throw new Error('Unable to initialize the isolated benchmark project.');
  env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ permission: {
    '*': 'deny',
    external_directory: 'deny',
    read: 'allow',
    glob: 'allow',
    grep: 'allow',
    skill: { buildsteward: 'allow' },
    edit: { '*': 'deny', [task === 'bugfix' ? 'totals.mjs' : 'assessment.json']: 'allow' },
    bash: {
      'node --test': 'allow', 'node --test totals.test.mjs': 'allow',
      [dependencyCommands[0]]: 'allow', [dependencyCommands[1]]: 'allow',
    },
  } });
  const start = performance.now();
  const child = spawnSync('opencode', [
    'run', '--pure', '--dir', project, '--format', 'json', '--model', model, prompt,
  ], { cwd: project, env, input: '', encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 512 * 1024 });
  const stdout = child.stdout ?? '';
  await writeFile(path.join(directory, 'events.jsonl'), stdout, { mode: 0o600 });
  await writeFile(path.join(directory, 'stderr.log'), child.stderr ?? '', { mode: 0o600 });
  const { stopped, ...observed } = summarize(stdout);
  const completed = child.status === 0 && stopped && !observed.agentErrors;
  const blocked = !observed.usage && !observed.toolCalls;
  return {
    arm, status: completed ? 'complete' : blocked ? 'blocked' : 'incomplete',
    agentExit: child.status, processError: child.error?.code ?? null,
    elapsedSeconds: Math.round((performance.now() - start) / 10) / 100,
    score: completed ? fixture('score', task, project) : null,
    ...observed,
  };
}

try {
  const [task, model, outputPath, orderArg, ...extra] = process.argv.slice(2);
  const order = orderArg?.split(',') ?? arms;
  if (!['bugfix', 'audit'].includes(task) || !/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:/-]*$/i.test(model ?? '') ||
      !outputPath || extra.length || order.length !== arms.length || !arms.every(arm => order.includes(arm))) {
    throw new Error('Usage: node benchmarks/opencode.js <bugfix|audit> <provider/model> <new-directory> [baseline,skill,cli]');
  }
  const version = spawnSync('opencode', ['--version'], { encoding: 'utf8', timeout: 5000, maxBuffer: 4096 });
  if (version.status !== 0) throw new Error('OpenCode executable not available on PATH.');
  const output = path.resolve(outputPath);
  await mkdir(output, { mode: 0o700 });
  const report = { task, model, agentVersion: version.stdout.trim(), timeoutSeconds: timeoutMs / 1000, runs: [] };
  for (const arm of order) {
    const blocked = report.runs.some(run => run.status === 'blocked');
    report.runs.push(blocked ? { arm, status: 'not_run' } : await runArm({ task, model, arm, output }));
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
