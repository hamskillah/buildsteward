#!/usr/bin/env node
/** Validate release metadata. Does not publish or authenticate with npm. */
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function validateReleaseMetadata(pkg) {
  const problems=[];
  if(pkg.name!=='@hamskillah/buildsteward') problems.push('unexpected npm package identity');
  if(pkg.private===true) problems.push('package is private');
  if(typeof pkg.version!=='string'||!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) problems.push('version must be explicit semver');
  if(pkg.repository?.url!=='git+https://github.com/hamskillah/buildsteward.git') problems.push('repository provenance URL mismatch');
  if(pkg.publishConfig?.access!=='public') problems.push('publishConfig.access must be public');
  if(pkg.bin?.buildsteward!=='bin/buildsteward.js') problems.push('CLI entrypoint mismatch');
  for(const directory of ['bin','src','skills','knowledge','docs']) if(!pkg.files?.includes(directory)) problems.push(`missing packed directory ${directory}`);
  if(!pkg.scripts?.check||!pkg.scripts?.prepublishOnly) problems.push('release checks missing');
  return problems;
}
const invoked=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));
  const problems=validateReleaseMetadata(pkg);
  if(problems.length){console.error(JSON.stringify({ok:false,problems}));process.exitCode=1;}
  else console.log(JSON.stringify({ok:true,name:pkg.name,version:pkg.version,note:'Metadata only; npm ownership/OIDC must be verified by the actual publish operation.'}));
}
