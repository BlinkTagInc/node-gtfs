import { defineGtfsDomainTable } from '../../domain-table.ts';

export const devices = defineGtfsDomainTable({
  filename: 'devices.csv',
  tableName: 'devices',
  presence: 'optional',
  primaryKey: ['device_id'],
  fields: {
    device_id: { kind: 'id', presence: 'required' },
    stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    vehicle_id: {
      kind: 'id',
      references: [
        { targetFilename: 'vehicles.csv', targetField: 'vehicle_id' },
      ],
    },
    train_car_id: {
      kind: 'id',
      references: [
        { targetFilename: 'train_cars.csv', targetField: 'train_car_id' },
      ],
    },
    device_type: { kind: 'text' },
    device_vendor: { kind: 'text' },
    device_model: { kind: 'text' },
    device_location: { kind: 'text' },
  },
  specification: 'tides',
});
