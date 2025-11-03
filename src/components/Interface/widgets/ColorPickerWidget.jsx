import React, { useState } from 'react';
import '../Interface.css';

// Simple color picker widget
export default function ColorPickerWidget({ config, applyRequest }) {
  const widget = config?.uiWidgets?.find((w) => w.type && w.type.toLowerCase().includes('color')) || {};
  const options = widget.options || {};
  const parts = options.parts || [];

  const [selectedPart, setSelectedPart] = useState(parts[0]?.name || '');
  const [color, setColor] = useState('#ffffff');
  const [persist, setPersist] = useState(false);

  // Function to apply color immediately when color changes
  const applyColor = async (newColor, targetPart = selectedPart) => {
    if (!targetPart) {
      console.log('⚠️ No target part selected for color application');
      return;
    }

    // Determine whether the target is a material or object
    const partCfg = parts.find(p => p.name === targetPart) || {};
    let target = targetPart;
    if (partCfg.type === 'material' && partCfg.materialName) {
      target = `__material:${partCfg.materialName}`;
    }

    if (!target || typeof target !== 'string') {
      console.error('ColorPickerWidget: resolved invalid target', { targetPart, partCfg, target });
      return;
    }

    console.log('🎨 ColorPickerWidget: applying color dynamically', { target, color: newColor, persist });

    if (!applyRequest?.current) {
      console.warn('⚠️ applyRequest not available on props');
      return;
    }

    try {
      // Call the applyRequest function with proper parameters
      const result = applyRequest.current(target, null, { tintColor: newColor, persist });

      // Handle both promise and non-promise returns
      if (result && typeof result.then === 'function') {
        await result;
      }

      console.log('✅ Color applied dynamically:', { target, color: newColor });
    } catch (err) {
      console.error('❌ Dynamic color apply failed:', err);
    }
  };

  // Handler for color picker grid clicks
  const handleColorSelect = (newColor) => {
    setColor(newColor);
    applyColor(newColor);
  };

  // Handler for custom color picker changes
  const handleCustomColorChange = (e) => {
    const newColor = e.target.value;
    setColor(newColor);
    applyColor(newColor);
  };

  if (!parts.length) {
    return (
      <div className="widget-container">
        <div className="widget-title">🎨 Color Picker</div>
        <p style={{ color: '#6c757d', fontStyle: 'italic' }}>No color targets configured for this model.</p>
      </div>
    );
  }

  return (
    <div className="widget-container">
      <div className="widget-title">🎨 Color Picker</div>

      <div className="widget-content" style={{ gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">Target</label>
          <select className="interface-select" value={selectedPart} onChange={(e) => setSelectedPart(e.target.value)}>
            <option value="" disabled>Select target</option>
            {parts.map(p => (
              <option key={p.name} value={p.name}>{p.label || p.name}{p.type === 'material' ? ' (material)' : ''}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Color</label>
          <div className="color-picker-grid" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {[
              '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6',
              '#000000', '#343a40', '#495057', '#6c757d',
              '#dc3545', '#fd7e14', '#ffc107', '#28a745',
              '#007bff', '#6f42c1', '#e83e8c', '#20c997',
              '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
              '#ffeaa7', '#dda0dd', '#98d8c8', '#f7dc6f'
            ].map(colorOption => (
              <div
                key={colorOption}
                className="color-picker"
                style={{
                  backgroundColor: colorOption,
                  border: color === colorOption ? '2px solid #4f46e5' : '2px solid transparent'
                }}
                onClick={() => handleColorSelect(colorOption)}
                title={colorOption}
              />
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Custom Color</label>
          <input
            type="color"
            value={color}
            onChange={handleCustomColorChange}
            style={{ width: '100%', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <input id="persistColor" type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} />
          <label htmlFor="persistColor" style={{ fontSize: '13px' }}>Persist on Save / immediate persist</label>
        </div>

        <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', padding: '8px', background: 'rgba(248, 250, 252, 0.5)', borderRadius: '6px' }}>
          💡 Colors apply instantly when selected
        </div>
      </div>
    </div>
  );
}
