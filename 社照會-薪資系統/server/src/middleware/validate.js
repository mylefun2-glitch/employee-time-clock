/**
 * Request validation helpers.
 * Provides middleware factories for common validation patterns.
 */

/**
 * Validate that required fields exist in request body.
 * @param {string[]} fields - Array of required field names
 */
export function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
    if (missing.length > 0) {
      return res.status(400).json({
        error: '缺少必填欄位',
        fields: missing,
        message: `缺少以下必填欄位: ${missing.join(', ')}`,
      });
    }
    next();
  };
}

/**
 * Validate that the given param is a valid integer ID.
 * @param {string} paramName - The route param name (default: 'id')
 */
export function validateId(paramName = 'id') {
  return (req, res, next) => {
    const id = parseInt(req.params[paramName], 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        error: '無效的 ID',
        message: `${paramName} 必須是正整數`,
      });
    }
    req.params[paramName] = id;
    next();
  };
}

/**
 * Validate query parameters for pagination.
 * Sets default values if not provided.
 */
export function validatePagination(req, res, next) {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 20;
  
  req.pagination = {
    page: Math.max(1, page),
    pageSize: Math.min(100, Math.max(1, pageSize)),
    skip: (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize)),
  };
  next();
}

/**
 * Validate year and month query parameters.
 */
export function validateYearMonth(req, res, next) {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  
  if (req.query.year && (isNaN(year) || year < 2000 || year > 2100)) {
    return res.status(400).json({ error: '無效的年份', message: '年份必須在 2000-2100 之間' });
  }
  if (req.query.month && (isNaN(month) || month < 1 || month > 12)) {
    return res.status(400).json({ error: '無效的月份', message: '月份必須在 1-12 之間' });
  }
  
  req.yearMonth = {
    year: year || new Date().getFullYear(),
    month: month || new Date().getMonth() + 1,
  };
  next();
}

/**
 * Validate date string format (YYYY-MM-DD).
 * @param {string} fieldName - The body field to validate
 */
export function validateDateFormat(fieldName) {
  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return res.status(400).json({
        error: '無效的日期格式',
        message: `${fieldName} 必須是 YYYY-MM-DD 格式`,
      });
    }
    next();
  };
}

/**
 * Sanitize string fields in request body - trim whitespace.
 */
export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = value.trim();
      }
    }
  }
  next();
}

export default {
  requireFields,
  validateId,
  validatePagination,
  validateYearMonth,
  validateDateFormat,
  sanitizeBody,
};
