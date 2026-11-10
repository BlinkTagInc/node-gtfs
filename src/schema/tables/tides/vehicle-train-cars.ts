import { defineGtfsDomainTable } from '../../domain-table.ts';

export const vehicleTrainCars = defineGtfsDomainTable({
  filename: 'vehicle_train_cars.csv',
  tableName: 'vehicle_train_cars',
  presence: 'optional',
  primaryKey: ['vehicle_id', 'train_car_id'],
  fields: {
    vehicle_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'vehicles.csv', targetField: 'vehicle_id' },
      ],
    },
    train_car_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'train_cars.csv', targetField: 'train_car_id' },
      ],
    },
    train_car_order: { kind: 'integer', minimum: 0 },
    operator_id: {
      kind: 'id',
      references: [
        { targetFilename: 'operators.csv', targetField: 'operator_id' },
      ],
    },
  },
  specification: 'tides',
});
