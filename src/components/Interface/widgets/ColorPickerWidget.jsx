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

  const handleApply = async () => {
    if (!selectedPart) {
      alert('Please select a target part or material first');
      return;
    }

    // Determine whether the target is a material or object
    // If the part entry has `type: 'material'` then we use the special syntax '__material:Name'
    const partCfg = parts.find(p => p.name === selectedPart) || {};
    let target = selectedPart;
    if (partCfg.type === 'material' && partCfg.materialName) {
      target = `__material:${partCfg.materialName}`;
    }

    if (!target || typeof target !== 'string') {
      console.error('ColorPickerWidget: resolved invalid target', { selectedPart, partCfg, target });
      alert('Invalid color target selected');
      return;
    }

    console.log('🎨 ColorPickerWidget: applying color', { target, color, persist });

    if (!applyRequest?.current) {
      console.warn('⚠️ applyRequest not available on props');
      alert('Color application not available - please refresh the page');
      return;
    }

    try {
      // Call the applyRequest function with proper parameters
      const result = applyRequest.current(target, null, { tintColor: color, persist });

      // Handle both promise and non-promise returns
      if (result && typeof result.then === 'function') {
        await result;
      }

      console.log('✅ Color apply invoked successfully');
      alert(`Color ${color} applied to ${target}`);
    } catch (err) {
      console.error('❌ Color apply failed:', err);
      alert('Failed to apply color. Please check the console for details.');
    }
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
                style={{ backgroundColor: colorOption }}
                onClick={() => setColor(colorOption)}
                title={colorOption}
              />
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Custom Color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: '100%', height: '40px', border: 'none', borderRadius: '8px' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <input id="persistColor" type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} />
          <label htmlFor="persistColor" style={{ fontSize: '13px' }}>Persist on Save / immediate persist</label>
        </div>

        <button className="interface-button btn-full-width" onClick={handleApply}>Apply Color</button>
      </div>
    </div>
  );
}
