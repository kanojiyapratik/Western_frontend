// Role hierarchy (higher number = higher authority)
const ROLE_HIERARCHY = {
  employee: 1,
  assistantmanager: 2,
  manager: 3,
  custom: 3, // Same level as manager
  admin: 4,
  superadmin: 5
};

// Get allowed roles for current user (can only assign roles below their level)
const getAllowedRoles = (currentUserRole) => {
  const currentLevel = ROLE_HIERARCHY[currentUserRole] || 1;
  return Object.keys(ROLE_HIERARCHY).filter(role => ROLE_HIERARCHY[role] < currentLevel);
};

// Check if user can edit another user (can only edit users at lower levels)
const canEditUser = (currentUserRole, targetUserRole) => {
  const currentLevel = ROLE_HIERARCHY[currentUserRole] || 1;
  const targetLevel = ROLE_HIERARCHY[targetUserRole] || 1;
  return currentLevel > targetLevel;
};

// Default permissions for each role
const ROLE_DEFAULT_PERMISSIONS = {
  manager: {
    modelUpload: true,
    modelManageUpload: true,
    modelManageEdit: true,
    modelManageDelete: true,
    userManagement: true,
    userManageCreate: true,
    userManageEdit: true,
    userManageDelete: true,
    doorPresets: true,
    doorToggles: true,
    drawerToggles: true,
    textureWidget: true,
    lightWidget: true,
    globalTextureWidget: true,
    screenshotWidget: true,
    saveConfig: true,
    canRotate: true,
    canPan: true,
    canZoom: true,
    canMove: true,
    reflectionWidget: false,
    movementWidget: false,
    customWidget: false,
    imageDownloadQualities: ['average', 'good', 'best'],
    presetAccess: {},
  },
  assistantmanager: {
    modelUpload: false,
    modelManageUpload: false,
    modelManageEdit: true,
    modelManageDelete: false,
    userManagement: false,
    userManageCreate: false,
    userManageEdit: false,
    userManageDelete: false,
    doorPresets: true,
    doorToggles: true,
    drawerToggles: true,
    textureWidget: true,
    lightWidget: true,
    globalTextureWidget: false,
    screenshotWidget: false,
    saveConfig: true,
    canRotate: true,
    canPan: false,
    canZoom: true,
    canMove: false,
    reflectionWidget: false,
    movementWidget: false,
    customWidget: false,
    imageDownloadQualities: ['average', 'good'],
    presetAccess: {},
  },
  employee: {
    modelUpload: false,
    modelManageUpload: false,
    modelManageEdit: false,
    modelManageDelete: false,
    userManagement: false,
    userManageCreate: false,
    userManageEdit: false,
    userManageDelete: false,
    doorPresets: true,
    doorToggles: true,
    drawerToggles: true,
    textureWidget: true,
    lightWidget: true,
    globalTextureWidget: false,
    screenshotWidget: false,
    saveConfig: true,
    canRotate: true,
    canPan: false,
    canZoom: true,
    canMove: false,
    reflectionWidget: false,
    movementWidget: false,
    customWidget: false,
    imageDownloadQualities: ['average'],
    presetAccess: {},
  },
  custom: {
    modelUpload: false,
    modelManageUpload: false,
    modelManageEdit: false,
    modelManageDelete: false,
    userManagement: false,
    userManageCreate: false,
    userManageEdit: false,
    userManageDelete: false,
    doorPresets: true,
    doorToggles: true,
    drawerToggles: true,
    textureWidget: true,
    lightWidget: true,
    globalTextureWidget: false,
    screenshotWidget: false,
    saveConfig: true,
    canRotate: true,
    canPan: false,
    canZoom: true,
    canMove: false,
    reflectionWidget: false,
    movementWidget: false,
    customWidget: false,
    imageDownloadQualities: ['average'],
    presetAccess: {},
  },
};

// Helper to compare permissions (only core role permissions, not presetAccess or other metadata)
const arePermissionsEqual = (a, b) => {
  // Only compare core permission properties, not metadata like presetAccess
  const corePermissionKeys = [
    'modelUpload', 'modelManageUpload', 'modelManageEdit', 'modelManageDelete',
    'userManagement', 'userManageCreate', 'userManageEdit', 'userManageDelete',
    'doorPresets', 'doorToggles', 'drawerToggles', 'textureWidget', 'lightWidget',
    'globalTextureWidget', 'screenshotWidget', 'saveConfig', 'canRotate', 'canPan',
    'canZoom', 'canMove', 'reflectionWidget', 'movementWidget', 'customWidget', 
    'imageDownloadQualities'
  ];
  
  for (let key of corePermissionKeys) {
    const aVal = a[key];
    const bVal = b[key];
    
    // Handle arrays (like imageDownloadQualities)
    if (Array.isArray(aVal) && Array.isArray(bVal)) {
      if (aVal.length !== bVal.length || !aVal.every(v => bVal.includes(v)) || !bVal.every(v => aVal.includes(v))) {
        return false;
      }
    }
    // Handle arrays vs non-arrays
    else if (Array.isArray(aVal) !== Array.isArray(bVal)) {
      return false;
    }
    // Handle boolean/other values
    else if (aVal !== bVal) {
      return false;
    }
  }
  return true;
};

// Display role name with proper formatting
const getRoleDisplayName = (user) => {
  const role = user.role || 'employee';
  
  // Debug: Log what we're actually getting from the database
  console.log('getRoleDisplayName - User:', user.name, 'Role from DB:', user.role, 'Permissions keys:', user.permissions ? Object.keys(user.permissions) : 'none');
  
  // Handle custom roles
  if (role === 'custom') {
    return user.customRoleName || 'Custom';
  }
  
  // Handle special formatting for compound role names
  if (role === 'assistantmanager') {
    return 'Assistant Manager';
  }
  
  // Handle standard roles with proper capitalization
  return role.charAt(0).toUpperCase() + role.slice(1);
};
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import './UserManagement.css';
import { ActivityLog } from '../../ActivityLog/ActivityLog';
import SavedConfigsList from '../../Interface/SavedConfigsList';
import SendPasswordReset from '../SendPasswordReset';

