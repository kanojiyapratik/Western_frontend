import React, { useState } from 'react';
import { widgetRegistry } from './widgets/index.jsx';
import SaveConfigModal from './SaveConfigModal.jsx';
import SavedConfigsList from './SavedConfigsList.jsx';
import { getApiBaseUrl } from '../../config/api.js';
import './Interface.css';

export function Interface({
  selectedModel,
  onModelChange,
  onLogout,
  userName,
  togglePart,
  applyDoorSelection,
  api,
  applyRequest,
  userPermissions,
  models = {}, // merged models map passed from MainApp
  // Section filtering props (passed from MainApp). Provide safe defaults so
  // the component works standalone during development or in older builds.
  sectionOptions = ['(All)'],
  selectedSection = '(All)',
  onSectionChange = () => {},
  onShowModelSelector = () => {},
}) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showConfigsList, setShowConfigsList] = useState(false);
  const [currentModelTransform, setCurrentModelTransform] = useState({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 2
  });

  // Current model config from provided map
  const config = models[selectedModel] || {};


  const allWidgets = React.useMemo(() => {
    // Merge widgets from both direct and metadata locations
    let rawWidgets = [];
    if (Array.isArray(config.uiWidgets)) rawWidgets = rawWidgets.concat(config.uiWidgets);
    if (Array.isArray(config.metadata?.uiWidgets)) rawWidgets = rawWidgets.concat(config.metadata.uiWidgets);

    // If the model has door presets but no doorPresets widget configured, inject it automatically
    const hasDoorPresetsConfig = !!config?.presets?.doorSelections && Object.keys(config.presets.doorSelections).length > 0;
    const hasDoorWidget = rawWidgets.some(w => w.type === 'doorPresets' || w.type === 'doorPresetWidget');
    if (hasDoorPresetsConfig && !hasDoorWidget) {
      rawWidgets = [{ type: 'doorPresets', title: 'Door Presets' }, ...rawWidgets];
    }

    // If lights are defined but no light widget configured, inject a default light widget
    const hasLights = (Array.isArray(config.lights) && config.lights.length > 0) || (Array.isArray(config.metadata?.lights) && config.metadata.lights.length > 0);
    const hasLightWidget = rawWidgets.some(w => w.type === 'lightWidget');
    if (hasLights && !hasLightWidget) {
      rawWidgets = [...rawWidgets, { type: 'lightWidget', title: 'Lights' }];
    }
    
    console.log(`🔍 INTERFACE WIDGET FILTERING DEBUG:`);
    console.log(`  - selectedModel: ${selectedModel}`);
    console.log(`  - rawWidgets.length: ${rawWidgets.length}`);
    console.log(`  - rawWidgets:`, rawWidgets);
    
    // Log each raw widget
    rawWidgets.forEach((widget, i) => {
      console.log(`    [${i}] ${widget.type} - "${widget.title}" - mesh: ${widget.meshName}`);
    });
    
    // Remove duplicate light widgets (keep only the first one for each mesh)
    const seenLightMeshes = new Set();
    const uniqueWidgets = rawWidgets.filter((widget, index) => {
      if (widget.type === 'lightWidget') {
        if (seenLightMeshes.has(widget.meshName)) {
          console.log(`🧹 Interface: REMOVING duplicate light widget [${index}]: "${widget.title}" for mesh: ${widget.meshName}`);
          return false; // Remove duplicate
        }
        seenLightMeshes.add(widget.meshName);
        console.log(`✅ Interface: KEEPING light widget [${index}]: "${widget.title}" for mesh: ${widget.meshName}`);
      }
      return true; // Keep widget
    });
    
    console.log(`🧹 Interface: Filtered ${rawWidgets.length} widgets to ${uniqueWidgets.length} unique widgets`);
    console.log(`  - Final uniqueWidgets:`, uniqueWidgets);
    
    return uniqueWidgets;
  }, [config.uiWidgets, config.metadata?.uiWidgets, selectedModel]);

  // Enhanced widget debugging
  React.useEffect(() => {
    console.log('🔍 INTERFACE CONFIG DEBUG:');
    console.log('  selectedModel:', selectedModel);
    console.log('  FULL config object:', config);
    console.log('  config.lights:', config.lights);
    console.log('  config.lights length:', config.lights?.length || 0);
    console.log('  config.uiWidgets:', config.uiWidgets);
    console.log('  config.metadata:', config.metadata);
    console.log('  config.metadata?.uiWidgets:', config.metadata?.uiWidgets);
    console.log('  allWidgets (final):', allWidgets);
    console.log('  allWidgets.length:', allWidgets.length);
    
    // Check for lights in different places
    console.log('🔍 LIGHTS LOCATION CHECK:');
    console.log('  - config.lights:', config.lights);
    console.log('  - config.metadata?.lights:', config.metadata?.lights);
    
    if (allWidgets.length > 0) {
      allWidgets.forEach((widget, i) => {
        console.log(`    Widget ${i}:`, widget);
      });
    }
  }, [selectedModel, JSON.stringify(config)]);

  // Function to capture current model state
  const captureCurrentState = () => {
    if (!api?.getCurrentState) {
      console.warn('API getCurrentState not available');
      return {};
    }

    return api.getCurrentState();
  };

  // Function to save configuration
  const handleSaveConfig = async (configData) => {
    try {
      // Capture current scene state from the Experience API
      let currentState = captureCurrentState();

      // If API exposes captureCurrentTextures, use it to include textures only when saving
      if (api?.captureCurrentTextures) {
        try {
          const liveTextures = api.captureCurrentTextures();
          currentState = {
            ...currentState,
            textureSettings: {
              ...currentState.textureSettings,
              ...liveTextures
            }
          };
        } catch (err) {
          console.warn('Failed to capture live textures for save:', err);
        }
      }
      
      const token = localStorage.getItem('token');
      // Use centralized API URL determination
      const apiUrl = getApiBaseUrl();

      console.log('🔗 Save config API call:', `${apiUrl}/configs/save`);
      console.log('🔗 apiUrl value:', apiUrl);
      console.log('🔗 Full URL being called:', `${apiUrl}/configs/save`);

      const response = await fetch(`${apiUrl}/configs/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...configData,
          configData: currentState
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  };

  // Function to load configuration
  const handleLoadConfig = (configData) => {
    if (!api?.loadState) {
      console.warn('API loadState not available');
      return;
    }

    api.loadState(configData);
    alert('Configuration loaded successfully!');
  };
  
  // Debug logging - only log when selectedModel changes
  React.useEffect(() => {
    console.log('=== INTERFACE DEBUG ===');
    console.log('Selected Model:', selectedModel);
    console.log('Available Models:', Object.keys(models));
    console.log('Config for selected model:', config);
    console.log('Config.metadata:', config.metadata);
    console.log('Config.metadata.uiWidgets:', config.metadata?.uiWidgets);
    console.log('Config.uiWidgets:', config.uiWidgets);
    console.log('All Widgets:', allWidgets);
    console.log('🔍 Widget Sources:');
    console.log('  - From config.uiWidgets:', config.uiWidgets || []);
    console.log('  - From config.metadata.uiWidgets:', config.metadata?.uiWidgets || []);
    console.log('  - Total merged widgets:', allWidgets.length);
    console.log('User Permissions:', userPermissions);
    console.log('🔍 Model-Specific Permissions:');
    console.log('  - userPermissions.modelSpecificPermissions:', userPermissions?.modelSpecificPermissions);
    console.log('  - Permissions for current model:', userPermissions?.modelSpecificPermissions?.[selectedModel]);
    console.log('🔍 Specific permission checks:');
    console.log('  - lightWidget permission:', userPermissions?.lightWidget);
    console.log('  - hasPermission(lightWidget):', hasPermission('lightWidget'));
    console.log('  - textureWidget permission:', userPermissions?.textureWidget);
    console.log('  - hasPermission(textureWidget):', hasPermission('textureWidget'));
    console.log('Config.interactionGroups:', config.interactionGroups);
    console.log('Interaction Groups Length:', config.interactionGroups?.length || 0);
    console.log('=======================');
  }, [selectedModel, config.uiWidgets]); // Only log when these change

  // Permission helpers (backend uses specific keys; derive common intents)
  const hasPermission = (permission) => {
    console.log(`🚨 PERMISSION CHECK: ${permission} for model: ${selectedModel}`);
    console.log(`🚨 userPermissions:`, userPermissions);
    console.log(`🚨 userPermissions.modelSpecificPermissions:`, userPermissions?.modelSpecificPermissions);
    
    // Grant full access to admin and superadmin roles
    if (userPermissions && (userPermissions.role === 'admin' || userPermissions.role === 'superadmin')) {
      console.log(`✅ Admin/Superadmin - granting full access for: ${permission}`);
      return true;
    }

    if (!userPermissions) {
      console.log(`❌ No user permissions - denying: ${permission}`);
      return false;
    }
    
    // NEW: Check model-specific permissions first
    if (userPermissions.modelSpecificPermissions && selectedModel) {
      const modelPermissions = userPermissions.modelSpecificPermissions[selectedModel];
      console.log(`🔍 Model-specific permissions for ${selectedModel}:`, modelPermissions);
      
      if (modelPermissions) {
        if (typeof modelPermissions[permission] !== 'undefined') {
          const result = !!modelPermissions[permission];
          console.log(`✅ Model-specific permission check for ${selectedModel}: ${permission} = ${result}`);
          return result;
        } else {
          console.log(`❌ Permission ${permission} not found in model-specific permissions for ${selectedModel}`);
        }
      } else {
        console.log(`❌ No model-specific permissions found for model: ${selectedModel}`);
      }
    } else {
      console.log(`❌ No modelSpecificPermissions object or selectedModel missing`);
    }
    
    // TEMPORARY: Disable global permissions fallback to force model-specific behavior
    console.log(`🛑 BLOCKING global permission fallback - no global access should be granted`);
    return false;
    
    // ORIGINAL FALLBACK CODE (DISABLED):
    /*
    // Support old keys used earlier (canEdit/canTexture)
    if (permission === 'canEdit') {
      const result = (
        userPermissions.canEdit ||
        userPermissions.doorPresets ||
        userPermissions.doorToggles ||
        userPermissions.drawerToggles ||
        userPermissions.textureWidget ||
        userPermissions.globalTextureWidget ||
        userPermissions.lightWidget
      );
      console.log(`🔍 Global canEdit permission check: ${result}`);
      return result;
    }
    if (permission === 'canTexture') {
      const result = (
        userPermissions.canTexture ||
        userPermissions.textureWidget ||
        userPermissions.globalTextureWidget
      );
      console.log(`🔍 Global canTexture permission check: ${result}`);
      return result;
    }
    
    // Check global permission as final fallback
    const hasGlobalPermission = !!userPermissions[permission];
    if (hasGlobalPermission) {
      console.log(`🔍 Global permission check: ${permission} = ${hasGlobalPermission}`);
    }
    return hasGlobalPermission;
    */
  };

  // Map widget types to permission requirements
  const getWidgetPermission = (widgetType) => {
    // Normalize widgetType to a canonical key (lowercase, strip non-alphanum and trailing 'widget')
    if (!widgetType || typeof widgetType !== 'string') return 'textureWidget';
    const normalized = widgetType.replace(/[^a-zA-Z0-9]/g, '').replace(/widget$/i, '').toLowerCase();

    // Extended mapping: map many widget type variants to backend permission keys
    const permissionMap = {
      preset: 'canEdit',
      presets: 'canEdit',
      presetwidget: 'canEdit',
      doorpresets: 'doorPresets',
      doorpreset: 'doorPresets',
      doorpresetwidget: 'doorPresets',
      doortoggles: 'doorToggles',
      doortoggle: 'doorToggles',
      drawertoggles: 'drawerToggles',
      drawertoggle: 'drawerToggles',
      texture: 'textureWidget',
      texturewidget: 'textureWidget',
      globaltexture: 'globalTextureWidget',
      globaltexturewidget: 'globalTextureWidget',
      light: 'lightWidget',
      lightwidget: 'lightWidget',
      screenshot: 'screenshotWidget',
      screenshotwidget: 'screenshotWidget',
      reflection: 'lightWidget',
      movement: 'canMove',
      saveconfig: 'saveConfig',
      modelposition: 'canMove',
      custom: 'textureWidget'
    };

    // prefer exact normalized match, otherwise try suffix matches
    if (permissionMap[normalized]) return permissionMap[normalized];

    // try to find a key that contains normalized (covers odd naming)
    const found = Object.keys(permissionMap).find(k => k.includes(normalized) || normalized.includes(k));
    if (found) return permissionMap[found];

    // fallback defaults
    if (normalized.includes('door')) return 'doorToggles';
    if (normalized.includes('preset')) return 'canEdit';
    if (normalized.includes('texture')) return 'textureWidget';
    if (normalized.includes('light')) return 'lightWidget';
    return 'textureWidget';
  };

  // Filter widgets based on user permissions (memoized to prevent loops)
  const widgets = React.useMemo(() => {
    console.log('🚨 WIDGET FILTERING DEBUG:');
    console.log('  - allWidgets count:', allWidgets.length);
    console.log('  - allWidgets:', allWidgets);
    console.log('  - selectedModel:', selectedModel);
    
    const filtered = allWidgets.filter(widget => {
      const requiredPermission = getWidgetPermission(widget.type);
      const hasPermissionResult = hasPermission(requiredPermission);
      
      console.log(`🚨 Widget: "${widget.type}" -> requires permission: "${requiredPermission}" -> hasPermission: ${hasPermissionResult}`);
      
      if (!hasPermissionResult) {
        console.log(`❌ Interface: widget "${widget.type}" requires "${requiredPermission}" but user lacks it`);
      } else {
        console.log(`✅ Interface: widget "${widget.type}" allowed (permission: ${requiredPermission})`);
      }
      return hasPermissionResult;
    });
    
    // Simple logging without circular reference
    console.log('🎮 FINAL RESULT: Widgets updated:', filtered.length, 'widgets available out of', allWidgets.length);
    console.log('🎮 FILTERED WIDGETS:', filtered);
    
    return filtered;
  }, [JSON.stringify(allWidgets), JSON.stringify(userPermissions), selectedModel]); // Use JSON.stringify to avoid object reference issues

  // Widget filtering debug removed to prevent infinite loops

  // Render individual widget
  const renderWidget = (widget, index) => {
    // Try direct lookup first
    let WidgetComponent = widgetRegistry[widget.type];

    // If not found, try common normalizations (lower-first-char, case-insensitive match,
    // and stripping 'widget' suffix). This lets configs use variants like "GlobalTextureWidget"
    // or different casing without breaking.
    if (!WidgetComponent && widget.type) {
      const lowerFirst = widget.type.charAt(0).toLowerCase() + widget.type.slice(1);
      if (widgetRegistry[lowerFirst]) {
        WidgetComponent = widgetRegistry[lowerFirst];
        console.log(`🛠 Interface: normalized widget type '${widget.type}' -> '${lowerFirst}'`);
      }
    }

    if (!WidgetComponent && widget.type) {
      const wanted = widget.type.toLowerCase();
      const foundKey = Object.keys(widgetRegistry).find(k => k.toLowerCase() === wanted);
      if (foundKey) {
        WidgetComponent = widgetRegistry[foundKey];
        console.log(`🛠 Interface: matched widget type case-insensitively '${widget.type}' -> '${foundKey}'`);
      }
    }

    if (!WidgetComponent && widget.type) {
      // Try stripping suffix 'widget' and matching
      const stripped = widget.type.replace(/widget$/i, '');
      const foundKey = Object.keys(widgetRegistry).find(k => k.replace(/widget$/i, '').toLowerCase() === stripped.toLowerCase());
      if (foundKey) {
        WidgetComponent = widgetRegistry[foundKey];
        console.log(`🛠 Interface: stripped suffix and matched '${widget.type}' -> '${foundKey}'`);
      }
    }

    if (!WidgetComponent) {
      console.error(`❌ Widget type "${widget.type}" not found in registry`);
      return <div style={{
        color: '#dc2626',
        padding: '16px',
        border: '2px solid #fecaca',
        borderRadius: '12px',
        marginBottom: '16px',
        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        fontSize: '14px',
        fontWeight: '500',
        textAlign: 'center'
      }}>
        ⚠️ Widget "{widget.type}" not found
      </div>;
    }

    try {
      return (
        <div key={`${widget.type}-${index}`} className="widget-wrapper">
          <WidgetComponent
            config={config}
            api={api}
            togglePart={togglePart}
            applyDoorSelection={applyDoorSelection}
            applyRequest={applyRequest}
            userPermissions={userPermissions}
            hasPermission={hasPermission}
            {...widget.props}
          />
        </div>
      );
    } catch (error) {
      console.error(`❌ Error rendering ${widget.type}:`, error);
      return <div style={{
        color: '#dc2626',
        padding: '16px',
        border: '2px solid #fecaca',
        borderRadius: '12px',
        marginBottom: '16px',
        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        fontSize: '14px',
        fontWeight: '500',
        textAlign: 'center'
      }}>
        ⚠️ Error rendering {widget.type}: {error.message}
      </div>;
    }
  };

  // No permissions message
  if (!userPermissions || Object.keys(userPermissions).length === 0) {
    return (
      <div className="interface-container">
        {/* Modern Model Display Header */}
        <div className="model-display-header">
          <div className="model-header-content">
            <div className="model-info-section">
              <div className="model-name-display">
                {config?.displayName || selectedModel}
              </div>
              <div className="model-details">
                <span className="model-type-badge">{config?.type || '3D Model'}</span>
                {config?.section && (
                  <span className="model-section-badge">{config.section}</span>
                )}
              </div>
            </div>
            <div className="model-actions">
              <button
                className="switch-model-btn"
                onClick={onShowModelSelector}
                aria-label="Switch Model"
              >
                <span className="btn-icon">🔄</span>
                <span className="btn-text">Switch Model</span>
              </button>
            </div>
          </div>
        </div>


        <div className="no-permissions">
          <h3>🔒 Access Required</h3>
          <p>You need appropriate permissions to use the configuration tools.</p>
        </div>
      </div>
    );
  }

  // No widgets configured or no permissions for any widgets
  if (!widgets.length && !hasPermission('saveConfig')) {
    return (
      <div className="interface-container">
        {/* Modern Model Display Header */}
        <div className="model-display-header">
          <div className="model-header-content">
            <div className="model-info-section">
              <div className="model-name-display">
                {config?.displayName || selectedModel}
              </div>
              <div className="model-details">
                <span className="model-type-badge">{config?.type || '3D Model'}</span>
                {config?.section && (
                  <span className="model-section-badge">{config.section}</span>
                )}
              </div>
            </div>
            <div className="model-actions">
              <button
                className="switch-model-btn"
                onClick={onShowModelSelector}
                aria-label="Switch Model"
              >
                <span className="btn-icon">🔄</span>
                <span className="btn-text">Switch Model</span>
              </button>
            </div>
          </div>
        </div>

        <div className="no-permissions">
          <h3>⚙️ No Configuration Available</h3>
          <p>You don't have permission to access configuration tools for this model.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="interface-container">
      {/* Modern Model Display Header */}
      <div className="model-display-header">
        <div className="model-header-content">
          <div className="model-info-section">
            <div className="model-name-display">
              {config?.displayName || selectedModel}
            </div>
            <div className="model-details">
              <span className="model-type-badge">{config?.type || '3D Model'}</span>
              {config?.section && (
                <span className="model-section-badge">{config.section}</span>
              )}
            </div>
          </div>
          <div className="model-actions">
            <button
              className="switch-model-btn"
              onClick={onShowModelSelector}
              aria-label="Switch Model"
            >
              <span className="btn-icon">🔄</span>
              <span className="btn-text">Switch Model</span>
            </button>
          </div>
        </div>
      </div>

      
      <div className="widgets-container">
        {widgets.map((widget, index) => renderWidget(widget, index))}
      </div>

      {/* Model Position Controls */}

      {/* Configuration Manager */}
      {hasPermission('canEdit') && (
        <div className="widget-container widget-full save-config-widget">
          <h4 className="widget-title">💾 Configuration Manager</h4>
          
          <div className="config-buttons">
            <button 
              className="btn btn-primary save-config-btn"
              onClick={() => setShowSaveModal(true)}
            >
              💾 Save Current Config
            </button>
            
            <button 
              className="btn btn-secondary load-config-btn"
              onClick={() => setShowConfigsList(true)}
            >
              📋 Load Saved Config
            </button>
          </div>
          
          <div className="save-config-info">
            <span className="info-text">
              Save your current configuration or load a previously saved one
            </span>
          </div>
        </div>
      )}

      {/* Model Information widget removed per request */}

      {/* Save Configuration Modal */}
      <SaveConfigModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveConfig}
        currentConfig={showSaveModal ? captureCurrentState() : {}}
        modelName={selectedModel}
      />

      {/* Saved Configurations List Modal */}
      <SavedConfigsList
        isOpen={showConfigsList}
        onClose={() => setShowConfigsList(false)}
        onLoad={handleLoadConfig}
        modelName={selectedModel}
      />
    </div>
  );
}

export default Interface;
