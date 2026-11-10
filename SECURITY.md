# Security Policy

Security reports help keep node-GTFS and its users safe. This policy
intentionally keeps the supported-version and response commitments limited.

## Supported versions

Security fixes are normally released only for the latest version published to
npm. Older releases, prereleases, unsupported Node.js versions, and unreleased
development branches do not receive guaranteed security updates or backports.

Users should upgrade to the latest release before reporting a vulnerability
and confirm that the issue is still reproducible there. An advisory may name a
different affected or supported version range when necessary.

## Reporting a vulnerability

Do not open a public GitHub issue, discussion, or pull request for a suspected
security vulnerability.

Prefer GitHub's private vulnerability reporting form:

<https://github.com/BlinkTagInc/node-gtfs/security/advisories/new>

If private reporting is unavailable, email
<security@blinktag.com> with `node-GTFS security` in the subject line.

Please include as much of the following as is practical:

- the affected node-GTFS and Node.js versions;
- the operating system and database backend;
- the affected API, CLI command, or package entry point;
- a description of the security impact and required attacker capabilities;
- minimal reproduction steps or a small proof of concept;
- whether the issue involves GTFS Schedule, GTFS-Realtime, a ZIP archive,
  GeoJSON, CSV, protobuf data, querying, import, export, or database access; and
- any suggested mitigation or fix.

Use synthetic data whenever possible. Do not send credentials, authorization
headers, private source URLs, production databases, personal information, or
other sensitive data unless it is essential and has been explicitly requested.

There is no bug bounty program and no guaranteed acknowledgement, remediation,
or disclosure timeline. The project will investigate and coordinate a fix and
disclosure as availability and the severity of the report permit. Please allow
reasonable time for investigation before public disclosure.

## Security scope

node-GTFS treats application code and configuration as trusted. This includes
database credentials and connections, configured source and destination paths,
source URLs and request headers, reporter callbacks, and deliberate access to raw
Kysely or SQL escape hatches.

Content read from a configured GTFS source is treated as untrusted. This
includes ZIP entry names, CSV fields and values, GeoJSON, and GTFS-Realtime
protobuf messages.

Examples of issues that should be reported privately include:

- arbitrary code execution caused by crafted static GTFS feed content;
- archive traversal or writing outside an intended temporary, import, export,
  or database location;
- SQL injection through a documented high-level node-GTFS query API;
- unauthorized disclosure or modification of rows belonging to another
  configured source;
- prototype pollution or modification of unrelated application state;
- exposure of configured credentials through node-GTFS errors or default
  reporting behavior;
- a validation, parsing, or persistence flaw with a concrete confidentiality,
  integrity, or availability impact; and
- practical, grossly asymmetric resource exhaustion caused by a small crafted
  input under normal documented use.

The following are normally handled as public bug reports or by the responsible
upstream project instead:

- ordinary GTFS specification, validation, import, query-result, or
  documentation errors without a security impact;
- expected CPU, memory, disk, or database use when processing a legitimately
  large static GTFS feed;
- issues that require control of trusted application configuration, arbitrary
  JavaScript execution, database credentials, the database itself, the host
  filesystem, operating system, or deployment network;
- SQL injection or destructive behavior in SQL intentionally supplied through
  raw Kysely, database-driver, or SQL APIs;
- secrets exposed by application-provided logging or reporter callbacks;
- server-side request forgery claims that require an application to let an
  attacker choose a trusted source URL or request headers;
- vulnerabilities solely in Node.js, a database server, database driver, or
  another dependency that node-GTFS does not cause or worsen; and
- behavior limited to an unsupported node-GTFS or Node.js version.

If it is unclear whether an issue has security impact or belongs to an
upstream dependency, report it privately first.

## Responsible testing and disclosure

Test vulnerabilities only using systems and data you are authorized to use.
Avoid destructive testing and include only the minimum proof of concept needed
to demonstrate the issue.

Please keep the report and any proposed fix private until a patched release or
coordinated disclosure is available. With the reporter's permission, public
advisories may credit the discovery.

## Security updates

Confirmed vulnerabilities may be documented through GitHub Security
Advisories and the project release notes. Watch the repository's **Security
alerts** and **Releases** to receive updates, and keep node-GTFS, Node.js, the
selected database driver, and the database server on supported versions.
