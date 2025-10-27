import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import './ConfigurationManagement.css';

const ConfigurationManagement = () => {
  const { user } = useAuth();
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelConfig, setModelConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/models', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to fetch models');

        const modelsData = await response.json();
        setModels(modelsData);
      } catch (err) {
        console.error('Error fetching models:', err);
        setError('Failed to load models');
      }
    };

    fetchModels();
  }, []);

  // Load model configuration
  const loadModelConfig = async (modelId) => {
    if (!modelId) return;

    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/models/${modelId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to load model configuration');

      const model = await response.json();

      // If model has a configUrl, fetch the JSON config
      if (model.configUrl) {
        try {
          const configResponse = await fetch(model.configUrl);
          if (configResponse.ok) {
            const configData = await configResponse.json();
            setModelConfig({
              ...model,
              configData
            });
          } else {
            // Create default config structure
            setModelConfig({
              ...model,
              configData: {
                name: model.name,
                presets: []
              }
            });
          }
        } catch (configErr) {
          console.warn('Could not load config JSON:', configErr);
          setModelConfig({
            ...model,
            configData: {
              name: model.name,
              presets: []
            }
          });
        }
      } else {
        // Create default config structure
        setModelConfig({
          ...model,
          configData: {
            name: model.name,
            presets: []
          }
        });
      }
    } catch (err) {
      console.error('Error loading model config:', err);
      setError('Failed to load model configuration');
    } finally {
      setLoading(false);
    }
  };

  // Handle model selection
  const handleModelChange = (e) => {
    const modelId = e.target.value;
    setSelectedModel(modelId);
    if (modelId) {
      loadModelConfig(modelId);
    } else {
      setModelConfig(null);
    }
  };

  // Upload image file
  const uploadImage = async (file) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('texture', file);

    const response = await fetch('/api/upload-texture', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const result = await response.json();
    return result.path;
  };

  // Add new preset
  const addPreset = () => {
    if (!modelConfig) return;

    const newPreset = {
      id: `preset_${Date.now()}`,
      label: 'New Preset',
      buttonColor: '#007bff',
      buttonTextColor: '#ffffff',
      actions: []
    };

    setModelConfig(prev => ({
      ...prev,
      configData: {
        ...prev.configData,
        presets: [...(prev.configData.presets || []), newPreset]
      }
    }));
  };

  // Update preset
  const updatePreset = (index, field, value) => {
    setModelConfig(prev => {
      const newPresets = [...(prev.configData.presets || [])];
      newPresets[index] = { ...newPresets[index], [field]: value };
      return {
        ...prev,
        configData: {
          ...prev.configData,
          presets: newPresets
        }
      };
    });
  };

  // Delete preset
  const deletePreset = (index) => {
    setModelConfig(prev => {
      const newPresets = [...(prev.configData.presets || [])];
      newPresets.splice(index, 1);
      return {
        ...prev,
        configData: {
          ...prev.configData,
          presets: newPresets
        }
      };
    });
  };

  // Add action to preset
  const addActionToPreset = (presetIndex) => {
    setModelConfig(prev => {
      const newPresets = [...(prev.configData.presets || [])];
      if (!newPresets[presetIndex].actions) {
        newPresets[presetIndex].actions = [];
      }
      newPresets[presetIndex].actions.push({
        part: '',
        texture: '',
        tintColor: ''
      });
      return {
        ...prev,
        configData: {
          ...prev.configData,
          presets: newPresets
        }
      };
    });
  };

  // Update preset action
  const updatePresetAction = (presetIndex, actionIndex, field, value) => {
    setModelConfig(prev => {
      const newPresets = [...(prev.configData.presets || [])];
      newPresets[presetIndex].actions[actionIndex] = {
        ...newPresets[presetIndex].actions[actionIndex],
        [field]: value
      };
      return {
        ...prev,
        configData: {
          ...prev.configData,
          presets: newPresets
        }
      };
    });
  };

  // Delete preset action
  const deletePresetAction = (presetIndex, actionIndex) => {
    setModelConfig(prev => {
      const newPresets = [...(prev.configData.presets || [])];
      newPresets[presetIndex].actions.splice(actionIndex, 1);
      return {
        ...prev,
        configData: {
          ...prev.configData,
          presets: newPresets
        }
      };
    });
  };

  // Handle image upload for texture
  const handleImageUpload = async (presetIndex, actionIndex, file) => {
    try {
      const imagePath = await uploadImage(file);
      updatePresetAction(presetIndex, actionIndex, 'texture', imagePath);
      setSuccess('Image uploaded successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Image upload failed:', err);
      setError('Failed to upload image');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Save configuration
  const saveConfiguration = async () => {
    if (!modelConfig) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');

      // Save the config JSON
      const configResponse = await fetch('/api/upload-config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modelConfig.configData)
      });

      if (!configResponse.ok) {
        throw new Error('Failed to save configuration');
      }

      const configResult = await configResponse.json();
      const configUrl = configResult.path;

      // Update the model with the new config URL
      const updateResponse = await fetch(`/api/admin/models/${modelConfig._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          configUrl: configUrl
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update model');
      }

      setSuccess('Configuration saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setError('Failed to save configuration');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="configuration-management">
      <div className="page-header">
        <h1>Configuration Management</h1>
        <p>Manage preset configurations and upload images for 3D models</p>
      </div>

      <div className="config-content">
        {/* Model Selection */}
        <div className="model-selection">
          <label>
            <span>Select Model:</span>
            <select value={selectedModel} onChange={handleModelChange}>
              <option value="">Choose a model...</option>
              {models.map(model => (
                <option key={model._id} value={model._id}>
                  {model.name} ({model.section || 'No section'})
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <div className="loading">Loading configuration...</div>}

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {modelConfig && (
          <div className="config-editor">
            <div className="config-header">
              <h2>Configure {modelConfig.name}</h2>
              <button
                className="btn-primary"
                onClick={addPreset}
                disabled={saving}
              >
                Add Preset
              </button>
            </div>

            <div className="presets-list">
              {(modelConfig.configData.presets || []).map((preset, presetIndex) => (
                <div key={preset.id || presetIndex} className="preset-item">
                  <div className="preset-header">
                    <h3>Preset {presetIndex + 1}</h3>
                    <button
                      className="btn-danger-small"
                      onClick={() => deletePreset(presetIndex)}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="preset-fields">
                    <label>
                      <span>ID:</span>
                      <input
                        type="text"
                        value={preset.id || ''}
                        onChange={(e) => updatePreset(presetIndex, 'id', e.target.value)}
                        disabled={saving}
                      />
                    </label>

                    <label>
                      <span>Label:</span>
                      <input
                        type="text"
                        value={preset.label || ''}
                        onChange={(e) => updatePreset(presetIndex, 'label', e.target.value)}
                        disabled={saving}
                      />
                    </label>

                    <label>
                      <span>Button Color:</span>
                      <input
                        type="color"
                        value={preset.buttonColor || '#007bff'}
                        onChange={(e) => updatePreset(presetIndex, 'buttonColor', e.target.value)}
                        disabled={saving}
                      />
                    </label>

                    <label>
                      <span>Button Text Color:</span>
                      <input
                        type="color"
                        value={preset.buttonTextColor || '#ffffff'}
                        onChange={(e) => updatePreset(presetIndex, 'buttonTextColor', e.target.value)}
                        disabled={saving}
                      />
                    </label>
                  </div>

                  <div className="preset-actions">
                    <h4>Actions</h4>
                    <button
                      className="btn-secondary-small"
                      onClick={() => addActionToPreset(presetIndex)}
                      disabled={saving}
                    >
                      Add Action
                    </button>

                    {(preset.actions || []).map((action, actionIndex) => (
                      <div key={actionIndex} className="action-item">
                        <div className="action-fields">
                          <label>
                            <span>Part:</span>
                            <input
                              type="text"
                              value={action.part || ''}
                              onChange={(e) => updatePresetAction(presetIndex, actionIndex, 'part', e.target.value)}
                              placeholder="e.g., Cylinder002"
                              disabled={saving}
                            />
                          </label>

                          <label>
                            <span>Texture Image:</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  handleImageUpload(presetIndex, actionIndex, file);
                                }
                              }}
                              disabled={saving}
                            />
                            {action.texture && (
                              <div className="texture-preview">
                                <img
                                  src={action.texture}
                                  alt="Texture preview"
                                  style={{ maxWidth: '100px', maxHeight: '100px' }}
                                />
                                <span>{action.texture}</span>
                              </div>
                            )}
                          </label>

                          <label>
                            <span>Tint Color:</span>
                            <input
                              type="color"
                              value={action.tintColor || '#ffffff'}
                              onChange={(e) => updatePresetAction(presetIndex, actionIndex, 'tintColor', e.target.value)}
                              disabled={saving}
                            />
                          </label>
                        </div>

                        <button
                          className="btn-danger-small"
                          onClick={() => deletePresetAction(presetIndex, actionIndex)}
                          disabled={saving}
                        >
                          Remove Action
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="config-actions">
              <button
                className="btn-primary"
                onClick={saveConfiguration}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigurationManagement;