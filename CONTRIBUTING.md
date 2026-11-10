# Contributing to node-GTFS

This guide covers development of node-GTFS v5. Bug reports and pull requests are
welcome. For a bug report, include the version, expected and actual behavior, and
a small reproducible example.

When a problem affects a specific static GTFS feed, please include a public link
to the static GTFS feed or the particular GTFS file whenever possible. Keep
credentials and private feed data out of issues. Report security concerns through
[SECURITY.md](SECURITY.md).

## Getting set up

Use the latest patch release of Node.js 22, 24, or 26 and the pnpm version pinned
in `package.json`.

After cloning your fork:

```sh
pnpm install
pnpm build
pnpm test
```

`pnpm build-watch` is available if you want the build to update while you work.

Source code is in `src/`, tests are in `test/`, and public documentation is in
`README.md` and `docs/`.

## Making changes

- Keep changes focused and add regression tests for bug fixes.
- Use braces and separate indented lines for all control-flow bodies.
- Follow the existing source and test organization. Use real databases to test
  SQL behavior, transactions, and cleanup; keep expected fixture values
  independent of the implementation.
- Prefer error codes and structured details in assertions. Assert exact text
  when testing user-facing formatting, and account for terminal color settings.
- Update public documentation and configuration tests when behavior or defaults
  change. Defaults live in `src/config/defaults.ts`.
- Keep public documentation focused on usage. Put local feeds, benchmark results,
  and maintainer design notes in the ignored `internal/` directory.

Format only the files you changed:

```sh
pnpm exec prettier --write <file>
```

## Running checks

Run these before opening a pull request:

```sh
pnpm lint
pnpm format:check
pnpm docs:check
pnpm typecheck
pnpm test
```

`pnpm test` checks generated files, builds the package, and runs the runtime test
suite. It skips PostgreSQL and MySQL tests when their connection URLs are unset.
`pnpm typecheck` also checks the public API assertions in `test/types/`.

For focused work:

| Command                 | Scope                                      |
| ----------------------- | ------------------------------------------ |
| `pnpm test:unit`        | Source-level unit tests; no build required |
| `pnpm test:contracts`   | Shared database behavior                   |
| `pnpm test:integration` | Import/export and adapter integration      |
| `pnpm test:package`     | Built public exports and CLI               |
| `pnpm test:release`     | Packed package, declarations, and examples |
| `pnpm test:coverage`    | Runtime tests with source coverage         |

Keep source-level tests in `test/unit/`, `test/contracts/`, or
`test/integration/`; checks of built exports belong in `test/package/`.
Fixtures and shared helpers live in `test/fixtures/` and `test/helpers/`.

### PostgreSQL and MySQL

For changes to shared database behavior, use disposable PostgreSQL and MySQL
databases. **The tests recreate their schema.** Set `GTFS_TEST_POSTGRES_URL` and
`GTFS_TEST_MYSQL_URL`, then run:

```sh
pnpm test:databases
```

Both URLs are required for this command. To test one server backend, set its URL
and run `pnpm test:contracts`. Run only one test process against those databases
at a time. See the [CI workflow](.github/workflows/nodejs.yml) for service versions
and configuration.

## Generated files and documentation

Edit schema definitions in `src/schema/tables/`, storage policy in
`src/database/storage/table-policy.ts`, or query extensions in
`src/schema/repository-query-extensions.ts` rather than their generated output.
After changing those inputs, run:

```sh
pnpm generated:generate
pnpm generated:check
```

Review and commit generated types, repositories, reference pages, and schema
snapshots with the source changes. Do not edit generated files by hand.

Use `js` or `ts` fences for documentation examples. `pnpm test:release` checks
them against the packed declarations. Use `js setup` for shared setup within a
document and `js legacy` or `ts legacy` only for historical examples.

## Pull requests

Explain the problem, what changed, and how you tested it. Note checks you could
not run. Keep unrelated formatting and dependency updates out of the diff.
Short, descriptive commit messages are sufficient; no special format is required.

Before merging, check the full CI results, including Node.js 22/24/26, both
server databases, and packed-package compatibility. Version bumps, tags, and
publishing are handled separately from ordinary contributions.
