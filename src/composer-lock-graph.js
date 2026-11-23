import { readDependencyJson } from './npm-lock-inventory.js';

const packageName = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i;
const platformName = /^(?:php(?:-64bit|-ipv6|-zts|-debug)?|hhvm|composer(?:-plugin-api|-runtime-api)?|(?:ext|lib)-[a-z0-9_.-]+)$/i;
const validName = name => typeof name === 'string' && name.length <= 214 && packageName.test(name);
const boundedString = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const requirementMap = value => value !== null && typeof value === 'object' &&
  (!Array.isArray(value) || value.length === 0);

export async function graphComposerLock(root) {
  const ecosystem = 'packagist';
  const input = await readDependencyJson(root, 'composer.lock', ecosystem);
  if (!input.lock) return input;
  const { lock, lockfileDigest } = input;
  if (!Array.isArray(lock.packages) || !Array.isArray(lock['packages-dev'])) {
    return { ecosystem, status: 'invalid_lockfile', reason: 'missing_package_lists', lockfileDigest };
  }

  const counts = { packages: 0, invalidPackages: 0, duplicateNames: 0, invalidDeclarations: 0, edges: 0, resolved: 0, platform: 0, unresolved: 0 };
  const packages = new Map();
  const duplicates = new Set();
  const virtual = new Set();
  for (const [list, dev] of [[lock.packages, false], [lock['packages-dev'], true]]) {
    for (const entry of list) {
      counts.packages++;
      if (!validName(entry?.name) || !boundedString(entry.version, 120)) {
        counts.invalidPackages++;
        continue;
      }
      const name = entry.name.toLowerCase();
      if (packages.has(name)) {
        duplicates.add(name);
        counts.duplicateNames++;
        continue;
      }
      packages.set(name, { entry, name, dev });
      for (const kind of ['provide', 'replace']) {
        const declarations = entry[kind];
        if (requirementMap(declarations)) {
          for (const key of Object.keys(declarations)) {
            if (validName(key)) virtual.add(key.toLowerCase());
          }
        } else if (declarations !== undefined) counts.invalidDeclarations++;
      }
    }
  }

  const edges = [];
  for (const { entry, name: from, dev } of packages.values()) {
    if (duplicates.has(from) || entry.require === undefined) continue;
    if (!requirementMap(entry.require)) {
      counts.invalidDeclarations++;
      continue;
    }
    for (const [rawName, requested] of Object.entries(entry.require)) {
      const name = rawName.toLowerCase();
      const target = packages.get(name);
      const edge = { from, dev, name: name.slice(0, 214), requested: boundedString(requested, 512) ? requested : null };
      if (!edge.requested || (!validName(name) && !(name.length <= 214 && platformName.test(name)))) edge.status = 'invalid_declaration';
      else if (platformName.test(name)) edge.status = 'platform_requirement';
      else if (duplicates.has(name)) edge.status = 'ambiguous_target';
      else if (target && (dev || !target.dev)) {
        edge.status = 'resolved';
        edge.package = { name, version: target.entry.version, dev: target.dev };
      } else if (virtual.has(name)) edge.status = 'unresolved_provide_or_replace';
      else edge.status = target ? 'dev_only_target' : 'missing_target';
      counts.edges++;
      if (edge.status === 'platform_requirement') counts.platform++;
      else if (edge.status === 'resolved') counts.resolved++;
      else counts.unresolved++;
      if (edges.length < 100) edges.push(edge);
    }
  }

  const partial = counts.invalidPackages || counts.duplicateNames || counts.invalidDeclarations || counts.unresolved;
  return {
    ecosystem, status: partial ? 'partial' : 'mapped', lockfileDigest, counts, edges,
    truncated: counts.edges > edges.length,
    checksNotPerformed: ['root manifest consistency', 'version constraint satisfaction', 'platform compatibility',
      'virtual package resolution', 'advisory scanning', 'license policy', 'package integrity verification'],
  };
}
