/** Offline inventory of npm v2/v3 lockfile entries. Not a dependency resolver. */
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MAX_BYTES=8_000_000, MAX_PREVIEW=100;
const isObject=v=>v!==null && typeof v==='object' && !Array.isArray(v);
const shortString=(v,max)=>typeof v==='string' && v.length>0 && v.length<=max ? v : null;
const platform=v=>Array.isArray(v) ? v.filter(x=>typeof x==='string' && x.length<=80).slice(0,20) : null;

function packageName(location) {
  const parts=location.split('/');
  const index=parts.lastIndexOf('node_modules');
  if(index<0) return null;
  const tail=parts.slice(index+1);
  if(tail.length===1 && tail[0] && !tail[0].startsWith('@')) return shortString(tail[0],214);
  if(tail.length===2 && /^@[^/]+$/.test(tail[0]) && tail[1]) return shortString(tail.join('/'),214);
  return null;
}

export async function inventoryNpmLock(root) {
  let handle;
  try { handle=await fs.open(path.join(root,'package-lock.json'),constants.O_RDONLY | (constants.O_NONBLOCK ?? 0)); }
  catch(error) { if(error.code==='ENOENT') return {ecosystem:'npm',status:'lockfile_missing'}; throw error; }
  let bytes;
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) return {ecosystem:'npm',status:'invalid_lockfile',reason:'not_regular_file'};
    if (stat.size > MAX_BYTES) throw new Error('Lockfile exceeds 8 MB limit');
    const buffer = Buffer.allocUnsafe(Math.min(MAX_BYTES + 1, stat.size + 1));
    let length = 0;
    while (length < buffer.length) {
      const {bytesRead} = await handle.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length !== stat.size) throw new Error('Lockfile size changed during inventory');
    bytes = buffer.subarray(0, length);
  } finally {await handle.close();}
  let lock;
  try {
    lock = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
  } catch {
    return {ecosystem:'npm',status:'invalid_lockfile',reason:'invalid_json_or_encoding'};
  }
  if(!isObject(lock)) return {ecosystem:'npm',status:'invalid_lockfile',reason:'invalid_root'};
  if (!Number.isSafeInteger(lock.lockfileVersion) || lock.lockfileVersion < 1) return {ecosystem:'npm',status:'invalid_lockfile',reason:'invalid_lockfile_version'};
  if(![2,3].includes(lock.lockfileVersion)) return {ecosystem:'npm',status:'unsupported_lockfile_version',lockfileVersion:lock.lockfileVersion ?? null};
  if(!isObject(lock.packages) || !isObject(lock.packages[''])) return {ecosystem:'npm',status:'invalid_lockfile',reason:'missing_packages_or_root'};
  const preview=[],counts={entries:0,unresolved:0,optional:0,development:0};
  for(const [location,data] of Object.entries(lock.packages)) {
    if(location==='' || !location.split('/').includes('node_modules')) continue;
    counts.entries++;
    const name=packageName(location);
    const validLocation=location.length<=512 && !!name;
    const recordedName=isObject(data) && data.name!==undefined ? shortString(data.name,214) : name;
    const version=isObject(data) ? shortString(data.version,120) : null;
    const status=!validLocation || !isObject(data) || !recordedName ? 'invalid_entry' : data.link===true ? 'unresolved_link' : !version ? 'missing_version' : 'recorded';
    if(status!=='recorded') counts.unresolved++;
    if(data?.optional===true) counts.optional++;
    if(data?.dev===true) counts.development++;
    if(preview.length<MAX_PREVIEW) preview.push({path:location.slice(0,512),name:recordedName,nameSource:isObject(data) && data.name!==undefined?'lockfile':'install_path',version,status,optional:data?.optional===true,dev:data?.dev===true,os:platform(data?.os),cpu:platform(data?.cpu)});
  }
  return {ecosystem:'npm',status:counts.unresolved?'partial':'inventoried',lockfileVersion:lock.lockfileVersion,
    lockfileDigest:createHash('sha256').update(bytes).digest('hex'),counts,entries:preview,truncated:counts.entries>preview.length,
    checksNotPerformed:['dependency edge resolution','vulnerability scanning','license policy','runtime compatibility','package integrity verification'],
    note:'Entries are lockfile records, not proof of an installed dependency graph or security. Names inferred from install paths may be npm aliases. Workspace links and missing versions remain unresolved.'};
}
