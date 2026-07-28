/**
 * web/middleware/validate.js
 * Defense-in-depth input validation for route params/query values.
 * Parameterized SQL already prevents injection (see handlers/*Handler.js),
 * but validating shape here means malformed input gets a clean 400 instead
 * of silently falling through to a query that just returns nothing — and
 * it keeps obviously-garbage input away from the handler layer entirely.
 */

const SNOWFLAKE_RE = /^\d{17,20}$/;

/**
 * Validates that req.params[paramName] looks like a Discord snowflake ID.
 */
function requireSnowflakeParam(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!SNOWFLAKE_RE.test(value)) {
      return res.status(400).json({ error: `Invalid ${paramName}: must be a 17-20 digit Discord ID.` });
    }
    next();
  };
}

/**
 * Validates an optional query-string snowflake (e.g. ?userId=...) — only
 * checks it if present, since some routes treat it as optional.
 */
function optionalSnowflakeQuery(paramName) {
  return (req, res, next) => {
    const value = req.query[paramName];
    if (value !== undefined && !SNOWFLAKE_RE.test(value)) {
      return res.status(400).json({ error: `Invalid ${paramName}: must be a 17-20 digit Discord ID.` });
    }
    next();
  };
}

/**
 * Validates that req.params[paramName] is a positive integer (used for
 * warning/case IDs, which are small auto-increment DB ids, not snowflakes).
 */
function requirePositiveIntParam(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!/^\d+$/.test(value) || Number(value) < 1) {
      return res.status(400).json({ error: `Invalid ${paramName}: must be a positive integer.` });
    }
    next();
  };
}

module.exports = { SNOWFLAKE_RE, requireSnowflakeParam, optionalSnowflakeQuery, requirePositiveIntParam };
