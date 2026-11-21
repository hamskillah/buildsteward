import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { validateReleaseMetadata } from '../scripts/release-preflight.js';
test('release preflight validates package identity, public access and packed runtime',async()=>{
  const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
  assert.deepEqual(validateReleaseMetadata(pkg),[]);
  assert.ok(validateReleaseMetadata({...pkg,private:true}).includes('package is private'));
  assert.ok(validateReleaseMetadata({...pkg,repository:{url:'https://example.com/wrong'}}).includes('repository provenance URL mismatch'));
  assert.ok(validateReleaseMetadata({...pkg,files:['README.md']}).some(x=>x.includes('packed directory')));
});
test('npm publication workflow remains manual, OIDC-gated and SHA-checked',async()=>{
  const workflow=await fs.readFile('.github/workflows/publish-npm.yml','utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\npush:/);
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/NPM_TRUSTED_PUBLISHING_READY/);
  assert.match(workflow,/expected_sha/);
  assert.match(workflow,/environment: npm-publish/);
  assert.doesNotMatch(workflow,/NODE_AUTH_TOKEN|NPM_TOKEN/);
});
