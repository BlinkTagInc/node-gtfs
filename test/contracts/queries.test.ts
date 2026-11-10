import { databaseContract } from '../helpers/database-contract.ts';
import {
  verifyExtensionRepositoryStateMatrix,
  verifyRepositoryFilterIntegration,
} from './cases/database-repositories.ts';
import { verifyDomainQueries } from './cases/domain-query.ts';
import { verifyGeoJSONIntegration } from './cases/geojson.ts';
import { verifyMonetarySqlFilters } from './cases/monetary-filter.ts';
import { verifyServiceDateFilters } from './cases/service-date-filter.ts';
import { verifyNullableRelationshipFilters } from './cases/relationship-filter.ts';
import {
  verifyScheduleRelationshipQueries,
  verifyFlexRelationshipQueries,
  verifyRealtimeRelationshipQueries,
} from './cases/keyed-relationship.ts';
import { verifyTextFilterIntegration } from './cases/text-filter.ts';
import { verifyAggregateAndFieldReferenceIntegration } from './cases/repository-aggregate.ts';

databaseContract(
  'distinguishes disabled, missing, and empty repositories',
  async ({ db, dialect, queryCount }) => {
    await verifyExtensionRepositoryStateMatrix(db, dialect, queryCount);
  },
);
databaseContract(
  'executes relationship and semantic filters',
  async ({ db, dialect }) => {
    await verifyRepositoryFilterIntegration(db, dialect);
  },
);

for (const [name, verify] of [
  ['domain queries', verifyDomainQueries],
  ['GeoJSON projections', verifyGeoJSONIntegration],
  ['monetary SQL filters', verifyMonetarySqlFilters],
  ['service-date filters', verifyServiceDateFilters],
  ['nullable relationship filters', verifyNullableRelationshipFilters],
  ['Schedule relationships', verifyScheduleRelationshipQueries],
  ['Flex relationships', verifyFlexRelationshipQueries],
  ['Realtime relationships', verifyRealtimeRelationshipQueries],
  ['text filters', verifyTextFilterIntegration],
  [
    'SQL summaries and field comparisons',
    verifyAggregateAndFieldReferenceIntegration,
  ],
] as const) {
  databaseContract(name, async ({ db }) => {
    await verify({ client: db });
  });
}
