import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();

  const sidebarWidth = isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';

  return (
    <div className="main-layout" style={{ 
      minHeight: '100vh', 
      display: 'flex',
      '--active-sidebar-width': sidebarWidth
    }}>
      {/* Mobile Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 'calc(var(--z-sidebar) - 1)',
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      <Sidebar 
        isCollapsed={isCollapsed} 
        onToggle={() => setIsCollapsed(!isCollapsed)} 
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />
      
      <div className="main-content-wrapper" style={{
        flex: 1,
        paddingLeft: 'var(--active-sidebar-width)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'padding-left var(--transition-normal)',
        width: '100%'
      }}>
        <Header onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
        <main className="main-content" style={{
          padding: 'var(--space-6)',
          paddingTop: 'calc(var(--header-height) + var(--space-6))',
          backgroundColor: 'var(--surface-secondary)',
          minHeight: '100vh',
          width: '100%',
          maxWidth: 'var(--content-max-width)',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)'
        }}>
          <div className="page-transition" key={location.pathname} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', flex: 1 }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
