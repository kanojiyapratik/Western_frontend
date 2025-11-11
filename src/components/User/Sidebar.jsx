import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../Admin/Sidebar.css';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace('/api', '');
  }
  if (import.meta.env.MODE === 'production') {
    return 'https://threed-configurator-backend-7pwk.onrender.com';
  }
  if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app'))) {
    return 'https://threed-configurator-backend-7pwk.onrender.com';
  }
  return 'http://192.168.1.7:5000';
};

const UserSidebar = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const canViewModels = !!(user?.permissions?.modelUpload || user?.permissions?.modelManageUpload || user?.permissions?.modelManageEdit || user?.permissions?.modelManageDelete);
  const canManageUsers = !!(user?.permissions?.userManagement || user?.permissions?.userManageCreate || user?.permissions?.userManageEdit || user?.permissions?.userManageDelete);

  // Fetch pending requests count
  useEffect(() => {
    const fetchPendingRequests = async () => {
      if (!user || (user?.role === 'admin' || user?.role === 'superadmin')) return;

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiBaseUrl()}/api/permission-requests/my-requests?status=pending`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.log('Failed to fetch pending requests count');
          return;
        }

        const requests = await response.json();
        setPendingRequestsCount(requests.length);
      } catch (error) {
        console.error('Error fetching pending requests:', error);
      }
    };

    fetchPendingRequests();
    
    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingRequests, 30000);
    
    // Listen for custom event when new request is submitted
    const handleRequestSubmitted = () => {
      fetchPendingRequests();
    };
    
    window.addEventListener('permissionRequestSubmitted', handleRequestSubmitted);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('permissionRequestSubmitted', handleRequestSubmitted);
    };
  }, [user]);
  
  const menuItems = [
    { path: '/user/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/user/viewer', icon: '🧭', label: 'Viewer' },
    ...(canViewModels ? [
      { path: '/user/model-management', icon: '🧩', label: 'Model Management' },
    ] : []),
    { path: '/user/permission-request', icon: pendingRequestsCount > 0 ? '🔔' : '📋', label: 'Permission Request' },
    ...(canManageUsers ? [
      { path: '/user/user-management', icon: '👥', label: 'User Management' },
    ] : []),
    { path: '/user/change-password', icon: '🔒', label: 'Change Password' },
  ];

  return (
    <aside className={`kt-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div style={{padding:'8px 16px', borderBottom:'1px solid #334155'}}>
        <div style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'14px', fontWeight:'600'}}>
          {!collapsed && <>⚙️ <span>User</span></>}
          <button
            onClick={onToggle}
            style={{
              marginLeft: collapsed ? '0' : 'auto',
              background: 'none',
              border: 'none',
              color: '#cbd5e1',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              fontSize: '24px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.background = '#334155'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? '⏵' : '⏴'}
          </button>
        </div>
      </div>
      <nav className="kt-nav">
        {menuItems.map(item => {
          const isPermissionRequest = item.path === '/user/permission-request';
          const hasNotifications = isPermissionRequest && pendingRequestsCount > 0;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`kt-nav-link ${location.pathname === item.path ? 'active' : ''}`}
              title={collapsed ? item.label : ''}
              onClick={(e) => {
                // Force page reload when navigating from viewer to prevent routing issues
                if (location.pathname === '/user/viewer' && item.path !== '/user/viewer') {
                  e.preventDefault();
                  if (typeof window !== 'undefined') {
                    window.location.href = item.path;
                  }
                }
                // Force page reload when navigating to viewer from any other page
                if (location.pathname !== '/user/viewer' && item.path === '/user/viewer') {
                  e.preventDefault();
                  if (typeof window !== 'undefined') {
                    window.location.href = item.path;
                  }
                }
              }}
            >
              <span className="kt-icon">
                {item.icon}
                {hasNotifications && (
                  <span 
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      background: 'var(--kt-danger)',
                      color: 'white',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      animation: 'pulse 2s infinite'
                    }}
                  >
                    {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                  </span>
                )}
              </span>
              <span className="kt-text">
                {item.label}
                {hasNotifications && !collapsed && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', opacity: 0.8 }}>
                    ({pendingRequestsCount})
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>
      <div style={{padding:'12px 16px', borderTop:'1px solid #334155'}}>
        {!collapsed ? (
          <div style={{marginBottom:'8px'}}>
            <div style={{display:'flex', alignItems:'center', gap:'8px', background:'#334155', padding:'8px', borderRadius:'6px'}}>
              <div className="kt-avatar" style={{width:'24px', height:'24px', fontSize:'10px'}}>
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{flex:'1', minWidth:'0'}}>
                <div style={{fontSize:'11px', fontWeight:'600', color:'#fff', lineHeight:'1.2'}}>{user?.name || 'User'}</div>
                <div style={{fontSize:'9px', color:'#94a3b8', textTransform:'capitalize'}}>{user?.role || 'user'}</div>
              </div>
            </div>
          </div>
        ) : null}
        <button
          className={`kt-btn danger sm ${collapsed ? 'icon-only' : ''}`}
          onClick={logout}
          title="Logout"
          style={{width:'100%', justifyContent:'center', padding:'6px 8px'}}
        >
          <span>🚪</span>
          {!collapsed && <span style={{marginLeft:'6px'}}>Logout</span>}
        </button>
      </div>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </aside>
  );
};

export default UserSidebar;
