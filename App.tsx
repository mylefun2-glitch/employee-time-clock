import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import KioskPage from './pages/KioskPage';
import LoginPage from './pages/admin/LoginPage';
import AdminLayout from './layouts/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import EmployeesPage from './pages/admin/EmployeesPage';
import AttendancePage from './pages/admin/AttendancePage';
import MakeupRequestsPage from './pages/admin/MakeupRequestsPage';
import RequestsPage from './pages/admin/RequestsPage';
import LeaveTypesPage from './pages/admin/LeaveTypesPage';
import CompanyManagementPage from './pages/admin/CompanyManagementPage';
import StatisticsPage from './pages/admin/StatisticsPage';
import { AuthProvider } from './contexts/AuthContext';
import { EmployeeProvider } from './contexts/EmployeeContext';
import EmployeeLayout from './layouts/EmployeeLayout';
import EmployeeLoginPage from './pages/employee/EmployeeLoginPage';
import EmployeeDashboardPage from './pages/employee/EmployeeDashboardPage';
import EmployeeProfilePage from './pages/employee/EmployeeProfilePage';
import EmployeeRequestsPage from './pages/employee/EmployeeRequestsPage';
import EmployeeAttendancePage from './pages/employee/EmployeeAttendancePage';
import EmployeeApprovalsPage from './pages/employee/EmployeeApprovalsPage';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <EmployeeProvider>
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
              <Route path="stats" element={<StatisticsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="makeup-requests" element={<MakeupRequestsPage />} />
              <Route path="requests" element={<RequestsPage />} />
              <Route path="leave-types" element={<LeaveTypesPage />} />
              <Route path="company" element={<CompanyManagementPage />} />
            </Route>

            {/* Employee Routes */}
            <Route path="/employee/login" element={<EmployeeLoginPage />} />
            <Route path="/employee" element={<EmployeeLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<EmployeeDashboardPage />} />
              <Route path="profile" element={<EmployeeProfilePage />} />
              <Route path="requests" element={<EmployeeRequestsPage />} />
              <Route path="attendance" element={<EmployeeAttendancePage />} />
              <Route path="approvals" element={<EmployeeApprovalsPage />} />
              <Route path="makeup-approvals" element={<MakeupRequestsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </EmployeeProvider>
    </AuthProvider>
  );
};

export default App;