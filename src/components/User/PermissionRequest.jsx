import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './PermissionRequest.css';

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

const PermissionRequest = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    requestedPermissions: {},
    justification: '',
    urgency: 'medium'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [myRequests, setMyRequests] = useState([]);
  const [showMyRequests, setShowMyRequests] = useState(false);

  // Available permission types for display
  const availablePermissions = [
    { key: 'modelUpload', label: 'Model Upload', description: 'Upload new 3D models and assets' },
    { key: 'modelManageEdit', label: 'Model Management (Edit)', description: 'Edit existing model configurations' },
    { key: 'userManagement', label: 'User Management', description: 'View and manage user accounts' },
    { key: 'userManageCreate', label: 'User Management (Create)', description: 'Create new user accounts' },
    { key: 'userManageEdit', label: 'User Management (Edit)', description: 'Edit user permissions and roles' },
    { key: 'userManageDelete', label: 'User Management (Delete)', description: 'Delete user accounts' },
    { key: 'textureWidget', label: 'Texture Widget', description: 'Apply custom textures to 3D models' },
    { key: 'lightWidget', label: 'Light Widget', description: 'Adjust lighting in 3D scenes' },
    { key: 'globalTextureWidget', label: 'Global Texture Widget', description: 'Apply textures globally across all models' },
    { key: 'screenshotWidget', label: 'Screenshot Widget', description: 'Take high-quality screenshots' },
    { key: 'saveConfig', label: 'Save Configuration', description: 'Save and manage 3D model configurations' },
    { key: 'canPan', label: 'Camera Pan', description: 'Pan the 3D camera view' },
    { key: 'canMove', label: 'Camera Move', description: 'Move 3D objects in the scene' },
  ];

  // Filter permissions for current display (not used in form anymore)
  const availableForUser = availablePermissions.filter(permission => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      return false; // Admins shouldn't request permissions
    }
    
    // Don't show permissions the user already has
    const userPermissions = user?.permissions || {};
    return !userPermissions[permission.key];
  });

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/api/permission-requests/my-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch your requests');
      }

      const requests = await response.json();
      setMyRequests(requests);
    } catch (error) {
      console.error('Error fetching your requests:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.justification.trim()) {
      setError('Please provide a justification for your request');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      
      // Prepare the data according to backend API
      const requestData = {
        targetId: user.id || user._id, // Current user's ID
        requestedPermissions: {}, // Empty for general requests
        justification: formData.justification,
        requestedBy: 'self',
        urgency: formData.urgency
      };

      const response = await fetch(`${getApiBaseUrl()}/api/permission-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit request');
      }

      const result = await response.json();
      console.log('Permission request submitted:', result);
      
      setSuccess('Your permission request has been submitted successfully! An email notification will be sent to the administrators.');
      setFormData({ requestedPermissions: {}, justification: '', urgency: 'medium' });
      
      // Refresh the list of requests
      await fetchMyRequests();
    } catch (error) {
      console.error('Error submitting permission request:', error);
      setError(error.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'var(--kt-warning)';
      case 'resolved':
        return 'var(--kt-success)';
      default:
        return 'var(--kt-text-soft)';
    }
  };

  if (user?.role === 'admin' || user?.role === 'superadmin') {
    return (
      <div className="kt-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h2>Permission Request System</h2>
        <p style={{ color: 'var(--kt-text-soft)', marginTop: '12px' }}>
          As an administrator, you already have full access to all features.
        </p>
      </div>
    );
  }

  return (
    <div className="kt-stack gap-16">
      {/* Header */}
      <div className="kt-card">
        <div className="flex gap-12" style={{alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <div className="kt-card-header" style={{margin:0}}>Permission Request</div>
            <div className="text-faint" style={{fontSize:12}}>Request additional permissions from administrators</div>
          </div>
          <div>
            <button
              className="kt-btn outline"
              onClick={() => setShowMyRequests(!showMyRequests)}
            >
              {showMyRequests ? 'Hide My Requests' : 'View My Requests'} ({myRequests.length})
            </button>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="kt-card" style={{borderColor:'var(--kt-success)'}}>
          <div style={{color:'var(--kt-success)', fontSize:14, display:'flex', alignItems:'center', gap:8}}>
            <span>✅</span>{success}
          </div>
        </div>
      )}

      {error && (
        <div className="kt-card" style={{borderColor:'var(--kt-danger)'}}>
          <div style={{color:'var(--kt-danger)', fontSize:14, display:'flex', alignItems:'center', gap:8}}>
            <span>⚠️</span>{error}
          </div>
        </div>
      )}

      {/* Request Form */}
      <div className="kt-card">
        <div className="kt-card-header" style={{marginBottom:16}}>Request Additional Permissions</div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-16">
          <div>
            <label style={{display:'block', marginBottom:8, fontSize:14, fontWeight:600}}>Justification for Request</label>
            <textarea
              value={formData.justification}
              onChange={(e) => setFormData(prev => ({ ...prev, justification: e.target.value }))}
              placeholder="Please explain what additional permissions you need and how they will help you in your work..."
              rows={4}
              style={{width:'100%', padding:'10px 12px', borderRadius:6, border:'1px solid var(--kt-border)', resize:'vertical'}}
              required
            />
          </div>

          <div>
            <label style={{display:'block', marginBottom:8, fontSize:14, fontWeight:600}}>Urgency Level</label>
            <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
              {[
                { key: 'low', label: 'Low', color: 'var(--kt-primary)' },
                { key: 'medium', label: 'Medium', color: 'var(--kt-warning)' },
                { key: 'high', label: 'High', color: 'var(--kt-danger)' }
              ].map(urgency => (
                <label key={urgency.key} style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer'}}>
                  <input
                    type="radio"
                    name="urgency"
                    value={urgency.key}
                    checked={formData.urgency === urgency.key}
                    onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value }))}
                  />
                  <span style={{color:urgency.color, fontWeight:urgency.key === formData.urgency ? 600 : 400}}>
                    {urgency.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={{display:'flex', justifyContent:'flex-end', gap:12}}>
            <button type="button" className="kt-btn outline" onClick={() => {
              setFormData({ requestedPermissions: {}, justification: '', urgency: 'medium' });
              setError('');
              setSuccess('');
            }}>
              Clear
            </button>
            <button type="submit" className="kt-btn primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>

      {/* My Requests Section */}
      {showMyRequests && (
        <div className="kt-card">
          <div className="kt-card-header" style={{marginBottom:16}}>My Permission Requests</div>
          {myRequests.length === 0 ? (
            <div style={{textAlign:'center', padding:'40px 20px', color:'var(--kt-text-soft)'}}>
              You haven't submitted any permission requests yet.
            </div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              {myRequests.map((request) => {
                // Handle both old and new permission data structure
                const requestedPerms = request.requestedPermissions || {};
                const permKeys = Object.keys(requestedPerms);
                const permLabels = permKeys.map(key => {
                  const permission = availablePermissions.find(p => p.key === key);
                  return permission ? permission.label : key;
                }).join(', ');

                return (
                  <div key={request._id} className="kt-card" style={{border:'1px solid var(--kt-border)', padding:'16px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px'}}>
                      <div>
                        <div style={{fontWeight:'600', fontSize:'16px', marginBottom:'4px'}}>
                          {permLabels || request.permissionType}
                        </div>
                        <div style={{fontSize:'14px', color:'var(--kt-text-soft)'}}>
                          Requested on {new Date(request.createdAt).toLocaleDateString()} at {new Date(request.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="badge" style={{
                        background: getStatusColor(request.status),
                        color: 'white'
                      }}>
                        {request.status}
                      </div>
                    </div>
                    
                    <div style={{marginBottom:'8px'}}>
                      <div style={{fontSize:'14px', fontWeight:'600', marginBottom:'4px'}}>Justification:</div>
                      <div style={{fontSize:'14px', color:'var(--kt-text)'}}>{request.justification || request.reason}</div>
                    </div>
                    
                    {request.urgency && (
                      <div style={{marginBottom:'8px'}}>
                        <span className="badge" style={{
                          background: request.urgency === 'high' ? 'var(--kt-danger)' : 
                                     request.urgency === 'medium' ? 'var(--kt-warning)' : 'var(--kt-primary)',
                          color: 'white'
                        }}>
                          {request.urgency} priority
                        </span>
                      </div>
                    )}
                    
                    {request.status === 'resolved' && (
                      <div style={{marginTop:'12px', padding:'8px', background:'var(--kt-surface-alt)', borderRadius:'4px'}}>
                        <div style={{fontSize:'12px', fontWeight:'600', marginBottom:'4px'}}>
                          ✅ Resolved by {request.respondedBy?.name || 'Administrator'}
                        </div>
                        {request.respondedBy && (
                          <div style={{fontSize:'12px', color:'var(--kt-text-soft)', marginBottom:'4px'}}>
                            on {new Date(request.respondedAt || request.updatedAt).toLocaleDateString()}
                          </div>
                        )}
                        {request.adminResponse && (
                          <div style={{fontSize:'14px', color:'var(--kt-text)'}}>
                            <strong>Resolution notes:</strong> {request.adminResponse}
                          </div>
                        )}
                        <div style={{fontSize:'14px', color:'var(--kt-text)'}}>
                          Your request has been reviewed. Please check your user profile to see the updated permissions.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Current Permissions Summary */}
      <div className="kt-card">
        <div className="kt-card-header" style={{marginBottom:16}}>Your Current Permissions</div>
        <div style={{display:'grid', gap:'8px', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))'}}>
          {Object.entries(user?.permissions || {}).filter(([key, value]) => value === true).map(([key, value]) => {
            const permission = availablePermissions.find(p => p.key === key);
            return (
              <div key={key} style={{
                padding:'8px 12px',
                background:'var(--kt-success)',
                color:'white',
                borderRadius:'4px',
                fontSize:'13px',
                display:'flex',
                alignItems:'center',
                gap:'6px'
              }}>
                <span>✅</span>
                {permission?.label || key}
              </div>
            );
          })}
        </div>
        {Object.entries(user?.permissions || {}).filter(([key, value]) => value === true).length === 0 && (
          <div style={{textAlign:'center', padding:'20px', color:'var(--kt-text-soft)'}}>
            You currently have minimal permissions. Consider requesting access to features you need.
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionRequest;