import path from 'node:path';
import { writeFile } from 'node:fs/promises';

export const portableKeyFixtures = [
  {
    table: 'fare_products',
    filename: 'fare_products.txt',
    header: 'fare_product_id,rider_category_id,fare_media_id,amount,currency',
    row: 'product,,,2.50,USD',
  },
  {
    table: 'fare_rules',
    filename: 'fare_rules.txt',
    header: 'fare_id,route_id,origin_id,destination_id,contains_id',
    row: 'fare,,,,',
  },
  {
    table: 'fare_leg_rules',
    filename: 'fare_leg_rules.txt',
    header:
      'network_id,from_area_id,to_area_id,from_timeframe_group_id,to_timeframe_group_id,fare_product_id',
    row: ',,,,,product',
  },
  {
    table: 'fare_leg_join_rules',
    filename: 'fare_leg_join_rules.txt',
    header: 'from_network_id,to_network_id,from_stop_id,to_stop_id',
    row: 'network-a,network-b,,',
  },
  {
    table: 'fare_transfer_rules',
    filename: 'fare_transfer_rules.txt',
    header:
      'from_leg_group_id,to_leg_group_id,fare_product_id,transfer_count,duration_limit,fare_transfer_type',
    row: ',,,,,0',
  },
  {
    table: 'timeframes',
    filename: 'timeframes.txt',
    header: 'timeframe_group_id,start_time,end_time,service_id',
    row: 'group,,,service',
  },
  {
    table: 'transfers',
    filename: 'transfers.txt',
    header:
      'from_stop_id,to_stop_id,from_trip_id,to_trip_id,from_route_id,to_route_id',
    row: 'from-stop,to-stop,,,,',
  },
  {
    table: 'translations',
    filename: 'translations.txt',
    header:
      'table_name,field_name,language,translation,record_id,record_sub_id,field_value',
    row: 'agency,agency_name,en,Translated,agency,,',
  },
] as const;

export async function writePortableKeyFixture(
  directory: string,
): Promise<void> {
  await Promise.all(
    portableKeyFixtures.map(({ filename, header, row }) =>
      writeFile(
        path.join(directory, filename),
        [header, row, row, ''].join('\n'),
      ),
    ),
  );
}
