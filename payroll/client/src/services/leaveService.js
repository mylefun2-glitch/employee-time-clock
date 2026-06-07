import { get, post, put } from './api';

export function getLeaves(params = {}) {
  return get('/leaves', params);
}

export function getLeave(id) {
  return get(`/leaves/${id}`);
}

export function createLeave(data) {
  return post('/leaves', data);
}

export function updateLeave(id, data) {
  return put(`/leaves/${id}`, data);
}

export function approveLeave(id) {
  return post(`/leaves/${id}/approve`);
}

export function rejectLeave(id, reason) {
  return post(`/leaves/${id}/reject`, { reason });
}

export function getLeaveBalance(employeeId) {
  return get(`/leaves/balance/${employeeId}`);
}

export default {
  getLeaves,
  getLeave,
  createLeave,
  updateLeave,
  approveLeave,
  rejectLeave,
  getLeaveBalance,
};
