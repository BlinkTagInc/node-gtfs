import { defineGtfsTable } from '../../define-table.ts';

export const devices = defineGtfsTable({
  file: 'devices.csv',
  presence: 'optional',
  primaryKey: ['device_id'],
  fields: {
    device_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    vehicle_id: {
      kind: 'id',
      references: [{ file: 'vehicles.csv', field: 'vehicle_id' }],
      applyFeedPrefix: true,
    },
    train_car_id: {
      kind: 'id',
      references: [{ file: 'train_cars.csv', field: 'train_car_id' }],
      applyFeedPrefix: true,
    },
    device_type: { kind: 'text' },
    device_vendor: { kind: 'text' },
    device_model: { kind: 'text' },
    device_location: { kind: 'text' },
  },
  namespace: 'tides',
});
