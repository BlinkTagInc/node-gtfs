/* eslint-env mocha */

const path = require('path');

const mongoose = require('mongoose');
const should = require('should');

const config = require('../config.json');
const gtfs = require('../..');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

const agencyKey = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getCalendars():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  it('should return empty array if no calendars', async () => {
    await mongoose.connection.db.dropDatabase();

    const calendars = await gtfs.getCalendars({
      agency_key: agencyKey
    });

    should.exists(calendars);
    calendars.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return expected calendars', async () => {
    const startDate = 20160404;
    const endDate = 20160405;
    const tuesday = 1;

    const calendars = await gtfs.getCalendars({
      agency_key: agencyKey,
      start_date: { $lt: endDate },
      end_date: { $gte: startDate },
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

    const calendarFormatted = calendars[0];
    delete calendarFormatted._id;
    expectedCalendar.should.match(calendarFormatted);
  });

  it('should return empty array if no calendars', async () => {
    await mongoose.connection.db.dropDatabase();

    const serviceIds = ['CT-16APR-Caltrain-Weekday-01-No'];

    const calendars = await gtfs.getCalendars({
      service_id: { $in: serviceIds }
    });

    should.exists(calendars);
    calendars.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return expected calendars limited by service_id', async () => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];

    const calendars = await gtfs.getCalendars({
      service_id: { $in: serviceIds }
    });

    should.exist(calendars);
    calendars.length.should.equal(1);

    const calendar = calendars[0];

    calendar.should.not.have.any.keys('_id');
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

  it('should return expected calendars limited by route_id', async () => {
    const routeIds = ['TaSj-16APR'];

    const calendars = await gtfs.getCalendars({
      route_id: { $in: routeIds }
    });

    should.exist(calendars);
    calendars.length.should.equal(2);

    const expectedServiceIds = ['CT-16APR-Caltrain-Sunday-02', 'CT-16APR-Caltrain-Saturday-02'];

    for (const calendar of calendars) {
      expectedServiceIds.should.matchAny(calendar.service_id);
    }
  });
});
