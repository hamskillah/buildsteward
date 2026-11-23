# Dependency inventory and evidence

Run `buildsteward deps inventory` in a project with `package-lock.json` (or pass `--root PATH`). Initialization and network access are not required. The command accepts npm lockfile versions 2 and 3, limits input to 8 MB, and returns the lockfile SHA-256, total package-entry counts, and a preview of at most 100 `node_modules` entries. Nested paths preserve multiple installed versions. The output records optional and development flags and bounded OS/CPU metadata.

`inventoried` means eligible entries were read; it does not mean the lockfile is complete, valid for the current platform, installed, safe, or supported by a security policy. `partial` means at least one entry in the full inventory was missing a usable version, was malformed, or was a workspace link. Such entries remain unresolved even if outside the preview. Missing files, invalid structure/JSON and unsupported lockfile versions have separate statuses. Oversized input fails with an error.

Names from `nameSource: install_path` are inferred and can be aliases; `lockfile` means the entry supplied the name. The command does not resolve dependency edges, inspect linked workspace metadata, resolve aliases reliably, perform advisory or license analysis, verify integrity, or test runtime compatibility. Platform lists and entry previews are bounded and can omit information. Do not use this output as an authorization or a vulnerability gate.

## Trace dependency edges

Run `buildsteward deps graph` to see which lockfile entry requests each package. The graph uses npm v2/v3 install paths to find child or hoisted targets and resolves peer edges from the requester's parent. It preserves the installed path and recorded version for each target, so two versions of one package remain distinct. The command also reports the lockfile digest, total counts and a preview of up to 100 edges.

A missing optional package or optional peer has a separate status from a required edge with a missing target. Invalid declarations, unresolved links and unsupported sources yield a partial graph. The graph maps lockfile entries with no network requests and does not check semver range satisfaction, reproduce workspace link resolution or prove which optional packages install on the current platform. Advisory and license assessments require separate evidence.

## Trace Composer dependency edges

Run `buildsteward deps graph --ecosystem packagist` in a project with `composer.lock`. The offline report maps recorded package requirements to exact locked versions and separates development packages and PHP platform requirements. It returns a SHA-256 digest, full counts, and up to 100 edges from a lockfile no larger than 8 MB. Missing targets, duplicate names, and unresolved virtual `provide` or `replace` requirements remain visible.

Use Composer's own `composer validate` and `composer check-platform-reqs` to verify manifest consistency and platform requirements. The graph does not run Composer, solve version constraints or virtual package requirements, or query package registry or advisory sources.

## Look up npm advisories

After `buildsteward init`, run `buildsteward deps advisories` to read cached evidence. Use `buildsteward deps advisories --online` to allow a lookup through [OSV's batch endpoint](https://google.github.io/osv.dev/post-v1-querybatch/). Online lookup sends package names and exact versions whose lockfile records point to canonical public npm registry tarballs. The request excludes project paths, lockfile contents, and identities with other registry URLs or missing URL provenance. Run on source you trust because the lockfile supplies that provenance. Projects with `intelligence.externalResearch=never` always use the cache.

Each invocation selects up to 100 distinct package versions from the graph and sends at most one request with an eight-second deadline. The report includes a lockfile digest, coverage counts, the source and observation time. Pagination, stale cached results, unresolved edges and identity caps remain visible as partial evidence. Advisory IDs are capped at 20 per package. Missing responses remain unknown. `no_advisories_reported` means OSV returned zero IDs for that exact query. It makes no claim about runtime safety, licenses, or platform compatibility.

## Inspect license and compatibility declarations

After `buildsteward init`, run `buildsteward deps metadata --name lodash --version 4.17.21 --online` to retrieve publisher metadata for an exact version in the resolved npm graph. Omit `--online` to use the local cache. Each invocation can make one exact-version request, and only for a matching public npm registry tarball. Project policy can disable online lookup.

The command reports the publisher's license declaration, Node and npm engine ranges, OS/CPU/libc lists, and deprecation metadata separately. Missing or unusable declarations are null. Registry and lockfile provenance, matching edge counts and cache freshness remain explicit in the report. The command does not determine legal compatibility, validate runtime behavior, or infer maintenance quality.

To compare a publisher declaration with your own allowlist, add `--allow-license 'MIT,Apache-2.0'`. Matching uses the complete declared string. Compound expressions can be allowlisted explicitly. Add `--check-platform` to compare declared OS and CPU lists with the current host. Missing evidence, expired cache records, and mixed registry provenance yield unknown assessments. The command leaves Node/npm engine ranges and libc as declarations for review.
