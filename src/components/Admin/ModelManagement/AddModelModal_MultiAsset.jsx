// Multi-Asset Model Upload Modal
// - Upload base, doors, drawers, glassDoors, other assets in one request
// - Automatically generates JSON configuration with asset URLs
// - Simplified version without advanced options, but with JSON paste functionality

import React, { useState, useEffect, useRef } from 'react';

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
  const [configUrl, setConfigUrl] = useState('');

  // Asset files
  const [files, setFiles] = useState({
    base: null,
    doors: null,
    drawers: null,
    glassDoors: null,
    other: null,
    thumbnail: null
  });
  
  // Force-remount keys to clear <input type="file"> elements
  const [fileInputKeys, setFileInputKeys] = useState({
    base: 0,
    doors: 0,
    drawers: 0,
    glassDoors: 0,
    other: 0,
    thumbnail: 0
  });

  // JSON paste functionality (like simple modal)
  const [showPasteJSON, setShowPasteJSON] = useState(false);
  const [pastedJSON, setPastedJSON] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [uploadingConfig, setUploadingConfig] = useState(false);
  const inlineUploadInProgress = useRef(false);

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

  // Upload file function (like simple modal)
  const uploadFile = async (file, subPath = 'models') => {
    if (!isLoggedIn) {
      throw new Error('You must be logged in to upload files. Please log in and try again.');
    }

    const token = localStorage.getItem('token');
    console.log('Upload token:', token ? 'present' : 'missing');

    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    if (subPath === 'configs') {
      // For config files, save directly to backend instead of S3
      const configData = await file.text();
      const jsonData = JSON.parse(configData);

      const res = await fetch(`${getApiBaseUrl()}/api/upload-config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config: jsonData })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[ConfigUploadError]', res.status, err);
        throw new Error(err.message || `Config upload failed (${res.status})`);
      }

      const data = await res.json();
      console.log('[ConfigUploadSuccess]', data);
      return data.path;
    } else {
      // For model files, use S3 upload
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${getApiBaseUrl()}/api/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[UploadError]', res.status, err);
        throw new Error(err.message || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      console.log('[UploadSuccess]', subPath, data);
      return data?.path || (data?.filename ? `/models/${data.filename}` : '');
    }
  };

  // Debounced inline JSON paste auto-upload to avoid spamming the server
  useEffect(() => {
    const v = (configUrl || '').trim();
    // If the dedicated paste panel is open, don't auto-upload from the input field
    if (showPasteJSON) return;
    // Ignore if field is empty or looks like a URL/path already
    if (!v || v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/')) return;
    // Only handle if it looks like full JSON text
    if (!(v.startsWith('{') && v.endsWith('}'))) return;

    const timer = setTimeout(async () => {
      if (inlineUploadInProgress.current) return; // prevent duplicate concurrent uploads
      inlineUploadInProgress.current = true;
      try {
        // Parse and upload pasted JSON content
        const parsed = JSON.parse(v);
        const blob = new Blob([JSON.stringify(parsed)], { type: 'application/json' });
        const file = new File([blob], `config-${Date.now()}.json`, { type: 'application/json' });
        setUploadingConfig(true);
        const path = await uploadFile(file, 'configs');
        setConfigUrl(path);
        console.log('[ConfigInlineUpload] Uploaded from input paste (debounced), got path:', path);
      } catch (err) {
        console.error('[ConfigInlineUploadError]', err);
        setError(err.message || 'Failed to upload pasted JSON');
      } finally {
        setUploadingConfig(false);
        inlineUploadInProgress.current = false;
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [configUrl, showPasteJSON]);

  const handleFileChange = (assetType, file) => {
    setFiles(prev => ({
      ...prev,
      [assetType]: file
    }));
  };

  const clearSelectedFile = (assetType) => {
    setFiles(prev => ({ ...prev, [assetType]: null }));
    setFileInputKeys(prev => ({ ...prev, [assetType]: prev[assetType] + 1 }));
  };

  const handlePasteUpload = async () => {
    setPasteError('');
    try {
      if (!pastedJSON.trim()) {
        setPasteError('Please paste JSON content first');
        return;
      }
      // Validate JSON
      JSON.parse(pastedJSON);
      // Create a File from the pasted JSON and reuse the upload endpoint
      const blob = new Blob([pastedJSON], { type: 'application/json' });
      const filename = `config-${Date.now()}.json`;
      const file = new File([blob], filename, { type: 'application/json' });
      setUploadingConfig(true);
      const path = await uploadFile(file, 'configs');
      setConfigUrl(path);
      setShowPasteJSON(false);
      setPastedJSON('');
    } catch (err) {
      console.error(err);
      setPasteError(err.message || 'Invalid JSON');
    } finally {
      setUploadingConfig(false);
    }
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
      formData.append('section', section);
      
      // Add config URL if provided
      if (configUrl.trim()) {
        formData.append('configUrl', configUrl);
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

          {/* Config JSON - Like Simple Modal */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
              Config JSON (Optional)
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input 
                value={configUrl} 
                onChange={(e) => setConfigUrl(e.target.value)} 
                placeholder="/configs/your-model-config.json or https://..."
                style={{ flex: 1, padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPasteJSON(v => !v)} 
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '13px' }}
                disabled={!isLoggedIn || checkingAuth}
              >
                {showPasteJSON ? 'Hide paste' : 'Paste JSON'}
              </button>
            </div>

            {/* Paste JSON Panel */}
            {showPasteJSON && (
              <div style={{ marginTop: '8px', padding: '12px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <textarea
                    value={pastedJSON}
                    onChange={(e) => setPastedJSON(e.target.value)}
                    placeholder='Paste your config JSON here'
                    rows={8}
                    style={{ 
                      width: '100%', 
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
                      padding: '8px', 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  {pasteError && <div style={{ color: '#dc2626', fontSize: '12px' }}>{pasteError}</div>}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={() => { setShowPasteJSON(false); setPastedJSON(''); setPasteError(''); }}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      onClick={handlePasteUpload} 
                      disabled={uploadingConfig || !isLoggedIn || checkingAuth}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      {uploadingConfig ? 'Uploading…' : 'Upload pasted JSON'}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      key={fileInputKeys[key]}
                      type="file"
                      accept={key === 'thumbnail' ? '.jpg,.jpeg,.png,.webp' : '.glb,.gltf'}
                      onChange={(e) => handleFileChange(key, e.target.files[0])}
                      style={{ flex: 1, padding: '4px', fontSize: '12px' }}
                      required={key === 'base'}
                    />
                    {files[key] && (
                      <button
                        type="button"
                        className="btn-danger"
                        title="Clear selected file"
                        onClick={() => clearSelectedFile(key)}
                        style={{ fontSize: 12, padding: '4px 8px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {files[key] && (
                    <div style={{ marginTop: '2px', fontSize: '11px', color: '#666' }}>
                      ✓ {files[key].name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

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

            {/* Allow quick corrections: delete any uploaded asset from S3 */}
            {uploadResult.assetUrls && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Uploaded assets</div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 6, alignItems: 'center' }}>
                  {Object.entries(uploadResult.assetUrls).map(([k, url]) => (
                    <React.Fragment key={k}>
                      <div style={{ fontSize: 12, color: '#334155' }}>{k}</div>
                      <div style={{ fontSize: 12, color: '#64748b', wordBreak: 'break-all' }}>{url}</div>
                      <button
                        type="button"
                        className="btn-danger"
                        title="Delete this asset from S3"
                        onClick={async () => {
                          try {
                            if (!url || !String(url).includes('amazonaws.com')) {
                              // Nothing to delete
                              return;
                            }
                            const token = localStorage.getItem('token');
                            const res = await fetch(`${getApiBaseUrl()}/api/upload/delete`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                              },
                              body: JSON.stringify({ url })
                            });
                            if (res.ok) {
                              // Remove from UI
                              setUploadResult(prev => ({
                                ...prev,
                                assetUrls: Object.fromEntries(Object.entries(prev.assetUrls || {}).filter(([key]) => key !== k))
                              }));
                            }
                          } catch (e) {
                            // ignore error; user can retry
                          }
                        }}
                        style={{ fontSize: 12, padding: '4px 8px' }}
                      >
                        ✕
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
                  Note: This removes the file from S3. If the created model references it, update the model accordingly.
                </div>
              </div>
            )}
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

          .btn-danger {
            background: #dc2626;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            padding: 4px 8px;
          }

          .btn-danger:hover {
            background: #b91c1c;
          }

          .btn-secondary {
            background: #e2e8f0;
            color: #111827;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
          }

          .btn-secondary:hover {
            background: #cbd5e1;
          }

          .btn-primary {
            background: #2563eb;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
          }

          .btn-primary:hover {
            background: #1d4ed8;
          }

          .btn-primary:disabled {
            background: #9ca3af;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    </div>
  );
}