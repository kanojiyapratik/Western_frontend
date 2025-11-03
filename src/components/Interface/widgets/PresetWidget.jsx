import React from 'react';
import '../Interface.css';
import { dlog } from '../../../utils/logger';

export const PresetWidget = ({ config, applyRequest, api, userPermissions }) => {
  const allPresets = Array.isArray(config.presets) ? config.presets : [];
  const presetAccess = userPermissions?.presetAccess;
  const presets = Array.isArray(allPresets)
    ? allPresets.filter(p => {
        if (!presetAccess || Object.keys(presetAccess).length === 0) return true; // no per-preset restrictions
        if (!p || !p.id) return false;
        return !!presetAccess[p.id];
      })
    : [];

  // Check if there are preset images available
  const presetImages = Array.isArray(config.presetImages) ? config.presetImages : [];
  dlog(`🎛️ PresetWidget: Found ${presets.length} presets and ${presetImages.length} preset images`);

  if (!presets.length && !presetImages.length) {
    return (
      <div className="widget-container">
        <div className="widget-title">🎛 Presets</div>
        <p style={{ color: '#6c757d', fontStyle: 'italic' }}>No presets available for this model.</p>
      </div>
    );
  }

  const handleApplyPreset = async (preset) => {
    if (!preset || !Array.isArray(preset.actions)) {
      dlog(`❌ Invalid preset or no actions:`, preset);
      return;
    }
    try {
      dlog(`🔄 Applying preset: ${preset.id || preset.label} with ${preset.actions.length} actions`);
      for (const action of preset.actions) {
        const part = action.part;
        if (!part) continue;

        dlog(`🎯 Processing action for part: ${part}`);

        if (action.texture) {
          dlog(`🖼️ Applying texture ${action.texture} to ${part}`);
          try {
            // Normalize part name to match the texture widget configuration
            let normalizedPart = part;
            if (part.toLowerCase().includes('sidepannel')) {
              // Convert sidepannelRight/sidepannelLeft to SidepannelRight/SidepannelLeft
              normalizedPart = part.charAt(0).toUpperCase() + part.slice(1);
              if (normalizedPart.toLowerCase().includes('right')) {
                normalizedPart = 'SidepannelRight';
              } else if (normalizedPart.toLowerCase().includes('left')) {
                normalizedPart = 'SidepannelLeft';
              }
              dlog(`🔄 Normalized part name: ${part} -> ${normalizedPart}`);
            }

            // Handle S3 URLs - proxy through backend to avoid CORS
            let textureUrl = action.texture;
            if (textureUrl && (textureUrl.includes('amazonaws.com') || textureUrl.includes('s3.'))) {
              // Proxy S3 images through backend to avoid CORS
              const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
              // Remove the /api suffix if present since we add it back
              const cleanApiBase = apiBase.replace('/api', '');
              textureUrl = `${cleanApiBase}/api/proxy-image?url=${encodeURIComponent(textureUrl)}`;
              dlog(`🔗 Proxied S3 URL: ${action.texture} -> ${textureUrl}`);
            } else if (textureUrl && textureUrl.includes('amazonaws.com') && !textureUrl.startsWith('http')) {
              textureUrl = 'https://' + textureUrl;
              dlog(`🔗 Fixed S3 URL: ${action.texture} -> ${textureUrl}`);
            }

            if (applyRequest?.current) {
              await applyRequest.current(normalizedPart, textureUrl, action.mapping || {}, action.persist || false);
              dlog(`✅ Texture applied via applyRequest to ${normalizedPart}: ${textureUrl}`);
            } else if (api?.applyTexture) {
              await api.applyTexture(normalizedPart, textureUrl, action.mapping || {}, action.persist || false);
              dlog(`✅ Texture applied via api to ${normalizedPart}: ${textureUrl}`);
            } else {
              console.warn(`❌ No texture application method available for ${normalizedPart}`);
            }
          } catch (textureErr) {
            console.error(`❌ Failed to apply texture to ${part}:`, textureErr);
            // Continue with other actions even if one fails
          }
        } else if (action.tintColor || action.color) {
          const color = action.tintColor || action.color;
          dlog(`🎨 Applying color ${color} to ${part}`);
          try {
            if (applyRequest?.current) {
              await applyRequest.current(part, null, { tintColor: color });
              dlog(`✅ Color applied via applyRequest to ${part}: ${color}`);
            } else if (api?.applyTexture) {
              await api.applyTexture(part, null, { tintColor: color });
              dlog(`✅ Color applied via api to ${part}: ${color}`);
            } else {
              console.warn(`❌ No color application method available for ${part}`);
            }
          } catch (colorErr) {
            console.error(`❌ Failed to apply color to ${part}:`, colorErr);
            // Continue with other actions even if one fails
          }
        }
      }
      dlog(`✅ Preset applied: ${preset.id || preset.label}`);
    } catch (err) {
      console.error('❌ Preset apply failed:', err);
    }
  };

  return (
    <div className="widget-container">
      <div className="widget-title">🎛 {config?.presetsTitle || 'Presets'}</div>

      {/* Preset Images Section */}
      {presetImages.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Preset Images:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {presetImages.map((img, idx) => (
              <div key={idx} style={{ textAlign: 'center', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
                <img
                  src={img.url}
                  alt={img.originalName || img.filename}
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 4, marginBottom: 4, cursor: 'pointer' }}
                  onError={(e) => {
                    e.target.src = '/placeholder-3d.svg';
                  }}
                  onClick={async () => {
                    dlog(`🖼️ Attempting to apply preset image: ${img.url}`);

                    // Try to apply the preset image as a texture to common parts
                    const commonParts = ['Cylinder002', 'Cylinder001', 'BodyMaterial', 'SidepannelRight', 'SidepannelLeft', 'sidepannelRight', 'sidepannelLeft'];

                    let applied = false;
                    for (const part of commonParts) {
                      try {
                        dlog(`🎯 Trying to apply to part: ${part}`);
                        if (applyRequest?.current) {
                          await applyRequest.current(part, img.url, {}, false);
                          dlog(`✅ Applied preset image to ${part}: ${img.url}`);
                          applied = true;
                          break; // Stop after first successful application
                        } else if (api?.applyTexture) {
                          await api.applyTexture(part, img.url, {}, false);
                          dlog(`✅ Applied preset image to ${part}: ${img.url}`);
                          applied = true;
                          break; // Stop after first successful application
                        } else {
                          dlog(`❌ No texture application method available`);
                        }
                      } catch (err) {
                        dlog(`⚠️ Failed to apply to ${part}:`, err?.message || err);
                        continue;
                      }
                    }

                    if (!applied) {
                      dlog(`❌ Could not apply preset image to any part, copying URL instead`);
                      // If no parts worked, fall back to copying URL
                      navigator.clipboard.writeText(img.url).then(() => {
                        dlog(`✅ Copied preset image URL: ${img.url}`);
                      }).catch(err => {
                        console.error('Failed to copy URL:', err);
                      });
                    }
                  }}
                  title={`Click to copy URL: ${img.originalName || img.filename}`}
                />
                <div style={{ fontSize: 10, fontWeight: 500, wordBreak: 'break-all', marginBottom: 4 }}>
                  {img.originalName || img.filename}
                </div>
                <button
                  className="interface-button"
                  style={{ fontSize: 10, padding: '4px 8px', width: '100%' }}
                  onClick={() => {
                    // Copy the image URL to clipboard for use in presets
                    navigator.clipboard.writeText(img.url).then(() => {
                      dlog(`✅ Copied preset image URL: ${img.url}`);
                    }).catch(err => {
                      console.error('Failed to copy URL:', err);
                    });
                  }}
                >
                  Copy URL
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preset Buttons Section */}
      {presets.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Available Presets:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {presets.map((p) => (
              <button key={p.id || p.label} className="interface-button" onClick={() => handleApplyPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(PresetWidget);
