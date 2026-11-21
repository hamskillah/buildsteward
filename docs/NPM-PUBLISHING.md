> The current, reviewed publishing procedure is in [RELEASE-NPM.md](RELEASE-NPM.md). The workflow is manual and requires npm Trusted Publisher configuration **after an initial authenticated package bootstrap**.

# npm publishing checklist (not executed)

The repository is set up to produce the scoped package `@hamskillah/buildsteward`. **Publication has not happened.** A verified npm publisher must complete these steps. Do not upload an npm token or one-time password to a public issue, PR, or AI conversation.

1. Confirm that the npm account controls the `@hamskillah` scope and that this exact package name is available or owned by that account.
2. Review the source, `package.json`, and `SECURITY.md`. Verify no secrets or personal configuration are included.
3. Run `npm run check` and `npm publish --dry-run` from a clean checkout of the intended commit. Inspect the exact packed file list.
4. Configure npm trusted publishing with GitHub Actions OIDC if feasible, with restricted repository/workflow/branch. Otherwise use appropriately protected publisher authentication and npm's required 2FA.
5. Publish the exact reviewed source commit with `npm publish --access public`; only the authorized publisher should do this.
6. Confirm the published package metadata and install it in a clean directory. Verify `npx --yes @hamskillah/buildsteward help` and `setup --dry-run`.
7. Only after the live registry install passes, change the README to recommend npm as the primary install route.

`npm publish --dry-run` is not publication. Node.js tests and local package smoke tests do not verify real coding-agent activation, model behavior or a production permission boundary.
