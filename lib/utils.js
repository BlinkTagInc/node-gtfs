const sqlString = require('sqlstring-sqlite');

/*
 * Calculate seconds from midnight for HH:mm:ss / H:m:s
 */
exports.calculateHourTimestamp = time => {
  const split = time.split(':').map(d => Number.parseInt(d, 10));
  if (split.length !== 3) {
    return null;
  }

  return (split[0] * 3600) + (split[1] * 60) + split[2];
};

exports.formatSelectClause = fields => {
  const selectItem = fields.length > 0 ? fields.map(fieldName => sqlString.escapeId(fieldName)).join(', ') : '*';

  return `SELECT ${selectItem}`;
};

exports.formatWhereClause = (key, value) => {
  if (Array.isArray(value)) {
    return `${sqlString.escapeId(key)} IN (${value.map(v => sqlString.escape(v)).join(', ')})`;
  }

  if (value === null) {
    return `${sqlString.escapeId(key)} IS NULL`;
  }

  return `${sqlString.escapeId(key)} = ${sqlString.escape(value)}`;
};

exports.formatWhereClauses = query => {
  if (Object.keys(query).length === 0) {
    return '';
  }

  const whereClauses = Object.entries(query).map(([key, value]) => exports.formatWhereClause(key, value));
  return `WHERE ${whereClauses.join(' AND ')}`;
};

exports.formatOrderByClause = orderBy => {
  let orderByClause = '';

  if (orderBy.length > 0) {
    orderByClause += 'ORDER BY ';

    orderByClause += orderBy.map(([key, value]) => {
      const direction = value === 'DESC' ? 'DESC' : 'ASC';
      return `${sqlString.escapeId(key)} ${direction}`;
    }).join(', ');
  }

  return orderByClause;
};
