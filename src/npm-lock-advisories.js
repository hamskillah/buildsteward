import { readConfig } from './config.js';
import { fetchEvidence } from './dependency.js';
import { graphNpmLock, isRegistryTarball } from './npm-lock-graph.js';

const SOURCE = 'https://api.osv.dev/v1/querybatch';
const LIMIT = 100;
const MAX_IDS = 20;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validResult(result) {
  if (!object(result) || !Object.keys(result).every(key => ['vulns', 'next_page_token'].includes(key))) return false;
  if (Object.hasOwn(result, 'next_page_token') && typeof result.next_page_token !== 'string') return false;
  return !Object.hasOwn(result, 'vulns') || (Array.isArray(result.vulns) &&
    result.vulns.every(item => object(item) && typeof item.id === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(item.id)));
}

export async function advisoriesForNpmLock(root, { online = false } = {}, { fetcher = fetch } = {}) {
  const candidates = new Map();
  let skippedRegistryEdges = 0;
  const graph = await graphNpmLock(root, { onEdge(edge, resolved) {
    if (edge.status !== 'resolved') return;
    if (!isRegistryTarball(edge.package, resolved)) {
      skippedRegistryEdges++;
      return;
    }
    const { name, version } = edge.package;
    candidates.set(`${name}@${version}`, { package: { name, ecosystem: 'npm' }, version });
  } });
  if (!['mapped', 'partial'].includes(graph.status)) return graph;

  const config = await readConfig(root);
  const offline = !online || config.intelligence.externalResearch === 'never';
  const queries = [...candidates.keys()].sort().slice(0, LIMIT).map(key => candidates.get(key));
  const validate = data => object(data) && Array.isArray(data.results) && data.results.length === queries.length && data.results.every(validResult);
  const batch = queries.length ? await fetchEvidence(root, `npm-graph-osv-v1:${JSON.stringify(queries)}`, SOURCE,
    { method: 'POST', body: { queries }, validate }, { offline, fetcher, cacheHours: config.intelligence.cacheHours }) :
    { status: 'not_queried', data: null, observedAt: null };
  const packages = queries.map(({ package: { name }, version }, index) => {
    const result = batch.data?.results[index];
    const advisoryIds = result ? [...new Set((result.vulns ?? []).map(item => item.id))] : null;
    const status = !result ? 'unknown' : result.next_page_token ? 'partial' :
      advisoryIds.length ? 'advisories_reported' : 'no_advisories_reported';
    return { name, version, status, advisoryIds: advisoryIds?.slice(0, MAX_IDS) ?? null, truncatedAdvisories: (advisoryIds?.length ?? 0) > MAX_IDS };
  });
  const noCoverage = !queries.length || !batch.data;
  const incomplete = graph.status !== 'mapped' || skippedRegistryEdges || candidates.size > queries.length ||
    batch.status === 'cached_stale' || packages.some(pkg => pkg.status === 'partial' || pkg.truncatedAdvisories);
  return {
    ecosystem: 'npm', status: noCoverage ? 'unavailable' : incomplete ? 'partial_evidence' : 'evidence_collected',
    lockfileDigest: graph.lockfileDigest, graphStatus: graph.status,
    counts: { eligibleIdentities: candidates.size, checkedIdentities: batch.data ? packages.length : 0, skippedRegistryEdges, unresolvedEdges: graph.counts.unresolved },
    source: { name: 'OSV', url: SOURCE, status: batch.status, observedAt: batch.observedAt },
    packages,
    note: 'OSV evidence covers up to 100 distinct versions from resolved dependency edges with public npm tarball URLs. Missing evidence and zero reported advisories do not establish package safety.',
  };
}
