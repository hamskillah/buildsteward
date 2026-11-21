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
for(const file of ['developer-flow','decisions','permissions','verification','efficiency']) {
  if (!fs.existsSync(path.join(skillRoot,'references',file+'.md'))) throw new Error('Missing reference: '+file);
}
process.stdout.write(JSON.stringify({valid:true,skill:skillPath,bytes:content.length})+'\n');
