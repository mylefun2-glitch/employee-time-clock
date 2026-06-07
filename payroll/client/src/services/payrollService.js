import { get, post, put, del } from './api';

export function getPayrolls(params = {}) {
  return get('/payroll', params);
}

export function getPayroll(id) {
  return get(`/payroll/${id}`);
}

export function calculatePayroll(data) {
  return post('/payroll/calculate', data);
}

export function updatePayroll(id, data) {
  return put(`/payroll/${id}`, data);
}

export function lockPayroll(id) {
  return post(`/payroll/${id}/lock`);
}

export function approvePayroll(id) {
  return post(`/payroll/${id}/approve`);
}

export function batchLock(ids) {
  return post('/payroll/batch-lock', { ids });
}

export function batchApprove(ids) {
  return post('/payroll/batch-approve', { ids });
}

export function deletePayroll(id) {
  return del(`/payroll/${id}`);
}

export function batchDelete(ids) {
  return post('/payroll/batch-delete', { ids });
}

export function downloadPayrollPDF(id) {
  return get(`/payroll/${id}/pdf`);
}

export function getPayrollSummary(params = {}) {
  return get('/payroll/summary', params);
}

export function batchUpdateAdjustments(year, month, adjustments) {
  return post('/payroll/batch-update-adjustments', { year, month, adjustments });
}

export default {
  getPayrolls,
  getPayroll,
  calculatePayroll,
  updatePayroll,
  lockPayroll,
  approvePayroll,
  batchLock,
  batchApprove,
  deletePayroll,
  batchDelete,
  downloadPayrollPDF,
  getPayrollSummary,
  batchUpdateAdjustments,
};
