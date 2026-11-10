import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { Gtfs, type GtfsDatabaseConfig } from '../../../src/index.ts';
import { faresBelowMinorUnits } from '../../helpers/advanced-filter-recipes.ts';
import { integerText } from '../../helpers/advanced-summary-recipes.ts';

export async function verifyMonetarySqlFilters(
  database: GtfsDatabaseConfig,
): Promise<void> {
  const gtfs = new Gtfs({
    database,
    sources: [{ sourceId: 'north' }],
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.recreate();
    await gtfs.database.withKysely({
      callback: async (db) => {
        await sql`insert into fare_attributes (source_id, fare_id, price, currency_type, payment_method) values
          ('north', 'zero', 0, 'USD', 0),
          ('north', 'lower', 123, 'USD', 0),
          ('north', 'match', 124, 'USD', 0),
          ('north', 'upper', 125, 'USD', 0),
          ('north', 'yen', 124, 'JPY', 0),
          ('north', 'dinar', 124, 'BHD', 0),
          ('south', 'match', 123, 'USD', 0),
          ('north', 'large', 9007199254740993, 'USD', 0),
          ('north', 'maximum', 9223372036854775807, 'USD', 0)`.execute(db);
        const prices = (currency: string, maximum: string) =>
          faresBelowMinorUnits(db, 'north', currency, maximum)
            .select(['fare_id', 'currency_type'])
            .select((eb) =>
              integerText(eb.ref('price'), gtfs.database.dialect).as(
                'minor_units',
              ),
            );
        assert.deepEqual(
          await prices('USD', '124').where('price', '>', '123').execute(),
          [{ fare_id: 'match', currency_type: 'USD', minor_units: '124' }],
        );
        assert.deepEqual(await prices('USD', '0').execute(), [
          { fare_id: 'zero', currency_type: 'USD', minor_units: '0' },
        ]);
        for (const [currency, id] of [
          ['JPY', 'yen'],
          ['BHD', 'dinar'],
        ] as const) {
          assert.deepEqual(await prices(currency, '124').execute(), [
            { fare_id: id, currency_type: currency, minor_units: '124' },
          ]);
        }
        assert.deepEqual(
          await prices('USD', '9007199254740993')
            .where('price', '>', '9007199254740992')
            .execute(),
          [
            {
              fare_id: 'large',
              currency_type: 'USD',
              minor_units: '9007199254740993',
            },
          ],
        );
        assert.deepEqual(
          await prices('USD', '9223372036854775807')
            .where('fare_id', '=', 'maximum')
            .execute(),
          [
            {
              fare_id: 'maximum',
              currency_type: 'USD',
              minor_units: '9223372036854775807',
            },
          ],
        );
        assert.deepEqual(await prices('EUR', '124').execute(), []);
        for (const value of [
          '1.24',
          'NaN',
          '1e2',
          '9223372036854775808',
          '-9223372036854775809',
          (Number.MAX_SAFE_INTEGER + 1) as never,
        ]) {
          assert.throws(
            () => faresBelowMinorUnits(db, 'north', 'USD', value),
            TypeError,
          );
        }
      },
    });
    for (const [currency_type, price, fare_id] of [
      ['USD', '1.24', 'match'],
      ['JPY', '124', 'yen'],
      ['BHD', '0.124', 'dinar'],
      ['USD', '90071992547409.93', 'large'],
    ] as const) {
      assert.deepEqual(
        await gtfs.schedule.fareAttributes
          .where({ currency_type, price })
          .select('fare_id', 'price')
          .all(),
        [{ fare_id, price }],
      );
    }
    for (const where of [
      { price: '1.24' },
      { currency_type: 'USD', price: '1.234' },
      { currency_type: 'USD', price: 1.24 },
    ]) {
      await assert.rejects(
        async () => gtfs.schedule.fareAttributes.where(where as never).count(),
        { code: 'GTFS_QUERY_INVALID' },
      );
    }
  } finally {
    await gtfs.close();
  }
}
