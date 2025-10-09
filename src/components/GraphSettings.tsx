import React, { useState } from 'react';
import { useGraphSettings, GraphSettings as GraphSettingsType } from '../hooks/useGraphSettings';

interface GraphSettingsProps {
  currentNodeCount: number;
  onSettingsChange?: (nodeCount: number, sizes: any, layout: any) => void;
}

export const GraphSettings: React.FC<GraphSettingsProps> = ({
  currentNodeCount,
  onSettingsChange
}) => {
  const { settings, updateSetting, updateThreshold, resetToDefaults, calculateSizes, isLoading } = useGraphSettings();
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="graph-settings loading">
        <div className="loading-spinner">🔄</div>
        <span>Loading settings...</span>
      </div>
    );
  }

  // Calculate current sizes for preview
  const currentSizes = calculateSizes(currentNodeCount);

  // Handle threshold updates and notify parent
  const handleThresholdChange = (index: number, field: string, value: number) => {
    const newThreshold = { ...settings.thresholds[index], [field]: value };
    updateThreshold(index, newThreshold);

    // Recalculate and notify parent if this affects current node count
    const newSizes = calculateSizes(currentNodeCount);
    onSettingsChange?.(currentNodeCount, newSizes, settings.layout);
  };

  // Handle layout setting changes
  const handleLayoutChange = (field: keyof typeof settings.layout, value: any) => {
    const newLayout = { ...settings.layout, [field]: value };
    updateSetting('layout', newLayout);

    // Notify parent with current sizes and new layout
    const currentSizes = calculateSizes(currentNodeCount);
    onSettingsChange?.(currentNodeCount, currentSizes, newLayout);
  };

  const handleReset = () => {
    resetToDefaults();
    const defaultSizes = calculateSizes(currentNodeCount);
    onSettingsChange?.(currentNodeCount, defaultSizes, settings.layout);
  };

  // Find which threshold is currently active
  const activeThresholdIndex = settings.thresholds.findIndex(t => currentNodeCount <= t.nodeCount);

  return (
    <div className="graph-settings">
      <div className="settings-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="settings-title">
          ⚙️ Graph Settings
          <span className="node-count-badge">{currentNodeCount} nodes</span>
        </div>
        <div className="settings-toggle">
          {isExpanded ? '▼' : '▶'}
        </div>
      </div>

      {isExpanded && (
        <div className="settings-content">
          {/* Current Settings Preview */}
          <div className="current-settings">
            <h4>📊 Current Sizes (for {currentNodeCount} nodes)</h4>
            <div className="current-sizes">
              <div className="size-item">
                <span className="size-label">Files:</span>
                <span className="size-value">{currentSizes.fileSize}px</span>
              </div>
              <div className="size-item">
                <span className="size-label">Folders:</span>
                <span className="size-value">{currentSizes.folderWidth}×{currentSizes.folderHeight}px</span>
              </div>
              <div className="size-item">
                <span className="size-label">Font:</span>
                <span className="size-value">{currentSizes.fontSize}px</span>
              </div>
            </div>
          </div>

          {/* Layout Settings */}
          <div className="layout-settings">
            <h4>📐 Graph Layout & Spacing</h4>
            <div className="layout-controls">
              <div className="control-row">
                <label>V-Space:</label>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="10"
                  value={settings.layout.rankSep}
                  onChange={(e) => handleLayoutChange('rankSep', parseInt(e.target.value))}
                  className="layout-slider"
                />
                <span className="value-display">{settings.layout.rankSep}px</span>
              </div>

              <div className="control-row">
                <label>H-Space:</label>
                <input
                  type="range"
                  min="10"
                  max="150"
                  step="5"
                  value={settings.layout.nodeSep}
                  onChange={(e) => handleLayoutChange('nodeSep', parseInt(e.target.value))}
                  className="layout-slider"
                />
                <span className="value-display">{settings.layout.nodeSep}px</span>
              </div>

              <div className="control-row">
                <label>Edge:</label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={settings.layout.edgeSep}
                  onChange={(e) => handleLayoutChange('edgeSep', parseInt(e.target.value))}
                  className="layout-slider"
                />
                <span className="value-display">{settings.layout.edgeSep}px</span>
              </div>

              <div className="control-row">
                <label>Compact:</label>
                <input
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.1"
                  value={settings.layout.spacingFactor}
                  onChange={(e) => handleLayoutChange('spacingFactor', parseFloat(e.target.value))}
                  className="layout-slider"
                />
                <span className="value-display">{settings.layout.spacingFactor.toFixed(1)}x</span>
              </div>

              <div className="control-row">
                <label>Padding:</label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={settings.layout.padding}
                  onChange={(e) => handleLayoutChange('padding', parseInt(e.target.value))}
                  className="layout-slider"
                />
                <span className="value-display">{settings.layout.padding}px</span>
              </div>
            </div>
          </div>

          {/* Advanced Layout Settings */}
          <div className="advanced-layout-settings">
            <h4>🧭 Orientation & Algorithm</h4>
            <div className="advanced-controls">
              <div className="control-row">
                <label>Engine:</label>
                <select
                  value={settings.layout.name}
                  onChange={(e) => handleLayoutChange('name', e.target.value)}
                  className="layout-select"
                >
                  <option value="dagre">Dagre (Hierarchical)</option>
                  <option value="fcose">fCOSE (Force-Directed)</option>
                  <option value="cose">COSE (Spring)</option>
                  <option value="circle">Circle</option>
                  <option value="concentric">Concentric</option>
                  <option value="grid">Grid</option>
                  <option value="breadthfirst">Breadthfirst</option>
                </select>
              </div>

              {/* Dagre-specific options */}
              {settings.layout.name === 'dagre' && (
                <>
                  <div className="control-row">
                    <label>Direction:</label>
                    <select
                      value={settings.layout.rankDir}
                      onChange={(e) => handleLayoutChange('rankDir', e.target.value)}
                      className="layout-select"
                    >
                      <option value="TB">Top → Bottom</option>
                      <option value="BT">Bottom → Top</option>
                      <option value="LR">Left → Right</option>
                      <option value="RL">Right → Left</option>
                    </select>
                  </div>

                  <div className="control-row">
                    <label>Alignment:</label>
                    <select
                      value={settings.layout.align}
                      onChange={(e) => handleLayoutChange('align', e.target.value)}
                      className="layout-select"
                    >
                      <option value="">Auto</option>
                      <option value="UL">Up-Left</option>
                      <option value="UR">Up-Right</option>
                      <option value="DL">Down-Left</option>
                      <option value="DR">Down-Right</option>
                    </select>
                  </div>

                  <div className="control-row">
                    <label>Ranker:</label>
                    <select
                      value={settings.layout.ranker}
                      onChange={(e) => handleLayoutChange('ranker', e.target.value)}
                      className="layout-select"
                    >
                      <option value="network-simplex">Network Simplex</option>
                      <option value="tight-tree">Tight Tree</option>
                      <option value="longest-path">Longest Path</option>
                    </select>
                  </div>
                </>
              )}

              {/* fCOSE-specific options */}
              {settings.layout.name === 'fcose' && (
                <>
                  <div className="control-row">
                    <label>Edge Len:</label>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      step="10"
                      value={settings.layout.idealEdgeLength}
                      onChange={(e) => handleLayoutChange('idealEdgeLength', parseInt(e.target.value))}
                      className="layout-slider"
                    />
                    <span className="value-display">{settings.layout.idealEdgeLength}px</span>
                  </div>

                  <div className="control-row">
                    <label>Repulsion:</label>
                    <input
                      type="range"
                      min="1000"
                      max="10000"
                      step="500"
                      value={settings.layout.nodeRepulsion}
                      onChange={(e) => handleLayoutChange('nodeRepulsion', parseInt(e.target.value))}
                      className="layout-slider"
                    />
                    <span className="value-display">{settings.layout.nodeRepulsion}</span>
                  </div>

                  <div className="control-row">
                    <label>Gravity:</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.layout.gravity ?? 0.25}
                      onChange={(e) => handleLayoutChange('gravity', parseFloat(e.target.value))}
                      className="layout-slider"
                    />
                    <span className="value-display">{(settings.layout.gravity ?? 0.25).toFixed(2)}</span>
                  </div>

                  <div className="control-row">
                    <label>Iterations:</label>
                    <input
                      type="range"
                      min="500"
                      max="5000"
                      step="250"
                      value={settings.layout.numIter}
                      onChange={(e) => handleLayoutChange('numIter', parseInt(e.target.value))}
                      className="layout-slider"
                    />
                    <span className="value-display">{settings.layout.numIter}</span>
                  </div>
                </>
              )}

              <div className="control-row">
                <label>X-Margin:</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={settings.layout.marginX}
                  onChange={(e) => handleLayoutChange('marginX', parseInt(e.target.value))}
                  className="layout-slider"
                />
                <span className="value-display">{settings.layout.marginX}px</span>
              </div>

              <div className="control-row">
                <label>Y-Margin:</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={settings.layout.marginY}
                  onChange={(e) => handleLayoutChange('marginY', parseInt(e.target.value))}
                  className="layout-slider"
                />
                <span className="value-display">{settings.layout.marginY}px</span>
              </div>

              <div className="control-row">
                <label>Animate:</label>
                <input
                  type="checkbox"
                  checked={settings.layout.animate}
                  onChange={(e) => handleLayoutChange('animate', e.target.checked)}
                  className="layout-checkbox"
                />
              </div>

              <div className="control-row">
                <label>Anim Speed:</label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={settings.layout.animationDuration}
                  onChange={(e) => handleLayoutChange('animationDuration', parseInt(e.target.value))}
                  className="layout-slider"
                />
                <span className="value-display">{settings.layout.animationDuration}ms</span>
              </div>
            </div>
          </div>

          {/* Threshold Settings */}
          <div className="threshold-settings">
            <div className="threshold-header">
              <h4>📏 Size Thresholds</h4>
              <button onClick={handleReset} className="reset-button">
                🔄 Reset Defaults
              </button>
            </div>

            <div className="thresholds-list">
              {settings.thresholds.map((threshold, index) => (
                <div
                  key={index}
                  className={`threshold-item ${activeThresholdIndex === index ? 'active' : ''}`}
                >
                  <div className="threshold-condition">
                    {index === settings.thresholds.length - 1 ? (
                      <span className="threshold-label">
                        📊 {settings.thresholds[index - 1]?.nodeCount + 1 || 201}+ nodes:
                      </span>
                    ) : (
                      <span className="threshold-label">
                        📊 ≤{threshold.nodeCount} nodes:
                      </span>
                    )}
                  </div>

                  <div className="threshold-controls">
                    <div className="control-row">
                      <label>File:</label>
                      <input
                        type="range"
                        min="15"
                        max="80"
                        value={threshold.fileSize}
                        onChange={(e) => handleThresholdChange(index, 'fileSize', parseInt(e.target.value))}
                        className="size-slider"
                      />
                      <span className="value-display">{threshold.fileSize}px</span>
                    </div>

                    <div className="control-row">
                      <label>F-Width:</label>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={threshold.folderWidth}
                        onChange={(e) => handleThresholdChange(index, 'folderWidth', parseInt(e.target.value))}
                        className="size-slider"
                      />
                      <span className="value-display">{threshold.folderWidth}px</span>
                    </div>

                    <div className="control-row">
                      <label>F-Height:</label>
                      <input
                        type="range"
                        min="15"
                        max="60"
                        value={threshold.folderHeight}
                        onChange={(e) => handleThresholdChange(index, 'folderHeight', parseInt(e.target.value))}
                        className="size-slider"
                      />
                      <span className="value-display">{threshold.folderHeight}px</span>
                    </div>

                    <div className="control-row">
                      <label>Font:</label>
                      <input
                        type="range"
                        min="6"
                        max="20"
                        value={threshold.fontSize}
                        onChange={(e) => handleThresholdChange(index, 'fontSize', parseInt(e.target.value))}
                        className="size-slider"
                      />
                      <span className="value-display">{threshold.fontSize}px</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="settings-help">
            <p><strong>💡 Tips:</strong></p>
            <ul>
              <li><strong>Layout Controls:</strong> Adjust spacing to make graph more compact or spread out</li>
              <li><strong>Direction:</strong> Change graph orientation (TB=top-bottom, LR=left-right, etc.)</li>
              <li><strong>Algorithm:</strong> Network Simplex is fastest, Longest Path for hierarchical data</li>
              <li><strong>Size Thresholds:</strong> The active threshold (highlighted) determines current node sizes</li>
              <li>All changes apply instantly and are saved automatically</li>
            </ul>
          </div>
        </div>
      )}

      <style jsx>{`
        .graph-settings {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          margin-bottom: 16px;
          overflow: hidden;
        }


        .graph-settings.loading {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          color: #6b7280;
        }

        .loading-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f1f5f9;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .settings-header:hover {
          background: #e2e8f0;
        }

        .settings-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
          color: #1e293b;
        }

        .node-count-badge {
          background: #3b82f6;
          color: white;
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .settings-toggle {
          font-size: 12px;
          color: #64748b;
        }

        .settings-content {
          padding: 12px;
          max-height: 500px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 #f1f5f9;
        }

        .settings-content::-webkit-scrollbar {
          width: 8px;
        }

        .settings-content::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }

        .settings-content::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 4px;
        }

        .settings-content::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        .current-settings {
          margin-bottom: 16px;
          padding: 8px;
          background: white;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
        }

        .current-settings h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #374151;
        }

        .current-sizes {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          text-align: center;
        }

        .layout-settings {
          margin-bottom: 16px;
          padding: 10px;
          background: white;
          border-radius: 4px;
          border: 2px solid #3b82f6;
        }

        .layout-settings h4 {
          margin: 0 0 10px 0;
          font-size: 12px;
          color: #1e40af;
          font-weight: 600;
        }

        .layout-controls {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .advanced-layout-settings {
          margin-bottom: 16px;
          padding: 10px;
          background: white;
          border-radius: 4px;
          border: 2px solid #10b981;
        }

        .advanced-layout-settings h4 {
          margin: 0 0 10px 0;
          font-size: 12px;
          color: #047857;
          font-weight: 600;
        }

        .advanced-controls {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .control-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .control-row label {
          font-size: 10px;
          font-weight: 500;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          min-width: 50px;
          flex-shrink: 0;
        }

        .control-row .layout-slider,
        .control-row .size-slider {
          flex: 1;
        }

        .control-row .layout-select {
          flex: 1;
          padding: 2px 4px;
          border: 1px solid #d1d5db;
          border-radius: 3px;
          font-size: 10px;
          background: white;
          cursor: pointer;
        }

        .control-row .layout-checkbox {
          transform: scale(0.8);
          margin: 0;
        }

        .layout-slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: #dbeafe;
          outline: none;
          -webkit-appearance: none;
          cursor: pointer;
        }

        .layout-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
        }

        .layout-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
        }

        .size-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .size-label {
          font-size: 12px;
          color: #6b7280;
        }

        .size-value {
          font-weight: 600;
          font-family: monospace;
          color: #1e293b;
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .threshold-settings h4 {
          margin: 0 0 10px 0;
          font-size: 12px;
          color: #374151;
        }

        .threshold-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .reset-button {
          background: #ef4444;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reset-button:hover {
          background: #dc2626;
          transform: translateY(-1px);
        }

        .thresholds-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .threshold-item {
          padding: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          background: white;
          transition: all 0.2s;
        }

        .threshold-item.active {
          border-color: #3b82f6;
          background: #eff6ff;
          box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
        }

        .threshold-label {
          font-weight: 600;
          color: #374151;
          font-size: 13px;
        }

        .threshold-item.active .threshold-label {
          color: #1d4ed8;
        }

        .threshold-controls {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 8px;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .control-group label {
          font-size: 10px;
          font-weight: 500;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .size-slider {
          width: 100%;
          height: 4px;
          border-radius: 2px;
          background: #e5e7eb;
          outline: none;
          -webkit-appearance: none;
          cursor: pointer;
        }

        .size-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .size-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .value-display {
          font-size: 11px;
          font-family: monospace;
          color: #374151;
          background: #f9fafb;
          padding: 2px 6px;
          border-radius: 3px;
          text-align: center;
          min-width: 40px;
        }

        .settings-help {
          margin-top: 12px;
          padding: 6px 8px;
          background: #fef3c7;
          border: 1px solid #fbbf24;
          border-radius: 4px;
          font-size: 10px;
        }

        .settings-help p {
          margin: 0 0 4px 0;
          color: #92400e;
          font-weight: 600;
        }

        .settings-help ul {
          margin: 0;
          padding-left: 12px;
          color: #a16207;
        }

        .settings-help li {
          margin-bottom: 2px;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .threshold-controls {
            grid-template-columns: 1fr;
          }

          .current-sizes {
            flex-direction: column;
            align-items: center;
          }
        }
      `}</style>
    </div>
  );
};