const Frequencies = require('../../models/frequencies');

/*
 * Returns an array of frequencies that match the query parameters.
 */
exports.getFrequencies= query => Frequencies.find(query);
