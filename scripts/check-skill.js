#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const skillRoot = path.resolve('skills/buildsteward');
const skillPath = path.join(skillRoot,'SKILL.md');
const content = fs.readFileSync(skillPath,'utf8');
const match = content.match(/^---\n([\s\S]*?)\n---\n/);
if (!match) throw new Error('Missing skill frontmatter');
for(const field of ['name: buildsteward','description:','license:']) if(!match[1].includes(field)) throw new Error('Missing field '+field);
if (content.length > 8000) throw new Error('Skill instructions should stay short');
const references = [...content.matchAll(/\]\((references\/[a-z-]+\.md)\)/g)].map(([, file]) => file);
const shipped = fs.readdirSync(path.join(skillRoot, 'references'))
  .filter(file => file.endsWith('.md'))
  .map(file => 'references/' + file);
if (references.length !== new Set(references).size ||
    shipped.length !== references.length ||
    shipped.some(file => !references.includes(file) || !fs.statSync(path.join(skillRoot, file)).isFile())) {
  throw new Error('Each shipped skill reference must have one valid link in SKILL.md');
}
process.stdout.write(JSON.stringify({valid:true,skill:skillPath,bytes:content.length})+'\n');
