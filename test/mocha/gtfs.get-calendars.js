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

const agencyKey = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getCalendars(): ', () => {
  before(() => database.connect(config));

  after(() => {
    return database.teardown()
    .then(database.close);
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return empty array if no calendars', () => {
    return database.teardown()
    .then(() => {
      const startDate = 20160404;
      const endDate = 20160405;
      const monday = 1;
      const tuesday = 1;
      const wednesday = 1;
      const thursday = 1;
      const friday = 1;
      const saturday = 1;
      const sunday = 1;

      return gtfs.getCalendars(agencyKey, startDate, endDate, monday, tuesday, wednesday, thursday, friday, saturday, sunday);
    })
    .then(calendars => {
      should.exists(calendars);
      calendars.should.have.length(0);
    });
  });

  it('should return expected calendars', () => {
    const startDate = 20160404;
    const endDate = 20160405;
    const monday = 0;
    const tuesday = 1;
    const wednesday = 0;
    const thursday = 0;
    const friday = 0;
    const saturday = 0;
    const sunday = 0;

    return gtfs.getCalendars(agencyKey, startDate, endDate, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
    .then(calendars => {
      should.exist(calendars);
      calendars.length.should.equal(1);

      const expectedCalendar = {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 0,
        sunday: 0,
        start_date: 20160404,
        end_date: 20190331,
        agency_key: 'caltrain'
      };

      const calendarFormatted = calendars[0].toObject();
      delete calendarFormatted._id;
      expectedCalendar.should.match(calendarFormatted);
    });
  });
});
