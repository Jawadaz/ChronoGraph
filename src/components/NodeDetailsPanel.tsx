import React from 'react';
import {
  AnalysisResult,
  hasEnhancedMetrics,
  getNodeMetrics,
  calculateVisualEncoding,
  VisualEncodingConfig,
  getArchitectureQualityDescription
} from '../types/Dependency';

interface NodeDetailsPanelProps {
  selectedNodeId: string | null;
  analysisResult?: AnalysisResult;
  visualEncodingConfig?: VisualEncodingConfig;
  onClose: () => void;
}

export const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
  selectedNodeId,
  analysisResult,
  visualEncodingConfig = {
    enable_size_encoding: true,
    enable_color_encoding: true,
    size_scaling_factor: 1.0,
    color_intensity: 1.0,
    highlight_orphans: true,
    highlight_cycles: true
  },
  onClose
}) => {
  if (!selectedNodeId) {
    return null;
  }

  const hasEnhanced = analysisResult && hasEnhancedMetrics(analysisResult);
  const nodeMetrics = hasEnhanced ? getNodeMetrics(analysisResult, selectedNodeId) : null;
  const globalMetrics = hasEnhanced ? analysisResult.global_metrics : null;

  const visualEncoding = nodeMetrics && globalMetrics
    ? calculateVisualEncoding(nodeMetrics, globalMetrics, visualEncodingConfig)
    : null;

  // Get basic dependency information with path normalization
  const dependencies = analysisResult?.dependencies || [];

  // Normalize the selected node ID for comparison
  const normalizePathForComparison = (path: string) => {
    return path.replace(/\\/g, '/').replace(/^\/+/, '');
  };

  const normalizedSelectedId = normalizePathForComparison(selectedNodeId);

  const incomingDeps = dependencies.filter(dep => {
    const normalizedTarget = normalizePathForComparison(dep.target_file);
    return normalizedTarget === normalizedSelectedId ||
           normalizedTarget.endsWith('/' + normalizedSelectedId);
  });

  const outgoingDeps = dependencies.filter(dep => {
    const normalizedSource = normalizePathForComparison(dep.source_file);
    return normalizedSource === normalizedSelectedId ||
           normalizedSource.endsWith('/' + normalizedSelectedId);
  });

  // Debug logging for dependency matching
  console.log('🔍 NodeDetailsPanel Debug:', {
    selectedNodeId,
    totalDependencies: dependencies.length,
    incomingCount: incomingDeps.length,
    outgoingCount: outgoingDeps.length,
    sampleDependency: dependencies[0],
    hasEnhanced,
    nodeMetrics: nodeMetrics ? 'present' : 'missing'
  });

  // Debug: Force cache clear if no enhanced metrics
  React.useEffect(() => {
    if (!hasEnhanced && dependencies.length > 0) {
      console.log('🔧 No enhanced metrics detected, clearing cache...');
      // Call Tauri command to clear cache
      (window as any).__TAURI__?.invoke('clear_all_cache').then((result: number) => {
        console.log(`🔧 Cache cleared: ${result} entries removed`);
        console.log('🔧 Please refresh the analysis to get enhanced metrics');
      }).catch((error: any) => {
        console.error('Failed to clear cache:', error);
      });
    }
  }, [hasEnhanced, dependencies.length]);

  // Extract filename from path
  const fileName = selectedNodeId.split('/').pop() || selectedNodeId;
  const isFile = fileName.includes('.');

  // Calculate file count for folders
  const fileCount = !isFile && analysisResult?.analyzed_files
    ? analysisResult.analyzed_files.filter(file => {
        const normalizedFile = file.replace(/\\/g, '/').replace(/^\/+/, '');
        const normalizedFolder = selectedNodeId.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        return normalizedFile === normalizedFolder || normalizedFile.startsWith(normalizedFolder + '/');
      }).length
    : 0;

  return (
    <div className="node-details-panel">
      <div className="panel-header">
        <h3 className="panel-title">
          {isFile ? '📄' : '📁'} {fileName}
        </h3>
        <button
          className="close-button"
          onClick={onClose}
          title="Close details panel"
        >
          ✕
        </button>
      </div>

      <div className="panel-content">
        <div className="section compact">
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Type:</span>
              <span className="value">{isFile ? 'File' : 'Folder'}</span>
            </div>
            <div className="info-item">
              <span className="label">Path:</span>
              <span className="value path">{selectedNodeId}</span>
            </div>
            {hasEnhanced && nodeMetrics && (
              <div className="info-item">
                <span className="label">SLOC:</span>
                <span className="value highlight">{nodeMetrics.sloc.toLocaleString()}</span>
              </div>
            )}
            {!isFile && fileCount > 0 && (
              <div className="info-item">
                <span className="label">Files:</span>
                <span className="value highlight">{fileCount.toLocaleString()}</span>
              </div>
            )}
            <div className="info-item">
              <span className="label">Incoming:</span>
              <span className="value">{incomingDeps.length}</span>
            </div>
            <div className="info-item">
              <span className="label">Outgoing:</span>
              <span className="value">{outgoingDeps.length}</span>
            </div>
          </div>
        </div>

        {hasEnhanced && nodeMetrics && globalMetrics && (
          <>
            <div className="section compact">
              <h4>📈 Lakos Metrics</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Component Dependency:</span>
                  <span className="value">{nodeMetrics.component_dependency}</span>
                </div>
                <div className="info-item">
                  <span className="label">In-Degree:</span>
                  <span className="value">{nodeMetrics.in_degree}</span>
                </div>
                <div className="info-item">
                  <span className="label">Out-Degree:</span>
                  <span className="value">{nodeMetrics.out_degree}</span>
                </div>
                <div className="info-item">
                  <span className="label">Instability:</span>
                  <span className={`value ${getInstabilityClass(nodeMetrics.instability)}`}>
                    {(nodeMetrics.instability * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="section">
              <h4>🎯 Architecture Quality</h4>
              <div className="info-grid">
                {nodeMetrics.is_orphan && (
                  <div className="info-item warning">
                    <span className="label">⚠️ Orphan Node:</span>
                    <span className="value">This node has no dependencies</span>
                  </div>
                )}
                {nodeMetrics.in_cycle && (
                  <div className="info-item error">
                    <span className="label">🔄 In Cycle:</span>
                    <span className="value">
                      This node participates in a dependency cycle
                      {nodeMetrics.cycle_id && ` (Cycle ${nodeMetrics.cycle_id})`}
                    </span>
                  </div>
                )}
                {visualEncoding && (
                  <div className="info-item">
                    <span className="label">Quality Rating:</span>
                    <span className={`value quality-${visualEncoding.quality_indicator}`}>
                      {getQualityEmoji(visualEncoding.quality_indicator)} {visualEncoding.quality_indicator.charAt(0).toUpperCase() + visualEncoding.quality_indicator.slice(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="section">
              <h4>🎨 Visual Encoding</h4>
              <div className="info-grid">
                {visualEncoding && (
                  <>
                    <div className="info-item">
                      <span className="label">Size Factor:</span>
                      <span className="value">{visualEncoding.size_factor.toFixed(2)}x</span>
                    </div>
                    <div className="info-item">
                      <span className="label">SLOC vs Average:</span>
                      <span className="value">
                        {((nodeMetrics.sloc / globalMetrics.average_sloc) * 100).toFixed(0)}% of average
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="label">Color Hue:</span>
                      <span className="value">
                        <span
                          className="color-indicator"
                          style={{
                            backgroundColor: `hsl(${visualEncoding.color_hue}, 70%, 50%)`,
                            display: 'inline-block',
                            width: '16px',
                            height: '16px',
                            borderRadius: '3px',
                            marginRight: '8px',
                            border: '1px solid #ddd'
                          }}
                        />
                        {Math.round(visualEncoding.color_hue)}°
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="section">
              <h4>📊 Context Metrics</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Project Total SLOC:</span>
                  <span className="value">{globalMetrics.total_sloc.toLocaleString()}</span>
                </div>
                <div className="info-item">
                  <span className="label">Project Average SLOC:</span>
                  <span className="value">{Math.round(globalMetrics.average_sloc).toLocaleString()}</span>
                </div>
                <div className="info-item">
                  <span className="label">This File's Share:</span>
                  <span className="value">
                    {((nodeMetrics.sloc / globalMetrics.total_sloc) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Project Quality Score:</span>
                  <span className="value">
                    {getArchitectureQualityDescription(analysisResult.architecture_quality_score)}
                    {analysisResult.architecture_quality_score && (
                      <span className="score">
                        {' '}({(analysisResult.architecture_quality_score * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {!hasEnhanced && (
          <div className="section">
            <div className="info-message">
              <h4>ℹ️ Enhanced Metrics Unavailable</h4>
              <p>
                Enhanced Lakos metrics (SLOC, instability, architecture quality) are not available for this analysis.
                To get comprehensive metrics, ensure your project is analyzed with the enhanced Lakos analyzer.
              </p>
            </div>
          </div>
        )}

        {(incomingDeps.length > 0 || outgoingDeps.length > 0) && (
          <div className="section">
            <h4>🔗 Dependencies</h4>

            {incomingDeps.length > 0 && (
              <div className="dependency-section">
                <h5>← Incoming ({incomingDeps.length})</h5>
                <div className="dependency-list">
                  {incomingDeps.slice(0, 10).map((dep, index) => (
                    <div key={index} className="dependency-item incoming">
                      <span className="dependency-file">
                        {dep.source_file.split('/').pop()}
                      </span>
                      <span className="dependency-type">{dep.relationship_type}</span>
                    </div>
                  ))}
                  {incomingDeps.length > 10 && (
                    <div className="more-indicator">
                      ... and {incomingDeps.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {outgoingDeps.length > 0 && (
              <div className="dependency-section">
                <h5>→ Outgoing ({outgoingDeps.length})</h5>
                <div className="dependency-list">
                  {outgoingDeps.slice(0, 10).map((dep, index) => (
                    <div key={index} className="dependency-item outgoing">
                      <span className="dependency-file">
                        {dep.target_file.split('/').pop()}
                      </span>
                      <span className="dependency-type">{dep.relationship_type}</span>
                    </div>
                  ))}
                  {outgoingDeps.length > 10 && (
                    <div className="more-indicator">
                      ... and {outgoingDeps.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .node-details-panel {
          position: relative;
          width: 100%;
          height: 100%;
          background: white;
          border-top: 1px solid #e2e8f0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          background: #f8fafc;
          color: #374151;
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .panel-title {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 320px;
        }

        .close-button {
          background: #ef4444;
          border: none;
          color: white;
          width: 22px;
          height: 22px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .close-button:hover {
          background: #dc2626;
          transform: scale(1.1);
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 0;
        }

        .section {
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
        }

        .section.compact {
          padding: 12px 16px;
        }

        .section:last-child {
          border-bottom: none;
        }

        .section h4 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .section h5 {
          margin: 0 0 12px 0;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .section.compact .info-grid {
          gap: 4px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 4px 0;
        }

        .section.compact .info-item {
          padding: 2px 0;
        }

        .info-item.warning {
          background: #fef3cd;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          padding: 12px;
          margin: 4px 0;
        }

        .info-item.error {
          background: #fee2e2;
          border: 1px solid #ef4444;
          border-radius: 6px;
          padding: 12px;
          margin: 4px 0;
        }

        .label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
          flex-shrink: 0;
          min-width: 140px;
        }

        .value {
          font-size: 12px;
          color: #111827;
          font-weight: 600;
          text-align: right;
          word-break: break-word;
        }

        .value.path {
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 11px;
          color: #4b5563;
          font-weight: 400;
        }

        .value.highlight {
          color: #3b82f6;
          font-weight: 700;
        }

        .value.stable {
          color: #22c55e;
        }

        .value.moderate {
          color: #f59e0b;
        }

        .value.unstable {
          color: #ef4444;
        }

        .value.quality-excellent {
          color: #22c55e;
          font-weight: 700;
        }

        .value.quality-good {
          color: #3b82f6;
          font-weight: 600;
        }

        .value.quality-poor {
          color: #f59e0b;
          font-weight: 600;
        }

        .value.quality-critical {
          color: #ef4444;
          font-weight: 700;
        }

        .score {
          font-size: 10px;
          color: #6b7280;
          font-weight: 400;
        }

        .info-message {
          text-align: center;
          padding: 20px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .info-message h4 {
          color: #4b5563;
          margin-bottom: 8px;
        }

        .info-message p {
          color: #6b7280;
          font-size: 12px;
          line-height: 1.5;
          margin: 0;
        }

        .dependency-section {
          margin-bottom: 20px;
        }

        .dependency-section:last-child {
          margin-bottom: 0;
        }

        .dependency-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .dependency-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 11px;
        }

        .dependency-item.incoming {
          background: #fef3cd;
          border-left: 3px solid #f59e0b;
        }

        .dependency-item.outgoing {
          background: #dcfce7;
          border-left: 3px solid #22c55e;
        }

        .dependency-file {
          font-weight: 600;
          color: #374151;
          font-family: 'Consolas', 'Courier New', monospace;
        }

        .dependency-type {
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .more-indicator {
          text-align: center;
          font-size: 11px;
          color: #6b7280;
          font-style: italic;
          padding: 8px;
        }

        .color-indicator {
          vertical-align: middle;
        }

        /* Scrollbar styling */
        .panel-content::-webkit-scrollbar {
          width: 6px;
        }

        .panel-content::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        .panel-content::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .panel-content::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

function getInstabilityClass(instability: number): string {
  if (instability < 0.3) return 'stable';
  if (instability < 0.7) return 'moderate';
  return 'unstable';
}

function getQualityEmoji(quality: string): string {
  switch (quality) {
    case 'excellent': return '🟢';
    case 'good': return '🔵';
    case 'poor': return '🟡';
    case 'critical': return '🔴';
    default: return '⚪';
  }
}