import { defineGtfsTable } from '../../define-table.ts';

export const vehicleTrainCars = defineGtfsTable({
  file: 'vehicle_train_cars.txt',
  presence: 'optional',
  primaryKey: ['vehicle_id', 'train_car_id'],
  fields: {
    vehicle_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'vehicles.txt', field: 'vehicle_id' }],
      applyFeedPrefix: true,
    },
    train_car_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'train_cars.txt', field: 'train_car_id' }],
      applyFeedPrefix: true,
    },
    train_car_order: { kind: 'integer', minimum: 0 },
    operator_id: {
      kind: 'id',
      references: [{ file: 'operators.txt', field: 'operator_id' }],
      applyFeedPrefix: true,
    },
  },
  namespace: 'tides',
});
