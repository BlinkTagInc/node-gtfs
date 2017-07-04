const path = require('path');

const should = require('should');

const config = require('../config.json');
const gtfs = require('../../');

const database = require('../support/database');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getCalendarDatesByService(): ', () => {
  before(() => database.connect(config));

  after(() => {
    return database.teardown()
    .then(database.close);
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return empty array if no calendar dates exist', () => {
    return database.teardown()
    .then(() => {
      const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];

      return gtfs.getCalendarDatesByService(serviceIds);
    })
    .then(calendarDates => {
      should.exists(calendarDates);
      calendarDates.should.have.length(0);
    });
  });

  it('should return expected calendar dates', () => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];

    return gtfs.getCalendarDatesByService(serviceIds)
    .then(calendarDates => {
      should.exist(calendarDates);
      calendarDates.length.should.equal(4);

      const expectedCalendarDates = [
        {
          service_id: 'CT-16APR-Caltrain-Weekday-01',
          date: 20161124,
          exception_type: 2,
          agency_key: 'caltrain'
        },
        {
          service_id: 'CT-16APR-Caltrain-Weekday-01',
          date: 20160905,
          exception_type: 2,
          agency_key: 'caltrain'
        },
        {
          service_id: 'CT-16APR-Caltrain-Weekday-01',
          date: 20160704,
          exception_type: 2,
          agency_key: 'caltrain'
        },
        {
          service_id: 'CT-16APR-Caltrain-Weekday-01',
          date: 20160530,
          exception_type: 2,
          agency_key: 'caltrain'
        }
      ];

      calendarDates.forEach(calendarDate => {
        const calendarDateFormatted = calendarDate.toObject();
        delete calendarDateFormatted._id;
        expectedCalendarDates.should.matchAny(calendarDateFormatted);
      });
    });
  });
});
