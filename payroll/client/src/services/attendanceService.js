import { get, post, put, del } from './api';

export function getAttendance(params = {}) {
  return get('/attendance', params);
}

export function createAttendance(data) {
  return post('/attendance', data);
}

export function updateAttendance(id, data) {
  return put(`/attendance/${id}`, data);
}

export function deleteAttendance(id) {
  return del(`/attendance/${id}`);
}

export function importAttendanceCSV(formData) {
  return post('/attendance/import', formData);
}

export function getAttendanceSummary(params = {}) {
  return get('/attendance/summary', params);
}

export default {
  getAttendance,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  importAttendanceCSV,
  getAttendanceSummary,
};
