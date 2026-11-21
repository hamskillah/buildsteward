import path from 'node:path';
import { packageName, readNpmLock } from './npm-lock-inventory.js';

const PREVIEW_LIMIT = 100;
const namePattern = /^(?:@[a-z0-9_~][a-z0-9._~-]*\/)?[a-z0-9_~][a-z0-9._~-]*$/i;
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const fields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validName = name => typeof name === 'string' && name.length <= 214 && namePattern.test(name);
const validLocation = location => location.length <= 512 && location.split('/').every(part => part && part !== '.' && part !== '..' && !part.includes('\\'));

function resolveLocation(packages, from, name, peer) {
  const parent = from.lastIndexOf('/node_modules/');
  let directory = peer ? (parent < 0 ? '' : from.slice(0, parent)) : from;
  while (true) {
    if (path.posix.basename(directory) !== 'node_modules') {
      const location = (directory ? directory + '/' : '') + 'node_modules/' + name;
      if (Object.hasOwn(packages, location)) return location;
    }
    if (!directory) return null;
    const next = path.posix.dirname(directory);
    directory = next === '.' ? '' : next;
  }
}

function targetIdentity(packages, target, name, requested) {
  const record = packages[target];
  if (record?.link === true) return { status: 'unresolved_link' };
  const alias = requested.startsWith('npm:') ? /^npm:((?:@[^/]+\/)?[^@]+)@.+$/.exec(requested)?.[1] : null;
  const actualName = record?.name ?? alias ?? name;
  if (!object(record) || !validName(actualName) || (requested.startsWith('npm:') && (!alias || alias !== actualName)) ||
      typeof record.version !== 'string' || record.version.length > 120 || !versionPattern.test(record.version)) {
    return { status: 'unresolved_identity' };
  }
  if ((/^(?:[a-z][a-z0-9+.-]*:|\.{1,2}\/|\/)/i.test(requested) && !alias) ||
      (typeof record.resolved === 'string' && !/^https?:\/\//i.test(record.resolved))) {
    return { status: 'unsupported_source' };
  }
  return { status: 'resolved', package: { name: actualName, version: record.version } };
}

export async function graphNpmLock(root, { onEdge } = {}) {
  const result = await readNpmLock(root);
  if (!result.lock) return result;
  const { lock: { lockfileVersion, packages }, lockfileDigest } = result;
  const counts = { edges: 0, resolved: 0, unresolved: 0, optionalMissing: 0, skippedEntries: 0, invalidDeclarations: 0 };
  const edges = [];
  for (const [from, record] of Object.entries(packages)) {
    if (from && (!validLocation(from) || !validName(packageName(from)) || !object(record) || record.link === true)) {
      counts.skippedEntries++;
      continue;
    }
    for (const kind of fields) {
      const declarations = record[kind];
      if (declarations === undefined || (from && kind === 'devDependencies')) continue;
      if (!object(declarations)) {
        counts.invalidDeclarations++;
        continue;
      }
      for (const [name, requested] of Object.entries(declarations)) {
        if (kind === 'dependencies' && object(record.optionalDependencies) && Object.hasOwn(record.optionalDependencies, name)) continue;
        counts.edges++;
        const peer = kind === 'peerDependencies';
        const optional = kind === 'optionalDependencies' || (peer && record.peerDependenciesMeta?.[name]?.optional === true);
        const valid = validName(name) && typeof requested === 'string' && requested.length > 0 && requested.length <= 512;
        const to = valid ? resolveLocation(packages, from, name, peer) : null;
        const identity = !valid ? { status: 'invalid_declaration' } : to !== null ? targetIdentity(packages, to, name, requested) :
          { status: optional ? 'optional_missing' : 'missing_target' };
        if (identity.status === 'resolved') counts.resolved++;
        else if (identity.status === 'optional_missing') counts.optionalMissing++;
        else counts.unresolved++;
        const edge = { from, to, name: name.slice(0, 214), requested: valid ? requested : null, kind, optional, ...identity };
        if (edges.length < PREVIEW_LIMIT) edges.push(edge);
        onEdge?.(edge, to === null ? null : packages[to]?.resolved);
      }
    }
  }
  const partial = counts.unresolved || counts.skippedEntries || counts.invalidDeclarations;
  return {
    ecosystem: 'npm', status: partial ? 'partial' : 'mapped', lockfileVersion, lockfileDigest,
    counts, edges, truncated: counts.edges > edges.length,
    checksNotPerformed: ['version range satisfaction', 'platform installation', 'advisory scanning', 'license policy', 'package integrity verification'],
  };
}
