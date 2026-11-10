# Complete optional-extension fixtures

`rows.json` contains explicit public row values for every file and field in
GTFS+, GTFS-Ride, GTFS-to-HTML, TODS v2.1, and TIDES. It includes quoted
Unicode text, times after midnight, fractional numbers, and exact TIDES
monetary strings. References use either another row in this fixture or the
Schedule data in `../complete/`.

`complete-extensions-roundtrip.test.ts` checks file and field coverage against
the public manifest, then writes CSV files with manifest-defined headers into
temporary static GTFS feed directories. Each static GTFS feed includes the complete Schedule fixture
and the files for one extension.

The tests compare explicit expected values with public repositories after
import and reimport, and inspect exported filenames and CSV values directly.
They exercise explicit selection, individual automatic detection, and the
automatic union across six sources. Validation uses the default strict mode.

When adding a field or file to a supported extension, add a non-empty value
here; the coverage assertion fails until the fixture matches the manifest.
Keep expected values explicit rather than deriving them with the library's
normalization code. These fixtures test the library's declared manifest and
round-trip behavior, not external specification conformance.