const API_BASE_URL = import.meta.env.VITE_API_BASE?.replace('/api', '') || 
  (import.meta.env.MODE === 'production' 
    ? 'https://threed-configurator-backend-7pwk.onrender.com' 
    : 'http://192.168.1.7:5000');

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityUserId, setActivityUserId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'employee', customRoleName: '' });
  const [createdPassword, setCreatedPassword] = useState('');
  const [createErrors, setCreateErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSourceUser, setTransferSourceUser] = useState(null);
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [configCounts, setConfigCounts] = useState({});
  const [showUserConfigs, setShowUserConfigs] = useState(false);
  const [configsUserId, setConfigsUserId] = useState(null);
  const [debugMessage, setDebugMessage] = useState('');
  const { user: tokenUser } = useAuth();
  const isSuperAdmin = tokenUser?.role === 'superadmin';
  const [selectedTab, setSelectedTab] = useState('admins'); // 'admins' | 'employees'
  const currentUserId = tokenUser?.id || tokenUser?._id || (tokenUser?._id && tokenUser._id.toString && tokenUser._id.toString());

  useEffect(() => {
    fetchUsers();
    loadModelPresets();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/admin-dashboard/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
      // Fetch saved-config counts for each user (show in table)
      (async () => {
        try {
          const counts = {};
          await Promise.all(data.map(async (u) => {
            try {
              const r = await fetch(`${API_BASE_URL}/api/admin/user-configs/${u._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (!r.ok) { counts[u._id] = 0; return; }
              const arr = await r.json();
              counts[u._id] = Array.isArray(arr) ? arr.length : 0;
            } catch (e) {
              counts[u._id] = 0;
            }
          }));
          setConfigCounts(counts);
        } catch (e) {
          console.warn('Failed to fetch config counts', e);
        }
      })();
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user) => {
    if (user._id === currentUserId) {
      setError('You cannot edit your own account');
      return;
    }
    if (!canEditUser(tokenUser?.role, user.role)) {
      setError('You can only edit users with lower authority levels');
      return;
    }
    console.log('=== EDIT USER DEBUG ===');
    console.log('User from DB:', {
      name: user.name,
      role: user.role,
      customRoleName: user.customRoleName,
      permissions: user.permissions
    });
    
    // Use the permissions from database exactly as they are - don't modify them
    const dbPermissions = user.permissions || {};
    
    console.log('=== PERMISSIONS DEBUG ===');
    console.log('User:', user.name, 'Role:', user.role);
    console.log('Raw permissions from DB:', user.permissions);
    console.log('User management permissions from DB:', {
      userManagement: dbPermissions.userManagement,
      userManageCreate: dbPermissions.userManageCreate,
      userManageEdit: dbPermissions.userManageEdit,
      userManageDelete: dbPermissions.userManageDelete
    });
    
    // Only add presetAccess if it doesn't exist
    let completePermissions = {
      ...dbPermissions,
      presetAccess: dbPermissions.presetAccess || {}
    };
    
    console.log('Complete permissions being set in edit form:', completePermissions);
    console.log('User management in complete permissions:', {
      userManagement: completePermissions.userManagement,
      userManageCreate: completePermissions.userManageCreate,
      userManageEdit: completePermissions.userManageEdit,
      userManageDelete: completePermissions.userManageDelete
    });
    
    setEditingUser({
      ...user,
      role: user.role || 'employee',
      permissions: completePermissions,
      customRoleName: user.customRoleName || '',
    });
    setShowEditModal(true);
    setTimeout(() => loadModelPresets(), 10);
  };

  // Presets for the currently-selected model (used to render per-preset controls)
  const [modelPresets, setModelPresets] = useState([]);

  // Load presets from server for the currently-selected model (uses same /api/models list as MainApp)
  const loadModelPresets = async () => {
    try {
      const selectedModel = localStorage.getItem('selectedModel');
      if (!selectedModel) return setModelPresets([]);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/models`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) return setModelPresets([]);
      const models = await res.json();
      const found = models.find(m => String(m.name) === String(selectedModel));
      if (!found) return setModelPresets([]);
      const cfgUrl = found.configUrl;
      if (!cfgUrl) return setModelPresets([]);
      const fullUrl = cfgUrl.startsWith('http') ? cfgUrl : `${API_BASE_URL}${cfgUrl.startsWith('/') ? '' : '/'}${cfgUrl}`;
      const cfgRes = await fetch(fullUrl);
      if (!cfgRes.ok) return setModelPresets([]);
      const json = await cfgRes.json();
      const presets = Array.isArray(json.presets) ? json.presets : [];
      setModelPresets(presets);
      // If editingUser is open and presetAccess wasn't initialized, default to allowing all
      setEditingUser(prev => {
        if (!prev) return prev;
        const currentAccess = prev.permissions?.presetAccess;
        if (currentAccess && Object.keys(currentAccess).length) return prev; // already set
        const map = {};
        presets.forEach(p => { if (p.id) map[p.id] = true; });
        return { ...prev, permissions: { ...prev.permissions, presetAccess: map } };
      });
    } catch (err) {
      console.warn('Failed to load model presets for admin UI', err);
      setModelPresets([]);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        permissions: editingUser.permissions || {},
        role: editingUser.role || 'employee',
        customRoleName: editingUser.customRoleName || '',
      };
      console.log('=== UPDATE USER DEBUG ===');
      console.log('User:', editingUser.name);
      console.log('Role being saved:', payload.role);
      console.log('All permissions being saved:', payload.permissions);
      console.log('User management permissions being saved:', {
        userManagement: payload.permissions.userManagement,
        userManageCreate: payload.permissions.userManageCreate,
        userManageEdit: payload.permissions.userManageEdit,
        userManageDelete: payload.permissions.userManageDelete
      });
      
      const response = await fetch(`${API_BASE_URL}/api/admin-dashboard/users/${editingUser._id}/permissions`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      const updatedUser = await response.json();
      console.log('Server response:', updatedUser);
      console.log('Updated user permissions:', updatedUser.user?.permissions);
      
      console.log('=== POST-UPDATE DEBUG ===');
      console.log('Updated user from server:', updatedUser.user);
      console.log('Updated user permissions from server:', updatedUser.user?.permissions);
      console.log('User management permissions from server response:', {
        userManagement: updatedUser.user?.permissions?.userManagement,
        userManageCreate: updatedUser.user?.permissions?.userManageCreate,
        userManageEdit: updatedUser.user?.permissions?.userManageEdit,
        userManageDelete: updatedUser.user?.permissions?.userManageDelete
      });
      
      // Update the users state with the new user data
      setUsers(prevUsers => prevUsers.map(user => 
        user._id === editingUser._id ? updatedUser.user : user
      ));
      
      // Refresh the entire users list to ensure consistency
      await fetchUsers();
      
      setShowEditModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Failed to update user');
    }
  };

  // Toggle a preset for editingUser.permissions.presetAccess
  const handlePresetToggle = (presetId, checked) => {
    setEditingUser(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        presetAccess: {
          ...(prev.permissions?.presetAccess || {}),
          [presetId]: checked
        }
      }
    }));
  };

  // Active/deactivated status removed; no toggle function

  const handleDeleteUser = async (userId) => {
    if (userId === currentUserId) {
      setError('You cannot delete your own account');
      return;
    }
    const targetUser = users.find(u => u._id === userId);
    if (targetUser && !canEditUser(tokenUser?.role, targetUser.role)) {
      setError('You can only delete users with lower authority levels');
      return;
    }
    try {
      const token = localStorage.getItem('token');

      // Query the admin endpoint that returns the user's saved-widget configs array
      const cfgResp = await fetch(`${API_BASE_URL}/api/admin/user-configs/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!cfgResp.ok) throw new Error('Failed to query user saved configurations');
      const configs = await cfgResp.json();
      const count = Array.isArray(configs) ? configs.length : 0;
  console.log('Delete flow:', { userId, count, configsSample: configs && configs.slice ? configs.slice(0,2) : configs });
  setDebugMessage(`Delete flow for ${userId}: count=${count}`);

      if (count === 0) {
        // No saved configs - ask confirmation and delete immediately
        if (!window.confirm('This user has no saved configurations. Delete account?')) return;
        const delResp = await fetch(`${API_BASE_URL}/api/admin-dashboard/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!delResp.ok) {
          const err = await delResp.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to delete user');
        }
        setUsers(prev => prev.filter(u => u._id !== userId));
        return;
      }

      // Has configs - open transfer modal (do not show browser confirm yet)
      const src = users.find(u => u._id === userId) || null;
      console.log('Transfer source user resolved:', src);
      setDebugMessage(`Transfer modal should open for ${src ? src.name : 'null'}`);
      setTransferSourceUser(src);
      setTransferTargetUserId('');
      setShowTransferModal(true);
    } catch (error) {
      console.error('Error in delete flow:', error);
      setError(error.message || 'Failed to delete user');
    }
  };

  const confirmDeleteWithTransfer = async () => {
    if (!transferSourceUser) { setShowTransferModal(false); return; }
    // Ask final confirmation here so admin saw the transfer modal first
    if (!window.confirm('Are you sure you want to delete this user now? This action cannot be undone.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const url = transferTargetUserId
        ? `${API_BASE_URL}/api/admin-dashboard/users/${transferSourceUser._id}?transferTo=${transferTargetUserId}`
        : `${API_BASE_URL}/api/admin-dashboard/users/${transferSourceUser._id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete user');
      }
  setUsers(prev => prev.filter(u => u._id !== transferSourceUser._id));
      setShowTransferModal(false);
      setTransferSourceUser(null);
      setTransferTargetUserId('');
    } catch (error) {
      console.error('Error deleting/transferring user:', error);
      setError(error.message || 'Failed to delete user');
    }
  };

  const handlePermissionChange = (permission, value) => {
    setEditingUser(prev => {
      const newPermissions = {
        ...prev.permissions,
        [permission]: value
      };
      
      // Auto-check main checkboxes when sub-permissions are enabled
      if (permission.startsWith('userManage') && value) {
        newPermissions.userManagement = true;
      }
      if (permission.startsWith('modelManage') && value) {
        newPermissions.modelUpload = true;
      }
      
      // Auto-uncheck main checkbox when all sub-permissions are disabled
      if (permission === 'userManagement' && !value) {
        newPermissions.userManageCreate = false;
        newPermissions.userManageEdit = false;
        newPermissions.userManageDelete = false;
      }
      if (permission === 'modelUpload' && !value) {
        newPermissions.modelManageUpload = false;
        newPermissions.modelManageEdit = false;
        newPermissions.modelManageDelete = false;
      }
      
      // Ensure all permissions have boolean values (not undefined)
      Object.keys(newPermissions).forEach(key => {
        if (newPermissions[key] === undefined) {
          newPermissions[key] = false;
        }
      });
      
      return {
        ...prev,
        permissions: newPermissions
      };
    });
  };

  const handleQualityChange = (quality, checked) => {
    setEditingUser(prev => {
      const currentQualities = prev.permissions.imageDownloadQualities || [];
      const newQualities = checked
        ? [...currentQualities, quality]
        : currentQualities.filter(q => q !== quality);
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          imageDownloadQualities: newQualities
        }
      };
    });
  };

  // Create user handler (moved out of inline form for clarity)
  const validateCreateForm = (user) => {
    const errs = {};
    if (!user.name || user.name.trim().length < 2) errs.name = 'Please enter a full name (min 2 characters).';
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!user.email || !emailRe.test(user.email)) errs.email = 'Please enter a valid email address.';
    if (!user.password || user.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    return errs;
  };

  const passwordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'Empty' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const labels = ['Very weak', 'Weak', 'Medium', 'Good', 'Strong', 'Excellent'];
    return { score, label: labels[Math.min(score, labels.length - 1)] };
  };

  const generatePassword = () => {
    // create a reasonably strong password
    const part = () => Math.random().toString(36).slice(2, 8);
    const special = '!@#$%^&*()_+~'.charAt(Math.floor(Math.random() * 11));
    const pwd = (part() + part() + special + String.fromCharCode(65 + Math.floor(Math.random() * 26))).slice(0, 14);
    setNewUser(prev => ({ ...prev, password: pwd }));
    setShowPassword(true);
    setCreateErrors(prev => ({ ...prev, password: undefined }));
    return pwd;
  };
  // Create user handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateSuccess('');
    
    // Get default permissions for the selected role
    const defaultPermissions = ROLE_DEFAULT_PERMISSIONS[newUser.role] || ROLE_DEFAULT_PERMISSIONS['employee'];
    
    const payload = { 
      ...newUser, 
      permissions: defaultPermissions 
    };
    const errs = validateCreateForm(payload);
    setCreateErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_BASE_URL}/api/admin-dashboard/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create user');
      }
      const data = await resp.json();
      const shownPwd = newUser.password || '';
      setCreatedPassword(shownPwd);
      setCreateSuccess('User created successfully');
      await fetchUsers();
      // reset form but keep createdPassword visible for copy
      setNewUser({ name: '', email: '', password: '', role: 'employee', customRoleName: '' });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Create user error', err);
      setCreateErrors({ form: err.message || 'Failed to create user' });
    } finally {
      setCreating(false);
    }
  };

  const grantAll = () => {
    if (!editingUser) return;
    const allTrue = Object.keys(editingUser.permissions).reduce((acc, key) => {
      if (key === 'imageDownloadQualities') {
        acc[key] = ['average', 'good', 'best'];
      } else {
        acc[key] = true;
      }
      return acc;
    }, {});
    setEditingUser(prev => ({ ...prev, permissions: allTrue }));
  };

  const revokeAll = () => {
    if (!editingUser) return;
    const allFalse = Object.keys(editingUser.permissions).reduce((acc, key) => {
      if (key === 'imageDownloadQualities') {
        acc[key] = [];
      } else {
        acc[key] = false;
      }
      return acc;
    }, {});
    setEditingUser(prev => ({ ...prev, permissions: allFalse }));
  };

  if (loading) {
    return (
      <div className="user-management-loading">
        <div className="spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="kt-stack gap-16">
      {/* DEBUG: show last delete-flow message and modal state for troubleshooting */}
      {debugMessage && (
        <div style={{padding:8, background:'rgba(15,23,42,0.04)', border:'1px solid var(--kt-border)', borderRadius:6}}>
          <strong>Debug:</strong> {debugMessage} {showTransferModal ? '(transfer modal open)' : '(modal closed)'}
        </div>
      )}
      <div className="kt-card">
        <div className="flex gap-12" style={{alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <div className="kt-card-header" style={{margin:0}}>User Management</div>
            <div className="text-faint" style={{fontSize:12}}>Manage permissions and status</div>
          </div>
          <div className="flex gap-12" style={{fontSize:12}}>
            <span className="badge primary">Total {users.length}</span>
            {/* Active/inactive removed */}
          </div>
          <div>
            <button
              className="kt-btn primary"
              onClick={() => {
                // Ensure non-superadmin cannot pre-select admin role when opening the modal
                if (!isSuperAdmin) setNewUser(prev => ({ ...prev, role: 'employee' }));
                setShowCreateModal(true);
              }}
            >
              Create User
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="kt-card" style={{borderColor:'var(--kt-danger)'}}>
          <div style={{color:'var(--kt-danger)', fontSize:14, display:'flex', alignItems:'center', gap:8}}>
            <span>⚠️</span>{error}
          </div>
        </div>
      )}

      {isSuperAdmin ? (
        <div className="kt-card" style={{padding:12}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <button
                className={`kt-btn sm ${selectedTab === 'admins' ? 'primary' : 'outline'}`}
                onClick={() => setSelectedTab('admins')}
                style={{minWidth:110}}
              >
                Admins ({users.filter(u => (u.role === 'admin' || u.role === 'superadmin') && String(u._id) !== String(currentUserId)).length})
              </button>
              <button
                className={`kt-btn sm ${selectedTab === 'employees' ? 'primary' : 'outline'}`}
                onClick={() => setSelectedTab('employees')}
                style={{minWidth:110}}
              >
                Employees ({users.filter(u => u.role === 'employee').length})
              </button>
            </div>
            <div style={{fontSize:13, color:'var(--kt-text-soft)'}}>Select a list to manage</div>
          </div>

          <div style={{marginTop:12}}>
            {selectedTab === 'admins' ? (
              <div className="kt-table-wrapper">
                <table className="kt-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => (u.role === 'admin' || u.role === 'superadmin') && String(u._id) !== String(currentUserId)).map(user => (
                      <tr key={user._id}>
                        <td style={{display:'flex', alignItems:'center', gap:8}}>
                          <div className="kt-avatar" style={{width:34, height:34, fontSize:13}}>{user.name.charAt(0).toUpperCase()}</div>
                          <span>{user.name}</span>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`role-badge ${user.role === 'superadmin' ? 'superadmin' : user.role}`}>
                            {getRoleDisplayName(user)}
                          </span>
                        </td>
                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="kt-actions">
                            {isSuperAdmin && <button onClick={() => handleEditUser(user)}>Edit</button>}
                            <button onClick={() => { setActivityUserId(user._id); setShowActivityModal(true); }}>View Activity</button>
                            {isSuperAdmin && <button onClick={() => handleDeleteUser(user._id)}>Delete</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : selectedTab === 'employees' ? (
              <div className="kt-table-wrapper">
                <table className="kt-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Saved Configs</th>
                      <th>Role</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.role === 'employee').map(user => (
                      <tr key={user._id}>
                        <td style={{display:'flex', alignItems:'center', gap:8}}>
                          <div className="kt-avatar" style={{width:34, height:34, fontSize:13}}>{user.name.charAt(0).toUpperCase()}</div>
                          <span>{user.name}</span>
                          {(() => { const p=user?.permissions||{}; return p.modelUpload||p.modelManageUpload||p.modelManageEdit||p.modelManageDelete; })() ? (
                            <span
                              title="Model management permission granted"
                              aria-label="Model management permission"
                              style={{
                                display:'inline-flex',
                                alignItems:'center',
                                justifyContent:'center',
                                fontSize:12,
                                lineHeight:1,
                                padding:'2px 6px',
                                borderRadius:999,
                                background:'var(--kt-primary-ghost, rgba(99,102,241,0.15))',
                                color:'var(--kt-primary, #6366f1)'
                              }}
                            >
                              ⤴️
                            </span>
                          ) : null}
                        </td>
                        <td>{user.email}</td>
                        <td style={{textAlign:'center'}}>
                          <div
                            role="button"
                            tabIndex={0}
                            title="Click to view saved configurations"
                            onClick={() => { setConfigsUserId(user._id); setShowUserConfigs(true); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setConfigsUserId(user._id); setShowUserConfigs(true); } }}
                            style={{display:'inline-flex', alignItems:'center', gap:8, cursor: typeof configCounts[user._id] === 'number' && configCounts[user._id] > 0 ? 'pointer' : 'default', padding:'6px 8px', borderRadius:6}}
                          >
                            {typeof configCounts[user._id] === 'number' && configCounts[user._id] > 0 ? (
                              <>
                                <span style={{fontSize:14, opacity:0.95}}>📋</span>
                                <span style={{textDecoration:'underline', color:'var(--kt-primary)', fontWeight:600}}>{configCounts[user._id]}</span>
                              </>
                            ) : (
                              <span className="badge" style={{background:'transparent', color:'var(--kt-text)'}}>-</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`role-badge ${user.role === 'custom' ? 'custom' : user.role}`}>
                            {getRoleDisplayName(user)}
                          </span>
                        </td>
                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="kt-actions">
                            <button onClick={() => handleEditUser(user)}>Edit</button>
                            <button onClick={() => { setActivityUserId(user._id); setShowActivityModal(true); }}>View Activity</button>
                            <SendPasswordReset userEmail={user.email} />
                            <button onClick={() => handleDeleteUser(user._id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="kt-table-wrapper">
          <table className="kt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>
                  Saved Configs
                  <div style={{fontSize:11, color:'var(--kt-text-soft)', marginTop:4}}>Click the number to view</div>
                </th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(u => u.role !== 'admin' && u.role !== 'superadmin').map(user => (
                <tr key={user._id}>
                  <td style={{display:'flex', alignItems:'center', gap:8}}>
                    <div className="kt-avatar" style={{width:34, height:34, fontSize:13}}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{user.name}</span>
                    {(() => { const p=user?.permissions||{}; return p.modelUpload||p.modelManageUpload||p.modelManageEdit||p.modelManageDelete; })() ? (
                      <span
                        title="Model management permission granted"
                        aria-label="Model management permission"
                        style={{
                          display:'inline-flex',
                          alignItems:'center',
                          justifyContent:'center',
                          fontSize:12,
                          lineHeight:1,
                          padding:'2px 6px',
                          borderRadius:999,
                          background:'var(--kt-primary-ghost, rgba(99,102,241,0.15))',
                          color:'var(--kt-primary, #6366f1)'
                        }}
                      >
                        ⤴️
                      </span>
                    ) : null}
                  </td>
                  <td>{user.email}</td>
                  <td style={{textAlign:'center'}}>
                    <div
                      role="button"
                      tabIndex={0}
                      title="Click to view saved configurations"
                      onClick={() => { setConfigsUserId(user._id); setShowUserConfigs(true); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setConfigsUserId(user._id); setShowUserConfigs(true); } }}
                      style={{display:'inline-flex', alignItems:'center', gap:8, cursor: typeof configCounts[user._id] === 'number' && configCounts[user._id] > 0 ? 'pointer' : 'default', padding:'6px 8px', borderRadius:6}}
                    >
                      {typeof configCounts[user._id] === 'number' && configCounts[user._id] > 0 ? (
                        <>
                          <span style={{fontSize:14, opacity:0.95}}>📋</span>
                          <span style={{textDecoration:'underline', color:'var(--kt-primary)', fontWeight:600}}>{configCounts[user._id]}</span>
                        </>
                      ) : (
                        <span className="badge" style={{background:'transparent', color:'var(--kt-text)'}}>-</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge ${user.role === 'custom' ? 'custom' : (user.role || 'employee')}`}>
                      {getRoleDisplayName(user)}
                    </span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="kt-actions">
                      <button onClick={() => handleEditUser(user)}>Edit</button>
                      <button onClick={() => { setActivityUserId(user._id); setShowActivityModal(true); }}>View Activity</button>
                      <button onClick={() => handleDeleteUser(user._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transfer / Delete Modal */}
      {showTransferModal && transferSourceUser && (
        <div className="modal-overlay" style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999, pointerEvents:'auto'}}>
          <div className="kt-card" style={{width:'min(640px,100%)'}}>
            <div className="flex" style={{justifyContent:'space-between', alignItems:'center'}}>
              <div className="kt-card-header">Delete User: {transferSourceUser.name}</div>
              <button onClick={() => { setShowTransferModal(false); setTransferSourceUser(null); }} style={{border:'none', background:'transparent', fontSize:24, lineHeight:1, cursor:'pointer'}}>×</button>
            </div>
            <div style={{padding:16}}>
              <p>This user has saved configurations. You can transfer them to another user, or delete them along with the account.</p>
              <div style={{marginTop:12}}>
                <label style={{display:'block', marginBottom:8}}>Transfer configurations to (optional):</label>
                <select value={transferTargetUserId} onChange={(e) => setTransferTargetUserId(e.target.value)} style={{width:'100%', padding:8}}>
                  <option value="">-- Do not transfer (delete configs) --</option>
                  {users.filter(u => u._id !== transferSourceUser._id && u.role !== 'admin' && u.role !== 'superadmin').map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{display:'flex', justifyContent:'flex-end', gap:12, padding:12, borderTop:'1px solid var(--kt-border)'}}>
              <button className="kt-btn" onClick={() => { setShowTransferModal(false); setTransferSourceUser(null); setTransferTargetUserId(''); }}>Cancel</button>
              <button className="kt-btn danger" onClick={confirmDeleteWithTransfer}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Saved configs modal for admin viewing another user's configs */}
      <SavedConfigsList
        isOpen={showUserConfigs}
        onClose={() => { setShowUserConfigs(false); setConfigsUserId(null); }}
        onLoad={(configData) => {
          // Optionally load the configuration into the main viewer (if the app supports it)
          try {
            // Some apps expect onLoad to be async - keep this minimal
          } catch (e) {
            console.warn('onLoad handler for SavedConfigsList not implemented', e);
          }
        }}
        userId={configsUserId}
      />

      {showEditModal && editingUser && (
        <div className="modal-overlay" style={{position:'fixed', inset:0, background:'rgba(15,23,42,.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'60px 20px', zIndex:200}}>
          <div className="kt-card" style={{width:'min(920px,100%)', maxHeight:'80vh', overflow:'auto'}}>
            <div className="flex" style={{justifyContent:'space-between', alignItems:'center'}}>
              <div className="kt-card-header" style={{marginBottom:0}}>Edit User: {editingUser.name}</div>
              <button onClick={() => setShowEditModal(false)} style={{border:'none', background:'transparent', fontSize:24, lineHeight:1, cursor:'pointer'}}>×</button>
            </div>
            <form onSubmit={handleUpdateUser} className="flex flex-col gap-16" style={{marginTop:12}}>
              <div className="kt-card" style={{boxShadow:'none', border:'1px dashed var(--kt-border)'}}>
                <div className="kt-card-header" style={{marginBottom:12}}>Basic Information</div>
                <div className="flex gap-16" style={{flexWrap:'wrap'}}>
                  <div style={{flex:'1 1 220px'}}>
                    <label style={{fontSize:12, fontWeight:600, color:'var(--kt-text-soft)'}}>Name</label>
                    <input style={{width:'100%', marginTop:4}} type="text" value={editingUser.name} disabled />
                  </div>
                  <div style={{flex:'1 1 220px'}}>
                    <label style={{fontSize:12, fontWeight:600, color:'var(--kt-text-soft)'}}>Email</label>
                    <input style={{width:'100%', marginTop:4}} type="email" value={editingUser.email} disabled />
                  </div>
                  <div style={{flex:'1 1 220px'}}>
                    <label style={{fontSize:12, fontWeight:600, color:'var(--kt-text-soft)'}}>Role</label>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 4}}>
                      <select
                        style={{flex: 1, padding:'8px 10px', borderRadius:6, border:'1px solid var(--kt-border)', fontSize:15}}
                        value={editingUser.role}
                        onChange={e => {
                          const newRole = e.target.value;
                          console.log('Role changed from', editingUser.role, 'to:', newRole);
                          
                          // Only apply default permissions if the role actually changed
                          if (newRole === editingUser.role) {
                            console.log('Role unchanged, keeping existing permissions');
                            return;
                          }
                          
                          setEditingUser(prev => {
                            const defaultPerms = { ...ROLE_DEFAULT_PERMISSIONS[newRole] } || {};
                            console.log('Default permissions for', newRole, ':', defaultPerms);
                            
                            const completePerms = {
                              ...defaultPerms,
                              presetAccess: prev.permissions?.presetAccess || {}
                            };
                            
                            console.log('Complete permissions being set:', completePerms);
                            
                            return { 
                              ...prev, 
                              role: newRole, 
                              customRoleName: newRole === 'custom' ? (prev.customRoleName || '') : '',
                              permissions: completePerms
                            };
                          });
                        }}
                      >
                        {getAllowedRoles(tokenUser?.role).map(role => (
                          <option key={role} value={role}>
                            {role === 'assistantmanager' ? 'Assistant Manager' : 
                             role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                      {editingUser.role === 'custom' && (
                        <input
                          type="text"
                          placeholder="Custom role name"
                          value={editingUser.customRoleName || ''}
                          onChange={e => setEditingUser(prev => ({ ...prev, customRoleName: e.target.value }))}
                          style={{flex: 1, padding:'8px 10px', borderRadius:6, border:'1px solid var(--kt-border)', fontSize:15}}
                        />
                      )}

                    </div>
                  </div>
                  {/* Active flag removed */}
                </div>
              </div>

              {/* High-level: Model Management permissions (collapsible) */}
              <div className="kt-card" style={{boxShadow:'none', border:'1px dashed var(--kt-border)'}}>
                <div className="kt-card-header" style={{marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <label style={{display:'flex', gap:6, alignItems:'center', fontSize:12}}>
                      <input type="checkbox" checked={!!editingUser.permissions.modelUpload} onChange={(e) => handlePermissionChange('modelUpload', e.target.checked)} />
                      <div>
                        <div style={{fontWeight:600}}>Model Management</div>
                        <div style={{fontSize:11, color:'var(--kt-text-soft)'}}>If only this is on, user can view models</div>
                      </div>
                    </label>
                  </div>
                  <button type="button" className="kt-btn outline sm" onClick={() => setEditingUser(prev => ({...prev, __mmOpen: !prev?.__mmOpen}))}>
                    {editingUser?.__mmOpen ? 'Hide actions' : 'Choose actions'}
                  </button>
                </div>
                {editingUser?.__mmOpen && (
                  <div style={{display:'grid', gap:10, gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))'}}>
                    <label style={{display:'flex', gap:6, alignItems:'center', fontSize:12, background:'var(--kt-surface-alt)', padding:'10px 12px', borderRadius:6, border:'1px solid var(--kt-border)'}}>
                      <input type="checkbox" checked={!!editingUser.permissions.modelManageUpload} onChange={(e) => handlePermissionChange('modelManageUpload', e.target.checked)} />
                      <div>
                        <div style={{fontWeight:600}}>Allow Upload</div>
                        <div style={{fontSize:11, color:'var(--kt-text-soft)'}}>Add new models and assets</div>
                      </div>
                    </label>
                    <label style={{display:'flex', gap:6, alignItems:'center', fontSize:12, background:'var(--kt-surface-alt)', padding:'10px 12px', borderRadius:6, border:'1px solid var(--kt-border)'}}>
                      <input type="checkbox" checked={!!editingUser.permissions.modelManageEdit} onChange={(e) => handlePermissionChange('modelManageEdit', e.target.checked)} />
                      <div>
                        <div style={{fontWeight:600}}>Allow Edit</div>
                        <div style={{fontSize:11, color:'var(--kt-text-soft)'}}>Edit model details and config URL</div>
                      </div>
                    </label>
                    <label style={{display:'flex', gap:6, alignItems:'center', fontSize:12, background:'var(--kt-surface-alt)', padding:'10px 12px', borderRadius:6, border:'1px solid var(--kt-border)'}}>
                      <input type="checkbox" checked={!!editingUser.permissions.modelManageDelete} onChange={(e) => handlePermissionChange('modelManageDelete', e.target.checked)} />
                      <div>
                        <div style={{fontWeight:600}}>Allow Delete</div>
                        <div style={{fontSize:11, color:'var(--kt-text-soft)'}}>Delete models and assets</div>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* High-level: User Management permissions (collapsible) */}
              <div className="kt-card" style={{boxShadow:'none', border:'1px dashed var(--kt-border)'}}>
                <div className="kt-card-header" style={{marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <label style={{display:'flex', gap:6, alignItems:'center', fontSize:12}}>
                      <input type="checkbox" checked={!!editingUser.permissions.userManagement} onChange={(e) => handlePermissionChange('userManagement', e.target.checked)} />
                      <div>
                        <div style={{fontWeight:600}}>User Management</div>
                        <div style={{fontSize:11, color:'var(--kt-text-soft)'}}>If only this is on, user can view users</div>
                      </div>
                    </label>
                  </div>
                  <button type="button" className="kt-btn outline sm" onClick={() => setEditingUser(prev => ({...prev, __umOpen: !prev?.__umOpen}))}>
                    {editingUser?.__umOpen ? 'Hide actions' : 'Choose actions'}
                  </button>
                </div>
                {editingUser?.__umOpen && (
                  <div style={{display:'grid', gap:10, gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))'}}>
                    <label style={{display:'flex', gap:6, alignItems:'center', fontSize:12, background:'var(--kt-surface-alt)', padding:'10px 12px', borderRadius:6, border:'1px solid var(--kt-border)'}}>
                      <input type="checkbox" checked={!!editingUser.permissions.userManageCreate} onChange={(e) => handlePermissionChange('userManageCreate', e.target.checked)} />
                      <div>
                        <div style={{fontWeight:600}}>Allow Create</div>
                        <div style={{fontSize:11, color:'var(--kt-text-soft)'}}>Create new users</div>
                      </div>
                    </label>
                    <label style={{display:'flex', gap:6, alignItems:'center', fontSize:12, background:'var(--kt-surface-alt)', padding:'10px 12px', borderRadius:6, border:'1px solid var(--kt-border)'}}>
                      <input type="checkbox" checked={!!editingUser.permissions.userManageEdit} onChange={(e) => handlePermissionChange('userManageEdit', e.target.checked)} />
                      <div>
                        <div style={{fontWeight:600}}>Allow Edit</div>
                        <div style={{fontSize:11, color:'var(--kt-text-soft)'}}>Edit user permissions and roles</div>
                      </div>
                    </label>
                    <label style={{display:'flex', gap:6, alignItems:'center', fontSize:12, background:'var(--kt-surface-alt)', padding:'10px 12px', borderRadius:6, border:'1px solid var(--kt-border)'}}>
                      <input type="checkbox" checked={!!editingUser.permissions.userManageDelete} onChange={(e) => handlePermissionChange('userManageDelete', e.target.checked)} />
                      <div>
                        <div style={{fontWeight:600}}>Allow Delete</div>
                        <div style={{fontSize:11, color:'var(--kt-text-soft)'}}>Delete users and transfer data</div>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Other feature permissions */}
              <div className="kt-card" style={{boxShadow:'none', border:'1px dashed var(--kt-border)'}}>
                <div className="flex" style={{justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                  <div className="kt-card-header" style={{marginBottom:0}}>Feature Permissions</div>
                  <div className="flex gap-8">
                    <button type="button" className="kt-btn outline" onClick={grantAll}>Grant All</button>
                    <button type="button" className="kt-btn danger" onClick={revokeAll}>Revoke All</button>
                  </div>
                </div>
                <div style={{display:'grid', gap:10, gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))'}}>
                  {Object.entries(editingUser.permissions)
                    .filter(([key]) => !["reflectionWidget","movementWidget","customWidget","imageDownloadQualities","modelUpload","modelManageUpload","modelManageEdit","modelManageDelete","userManagement","userManageCreate","userManageEdit","userManageDelete"].includes(key))
                    .map(([key, value]) => (
                      <label key={key} style={{display:'flex', gap:6, alignItems:'center', fontSize:12, background:'var(--kt-surface-alt)', padding:'6px 8px', borderRadius:6, border:'1px solid var(--kt-border)'}}>
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => handlePermissionChange(key, e.target.checked)}
                        />
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </label>
                    ))}
                </div>
              </div>

              {/* Per-preset controls (Coke/Pepsi etc) */}
              {modelPresets.length > 0 && (
                <div className="kt-card" style={{boxShadow:'none', border:'1px dashed var(--kt-border)'}}>
                  <div className="kt-card-header" style={{marginBottom:12}}>Presets Access</div>
                  <div style={{display:'grid', gap:10, gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))'}}>
                    {modelPresets.map(p => (
                      <label key={p.id} style={{display:'flex', gap:6, alignItems:'center', fontSize:12, background:'var(--kt-surface-alt)', padding:'6px 8px', borderRadius:6, border:'1px solid var(--kt-border)'}}>
                        <input
                          type="checkbox"
                          checked={!!editingUser.permissions?.presetAccess?.[p.id]}
                          onChange={(e) => handlePresetToggle(p.id, e.target.checked)}
                        />
                        {p.label || p.id}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="kt-card" style={{boxShadow:'none', border:'1px dashed var(--kt-border)'}}>
                <div className="kt-card-header" style={{marginBottom:12}}>Image Download Qualities</div>
                <div style={{display:'grid', gap:10, gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))'}}>
                  {['average', 'good', 'best'].map(quality => (
                    <label key={quality} style={{display:'flex', gap:6, alignItems:'center', fontSize:12, background:'var(--kt-surface-alt)', padding:'6px 8px', borderRadius:6, border:'1px solid var(--kt-border)'}}>
                      <input
                        type="checkbox"
                        checked={(editingUser.permissions.imageDownloadQualities || []).includes(quality)}
                        onChange={(e) => handleQualityChange(quality, e.target.checked)}
                      />
                      {quality.charAt(0).toUpperCase() + quality.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex" style={{justifyContent:'flex-end', gap:12}}>
                <button type="button" className="kt-btn outline" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="kt-btn primary" onClick={() => console.log('UPDATE CLICKED - Current permissions:', editingUser.permissions)}>Update User</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCreateModal && (
        <div className="modal-overlay" style={{position:'fixed', inset:0, background:'rgba(15,23,42,.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'60px 20px', zIndex:200}}>
          <div className="kt-card" style={{width:'min(620px,100%)'}}>
            <div className="flex" style={{justifyContent:'space-between', alignItems:'center'}}>
              <div className="kt-card-header" style={{marginBottom:0}}>Create User</div>
              <button aria-label="Close create user" onClick={() => setShowCreateModal(false)} style={{border:'none', background:'transparent', fontSize:24, lineHeight:1, cursor:'pointer'}}>×</button>
            </div>
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-12" style={{marginTop:12}} noValidate>
              <div style={{display:'grid', gap:10, gridTemplateColumns:'1fr 1fr'}}>
                <div style={{display:'flex', flexDirection:'column'}}>
                  <label style={{fontSize:12, fontWeight:600}}>Name</label>
                  <input aria-label="Full name" autoFocus value={newUser.name} onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))} />
                  {createErrors.name && <div style={{color:'var(--kt-danger)', fontSize:12, marginTop:6}}>{createErrors.name}</div>}
                </div>

                <div style={{display:'flex', flexDirection:'column'}}>
                  <label style={{fontSize:12, fontWeight:600}}>Email</label>
                  <input aria-label="Email address" type="email" value={newUser.email} onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))} />
                  {createErrors.email && <div style={{color:'var(--kt-danger)', fontSize:12, marginTop:6}}>{createErrors.email}</div>}
                </div>
              </div>

              <div style={{display:'grid', gap:8, gridTemplateColumns:'1fr'}}>
                <label style={{fontSize:12, fontWeight:600}}>Password</label>
                <div style={{display:'flex', gap:8, alignItems:'center'}}>
                  <input aria-label="Password" type={showPassword ? 'text' : 'password'} value={newUser.password} onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))} style={{flex:1}} />
                  <button type="button" className="kt-btn outline" onClick={() => setShowPassword(s => !s)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
                  <button type="button" className="kt-btn" onClick={() => generatePassword()}>Generate</button>
                </div>
                {createErrors.password && <div style={{color:'var(--kt-danger)', fontSize:12}}>{createErrors.password}</div>}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{fontSize:12, color:'var(--kt-text-soft)'}}>Strength: {passwordStrength(newUser.password).label}</div>
                  <div style={{width:120, height:8, background:'var(--kt-surface)', borderRadius:6, overflow:'hidden'}}>
                    <div style={{height:'100%', width:`${(passwordStrength(newUser.password).score/5)*100}%`, background: passwordStrength(newUser.password).score >=4 ? 'var(--kt-success)' : 'var(--kt-primary)'}} />
                  </div>
                </div>
              </div>

              <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
                <label style={{fontSize:12, fontWeight:600}}>Role</label>
                <div style={{display:'flex', gap:8, alignItems:'center'}}>
                  <select 
                    value={newUser.role} 
                    onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value, customRoleName: e.target.value === 'custom' ? prev.customRoleName : '' }))} 
                    style={{padding:'8px 10px', borderRadius:6, border:'1px solid var(--kt-border)', fontSize:15}}
                  >
                    {getAllowedRoles(tokenUser?.role).filter(role => role !== 'superadmin').map(role => (
                      <option key={role} value={role}>
                        {role === 'assistantmanager' ? 'Assistant Manager' : 
                         role.charAt(0).toUpperCase() + role.slice(1)}
                      </option>
                    ))}
                  </select>
                  {newUser.role === 'custom' && (
                    <input
                      type="text"
                      placeholder="Custom role name"
                      value={newUser.customRoleName}
                      onChange={e => setNewUser(prev => ({ ...prev, customRoleName: e.target.value }))}
                      style={{padding:'8px 10px', borderRadius:6, border:'1px solid var(--kt-border)', fontSize:15, minWidth:'150px'}}
                    />
                  )}
                </div>
                <div style={{marginLeft:'auto'}}>
                  {createErrors.form && <div style={{color:'var(--kt-danger)', fontSize:13, marginRight:12}}>{createErrors.form}</div>}
                  {createSuccess && <div style={{color:'var(--kt-success)', fontSize:13, marginRight:12}}>{createSuccess}</div>}
                </div>
              </div>

              <div className="flex" style={{justifyContent:'flex-end', gap:12}}>
                <button type="button" className="kt-btn outline" onClick={() => { setShowCreateModal(false); setCreateErrors({}); setNewUser({ name: '', email: '', password: '', role: 'employee', customRoleName: '' }); }}>Cancel</button>
                <button type="submit" className="kt-btn primary" disabled={creating}>{creating ? 'Creating…' : 'Create user'}</button>
              </div>
            </form>

            {createdPassword && (
              <div style={{marginTop:12, padding:10, borderTop:'1px dashed var(--kt-border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div style={{fontSize:12, color:'var(--kt-text-soft)'}}>Temporary password (copy and provide to the user):</div>
                  <div style={{fontWeight:700, marginTop:6}}>{createdPassword}</div>
                </div>
                <div>
                  <button className="kt-btn" onClick={() => {
                    try {
                      navigator.clipboard.writeText(createdPassword);
                    } catch (e) {
                      console.warn('Clipboard write failed', e);
                    }
                  }}>Copy</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showActivityModal && activityUserId && (
        <div className="modal-overlay" style={{position:'fixed', inset:0, background:'rgba(15,23,42,.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'60px 20px', zIndex:200}}>
          <div className="kt-card" style={{width:'min(920px,100%)', maxHeight:'80vh', overflow:'auto'}}>
            <div className="flex" style={{justifyContent:'space-between', alignItems:'center'}}>
              <div className="kt-card-header" style={{marginBottom:0}}>Activity for user</div>
              <button onClick={() => { setShowActivityModal(false); setActivityUserId(null); }} style={{border:'none', background:'transparent', fontSize:24, lineHeight:1, cursor:'pointer'}}>×</button>
            </div>
            <div style={{marginTop:12}}>
              {/* ActivityLog component accepts userId prop */}
              <ActivityLog userId={activityUserId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
