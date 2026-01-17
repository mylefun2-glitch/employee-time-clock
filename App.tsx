import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import KioskPage from './pages/KioskPage';
import LoginPage from './pages/admin/LoginPage';
import AdminLayout from './layouts/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import EmployeesPage from './pages/admin/EmployeesPage';
import AttendancePage from './pages/admin/AttendancePage';
import RequestsPage from './pages/admin/RequestsPage';
import LeaveTypesPage from './pages/admin/LeaveTypesPage';
import { AuthProvider } from './contexts/AuthContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Kiosk Route */}
          <Route path="/" element={<KioskPage />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<LoginPage />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="leave-types" element={<LeaveTypesPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;