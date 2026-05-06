import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { EmployeeProvider } from './contexts/EmployeeContext';
import LoadingScreen from './components/LoadingScreen';

// 動態匯入頁面與佈局 (Code Splitting)
const KioskPage = lazy(() => import('./pages/KioskPage'));
const LoginPage = lazy(() => import('./pages/admin/LoginPage'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const EmployeesPage = lazy(() => import('./pages/admin/EmployeesPage'));
const MakeupRequestsPage = lazy(() => import('./pages/admin/MakeupRequestsPage'));
const ResourceManagerPage = lazy(() => import('./pages/admin/ResourceManagerPage'));
const RequestsPage = lazy(() => import('./pages/admin/RequestsPage'));
const ShiftRequestsPage = lazy(() => import('./pages/admin/ShiftRequestsPage'));
const LeaveTypesPage = lazy(() => import('./pages/admin/LeaveTypesPage'));
const CompanyManagementPage = lazy(() => import('./pages/admin/CompanyManagementPage'));
const StatisticsPage = lazy(() => import('./pages/admin/StatisticsPage'));
const AdminLeaveStatsPage = lazy(() => import('./pages/admin/AdminLeaveStatsPage'));
const AttendanceCalendarPage = lazy(() => import('./pages/admin/AttendanceCalendarPage'));

const EmployeeLayout = lazy(() => import('./layouts/EmployeeLayout'));
const EmployeeLoginPage = lazy(() => import('./pages/employee/EmployeeLoginPage'));
const EmployeeDashboardPage = lazy(() => import('./pages/employee/EmployeeDashboardPage'));
const EmployeeProfilePage = lazy(() => import('./pages/employee/EmployeeProfilePage'));
const EmployeeRequestsPage = lazy(() => import('./pages/employee/EmployeeRequestsPage'));
const EmployeeAttendancePage = lazy(() => import('./pages/employee/EmployeeAttendancePage'));
const EmployeeCalendarPage = lazy(() => import('./pages/employee/EmployeeCalendarPage'));
const EmployeeResourceCalendarPage = lazy(() => import('./pages/employee/ResourceCalendarPage'));
const EmployeeApprovalsPage = lazy(() => import('./pages/employee/EmployeeApprovalsPage'));
const ManagerTeamLeavePage = lazy(() => import('./pages/employee/ManagerTeamLeavePage'));
const CarRequestsPage = lazy(() => import('./pages/admin/CarRequestsPage'));

const App: React.FC = () => {
  return (
    <AuthProvider>
      <EmployeeProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
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
                <Route path="leave-stats" element={<AdminLeaveStatsPage />} />
                <Route path="attendance-calendar" element={<AttendanceCalendarPage />} />
                <Route path="makeup-requests" element={<MakeupRequestsPage />} />
                <Route path="shift-requests" element={<ShiftRequestsPage />} />
                <Route path="requests" element={<RequestsPage />} />
                <Route path="resource-manager" element={<ResourceManagerPage />} />
                {/* Redirects for legacy paths */}
                <Route path="cars" element={<Navigate to="../resource-manager" replace />} />
                <Route path="resources" element={<Navigate to="../resource-manager" replace />} />
                <Route path="resource-requests" element={<Navigate to="../resource-manager" replace />} />
                <Route path="resource-calendar" element={<Navigate to="../resource-manager" replace />} />
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
                <Route path="calendar" element={<EmployeeCalendarPage />} />
                <Route path="resource-calendar" element={<EmployeeResourceCalendarPage />} />
                <Route path="approvals" element={<EmployeeApprovalsPage />} />
                <Route path="team-leaves" element={<ManagerTeamLeavePage />} />
                <Route path="car-requests" element={<CarRequestsPage />} />
              </Route>


              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </EmployeeProvider>
    </AuthProvider>
  );
};

export default App;