# npm publication via GitHub Trusted Publishing

**Status:** The first version, `@hamskillah/buildsteward@0.1.0`, has been published. The GitHub workflow is prepared for subsequent versions after Trusted Publishing is configured.

This is a manual, source-verified workflow for releases **after the package exists and trusted publisher is configured**. It deliberately cannot auto-publish from normal pushes or pull requests.

## Bootstrap: first publication requires npm ownership

For a **brand-new** npm package, Trusted Publisher settings normally cannot be configured until the package exists in the registry. GitHub repository ownership is not proof of npm publisher ownership.

The maintainer must first use an authenticated npm account that owns the `@hamskillah` scope. A conservative bootstrap is:

```bash
git clone https://github.com/hamskillah/buildsteward.git
cd buildsteward
npm login
npm whoami
npm run check
npm publish --dry-run --access public
npm publish --access public
```

Run this from a clean, reviewed checkout on the maintainer's trusted machine. Follow npm's current 2FA requirements and **never share passwords, tokens or OTPs in chat or GitHub issues**. This publishes the initial version directly; **do not publish it again from the GitHub OIDC workflow**. Versions on npm are immutable. After this first release, configure Trusted Publishing for a *new, reviewed package version*.

An alternative available in the current npm ecosystem is a **staged first publish** to create a package before promotion, but that flow also requires the authenticated publisher and separate review. See [npm staged publishing](https://docs.npmjs.com/staged-publishing/). We do not automate bootstrap without control of the npm account.

## Prerequisites (one-time maintainer setup after bootstrap)

1. Verify that you own the `@hamskillah` **npm account/scope**. GitHub username does not prove npm ownership. Confirm that `@hamskillah/buildsteward` can be published by that account.
2. Follow [npm's Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/). In the package's npm Trusted Publisher settings select GitHub Actions and enter:
   - owner/user: `hamskillah`
   - repository: `buildsteward`
   - workflow filename: `publish-npm.yml`
   - optional protected environment: `npm-publish`
   - **allow `npm publish`** if you intend the direct publish workflow below. A stage-only publisher cannot run `npm publish`.
3. In GitHub, configure the `npm-publish` **Environment** with required reviewer protection where available. Do not rely on the name alone; an unprotected environment is not an approval mechanism.
4. Create repository Actions variable `NPM_TRUSTED_PUBLISHING_READY` with value `true` only after the npm publisher and protections are configured.
5. Check package name, version, release contents and CI results. **Increment to a new version through a reviewed PR** after the initial manual publication; npm versions cannot be republished.

Important: npm's documentation states that a new trusted publisher must complete its first successful publish within two days or the trust configuration expires. Configure it only when prepared to publish.

## Release process

1. Merge the reviewed release changes to `main` after CI passes.
2. Copy the exact full 40-character commit SHA from `main`.
3. Open GitHub → Actions → **Publish npm (trusted, manual)** → Run workflow **on main** and paste the SHA.
4. The job verifies the release gate variable, exact SHA, package metadata, automated tests and the packaged artifact, then uses npm OIDC to publish. GitHub OIDC requires `id-token: write`; no npm token should be placed in repository files.
5. After a successful publish, verify package metadata on npm and test `npx --yes @hamskillah/buildsteward help` plus `setup --dry-run` in a fresh environment. Do not change README installation claims before this live test.

If GitHub Actions says `ENEEDAUTH`, stop. Check the npm Trusted Publisher configuration, filename, allowed action and package ownership. **Do not paste tokens, OTPs, npmrc credentials, or account secrets into PRs/issues/ChatGPT.**

No step here proves real OpenCode/Codex/Claude Code activation, cross-model decision quality, or host-enforced permissions. Those have separate test gates.
