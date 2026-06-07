import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EmployeesList from './pages/Employees';
import EmployeeDetail from './pages/Employees/EmployeeDetail';
import EmployeeForm from './pages/Employees/EmployeeForm';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import PayrollList from './pages/Payroll';
import PayrollDetail from './pages/Payroll/PayrollDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes inside Main Layout */}
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            
            {/* Employee Management */}
            <Route path="employees" element={<EmployeesList />} />
            <Route path="employees/new" element={<EmployeeForm />} />
            <Route path="employees/:id" element={<EmployeeDetail />} />
            <Route path="employees/:id/edit" element={<EmployeeForm />} />
            
            {/* Attendance Management */}
            <Route path="attendance" element={<Attendance />} />
            
            {/* Leaves Management */}
            <Route path="leaves" element={<Leaves />} />
            
            {/* Payroll Calculation */}
            <Route path="payroll" element={<PayrollList />} />
            <Route path="payroll/:id" element={<PayrollDetail />} />
            
            {/* Reports & Settings */}
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Fallback Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
