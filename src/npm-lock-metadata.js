import { readConfig } from './config.js';
import { fetchEvidence } from './dependency.js';
import { graphNpmLock, isRegistryTarball } from './npm-lock-graph.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const declaration = value => typeof value === 'string' && value.length <= 256 && value.trim() &&
  !/[\x00-\x1f\x7f]/.test(value) ? value : null;
const platforms = values => Array.isArray(values) && values.length <= 32 &&
  values.every(value => typeof value === 'string' && /^!?[a-z0-9_-]{1,32}$/i.test(value)) ? values : null;

function select(data) {
  return {
    name: data.name, version: data.version,
    license: declaration(data.license),
    engines: { node: declaration(data.engines?.node), npm: declaration(data.engines?.npm) },
    platform: { os: platforms(data.os), cpu: platforms(data.cpu), libc: platforms(data.libc) },
    deprecated: typeof data.deprecated === 'string' ? data.deprecated.length > 0 : null,
  };
}

function platformMatch(rules, value) {
  if (!rules?.length) return 'unknown';
  if (rules.includes('!' + value)) return 'excluded';
  const allowed = rules.filter(rule => !rule.startsWith('!'));
  return !allowed.length || allowed.includes(value) || allowed.includes('any') ? 'matches' : 'excluded';
}

function assess(data, licenses, checkPlatform, host) {
  if (!licenses && !checkPlatform) return {};
  const assessment = {};
  if (licenses) {
    const declared = data?.license?.trim();
    assessment.license = !declared ? 'unknown' : licenses.includes(declared) ? 'allowlisted' : 'not_allowlisted';
  }
  if (checkPlatform) {
    const os = platformMatch(data?.platform?.os, host.platform);
    const cpu = platformMatch(data?.platform?.cpu, host.arch);
    assessment.host = { os: host.platform, cpu: host.arch, osMatch: os, cpuMatch: cpu,
      libc: data?.platform?.libc?.length ? 'not_evaluated' : 'unknown' };
  }
  return { assessment };
}

export async function metadataForNpmLock(root, { name, version, online = false, allowLicense, checkPlatform = false },
  { fetcher = fetch, host = process } = {}) {
  if (!declaration(name) || !declaration(version)) throw new Error('Exact package name and version required');
  const licenses = allowLicense?.split(',').map(item => item.trim());
  if (licenses && (licenses.length > 25 || licenses.some(item => !declaration(item)))) {
    throw new Error('Allowlist must contain 1–25 non-empty license declarations');
  }
  let matchedEdges = 0;
  let publicEdges = 0;
  const graph = await graphNpmLock(root, { onEdge(edge, resolved) {
    if (edge.status !== 'resolved' || edge.package.name !== name || edge.package.version !== version) return;
    matchedEdges++;
    if (isRegistryTarball(edge.package, resolved)) publicEdges++;
  } });
  if (!['mapped', 'partial'].includes(graph.status)) return graph;
  const base = { package: { ecosystem: 'npm', name, version }, lockfileDigest: graph.lockfileDigest, graphStatus: graph.status,
    matchedEdges, publicEdges };
  if (!publicEdges) {
    return { ...base, status: matchedEdges ? 'unverified_registry_origin' : 'not_in_resolved_graph', metadata: null, source: null, ...assess(null, licenses, checkPlatform, host) };
  }

  const config = await readConfig(root);
  const offline = !online || config.intelligence.externalResearch === 'never';
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const validate = data => object(data) && data.name === name && data.version === version;
  const evidence = await fetchEvidence(root, `npm-metadata-v1:${name}@${version}`, url, { validate, select },
    { offline, fetcher, cacheHours: config.intelligence.cacheHours });
  return {
    ...base,
    status: !evidence.data ? 'unavailable' : evidence.status === 'cached_stale' || graph.status === 'partial' ||
      publicEdges !== matchedEdges || !evidence.data.license ? 'partial_evidence' : 'publisher_metadata_collected',
    source: { name: 'npm registry', url, status: evidence.status, observedAt: evidence.observedAt },
    metadata: evidence.data,
    ...assess(evidence.status === 'cached_stale' || publicEdges !== matchedEdges ? null : evidence.data,
      licenses, checkPlatform, host),
    note: 'Values are publisher declarations. Null means no usable declaration. This does not verify license compliance or runtime compatibility.',
  };
}
