import { defineGtfsDomainTable } from '../../domain-table.ts';

export const trainCars = defineGtfsDomainTable({
  filename: 'train_cars.csv',
  tableName: 'train_cars',
  presence: 'optional',
  primaryKey: ['train_car_id'],
  fields: {
    train_car_id: { kind: 'id', presence: 'required' },
    model_name: { kind: 'text' },
    facility_name: { kind: 'text' },
    capacity_seated: { kind: 'integer', minimum: 0 },
    capacity_wheelchair: { kind: 'integer', minimum: 0 },
    capacity_bike: { kind: 'integer', minimum: 0 },
    bike_rack: { kind: 'text' },
    capacity_standing: { kind: 'integer', minimum: 0 },
    train_car_type: { kind: 'text' },
  },
  specification: 'tides',
});
