const model = {
    filenameBase: 'stop_times_updates',
    extension: 'gtfs-rt',
    schema: [
      {
        name: 'trip_id',
        type: 'varchar(255)',
        required: true,
        index: true,
        source: 'parent.tripUpdate.trip.tripId',
      },
      {
        name: 'stop_id',
        type: 'varchar(255)',
        required: true,
        index: true,
        source: 'entity.stopId',
      },
      {
        name: 'stop_sequence',
        type: 'integer',
        required: true,
        min: 0,
        index: true,
        source: 'entity.stopSequence',
      },
      {
        name: 'arrival_delay',
        type: 'integer',
        required: true,
        min: 0,
        index: true,
        source: 'entity.arrival.delay',
      },
      {
        name: 'departure_delay',
        type: 'integer',
        required: true,
        min: 0,
        index: true,
        source: 'entity.departure.delay',
      },
    ],
  };
  
  export default model;
  