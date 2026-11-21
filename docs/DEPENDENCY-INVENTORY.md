# Offline npm lockfile inventory

Run `buildsteward deps inventory` in a project with `package-lock.json` (or pass `--root PATH`). Initialization and network access are not required. The command accepts npm lockfile versions 2 and 3, limits input to 8 MB, and returns the lockfile SHA-256, total package-entry counts, and a preview of at most 100 `node_modules` entries. Nested paths preserve multiple installed versions. The output records optional and development flags and bounded OS/CPU metadata.

`inventoried` means eligible entries were read; it does not mean the lockfile is complete, valid for the current platform, installed, safe, or supported by a security policy. `partial` means at least one entry in the full inventory was missing a usable version, was malformed, or was a workspace link. Such entries remain unresolved even if outside the preview. Missing files, invalid structure/JSON and unsupported lockfile versions have separate statuses. Oversized input fails with an error.

Names from `nameSource: install_path` are inferred and can be aliases; `lockfile` means the entry supplied the name. The command does not resolve dependency edges, inspect linked workspace metadata, resolve aliases reliably, perform advisory or license analysis, verify integrity, or test runtime compatibility. Platform lists and entry previews are bounded and can omit information. Do not use this output as an authorization or a vulnerability gate.

## Trace dependency edges

Run `buildsteward deps graph` to see which lockfile entry requests each package. The graph uses npm v2/v3 install paths to find child or hoisted targets and resolves peer edges from the requester's parent. It preserves the installed path and recorded version for each target, so two versions of one package remain distinct. The command also reports the lockfile digest, total counts and a preview of up to 100 edges.

A missing optional package or optional peer has a separate status from a required edge with a missing target. Invalid declarations, unresolved links and unsupported sources yield a partial graph. The graph maps lockfile entries with no network requests and does not check semver range satisfaction, reproduce workspace link resolution or prove which optional packages install on the current platform. Advisory and license assessments require separate evidence.

## Look up npm advisories

After `buildsteward init`, run `buildsteward deps advisories` to read cached evidence. Use `buildsteward deps advisories --online` to allow a lookup through [OSV's batch endpoint](https://google.github.io/osv.dev/post-v1-querybatch/). Online lookup sends package names and exact versions whose lockfile records point to canonical public npm registry tarballs. The request excludes project paths, lockfile contents, and identities with other registry URLs or missing URL provenance. Run on source you trust because the lockfile supplies that provenance. Projects with `intelligence.externalResearch=never` always use the cache.

Each invocation selects up to 100 distinct package versions from the graph and sends at most one request with an eight-second deadline. The report includes a lockfile digest, coverage counts, the source and observation time. Pagination, stale cached results, unresolved edges and identity caps remain visible as partial evidence. Advisory IDs are capped at 20 per package. Missing responses remain unknown. `no_advisories_reported` means OSV returned zero IDs for that exact query. It makes no claim about runtime safety, licenses, or platform compatibility.
