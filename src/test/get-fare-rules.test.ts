import { describe, it, expect, withGtfsFixture } from './test-utils.ts';
import { getFareRules } from '../../dist/index.js';

withGtfsFixture();

describe('getFareRules():', () => {
  it('should return empty array if no fare_rules', () => {
    const routeId = 'not_real';

    const results = getFareRules({
      route_id: routeId,
    });

    expect(results).toHaveLength(0);
  });

  it('should return expected fare_rules', () => {
    const routeId = 'Bu-16APR';

    const results = getFareRules(
      {
        route_id: routeId,
      },
      ['fare_id', 'route_id', 'origin_id', 'destination_id'],
    );

    const expectedResult = {
      fare_id: 'OW_2_20160228',
      route_id: 'Bu-16APR',
      origin_id: '6',
      destination_id: '5',
    };

    expect(results).toHaveLength(36);
    expect(results).toContainEqual(expectedResult);
  });
});
