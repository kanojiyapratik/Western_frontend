import React, { useState, useEffect, useMemo } from 'react';
import './ModelSelector.css';

const ModelSelector = ({
  isOpen,
  onClose,
  models = {},
  selectedModel,
  onModelSelect,
  sectionOptions = ['(All)'],
  selectedSection = '(All)',
  onSectionChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(selectedSection);
  const [isAnimating, setIsAnimating] = useState(false);

  // Reset search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCategory(selectedSection);
      // Small delay to ensure DOM is ready for animation
      const timer = setTimeout(() => setIsAnimating(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen, selectedSection]);

  // Fuzzy search implementation
  const fuzzySearch = (text, query) => {
    if (!query) return true;
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();

    // Exact match gets highest priority
    if (textLower.includes(queryLower)) return 2;

    // Fuzzy match - check if all query characters exist in order
    let textIndex = 0;
    for (let queryIndex = 0; queryIndex < queryLower.length; queryIndex++) {
      const foundIndex = textLower.indexOf(queryLower[queryIndex], textIndex);
      if (foundIndex === -1) return 0;
      textIndex = foundIndex + 1;
    }
    return 1; // Fuzzy match
  };

  // Filter and sort models
  const filteredModels = useMemo(() => {
    let filtered = Object.entries(models);

    // Filter by category
    if (selectedCategory && selectedCategory !== '(All)') {
      const want = String(selectedCategory).trim().toLowerCase();
      filtered = filtered.filter(([name, cfg]) => {
        const sec = String(cfg?.section || '').trim().toLowerCase();
        return sec === want;
      });
    }

    // Filter and sort by search
    if (searchQuery.trim()) {
      filtered = filtered
        .map(([name, cfg]) => {
          const displayName = cfg?.displayName || name;
          const searchScore = Math.max(
            fuzzySearch(displayName, searchQuery),
            fuzzySearch(name, searchQuery),
            fuzzySearch(cfg?.type || '', searchQuery),
            fuzzySearch(cfg?.section || '', searchQuery)
          );
          return [name, cfg, searchScore];
        })
        .filter(([name, cfg, score]) => score > 0)
        .sort((a, b) => b[2] - a[2]) // Sort by relevance
        .map(([name, cfg]) => [name, cfg]);
    }

    return filtered;
  }, [models, selectedCategory, searchQuery]);

  const handleModelClick = (modelKey) => {
    onModelSelect(modelKey);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`model-selector-overlay ${isOpen ? 'open' : ''}`} onClick={handleOverlayClick}>
      <div className={`model-selector-container ${isOpen ? 'active' : ''}`}>
        {/* Header */}
        <div className="model-selector-header">
          <div className="header-content">
            <h2 className="selector-title">
              <span className="title-icon">🎨</span>
              Select the Model
            </h2>
          </div>

          {/* Search and Filters - Right Side */}
          <div className="header-controls">
            {Array.isArray(sectionOptions) && sectionOptions.length > 1 && (
              <div className="category-wrapper">
                <span className="category-label">Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="category-filter"
                >
                  {sectionOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="search-input-wrapper">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Model Count in Header */}
            <div className="results-summary">
              <span className="results-count">
                {filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''} found
              </span>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close model selector"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>


        {/* Models Grid */}
        <div className="models-grid">
          {filteredModels.length > 0 ? (
            filteredModels.map(([modelKey, modelConfig], index) => (
              <div
                key={modelKey}
                className={`model-card ${selectedModel === modelKey ? 'selected' : ''}`}
                onClick={() => handleModelClick(modelKey)}
              >
                <div className="model-image-placeholder">
                  {modelConfig?.thumbnail ? (
                    <img
                      src={modelConfig.thumbnail}
                      alt={`${modelConfig?.displayName || modelKey} thumbnail`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '8px'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="placeholder-icon"
                    style={{ display: modelConfig?.thumbnail ? 'none' : 'flex' }}
                  >
                    {modelConfig?.type === 'Visicooler' ? '🧊' :
                     modelConfig?.type === 'Upright Counter' ? '🏪' :
                     modelConfig?.section === 'Upright Counter' ? '🏪' : '📦'}
                  </div>
                </div>

                <div className="model-card-content">
                  <div className="model-info-row">
                    <span className="model-number">#{index + 1}</span>
                    <span className="model-type-badge">{modelConfig?.type || '3D Model'}</span>
                  </div>

                  <h3 className="model-name">
                    {modelConfig?.displayName || modelKey}
                  </h3>

                  <div className="model-meta-info">
                    <span className="meta-text">by Admin</span>
                  </div>
                </div>

              </div>
            ))
          ) : (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <h3>No models found</h3>
              <p>Try adjusting your search or category filter</p>
              {searchQuery && (
                <button
                  className="clear-filters-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('(All)');
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelSelector;