import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'csv-stringify/sync';

export const textFilterRows = [
  ['a', 'Market Street Station'],
  ['b', 'market street station'],
  ['c', 'Straße'],
  ['d', 'STRASSE'],
  ['e', 'Ångström'],
  ['f', 'A\u030Angström'],
  ['g', 'Σςσ'],
  ['h', 'CAFÉ'],
  ['i', 'Cafe'],
  ['j', 'İstanbul'],
  ['k', 'istanbul'],
  ['l', '100%_[x]*?!\\End'],
  ['m', '100XaxZQ!!\\End'],
  ['n', ''],
  ['o', null],
  ['p', "O'Brien\nStation"],
  ['q', '終点🚉'],
  ['r', 'a]b[-?*^'],
] as const;

export async function writeTextFilterFixture(directory: string): Promise<void> {
  const files = {
    'agency.txt':
      'agency_id,agency_name,agency_url,agency_timezone\na,Transit,https://example.com,Etc/UTC\n',
    'routes.txt': 'route_id,route_type,route_short_name\nred,3,Réd\n',
    'trips.txt':
      'trip_id,route_id,service_id,shape_id\ntrip,red,weekday,shape\n',
    'stop_times.txt':
      'trip_id,stop_sequence,stop_id,arrival_time,departure_time\ntrip,1,a,09:00:00,09:00:00\n',
    'calendar_dates.txt':
      'service_id,date,exception_type\nweekday,20260911,1\n',
    'shapes.txt':
      'shape_id,shape_pt_sequence,shape_pt_lat,shape_pt_lon\nshape,1,0,0\nshape,2,1,1\n',
    'stops.txt': stringify(
      textFilterRows.map(([stop_id, stop_name]) => ({
        stop_id,
        stop_name,
        stop_lat: 0,
        stop_lon: 0,
      })),
      { header: true },
    ),
  };
  for (const [filename, contents] of Object.entries(files)) {
    await writeFile(path.join(directory, filename), contents);
  }
}
