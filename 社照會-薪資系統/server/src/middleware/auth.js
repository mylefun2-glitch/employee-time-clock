import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

/**
 * JWT authentication middleware.
 * Validates the Bearer token from the Authorization header.
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供認證令牌' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '認證令牌已過期' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '無效的認證令牌' });
    }
    return res.status(401).json({ error: '認證失敗' });
  }
}

/**
 * Role authorization middleware.
 * @param  {...string} roles - Allowed roles
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未認證' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '權限不足' });
    }
    next();
  };
}

export default { authenticate, authorize };
