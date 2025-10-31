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
    if (!preset || !Array.isArray(preset.actions)) return;
    try {
      dlog(`🔄 Applying preset: ${preset.id || preset.label}`);
      for (const action of preset.actions) {
        const part = action.part;
        if (!part) continue;

        dlog(`🎯 Processing action for part: ${part}`);

        if (action.texture) {
          dlog(`🖼️ Applying texture ${action.texture} to ${part}`);
          try {
            if (applyRequest?.current) {
              await applyRequest.current(part, action.texture, action.mapping || {}, action.persist || false);
              dlog(`✅ Texture applied via applyRequest to ${part}`);
            } else if (api?.applyTexture) {
              await api.applyTexture(part, action.texture, action.mapping || {}, action.persist || false);
              dlog(`✅ Texture applied via api to ${part}`);
            } else {
              console.warn(`❌ No texture application method available for ${part}`);
            }
          } catch (textureErr) {
            console.error(`❌ Failed to apply texture to ${part}:`, textureErr);
          }
        } else if (action.tintColor || action.color) {
          const color = action.tintColor || action.color;
          dlog(`🎨 Applying color ${color} to ${part}`);
          try {
            if (applyRequest?.current) {
              await applyRequest.current(part, null, { tintColor: color });
              dlog(`✅ Color applied via applyRequest to ${part}`);
            } else if (api?.applyTexture) {
              await api.applyTexture(part, null, { tintColor: color });
              dlog(`✅ Color applied via api to ${part}`);
            } else {
              console.warn(`❌ No color application method available for ${part}`);
            }
          } catch (colorErr) {
            console.error(`❌ Failed to apply color to ${part}:`, colorErr);
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
