/**
 * Base API service - wraps fetch with auth token injection and error handling.
 */

export const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Get JWT token from localStorage
 */
function getToken() {
  return localStorage.getItem('token');
}

/**
 * Core fetch wrapper
 */
async function request(endpoint, options = {}) {
  const token = getToken();
  const url = `${BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // Handle 401 - redirect to login
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('未授權，請重新登入');
    }

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `請求失敗 (${response.status})`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    // Return blob for file downloads
    return await response.blob();
  } catch (error) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('無法連接伺服器，請檢查網路連線');
    }
    throw error;
  }
}

/**
 * GET request
 */
export function get(endpoint, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });

  const queryString = searchParams.toString();
  const url = queryString ? `${endpoint}?${queryString}` : endpoint;

  return request(url, { method: 'GET' });
}

/**
 * POST request
 */
export function post(endpoint, data) {
  return request(endpoint, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  });
}

/**
 * PUT request
 */
export function put(endpoint, data) {
  return request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * PATCH request
 */
export function patch(endpoint, data) {
  return request(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request
 */
export function del(endpoint) {
  return request(endpoint, { method: 'DELETE' });
}

export default { get, post, put, patch, del };
