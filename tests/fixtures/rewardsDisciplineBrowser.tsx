// SYNTHETIC component fixture. No real Auth, employee or business source.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { RewardsDisciplinePermissionProvider } from '../../hooks/useRewardsDisciplinePermission';
import AdminLayout from '../../layouts/AdminLayout';
import EmployeeRewardsDisciplinePage from '../../pages/admin/EmployeeRewardsDisciplinePage';

createRoot(document.getElementById('root')!).render(<AuthProvider><MemoryRouter initialEntries={['/admin/rewards-discipline']}><Routes>
  <Route path="/admin/login" element={<p>模擬登入頁（未登入）</p>}/>
  <Route path="/admin" element={<RewardsDisciplinePermissionProvider><AdminLayout/></RewardsDisciplinePermissionProvider>}>
    <Route path="rewards-discipline" element={<EmployeeRewardsDisciplinePage/>}/>
    <Route path="dashboard" element={<p>模擬其他頁</p>}/>
  </Route>
</Routes></MemoryRouter></AuthProvider>);
