import { Router } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { authenticate } from '../middleware/auth.js';
import { requireFields } from '../middleware/validate.js';
import { supabase } from '../services/supabase.js';

dotenv.config();
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

/**
 * POST /api/auth/login
 * Login with username and password, return JWT token.
 */
router.post('/login', requireFields('username', 'password'), async (req, res) => {
  try {
    const { username, password } = req.body;

    let employee = null;
    let isValid = false;

    // Local admin fallback
    if (username === 'admin' && password === 'admin123') {
      isValid = true;
      employee = {
        id: 9999,
        username: 'admin',
        name: '系統管理員',
        role: 'admin',
      };
    } else {
      // Query Supabase employees table
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('username', username)
        .eq('pin', password); // pin acts as plain text password

      if (error) {
        console.error('Supabase query error:', error);
      }

      if (!error && data && data.length > 0) {
        const sbEmp = data[0];
        isValid = true;
        
        // Grant admin privileges to mylefun@gmail.com
        const role = sbEmp.username === 'mylefun@gmail.com' ? 'admin' : 'employee';
        
        employee = {
          id: sbEmp.id,
          username: sbEmp.username,
          name: sbEmp.name,
          role,
        };
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const token = jwt.sign(
      {
        id: employee.id,
        username: employee.username,
        name: employee.name,
        role: employee.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: employee.id,
        username: employee.username,
        name: employee.name,
        role: employee.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登入失敗' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info.
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    // Simply return the user data decoded from the JWT token
    res.json({ user: req.user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '取得使用者資訊失敗' });
  }
});

export default router;
