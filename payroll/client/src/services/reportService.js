import { get } from './api';

export function getMonthlyReport(params = {}) {
  return get('/reports/monthly', params);
}

export function getDepartmentReport(params = {}) {
  return get('/reports/department', params);
}

export function getYearlyReport(params = {}) {
  return get('/reports/yearly', params);
}

export function getInsuranceReport(params = {}) {
  return get('/reports/insurance', params);
}

export function exportReportCSV(type, params = {}) {
  return get(`/reports/${type}/export`, params);
}

export function getDashboardStats() {
  return get('/reports/dashboard');
}

export default {
  getMonthlyReport,
  getDepartmentReport,
  getYearlyReport,
  getInsuranceReport,
  exportReportCSV,
  getDashboardStats,
};
