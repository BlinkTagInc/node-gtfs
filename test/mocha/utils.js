const should = require('should');
const utils = require('../../lib/utils');

describe.only('utils:', () => {
  describe('calculateHourTimestamp:', () => {
    it('should return 0 seconds from midnight', async () => {
      const timestamp = utils.calculateHourTimestamp('00:00:00');
      should.exist(timestamp)
      timestamp.should.equal(0);
    });
    it('should return 10 seconds from midnight', async () => {
      const timestamp = utils.calculateHourTimestamp('00:00:10');
      should.exist(timestamp)
      timestamp.should.equal(10);
    });
    it('should return 60 seconds from midnight', async () => {
      const timestamp = utils.calculateHourTimestamp('00:01:00');
      should.exist(timestamp)
      timestamp.should.equal(60);
    });
    it('should return 76358 seconds from midnight', async () => {
      const timestamp = utils.calculateHourTimestamp('21:12:38');
      should.exist(timestamp)
      timestamp.should.equal(76358);
    });
  })
})