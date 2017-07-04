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

describe('gtfs.getCalendarsByService(): ', () => {
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
      const serviceIds = ['CT-16APR-Caltrain-Weekday-01-not-real'];

      return gtfs.getCalendarsByService(serviceIds);
    })
    .then(calendars => {
      should.exists(calendars);
      calendars.should.have.length(0);
    });
  });

  it('should return expected calendars', () => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];

    return gtfs.getCalendarsByService(serviceIds)
    .then(calendars => {
      should.exist(calendars);
      calendars.length.should.equal(1);

      const calendar = calendars[0].toObject();

      calendar.agency_key.should.equal(agencyKey);
      calendar.service_id.should.equal('CT-16APR-Caltrain-Weekday-01');
      calendar.monday.should.equal(1);
      calendar.tuesday.should.equal(1);
      calendar.wednesday.should.equal(1);
      calendar.thursday.should.equal(1);
      calendar.friday.should.equal(1);
      calendar.saturday.should.equal(0);
      calendar.sunday.should.equal(0);
      calendar.start_date.should.equal(20160404);
      calendar.end_date.should.equal(20190331);
    });
  });
});
