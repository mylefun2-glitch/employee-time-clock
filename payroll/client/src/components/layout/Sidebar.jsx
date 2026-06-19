import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Sidebar({ isCollapsed, onToggle, isMobileOpen, onCloseMobile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if any stats route is active to auto-expand
  const isStatsRouteActive = location.pathname.startsWith('/attendance') || 
                             location.pathname.startsWith('/leaves') || 
                             location.pathname.startsWith('/reports');
                             
  const [isStatsExpanded, setIsStatsExpanded] = useState(isStatsRouteActive);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const mainNavItems = [
    { to: '/', label: '儀表板', icon: 'dashboard' },
    { to: '/employees', label: '員工管理', icon: 'people' },
    { to: '/payroll', label: '薪資結算', icon: 'payments' },
  ];

  const statsItems = [
    { to: '/attendance', label: '加班統計', icon: 'schedule' },
    { to: '/leaves', label: '請假統計', icon: 'event_busy' },
    { to: '/reports', label: '報表統計', icon: 'bar_chart' },
  ];

  const bottomNavItems = [
    { to: '/settings', label: '系統設定', icon: 'settings' },
  ];

  const renderNavLink = (item, isSubItem = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={() => {
        if (window.innerWidth <= 768 && onCloseMobile) {
          onCloseMobile();
        }
      }}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed && !isMobileOpen ? 'center' : 'flex-start',
        gap: isCollapsed && !isMobileOpen ? '0' : 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        paddingLeft: isSubItem && (!isCollapsed || isMobileOpen) ? 'var(--space-8)' : 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        color: isActive ? 'var(--color-neutral-0)' : 'rgba(255, 255, 255, 0.75)',
        backgroundColor: isActive ? 'var(--surface-sidebar-active)' : 'transparent',
        textDecoration: 'none',
        fontWeight: isActive ? '600' : '400',
        transition: 'all var(--transition-fast)'
      })}
      className="sidebar-link"
      title={(isCollapsed && !isMobileOpen) ? item.label : undefined}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
      {(!isCollapsed || isMobileOpen) && <span style={{ fontSize: 'var(--text-base)' }}>{item.label}</span>}
    </NavLink>
  );

  return (
    <div className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`} style={{
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
      transition: 'all var(--transition-normal)'
    }}>
      {/* Brand Header */}
      <div style={{
        padding: (isCollapsed && !isMobileOpen) ? 'var(--space-4) var(--space-2)' : 'var(--space-6) var(--space-4)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'padding var(--transition-normal)',
        position: 'relative'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: (isCollapsed && !isMobileOpen) ? 'center' : 'space-between', 
          width: '100%',
          flexDirection: (isCollapsed && !isMobileOpen) ? 'column' : 'row',
          gap: (isCollapsed && !isMobileOpen) ? 'var(--space-3)' : '0'
        }}>
          {(!isCollapsed || isMobileOpen) ? (
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
          
          {/* Desktop Toggle Button */}
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
            className="sidebar-toggle-btn desktop-only"
            title={isCollapsed ? "展開選單" : "收合選單"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {isCollapsed ? 'menu' : 'menu_open'}
            </span>
          </button>

          {/* Mobile Close Button */}
          <button 
            onClick={onCloseMobile} 
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
            className="sidebar-close-btn mobile-only"
            title="關閉選單"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              close
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
        {mainNavItems.map(item => renderNavLink(item))}

        {/* Statistics Group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            onClick={() => {
              if (isCollapsed && !isMobileOpen) {
                onToggle();
                setIsStatsExpanded(true);
              } else {
                setIsStatsExpanded(!isStatsExpanded);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: (isCollapsed && !isMobileOpen) ? 'center' : 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              color: isStatsRouteActive ? 'var(--color-neutral-0)' : 'rgba(255, 255, 255, 0.75)',
              backgroundColor: isStatsRouteActive && (isCollapsed && !isMobileOpen) ? 'var(--surface-sidebar-active)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: isStatsRouteActive ? '600' : '400',
              transition: 'all var(--transition-fast)'
            }}
            className="sidebar-group-btn"
            title={(isCollapsed && !isMobileOpen) ? "統計報表" : undefined}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: (isCollapsed && !isMobileOpen) ? '0' : 'var(--space-3)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>insights</span>
              {(!isCollapsed || isMobileOpen) && <span style={{ fontSize: 'var(--text-base)' }}>統計報表</span>}
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <span className="material-symbols-outlined" style={{ fontSize: '18px', transition: 'transform 0.2s', transform: isStatsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                expand_more
              </span>
            )}
          </button>

          {/* Expanded Items */}
          {(isStatsExpanded || (isCollapsed && !isMobileOpen && isStatsRouteActive)) && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '2px',
              marginTop: '2px',
              backgroundColor: (!isCollapsed || isMobileOpen) ? 'rgba(0,0,0,0.1)' : 'transparent',
              borderRadius: 'var(--radius-md)',
              padding: (!isCollapsed || isMobileOpen) ? '4px 0' : '0'
            }}>
              {statsItems.map(item => renderNavLink(item, true))}
            </div>
          )}
        </div>

        {bottomNavItems.map(item => renderNavLink(item))}
      </nav>

      {/* User Info & Logout at Bottom */}
      <div style={{
        padding: (isCollapsed && !isMobileOpen) ? 'var(--space-3) var(--space-2)' : 'var(--space-4)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        transition: 'padding var(--transition-normal)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: (isCollapsed && !isMobileOpen) ? 'center' : 'flex-start', gap: (isCollapsed && !isMobileOpen) ? '0' : 'var(--space-3)' }}>
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
          {(!isCollapsed || isMobileOpen) && (
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
            const mainSystemUrl = import.meta.env.VITE_MAIN_SYSTEM_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');
            window.location.href = `${mainSystemUrl}/admin/dashboard`;
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: (isCollapsed && !isMobileOpen) ? '0' : 'var(--space-2)',
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
          title={(isCollapsed && !isMobileOpen) ? "返回主系統" : undefined}
        >
          <span className="material-symbols-outlined icon-sm" style={{ fontSize: '18px' }}>arrow_back</span>
          {(!isCollapsed || isMobileOpen) && <span>返回主系統</span>}
        </button>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: (isCollapsed && !isMobileOpen) ? '0' : 'var(--space-2)',
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
          title={(isCollapsed && !isMobileOpen) ? "登出系統" : undefined}
        >
          <span className="material-symbols-outlined icon-sm" style={{ fontSize: '18px' }}>logout</span>
          {(!isCollapsed || isMobileOpen) && <span>登出系統</span>}
        </button>
      </div>
    </div>
  );
}
