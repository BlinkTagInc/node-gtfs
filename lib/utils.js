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

/*
 * Extend a set of bounds with a point
 */
exports.extendBounds = (bounds, loc) => {
  if (bounds.sw[0] > loc[0] || !bounds.sw[0]) {
    bounds.sw[0] = loc[0];
  }
  if (bounds.ne[0] < loc[0] || !bounds.ne[0]) {
    bounds.ne[0] = loc[0];
  }
  if (bounds.sw[1] > loc[1] || !bounds.sw[1]) {
    bounds.sw[1] = loc[1];
  }
  if (bounds.ne[1] < loc[1] || !bounds.ne[1]) {
    bounds.ne[1] = loc[1];
  }
  return bounds;
};

/*
 * Calculates a center point from bounds
 */
exports.boundsCenter = bounds => {
  const lat = ((bounds.ne[0] - bounds.sw[0]) / 2) + bounds.sw[0];
  const lon = ((bounds.ne[1] - bounds.sw[1]) / 2) + bounds.sw[1];
  return [lat, lon];
};
