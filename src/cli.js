import fs from 'node:fs/promises';
import path from 'node:path';
import { initialize, readConfig, setConfig } from './config.js';
import { routeTask } from './router.js';
import { inspectProject } from './inspect.js';
import { evaluateDecision, recordDecision, resolveDecision, listDecisions } from './decision.js';
import { inspectDependency } from './dependency.js';
import { inspectProjectDependencies } from './dependency-audit.js';
import { inventoryNpmLock } from './npm-lock-inventory.js';
import { graphNpmLock } from './npm-lock-graph.js';
import { advisoriesForNpmLock } from './npm-lock-advisories.js';
import { listKnowledge, searchKnowledge, readKnowledge } from './library.js';
import { requestApproval, resolveApproval, checkAction, listApprovals } from './approval.js';
import { setCheckpoint, getCheckpoint } from './checkpoint.js';
import { recordProgress } from './progress.js';
import { graphStatus, graphSearch } from './graph.js';
import { setupInstallation, installationDoctor, uninstallInstallation, rollbackInstallation, detectAgents } from './setup.js';
import { createInterface } from 'node:readline/promises';
import { runConsole } from './console.js';
import { createWork, workStatus, nextWork, startWork, completeWork, reviewWork, blockWork, resumeWork, checkWork, workContext } from './work.js';

