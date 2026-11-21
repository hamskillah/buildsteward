// Deliberately conservative keyword router. An agent may override after inspecting the repo.
const routes = [
  { name: 'deploy', patterns: [/\bdeploy\b|\brelease\b|\bproduction\b|\bci\/cd\b|rilis|deploy ke/i], path: 'standard', playbooks: ['release'] },
  { name: 'dependency', patterns: [/\bdependenc(?:y|ies)\b|\blibrar(?:y|ies)\b|\bpackage\b|\bframework\b|dependensi|pustaka/i], path: 'architectural', playbooks: ['decisions', 'dependencies'] },
  { name: 'bugfix', patterns: [/\bbug\b|\bdebug\b|\berror\b|\bfix\b|\bcrash\b|perbaiki|gagal|bermasalah/i], path: 'standard', playbooks: ['debugging'] },
  { name: 'refactor', patterns: [/\brefactor\b|\bcleanup\b|rapikan kode|struktur ulang/i], path: 'standard', playbooks: ['implementation'] },
  { name: 'design', patterns: [/\bui\b|\bux\b|\bdesign\b|\bdashboard\b|desain|tampilan/i], path: 'standard', playbooks: ['design'] },
  { name: 'new_project', patterns: [/\bbuild\b|\bcreate\b|\bnew project\b|\bsaas\b|buat aplikasi|bangun proyek|bangun project/i], path: 'architectural', playbooks: ['discovery', 'decisions', 'implementation'] },
  { name: 'small_edit', patterns: [/\btypo\b|\brename\b|\bcomment\b|\btext\b|salah ketik|ganti nama/i], path: 'fast', playbooks: ['implementation'] }
];
export function routeTask(task) {
  if (!task || typeof task !== 'string' || task.length > 4000) throw new Error('Task must be 1..4000 characters');
  const hit = routes.find(item => item.patterns.some(pattern => pattern.test(task)));
  return { task, category: hit?.name || 'general', path: hit?.path || 'standard', playbooks: hit?.playbooks || ['discovery'], requirements: ['inspect affected context', 'follow project conventions', 'verify relevant outcome'], note: 'Heuristic routing; review the actual task and repository before executing.' };
}
