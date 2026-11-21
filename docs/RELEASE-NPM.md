# npm publication via GitHub Trusted Publishing

**Status:** GitHub release workflow is prepared, but BuildSteward is NOT published on npm. It does not create your npm account, acquire an OTP, or configure trusted publisher settings on your behalf.

This is a manual, source-verified workflow. It deliberately cannot auto-publish from normal pushes or pull requests.

## Prerequisites (one-time maintainer setup)

1. Verify that you own the `@hamskillah` **npm account/scope**. GitHub username does not prove npm ownership. Confirm that `@hamskillah/buildsteward` can be published by that account.
2. Follow [npm's Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/). In the package's npm Trusted Publisher settings select GitHub Actions and enter:
   - owner/user: `hamskillah`
   - repository: `buildsteward`
   - workflow filename: `publish-npm.yml`
   - optional protected environment: `npm-publish`
   - **allow `npm publish`** if you intend the direct publish workflow below. A stage-only publisher cannot run `npm publish`.
3. In GitHub, configure the `npm-publish` **Environment** with required reviewer protection where available. Do not rely on the name alone; an unprotected environment is not an approval mechanism.
4. Create repository Actions variable `NPM_TRUSTED_PUBLISHING_READY` with value `true` only after the npm publisher and protections are configured.
5. Check package name, version, release contents and CI results. Update the version through a reviewed PR for later releases; npm versions cannot be republished.

Important: npm's documentation states that a new trusted publisher must complete its first successful publish within two days or the trust configuration expires. Configure it only when prepared to publish.

## Release process

1. Merge the reviewed release changes to `main` after CI passes.
2. Copy the exact full 40-character commit SHA from `main`.
3. Open GitHub → Actions → **Publish npm (trusted, manual)** → Run workflow **on main** and paste the SHA.
4. The job verifies the release gate variable, exact SHA, package metadata, automated tests and the packaged artifact, then uses npm OIDC to publish. GitHub OIDC requires `id-token: write`; no npm token should be placed in repository files.
5. After a successful publish, verify package metadata on npm and test `npx --yes @hamskillah/buildsteward help` plus `setup --dry-run` in a fresh environment. Do not change README installation claims before this live test.

If GitHub Actions says `ENEEDAUTH`, stop. Check the npm Trusted Publisher configuration, filename, allowed action and package ownership. **Do not paste tokens, OTPs, npmrc credentials, or account secrets into PRs/issues/ChatGPT.**

No step here proves real OpenCode/Codex/Claude Code activation, cross-model decision quality, or host-enforced permissions. Those have separate test gates.
