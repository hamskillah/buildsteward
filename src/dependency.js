import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readConfig, stateDir, safeWriteJson } from './config.js';

const SYSTEMS = { npm: 'npm', pypi: 'pypi', cargo: 'cargo', go: 'go', maven: 'maven', nuget: 'nuget', rubygems: 'rubygems' };
const OSV_NAMES = { npm: 'npm', pypi: 'PyPI', cargo: 'crates.io', go: 'Go', maven: 'Maven', nuget: 'NuGet', rubygems: 'RubyGems' };

function validIdentity(ecosystem, name, version) {
  if (!SYSTEMS[ecosystem]) throw new Error('Unsupported ecosystem: ' + ecosystem);
  if (!name || typeof name !== 'string' || name.length > 200 || !/^[\w@./+:\-]+$/.test(name)) throw new Error('Invalid package name');
  if (!version || typeof version !== 'string' || version.length > 120 || !/^[\w.+!~:\-]+$/.test(version)) throw new Error('Use an exact published version, not a range or wildcard');
}

function cacheFile(root, key) { return path.join(stateDir(root), 'cache', createHash('sha256').update(key).digest('hex') + '.json'); }

async function fromCache(filename, ttlHours, offline) {
  try {
    const payload = JSON.parse(await fs.readFile(filename, 'utf8'));
    if (offline || Date.now() - Date.parse(payload.observedAt) <= ttlHours * 3600000) return { ...payload, stale: Date.now() - Date.parse(payload.observedAt) > ttlHours * 3600000 };
  } catch (error) { if (error.code !== 'ENOENT' && error instanceof SyntaxError) return null; }
  return null;
}

async function requestJSON(url, { method = 'GET', body, fetcher = fetch, validate = () => true, select = data => data }) {
  const response = await fetcher(url, { method, headers: { 'accept': 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const pieces = [];
  let size = 0;
  for await (const chunk of response.body ?? [Buffer.from(await response.text())]) {
    size += chunk.byteLength;
    if (size > 3_000_000) throw new Error('Response too large');
    pieces.push(chunk);
  }
  const data = JSON.parse(Buffer.concat(pieces, size).toString('utf8'));
  if (!validate(data)) throw new Error('Invalid evidence response');
  return select(data);
}

export async function fetchEvidence(root, key, url, options, { offline = false, fetcher = fetch, cacheHours = 24 } = {}) {
  const file = cacheFile(root, key);
  const prior = await fromCache(file, cacheHours, offline);
  if (prior && (!options.validate || options.validate(prior.data))) return { data: prior.data, source: url, status: prior.stale ? 'cached_stale' : 'cached', observedAt: prior.observedAt };
  if (offline) return { data: null, source: url, status: 'unavailable_offline', observedAt: null };
  try {
    const data = await requestJSON(url, { ...options, fetcher });
    const observedAt = new Date().toISOString();
    await safeWriteJson(file, { observedAt, data });
    return { data, source: url, status: 'live', observedAt };
  } catch (error) {
    // Do not silently fall back to expired facts when an online request failed.
    return { data: null, source: url, status: 'unavailable', observedAt: null, error: error.message };
  }
}

export async function inspectDependency(root, { ecosystem, name, version, offline = false }, options = {}) {
  const config = await readConfig(root);
  validIdentity(ecosystem, name, version);
  const depsUrl = `https://api.deps.dev/v3/systems/${SYSTEMS[ecosystem]}/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`;
  const osvUrl = 'https://api.osv.dev/v1/query';
  const actualOffline = offline || config.intelligence.externalResearch === 'never';
  const deps = await fetchEvidence(root, `deps:${ecosystem}:${name}:${version}`, depsUrl, {}, { ...options, offline: actualOffline, cacheHours: config.intelligence.cacheHours });
  const osv = await fetchEvidence(root, `osv:${ecosystem}:${name}:${version}`, osvUrl, { method: 'POST', body: { version, package: { name, ecosystem: OSV_NAMES[ecosystem] } } }, { ...options, offline: actualOffline, cacheHours: config.intelligence.cacheHours });
  const dv = deps.data;
  const vulnerabilities = osv.data?.vulns;
  const haveBoth = !!(dv && Array.isArray(dv.licenses) && dv.licenses.length > 0 && Array.isArray(dv.advisoryKeys) && osv.data && Array.isArray(vulnerabilities ?? []) && !osv.data.next_page_token);
  const licenses = Array.isArray(dv?.licenses) ? dv.licenses : null;
  return {
    package: { ecosystem, name, version },
    status: haveBoth ? 'evidence_collected' : 'incomplete_evidence',
    knownDirectAdvisories: Array.isArray(dv?.advisoryKeys) ? dv.advisoryKeys.map(a => a.id || a.name).filter(Boolean) : null,
    knownOsvVulnerabilities: Array.isArray(vulnerabilities) ? vulnerabilities.map(v => v.id).filter(Boolean).slice(0,100) : osv.data ? [] : null,
    licenses,
    deprecated: dv?.isDeprecated ?? null,
    publishedAt: dv?.publishedAt ?? null,
    sources: [
      { source: 'deps.dev', url: deps.source, status: deps.status, observedAt: deps.observedAt, ...(deps.error ? { error: deps.error } : {}) },
      { source: 'OSV', url: osv.source, status: osv.status, observedAt: osv.observedAt, ...(osv.error ? { error: osv.error } : {}) }
    ],
    checksNotPerformed: ['actual lockfile resolution', 'transitive vulnerability scan', 'license compatibility assessment', 'runtime compatibility test', 'maintainer quality validation'],
    caveat: 'No known advisories is not proof of safety. Unknown data is not treated as passing.'
  };
}
