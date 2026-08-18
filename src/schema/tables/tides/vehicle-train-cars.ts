import { defineGtfsTable } from '../../define-table.ts';

export const vehicleTrainCars = defineGtfsTable({
  file: 'vehicle_train_cars.csv',
  presence: 'optional',
  primaryKey: ['vehicle_id', 'train_car_id'],
  fields: {
    vehicle_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'vehicles.csv', field: 'vehicle_id' }],
      applyFeedPrefix: true,
    },
    train_car_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'train_cars.csv', field: 'train_car_id' }],
      applyFeedPrefix: true,
    },
    train_car_order: { kind: 'integer', minimum: 0 },
    operator_id: {
      kind: 'id',
      references: [{ file: 'operators.csv', field: 'operator_id' }],
      applyFeedPrefix: true,
    },
  },
  namespace: 'tides',
});
