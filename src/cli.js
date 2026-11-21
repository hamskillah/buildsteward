import fs from 'node:fs/promises';
import path from 'node:path';
import { initialize, readConfig, setConfig } from './config.js';
import { routeTask } from './router.js';
import { inspectProject } from './inspect.js';
import { evaluateDecision, recordDecision, resolveDecision, listDecisions } from './decision.js';
import { inspectDependency } from './dependency.js';
import { listKnowledge, searchKnowledge, readKnowledge } from './library.js';
import { requestApproval, resolveApproval, checkAction, listApprovals } from './approval.js';
import { setCheckpoint, getCheckpoint } from './checkpoint.js';
import { recordProgress } from './progress.js';
import { graphStatus, graphSearch } from './graph.js';

const HELP = `BuildSteward: local-first developer workflow and engineering intelligence\n\nUsage: node bin/buildsteward.js [--root PATH] <command> [args]\n\n  init [--mode autonomous|approval]\n  config show | set KEY VALUE\n  inspect\n  route "task description"\n  decide evaluate --file path.json\n  decide record --file path.json\n  decide approve ID --actor LABEL [--selection NAME] [--reason TEXT]\n  decide reject ID --actor LABEL\n  decide list\n  deps inspect --ecosystem npm --name react --version 18.2.0 [--offline]\n  library list | search "words" | show ID [--detail]\n  approvals request --action ACTION --target TARGET --reason TEXT\n  approvals approve ID --actor LABEL | reject ID --actor LABEL | list\n  guard --action ACTION --target TARGET\n  checkpoint show | save --file path.json\n  progress record --action TEXT --outcome progress|no_progress|blocked [--evidence TEXT]\n  graph status | search "query" [--project NAME]\n\nAll output is JSON (except help). Network is used only by deps inspect.\n`;
function param(args, key, fallback) {
  const i = args.indexOf(key); if (i === -1) return fallback;
  if (i + 1 >= args.length || args[i + 1].startsWith('--')) throw new Error('Missing value for '+key);
  return args[i+1];
}
function required(args, key) { const v = param(args,key); if (!v) throw new Error('Missing required '+key); return v; }
function positional(args) { return args.filter((v,i) => i === 0 || !args[i-1].startsWith('--')).filter(v => !v.startsWith('--')); }
async function readInput(file) { if (!file) throw new Error('Missing --file'); return JSON.parse(await fs.readFile(path.resolve(file),'utf8')); }
export async function main(args) {
  if (args.length === 0 || ['help', '-h', '--help'].includes(args[0])) { process.stdout.write(HELP); return; }
  let root = process.cwd();
  if (args[0] === '--root') { if (!args[1]) throw new Error('Missing --root path'); root = path.resolve(args[1]); args = args.slice(2); }
  const [command, sub, ...rest] = args;
  let result;
  switch(command) {
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
      if(sub !== 'inspect') throw new Error('Expected deps inspect');
      result = await inspectDependency(root, { ecosystem: required(rest,'--ecosystem'), name: required(rest,'--name'), version: required(rest,'--version'), offline: rest.includes('--offline') });
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
    case 'graph':
      if(sub==='status') result = await graphStatus(root);
      else if(sub==='search') result = await graphSearch(root,rest.filter((v,i)=> !v.startsWith('--') && (i===0 || !rest[i-1].startsWith('--'))).join(' '),param(rest,'--project'));
      else throw new Error('Expected graph status|search');
      break;
    default: throw new Error('Unknown command. Run help.');
  }
  process.stdout.write(JSON.stringify({ok:true,result},null,args.includes('--pretty') ? 2 : 0)+'\n');
}
