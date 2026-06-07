import { get, put } from './api';

export function getSettings() {
  return get('/settings');
}

export function updateSettings(data) {
  return put('/settings', { settings: data });
}

export default {
  getSettings,
  updateSettings,
  updateOrganization: (data) => updateSettings(data),
  updateLaborInsurance: (data) => updateSettings(data),
  updateHealthInsurance: (data) => updateSettings(data),
  updatePension: (data) => updateSettings(data),
  updateSalaryDefaults: (data) => updateSettings(data),
};
