import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Sidebar({ isCollapsed, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: '儀表板', icon: 'dashboard' },
    { to: '/employees', label: '員工管理', icon: 'people' },
    { to: '/attendance', label: '加班統計', icon: 'schedule' },
    { to: '/leaves', label: '請假統計', icon: 'event_busy' },
    { to: '/payroll', label: '薪資結算', icon: 'payments' },
    { to: '/reports', label: '報表統計', icon: 'bar_chart' },
    { to: '/settings', label: '系統設定', icon: 'settings' },
  ];

  return (
    <div style={{
      width: 'var(--active-sidebar-width, 260px)',
      backgroundColor: 'var(--surface-sidebar)',
      color: 'rgba(255, 255, 255, 0.85)',
      height: '100vh',
      position: 'fixed',
      top: 0, left: 0,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 'var(--z-sidebar)',
      transition: 'width var(--transition-normal)'
    }}>
      {/* Brand Header */}
      <div style={{
        padding: isCollapsed ? 'var(--space-4) var(--space-2)' : 'var(--space-6) var(--space-4)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'padding var(--transition-normal)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: isCollapsed ? 'center' : 'space-between', 
          width: '100%',
          flexDirection: isCollapsed ? 'column' : 'row',
          gap: isCollapsed ? 'var(--space-3)' : '0'
        }}>
          {!isCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h1 style={{
                fontSize: 'var(--text-xl)',
                color: 'var(--color-neutral-0)',
                margin: 0,
                fontWeight: 'bold',
                letterSpacing: '1px'
              }}>社照會</h1>
              <span style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-primary-200)',
                fontWeight: '500'
              }}>薪資管理系統</span>
            </div>
          ) : (
            <div style={{
              fontSize: 'var(--text-xl)',
              color: 'var(--color-neutral-0)',
              fontWeight: 'bold',
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>社</div>
          )}
          
          <button 
            onClick={onToggle} 
            style={{ 
              color: 'rgba(255, 255, 255, 0.8)', 
              cursor: 'pointer', 
              padding: '6px', 
              display: 'flex', 
              alignItems: 'center', 
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              transition: 'background-color var(--transition-fast)'
            }}
            className="sidebar-toggle-btn"
            title={isCollapsed ? "展開選單" : "收合選單"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {isCollapsed ? 'menu' : 'menu_open'}
            </span>
          </button>
        </div>
      </div>

      {/* Nav Links */}
      <nav style={{
        flex: 1,
        padding: 'var(--space-4) var(--space-2)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: isCollapsed ? '0' : 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              color: isActive ? 'var(--color-neutral-0)' : 'rgba(255, 255, 255, 0.75)',
              backgroundColor: isActive ? 'var(--surface-sidebar-active)' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? '600' : '400',
              transition: 'all var(--transition-fast)'
            })}
            className="sidebar-link"
            title={isCollapsed ? item.label : undefined}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
            {!isCollapsed && <span style={{ fontSize: 'var(--text-base)' }}>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User Info & Logout at Bottom */}
      <div style={{
        padding: isCollapsed ? 'var(--space-3) var(--space-2)' : 'var(--space-4)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        transition: 'padding var(--transition-normal)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: isCollapsed ? '0' : 'var(--space-3)' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-primary-500)',
            color: 'var(--color-neutral-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '600',
            fontSize: 'var(--text-md)',
            flexShrink: 0
          }}>
            {user?.name?.charAt(0) || '管'}
          </div>
          {!isCollapsed && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--color-neutral-0)' }} className="truncate">
                {user?.name || '管理員'}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-primary-200)' }} className="truncate">
                {user?.role === 'admin' ? '系統管理員' : '會計人員'}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            const mainSystemUrl = import.meta.env.VITE_MAIN_SYSTEM_URL || 'http://localhost:3000';
            window.location.href = `${mainSystemUrl}/admin/dashboard`;
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isCollapsed ? '0' : 'var(--space-2)',
            width: '100%',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            color: '#93c5fd',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: '600',
            marginTop: 'var(--space-2)',
            border: 'none',
            transition: 'all var(--transition-fast)'
          }}
          className="sidebar-back-to-main"
          title={isCollapsed ? "返回主系統" : undefined}
        >
          <span className="material-symbols-outlined icon-sm" style={{ fontSize: '18px' }}>arrow_back</span>
          {!isCollapsed && <span>返回主系統</span>}
        </button>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isCollapsed ? '0' : 'var(--space-2)',
            width: '100%',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#fca5a5',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: '600',
            marginTop: 'var(--space-2)',
            border: 'none',
            transition: 'all var(--transition-fast)'
          }}
          className="sidebar-logout"
          title={isCollapsed ? "登出系統" : undefined}
        >
          <span className="material-symbols-outlined icon-sm" style={{ fontSize: '18px' }}>logout</span>
          {!isCollapsed && <span>登出系統</span>}
        </button>
      </div>
    </div>
  );
}
