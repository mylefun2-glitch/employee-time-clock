import { get, post } from './api';

/**
 * Auth service - login, logout, token management
 */

export function login(username, password) {
  return post('/auth/login', { username, password });
}

export function getProfile() {
  return get('/auth/me');
}

export function changePassword(currentPassword, newPassword) {
  return post('/auth/change-password', { currentPassword, newPassword });
}

/**
 * Decode JWT token payload (without verification)
 */
export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export default { login, getProfile, changePassword, decodeToken };
