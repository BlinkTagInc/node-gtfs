# Repository guidance

## Public documentation

`README.md` and `docs/` are published with the npm package. Write them for
people using node-GTFS. Keep them concise, task-oriented, and focused on public
behavior, configuration, examples, and troubleshooting.

Do not add implementation rationale, roadmap status, contributor workflow,
internal architecture commentary, or explanations of why private APIs are not
exported. Document an advanced public API only when a package user needs the
information to use it.

Keep contributor instructions in `CONTRIBUTING.md`. Keep implementation plans
and maintainer design notes in the ignored `internal/` directory, and express
important public API boundaries through types and contract tests.
