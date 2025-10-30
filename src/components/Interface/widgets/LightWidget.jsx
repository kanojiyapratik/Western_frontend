// src/components/widgets/LightWidget.jsx
import React from 'react';
import "../Interface.css";
import { dlog } from '../../../utils/logger';

export const LightWidget = ({ config, api }) => {
  // Check both config.lights and config.metadata.lights - prioritize non-empty arrays
  const lights = (config.lights && config.lights.length > 0) ? config.lights : (config.metadata?.lights || []);
  const [lightsState, setLightsState] = React.useState({});

  // Enhanced debug logging
  React.useEffect(() => {
    dlog('💡 LightWidget Enhanced Debug:');
    dlog('  - FULL config object:', config);
    dlog('  - config.lights:', config.lights);
    dlog('  - config.metadata.lights:', config.metadata?.lights);
    dlog('  - MERGED lights result:', lights);
    dlog('  - lights.length:', lights.length);
    dlog('  - lights array type:', Array.isArray(lights));
    
    if (lights.length > 0) {
      dlog('  - ✅ LIGHTS FOUND!');
      lights.forEach((light, i) => {
        dlog(`  - Light ${i}:`, light);
      });
    } else {
      dlog('  - ❌ NO LIGHTS FOUND anywhere');
    }
  }, [JSON.stringify(config)]); // Watch entire config object changes

  // Initialize lights state - use JSON string to avoid infinite loops
  React.useEffect(() => {
    const initialState = {};
    lights.forEach(light => {
      initialState[light.name] = light.defaultState === "on";
    });
    setLightsState(initialState);
  }, [JSON.stringify(lights)]); // Use JSON.stringify to avoid infinite loops on array changes

  if (!lights || lights.length === 0) {
    return null; // Don't show widget if no lights configured
  }

  const toggleLight = (lightName, newState) => {
    setLightsState(prev => ({
      ...prev,
      [lightName]: newState
    }));
    
    // Call the API to actually toggle the light
    if (api && api.toggleLight) {
      api.toggleLight(lightName, newState);
    }
  };

  const toggleAllLights = () => {
    const allOn = Object.values(lightsState).every(state => state);
    const newState = !allOn;
    
    const newLightsState = {};
    lights.forEach(light => {
      newLightsState[light.name] = newState;
    });
    
    setLightsState(newLightsState);
    
    // Toggle all lights
    if (api && api.toggleAllLights) {
      api.toggleAllLights(newState);
    }
  };

  const allOn = Object.values(lightsState).every(state => state);
  const anyOn = Object.values(lightsState).some(state => state);

  return (
    <div className="widget light-widget">
      <h3>Lights</h3>
      <div className="widget-content">
        <button
          className={`light-toggle-btn ${anyOn ? 'active' : ''}`}
          onClick={toggleAllLights}
          title={anyOn ? 'Turn off all lights' : 'Turn on all lights'}
        >
          {anyOn ? '💡' : '🔆'}
        </button>
      </div>
    </div>
  );
};

export default React.memo(LightWidget);