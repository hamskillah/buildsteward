# Changelog

## 0.2.1

- Detect Windows command shims and the Cursor Agent CLI during setup.
- Validate existing project settings before installing a full runtime. Strict doctor now reports missing or invalid project settings for bundled project installs.
- Run npm test scripts through Node on Windows and exercise the installer and package artifact on macOS and Windows in CI.

## 0.2.0

- Shorter core skill for focused changes, backward compatibility, evidence-based review, and verification.
- Identical skill setups return `unchanged` without creating a backup. Skill-only setups leave project configuration untouched.
- The Node test runner detects the same failure across attempts with different timings.
- Added npm lockfile graph, exact-version advisory lookup, and publisher metadata to the optional CLI.
- Codebase Memory search can select the index for the current checkout when the match is unique.
- Added review and backward-compatibility fixtures, with measured results in the [benchmark report](docs/BENCHMARKS.md).

## 0.1.0

- Initial [npm package](https://www.npmjs.com/package/@hamskillah/buildsteward/v/0.1.0) with a portable developer skill, setup console, and local CLI for project inspection and verification history.
