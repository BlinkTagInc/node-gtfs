/*
 * Converts miles to degrees
 */
exports.milesToDegrees = miles => {
  const milesPerDegree = 69.17101972;
  return miles / milesPerDegree;
};

/*
 * Pluralize a word based on count
 */
exports.pluralize = (word, count) => {
  return count === 1 ? word : `${word}s`;
};
