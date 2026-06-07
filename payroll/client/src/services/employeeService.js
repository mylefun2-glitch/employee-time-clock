import { get, post, put, del } from './api';

export function getEmployees(params = {}) {
  return get('/employees', params);
}

export function getEmployee(id) {
  return get(`/employees/${id}`);
}

export function createEmployee(data) {
  return post('/employees', data);
}

export function updateEmployee(id, data) {
  return put(`/employees/${id}`, data);
}

export function deleteEmployee(id) {
  return del(`/employees/${id}`);
}

export function getEmployeeSalaryHistory(id) {
  return get(`/employees/${id}/salary-history`);
}

export function getEmployeeAttendance(id, params = {}) {
  return get(`/employees/${id}/attendance`, params);
}

export function getEmployeeLeaves(id, params = {}) {
  return get(`/employees/${id}/leaves`, params);
}

export function getDepartments() {
  return get('/employees/departments');
}

export default {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeSalaryHistory,
  getEmployeeAttendance,
  getEmployeeLeaves,
  getDepartments,
};
