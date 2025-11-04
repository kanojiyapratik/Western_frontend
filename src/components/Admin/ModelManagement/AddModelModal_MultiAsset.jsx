// Multi-Asset Model Upload Modal
// - Upload base, doors, drawers, glassDoors, other assets in one request
// - Automatically generates JSON configuration with asset URLs
// - Admin can copy the JSON and use it as a starting point

import React, { useState, useEffect } from 'react';

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

export default function AddModelModalMultiAsset({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState('cabinet');
  const [section, setSection] = useState('Upright Counter');
  const [interactionGroups, setInteractionGroups] = useState('');
  const [metadata, setMetadata] = useState('');

  // Asset files
  const [files, setFiles] = useState({
    base: null,
    doors: null,
    drawers: null,
    glassDoors: null,
    other: null,
    thumbnail: null
  });

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoggedIn(false);
        setCheckingAuth(false);
        return;
      }

      try {
        const response = await fetch(`${getApiBaseUrl()}/api/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem('token');
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        setIsLoggedIn(false);
      }

      setCheckingAuth(false);
    };

    checkAuth();
  }, []);

  const handleFileChange = (assetType, file) => {
    setFiles(prev => ({
      ...prev,
      [assetType]: file
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setUploadResult(null);

    if (!name.trim()) {
      setError('Model name is required');
      return;
    }

    if (!files.base) {
      setError('Base model file is required');
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('name', name);
      formData.append('displayName', displayName || name);
      formData.append('type', type);
  // Section (category) for the model
  if (section) formData.append('section', section);

      if (interactionGroups.trim()) {
        formData.append('interactionGroups', interactionGroups);
      }

      if (metadata.trim()) {
        formData.append('metadata', metadata);
      }

      // Add asset files
      Object.entries(files).forEach(([assetType, file]) => {
        if (file) {
          formData.append(assetType, file);
        }
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/api/admin/models/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed (${response.status})`);
      }

      const result = await response.json();
      setUploadResult(result);

      console.log('Upload successful:', result);

      if (onAdd) onAdd();

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('JSON configuration copied to clipboard!');
    } catch (e) {
      console.warn('Clipboard write failed');
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('JSON configuration copied to clipboard!');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '700px', maxHeight: '85vh', overflow: 'auto' }}>
        <h3>Upload Multi-Asset Model</h3>


        {error && (
          <div style={{ padding: '8px', background: '#fee2e2', border: '1px solid #dc2626', borderRadius: '8px', marginBottom: '16px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Info - Compact Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                Model Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., ModernCabinet"
                required
                style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Modern Kitchen Cabinet"
                style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
              >
                <option value="cabinet">Cabinet</option>
                <option value="refrigerator">Refrigerator</option>
                <option value="freezer">Freezer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                Section
              </label>
              <select value={section} onChange={(e) => setSection(e.target.value)} style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}>
                <option value="Upright Counter">Upright Counter</option>
                <option value="Visicooler">Visicooler</option>
                <option value="XYZ">XYZ</option>
              </select>
            </div>
          </div>

          {/* Asset Files - Compact Layout */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Asset Files</h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {Object.entries({
                base: 'Base Model (Required)',
                doors: 'Doors',
                drawers: 'Drawers',
                glassDoors: 'Glass Doors',
                other: 'Other Assets',
                thumbnail: 'Thumbnail Image'
              }).map(([key, label]) => (
                <div key={key} style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '2px', fontWeight: 'bold', fontSize: '12px' }}>
                    {label} {key === 'base' ? '*' : ''}
                  </label>
                  <input
                    type="file"
                    accept={key === 'thumbnail' ? '.jpg,.jpeg,.png,.webp' : '.glb,.gltf'}
                    onChange={(e) => handleFileChange(key, e.target.files[0])}
                    style={{ width: '100%', padding: '4px', fontSize: '12px' }}
                    required={key === 'base'}
                  />
                  {files[key] && (
                    <div style={{ marginTop: '2px', fontSize: '11px', color: '#666' }}>
                      ✓ {files[key].name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Options - Collapsed by default */}
          <details style={{ marginBottom: '16px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
              ⚙️ Advanced Options (Optional)
            </summary>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
                  Interaction Groups (JSON)
                </label>
                <textarea
                  value={interactionGroups}
                  onChange={(e) => setInteractionGroups(e.target.value)}
                  placeholder='[{"type": "doors", "label": "Doors", "parts": []}]'
                  rows={2}
                  style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
                  Metadata (JSON)
                </label>
                <textarea
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  placeholder='{"panels": [], "solidDoorMeshPrefixes": []}'
                  rows={2}
                  style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>
            </div>
          </details>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px', background: '#f5f5f5' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !isLoggedIn}
              style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', background: '#2563eb', color: 'white' }}
            >
              {uploading ? 'Uploading...' : 'Upload Model'}
            </button>
          </div>
        </form>

        {/* Upload Result - Compact */}
        {uploadResult && (
          <div style={{ marginTop: '16px', padding: '12px', background: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#0ea5e9', fontSize: '14px' }}>✅ Upload Successful!</h4>

            <div style={{ marginBottom: '8px', fontSize: '13px' }}>
              <strong>Model:</strong> {uploadResult.model?.name} ({uploadResult.model?.displayName})
            </div>

            <div style={{ marginBottom: '8px' }}>
              <button
                onClick={() => copyToClipboard(JSON.stringify(uploadResult.jsonConfig, null, 2))}
                style={{ padding: '4px 8px', border: '1px solid #0ea5e9', borderRadius: '4px', background: '#e0f2fe', color: '#0ea5e9', cursor: 'pointer', fontSize: '12px' }}
              >
                📋 Copy JSON Config
              </button>
            </div>

            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>View JSON</summary>
              <pre style={{
                background: '#f8fafc',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '10px',
                overflow: 'auto',
                maxHeight: '200px',
                marginTop: '4px'
              }}>
                {JSON.stringify(uploadResult.jsonConfig, null, 2)}
              </pre>
            </details>
          </div>
        )}

        <style>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .modal {
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 600px;
            width: 90%;
            max-height: 90vh;
            overflow: auto;
          }

          .modal h3 {
            margin-top: 0;
            margin-bottom: 16px;
          }
        `}</style>
      </div>
    </div>
  );
}