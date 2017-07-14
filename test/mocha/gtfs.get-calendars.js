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

describe('gtfs.getCalendars():', () => {
  before(async () => {
    await database.connect(config);
  });

  after(async () => {
    await database.teardown();
    await database.close();
  });

  beforeEach(async () => {
    await database.teardown();
    await gtfs.import(config);
  });

  it('should return empty array if no calendars', async () => {
    await database.teardown();

    const calendars = await gtfs.getCalendars({
      agency_key: agencyKey
    });

    should.exists(calendars);
    calendars.should.have.length(0);
  });

  it('should return expected calendars', async () => {
    const startDate = 20160404;
    const endDate = 20160405;
    const tuesday = 1;

    const calendars = await gtfs.getCalendars({
      agency_key: agencyKey,
      start_date: {$lt: endDate},
      end_date: {$gte: startDate},
      tuesday
    });

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

  it('should return empty array if no calendars', async () => {
    await database.teardown();

    const serviceIds = ['CT-16APR-Caltrain-Weekday-01-No'];

    const calendars = await gtfs.getCalendars({
      service_id: {$in: serviceIds}
    });

    should.exists(calendars);
    calendars.should.have.length(0);
  });

  it('should return expected calendars', async () => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];

    const calendars = await gtfs.getCalendars({
      service_id: {$in: serviceIds}
    });

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
