import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Experience } from "../Experience/Experience.jsx";
import './PublicViewer.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE?.replace('/api', '') || 
  (import.meta.env.MODE === 'production' 
    ? 'https://threed-configurator-backend-7pwk.onrender.com' 
    : 'http://192.168.1.7:5000');

function PublicViewer() {
  const [dbModels, setDbModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  // Get model ID from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modelId = urlParams.get('model');
    if (modelId) {
      setSelectedModel(modelId);
    }
  }, []);

  // Fetch specific model by ID (no authentication required)
  useEffect(() => {
    const fetchModel = async () => {
      if (!selectedModel) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/public/model/${selectedModel}`);
        
        if (response.ok) {
          const model = await response.json();
          setDbModels([model]);
        } else if (response.status === 404) {
          setError('Model not found');
        } else {
          setError('Failed to load 3D model');
        }
      } catch (err) {
        console.error('Error fetching model:', err);
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    };

    fetchModel();
  }, [selectedModel]);

  // Helper to normalize asset/model URLs
  const normalizeModelUrls = useCallback((cfg) => {
    if (!cfg || typeof cfg !== 'object') return cfg;
    const out = { ...cfg };
    const fix = (val) => {
      if (!val || typeof val !== 'string') return val;
      if (val.startsWith('http://') || val.startsWith('https://')) return val;
      if (val.startsWith('/models/')) return `${API_BASE_URL}${val}`;
      if (val.startsWith('models/')) return `${API_BASE_URL}/${val}`;
      return val;
    };
    if (out.path) out.path = fix(out.path);
    if (out.assets && typeof out.assets === 'object') {
      out.assets = { ...out.assets };
      Object.keys(out.assets).forEach((k) => {
        out.assets[k] = fix(out.assets[k]);
      });
    }
    return out;
  }, []);

  // Helper to unwrap external configs
  const unwrapExternalConfig = useCallback((name, json) => {
    if (!json || typeof json !== 'object') return json;
    const looksDirect = json.camera || json.uiWidgets || json.assets || json.path || json.interactionGroups || json.presets || json.metadata;
    if (looksDirect) return json;

    if (json[name] && typeof json[name] === 'object') return json[name];
    const key = Object.keys(json).find((k) => k.toLowerCase() === String(name).toLowerCase());
    if (key && typeof json[key] === 'object') return json[key];
    if (json.config && typeof json.config === 'object') return json.config;
    if (json.data && typeof json.data === 'object') return json.data;
    if (json.models && json.models[name] && typeof json.models[name] === 'object') return json.models[name];

    return json;
  }, []);

  const dbModelsFormatted = useMemo(() => {
    const formatted = {};
    dbModels.forEach(model => {
      const baseModelFields = {
        path: model.file,
        displayName: model.displayName,
        type: model.type,
        ...(model.assets && { assets: model.assets }),
        ...(model.section && { section: model.section }),
        // Include all model properties for public viewer
        uiWidgets: model.uiWidgets || [],
        lights: model.lights || [],
        hiddenInitially: model.hiddenInitially || [],
        camera: model.camera,
        presets: model.presets,
        interactionGroups: model.interactionGroups || [],
        placementMode: model.placementMode || 'autofit',
        modelPosition: model.modelPosition,
        modelRotation: model.modelRotation,
        modelScale: model.modelScale
      };
      formatted[model.name] = { ...baseModelFields, __configUrl: model.configUrl };
    });
    return formatted;
  }, [dbModels]);

  // Load external config JSONs
  const [externalConfigs, setExternalConfigs] = useState({});

  useEffect(() => {
    let aborted = false;
    const loadConfigs = async () => {
      const entries = Object.entries(dbModelsFormatted);
      await Promise.all(entries.map(async ([name, base]) => {
        const url = base.__configUrl;
        if (!url) return;
        try {
          const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
          const res = await fetch(fullUrl);
          if (!res.ok) throw new Error(`Fetch ${fullUrl} failed ${res.status}`);
          const json = await res.json();
          const unwrapped = unwrapExternalConfig(name, json);
          const normalized = normalizeModelUrls(unwrapped);
          if (!aborted) {
            setExternalConfigs(prev => ({ ...prev, [name]: normalized }));
          }
        } catch (e) {
          console.warn('Config fetch error:', name, e);
        }
      }));
    };
    loadConfigs();
    return () => { aborted = true; };
  }, [dbModelsFormatted, unwrapExternalConfig, normalizeModelUrls]);

  const mergedModels = useMemo(() => {
    const merged = {};
    Object.entries(dbModelsFormatted).forEach(([name, base]) => {
      const ext = externalConfigs[name];
      if (ext) {
        const combined = { ...ext };
        const hasAssetsBase = !!(combined.assets && combined.assets.base);
        if (!hasAssetsBase && !combined.path && base.path) {
          combined.path = base.path;
        }
        combined.section = combined.section || base.section;
        merged[name] = combined;
      } else {
        merged[name] = normalizeModelUrls({ ...base });
      }
    });
    return merged;
  }, [dbModelsFormatted, externalConfigs, normalizeModelUrls]);

  // Get current model configuration (use model name as key)
  const modelName = dbModels.length > 0 ? dbModels[0].name : selectedModel;
  const currentModel = mergedModels[modelName];

  // Public user permissions (limited interactions)
  const publicPermissions = {
    canRotate: true,
    canPan: true,
    canZoom: true,
    doorToggles: true,
    drawerToggles: true,
    canMove: false,
    modelUpload: false,
    userManagement: false,
  };

  // Mock user for public viewer
  const publicUser = {
    name: 'Public Viewer',
    role: 'public',
    permissions: publicPermissions
  };

  if (loading) {
    return (
      <div className="public-viewer-loading">
        <div className="spinner"></div>
        <p>Loading 3D model...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-viewer-error">
        <h2>Unable to load 3D model</h2>
        <p>{error}</p>
        <p>Please check the model name in the URL or try again later.</p>
      </div>
    );
  }

  if (!currentModel) {
    return (
      <div className="public-viewer-error">
        <h2>Model not found</h2>
        <p>The requested 3D model could not be found.</p>
        <p>Please check the model ID in the URL.</p>
      </div>
    );
  }

  return (
    <div className="public-viewer">
      <div className="public-viewer-header">
        <h1>{currentModel.displayName || modelName}</h1>
        <p>Interactive 3D Model Viewer</p>
      </div>
      
      <div className="public-viewer-canvas">
        <Canvas
          shadows
          frameloop="demand"
          dpr={Math.min(window.devicePixelRatio || 1, 1.5)}
          camera={{
            position: [2, 2, 2],
            fov: 25,
          }}
        >
          <Experience
            key={`${modelName}-${currentModel?.path || ''}`}
            modelName={modelName}
            modelConfig={currentModel}
            allModels={mergedModels}
            userPermissions={publicPermissions}
            user={publicUser}
            onTogglePart={() => {}}
            onApiReady={() => {}}
            applyRequest={{ current: null }}
            onModelTransformChange={() => {}}
          />
        </Canvas>
      </div>

      <div className="public-viewer-controls">
        <p>🖱️ Click and drag to rotate • Scroll to zoom • Right-click and drag to pan</p>
        <p>Click on doors and drawers to open/close them</p>
      </div>
    </div>
  );
}

export default PublicViewer;