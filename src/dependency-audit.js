/** Compact offline npm manifest/lockfile consistency inspection.
 * This is NOT a vulnerability, license or runtime-compatibility audit.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readConfig } from './config.js';

const MAX_BYTES=8_000_000;
async function readJsonLimited(filename) {
  const handle=await fs.open(filename,'r');
  try {
    const stat=await handle.stat();
    if(stat.size>MAX_BYTES)throw new Error(`JSON file too large: ${path.basename(filename)}`);
    const content=await handle.readFile('utf8');
    return {value:JSON.parse(content),hash:createHash('sha256').update(content).digest('hex')};
  } finally {await handle.close();}
}
export async function inspectProjectDependencies(root) {
  await readConfig(root);
  const manifestFile=path.join(root,'package.json');
  let pkg;
  try {pkg=await readJsonLimited(manifestFile);} catch(e){if(e.code==='ENOENT')return {ecosystem:'npm',status:'no_npm_manifest',note:'Only npm package.json and package-lock.json are supported by this offline check.'};throw e;}
  const fields=['dependencies','devDependencies','optionalDependencies'];
  const declared=new Map();
  for(const field of fields) {
    const entries=pkg.value[field]||{};
    if(!entries||typeof entries!=='object'||Array.isArray(entries))throw new Error(`Invalid package.json ${field}`);
    for(const [name,range] of Object.entries(entries)){
      if(typeof range!=='string')throw new Error(`Invalid dependency range for ${name}`);
      declared.set(name,{name,range,kind:field});
    }
  }
  let lock;
  try {lock=await readJsonLimited(path.join(root,'package-lock.json'));}catch(e){if(e.code==='ENOENT')return {ecosystem:'npm',status:'lockfile_missing',directCount:declared.size,manifestDigest:pkg.hash,checksNotPerformed:['dependency resolution','vulnerability analysis','license compliance','runtime compatibility'],note:'Create a lockfile through your package manager before claiming reproducible resolution.'};throw e;}
  if(![1,2,3].includes(lock.value.lockfileVersion))return {ecosystem:'npm',status:'unsupported_lockfile_version',lockfileVersion:lock.value.lockfileVersion};
  const lockPackages=lock.value.packages||{};
  const rootPkg=lockPackages['']||null;
  const missing=[],mismatch=[],direct=[];
  for(const entry of declared.values()){
    const target=lockPackages[`node_modules/${entry.name}`]||lock.value.dependencies?.[entry.name]||null;
    const lockRange=rootPkg?.[entry.kind]?.[entry.name];
    if(!target?.version)missing.push(entry.name);
    if(rootPkg && lockRange!==entry.range)mismatch.push(entry.name);
    direct.push({...entry,lockedVersion:target?.version||null});
  }
  const count=Object.keys(lockPackages).filter(x=>x!==''&&x.startsWith('node_modules/')).length||Object.keys(lock.value.dependencies||{}).length;
  const warnings=[];
  if(missing.length)warnings.push('Declared dependency missing from lockfile');
  if(mismatch.length)warnings.push('Lockfile root declarations differ from package.json');
  const hasMismatch=missing.length>0||mismatch.length>0;
  return {
    ecosystem:'npm',status:hasMismatch?'inconsistent':'consistent_manifest',
    lockfileVersion:lock.value.lockfileVersion,
    counts:{direct:declared.size,lockedPackageEntries:count},
    missing:missing.slice(0,30),mismatchedRanges:mismatch.slice(0,30),
    directPreview:direct.slice(0,20),truncatedDirectPreview:direct.length>20,
    manifestDigest:pkg.hash,lockfileDigest:lock.hash,
    warnings,checksNotPerformed:['security advisory scanning','license compatibility','transitive vulnerability verification','runtime compatibility'],
    note:'Manifest consistency is not proof of vulnerability-free or reproducible platform-specific installs.'
  };
}