const HELP = `BuildSteward: local-first developer workflow and engineering intelligence\n\nUsage: buildsteward [--root PATH] [command] [args]\n\n  Run buildsteward with no arguments in a terminal to open the project console.\n\n  setup [--scope project|global] [--agents auto|opencode,codex,claude,cursor]\n        [--mode autonomous|approval] [--graph off|auto|on] [--skill-only] [--dry-run] [--force]\n  doctor [--scope project|global] [--agents opencode,codex] [--strict]\n  uninstall --agents opencode,codex [--scope project|global] [--dry-run] [--force]\n  rollback --agents opencode,codex [--scope project|global] [--dry-run] [--force]\n  init [--mode autonomous|approval]\n  config show | set KEY VALUE\n  inspect\n  route "task description"\n  decide evaluate --file path.json\n  decide record --file path.json\n  decide approve ID --actor LABEL [--selection NAME] [--reason TEXT]\n  decide reject ID --actor LABEL\n  decide list\n  deps inspect --ecosystem npm --name react --version 18.2.0 [--offline]\n  deps project (offline npm manifest/lockfile inspection)\n  deps inventory (offline npm v2/v3 lockfile entries)\n  deps graph (offline npm v2/v3 dependency edges)\n  deps advisories [--online] (npm lockfile OSV evidence)\n  library list | search "words" | show ID [--detail]\n  approvals request --action ACTION --target TARGET --reason TEXT\n  approvals approve ID --actor LABEL | reject ID --actor LABEL | list\n  guard --action ACTION --target TARGET\n  checkpoint show | save --file path.json\n  progress record --action TEXT --outcome progress|no_progress|blocked [--evidence TEXT]\n  graph status | search "query" [--project NAME]\n  work create --file plan.json | status | next | context\n  work start --id ID | done --id ID --evidence TEXT\n  work review --id ID --evidence TEXT (manual tasks only)\n  work check --id ID --runner npm-test|node-test|go-test|cargo-test|python-test --confirm-run\n  work block --id ID --reason TEXT | resume --id ID\n\nDirect commands emit JSON, except help. Network is used by deps inspect and deps advisories --online.\n`;
function param(args, key, fallback) {
  const i = args.indexOf(key); if (i === -1) return fallback;
  if (i + 1 >= args.length || args[i + 1].startsWith('--')) throw new Error('Missing value for '+key);
  return args[i+1];
}
function required(args, key) { const v = param(args,key); if (!v) throw new Error('Missing required '+key); return v; }
function positional(args) { return args.filter((v,i) => i === 0 || !args[i-1].startsWith('--')).filter(v => !v.startsWith('--')); }
async function readInput(file) { if (!file) throw new Error('Missing --file'); return JSON.parse(await fs.readFile(path.resolve(file),'utf8')); }
export async function main(args) {
  let root = process.cwd();
  if (args[0] === '--root') { if (!args[1]) throw new Error('Missing --root path'); root = path.resolve(args[1]); args = args.slice(2); }
  if (args.length === 0 && process.stdin.isTTY && process.stdout.isTTY) {
    return runConsole({
      root, input: process.stdin, output: process.stdout,
      showHelp: () => process.stdout.write(HELP),
    });
  }
  if (args.length === 0 || args[0] === 'help' || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP);
    return;
  }
  const [command, sub, ...rest] = args;
  let result;
  switch(command) {
    case 'setup': {
      let agents = param(args,'--agents','auto');
      if (agents === 'auto') {
        const detected = await detectAgents();
        // Agent binaries are not always on PATH even when the host supports skills.
        // Interactive setup can ask for an explicit target instead of failing early.
        if (!detected.length && (!process.stdin.isTTY || args.includes('--yes') || args.includes('--dry-run')))
          throw new Error('No coding agent executable detected. Pass --agents opencode,codex,claude,cursor explicitly.');
        agents = detected.length ? detected : '';
      }
      let scope=param(args,'--scope','project'), mode=param(args,'--mode','approval'), graph=param(args,'--graph','off');
      if(process.stdin.isTTY && !args.includes('--yes') && !args.includes('--dry-run')){
        const rl=createInterface({input:process.stdin,output:process.stderr});
        try {
          scope=(await rl.question(`Installation scope [${scope}]: `)).trim()||scope;
          agents=(await rl.question(`Agents (opencode,codex,claude,cursor) [${Array.isArray(agents)?agents.join(','):agents||'select'}]: `)).trim()||agents;
          if(scope==='project') {
            mode=(await rl.question(`Decision mode [${mode}]: `)).trim()||mode;
            graph=(await rl.question(`Optional graph [${graph}]: `)).trim()||graph;
          }
          const confirmation=(await rl.question('Install BuildSteward into selected agent directories? [y/N] ')).trim().toLowerCase();
          if(!['y','yes'].includes(confirmation)) throw new Error('Setup cancelled');
        } finally {rl.close();}
      }
      result=await setupInstallation({root,scope,agents,mode,graph,dryRun:args.includes('--dry-run'),force:args.includes('--force'),withRuntime:!args.includes('--skill-only')});
      break;
    }
    case 'doctor': {
      result = await installationDoctor({root,scope:param(args,'--scope','project'),agents:param(args,'--agents')});
      if(args.includes('--strict') && !result.healthy) {
        const failures=result.agents.filter(a=>!a.healthy).map(a=>`${a.agent}:${a.status}`);
        throw new Error(`Installation check failed: ${failures.join(', ')}`);
      }
      break;
    }
    case 'uninstall': result = await uninstallInstallation({root,scope:param(args,'--scope','project'),agents:required(args,'--agents'),dryRun:args.includes('--dry-run'),force:args.includes('--force')}); break;
    case 'rollback': result = await rollbackInstallation({root,scope:param(args,'--scope','project'),agents:required(args,'--agents'),dryRun:args.includes('--dry-run'),force:args.includes('--force')}); break;
    case 'init': result = await initialize(root, param(args,'--mode','approval')); break;
    case 'config':
      if(sub==='show') result = await readConfig(root);
      else if(sub==='set') result = await setConfig(root, args[2], args[3]);
      else throw new Error('Expected config show|set');
      break;
    case 'inspect': result = await inspectProject(root); break;
    case 'route': result = routeTask(args.slice(1).join(' ')); break;
    case 'decide':
      if(sub==='evaluate') result = evaluateDecision(await readInput(required(rest,'--file')));
      else if(sub==='record') result = await recordDecision(root, await readInput(required(rest,'--file')));
      else if(sub==='approve' || sub==='reject') result = await resolveDecision(root, rest[0], sub==='approve'?'approved':'rejected',required(rest,'--actor'),param(rest,'--selection'),param(rest,'--reason'));
      else if(sub==='list') result = await listDecisions(root);
      else throw new Error('Expected decide evaluate|record|list');
      break;
    case 'deps':
      if(sub==='project') result = await inspectProjectDependencies(root);
      else if(sub==='inventory') result = await inventoryNpmLock(root);
      else if(sub==='graph') result = await graphNpmLock(root);
      else if(sub==='advisories') {
        if (rest.length > 1 || rest.some(arg => arg !== '--online')) throw new Error('Usage: deps advisories [--online]');
        result = await advisoriesForNpmLock(root, { online: rest.includes('--online') });
      }
      else if(sub==='inspect') result = await inspectDependency(root, { ecosystem: required(rest,'--ecosystem'), name: required(rest,'--name'), version: required(rest,'--version'), offline: rest.includes('--offline') });
      else throw new Error('Expected deps inspect|project|inventory|graph|advisories');
      break;
    case 'library':
      if(sub==='list') result = (await listKnowledge()).map(e => ({id:e.id,title:e.title,summary:e.summary}));
      else if(sub==='search') result = await searchKnowledge(args.slice(2).join(' '));
      else if(sub==='show') result = await readKnowledge(args[2], args.includes('--detail'));
      else throw new Error('Expected library list|search|show');
      break;
    case 'approvals':
      if(sub==='request') result = await requestApproval(root, required(rest,'--action'),required(rest,'--target'),required(rest,'--reason'));
      else if(sub==='approve' || sub==='reject') result = await resolveApproval(root, rest[0], sub==='approve'?'approved':'rejected', required(rest,'--actor'));
      else if(sub==='list') result = await listApprovals(root);
      else throw new Error('Expected approvals request|approve|reject|list');
      break;
    case 'guard': result = await checkAction(root,required(args.slice(1),'--action'),required(args.slice(1),'--target')); break;
    case 'checkpoint':
      if(sub==='show') result = await getCheckpoint(root);
      else if(sub==='save') result = await setCheckpoint(root,await readInput(required(rest,'--file')));
      else throw new Error('Expected checkpoint show|save');
      break;
    case 'progress':
      if(sub!=='record') throw new Error('Expected progress record');
      result = await recordProgress(root, { action:required(rest,'--action'), outcome:required(rest,'--outcome'), evidence:param(rest,'--evidence','') });
      break;
    case 'work':
      if(sub==='create') result=await createWork(root,await readInput(required(rest,'--file')));
      else if(sub==='status') result=await workStatus(root);
      else if(sub==='next') result=await nextWork(root);
      else if(sub==='context') result=await workContext(root);
      else if(sub==='start') result=await startWork(root,required(rest,'--id'));
      else if(sub==='done') result=await completeWork(root,required(rest,'--id'),required(rest,'--evidence'));
      else if(sub==='review') result=await reviewWork(root,required(rest,'--id'),required(rest,'--evidence'));
      else if(sub==='check') result=await checkWork(root,required(rest,'--id'),required(rest,'--runner'),{confirmed:rest.includes('--confirm-run')});
      else if(sub==='block') result=await blockWork(root,required(rest,'--id'),required(rest,'--reason'));
      else if(sub==='resume') result=await resumeWork(root,required(rest,'--id'));
      else throw new Error('Expected work create|status|next|context|start|done|review|check|block|resume');
      break;
    case 'graph':
      if(sub==='status') result = await graphStatus(root);
      else if(sub==='search') result = await graphSearch(root,rest.filter((v,i)=> !v.startsWith('--') && (i===0 || !rest[i-1].startsWith('--'))).join(' '),param(rest,'--project'));
      else throw new Error('Expected graph status|search');
      break;
    default: throw new Error('Unknown command. Run help.');
  }
  process.stdout.write(JSON.stringify({ok:true,result},null,args.includes('--pretty') ? 2 : 0)+'\n');
}
