import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const sidebarWidth = isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex',
      '--active-sidebar-width': sidebarWidth
    }}>
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      <div style={{
        flex: 1,
        paddingLeft: 'var(--active-sidebar-width)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'padding-left var(--transition-normal)'
      }}>
        <Header />
        <main style={{
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
