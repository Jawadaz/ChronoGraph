import React, { useState } from 'react';
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'metrics']));

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

  // Extract filename from path
  const fileName = selectedNodeId.split('/').pop() || selectedNodeId;
  const isFile = fileName.includes('.');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  return (
    <div className="node-details-panel">
      <div className="panel-header">
        <h3 className="panel-title">
          {isFile ? '📄' : '📁'} {fileName}
        </h3>
        <button
          className="close-button"
          onClick={onClose}
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="panel-content">
        {/* Overview Section - Always shown */}
        <Section
          title="Overview"
          icon="📋"
          isExpanded={expandedSections.has('overview')}
          onToggle={() => toggleSection('overview')}
        >
          <InfoRow label="Type" value={isFile ? 'File' : 'Folder'} />
          <InfoRow label="Path" value={selectedNodeId} mono />
          <InfoRow label="Dependencies" value={`${incomingDeps.length} in, ${outgoingDeps.length} out`} />
        </Section>

        {/* Metrics Section */}
        {hasEnhanced && nodeMetrics && globalMetrics && (
          <Section
            title="Metrics"
            icon="📊"
            isExpanded={expandedSections.has('metrics')}
            onToggle={() => toggleSection('metrics')}
          >
            <InfoRow label="SLOC" value={nodeMetrics.sloc.toLocaleString()} highlight />
            <InfoRow
              label="Instability"
              value={`${(nodeMetrics.instability * 100).toFixed(1)}%`}
              valueClass={getInstabilityClass(nodeMetrics.instability)}
            />
            <InfoRow label="In/Out Degree" value={`${nodeMetrics.in_degree} / ${nodeMetrics.out_degree}`} />
            {'fan_in' in nodeMetrics && (
              <InfoRow label="Fan In/Out" value={`${(nodeMetrics as any).fan_in} / ${(nodeMetrics as any).fan_out}`} />
            )}
            {visualEncoding && (
              <InfoRow
                label="Quality"
                value={`${getQualityEmoji(visualEncoding.quality_indicator)} ${visualEncoding.quality_indicator}`}
                valueClass={`quality-${visualEncoding.quality_indicator}`}
              />
            )}
          </Section>
        )}

        {/* Warnings Section */}
        {hasEnhanced && nodeMetrics && (nodeMetrics.is_orphan || nodeMetrics.in_cycle) && (
          <Section
            title="Warnings"
            icon="⚠️"
            isExpanded={expandedSections.has('warnings')}
            onToggle={() => toggleSection('warnings')}
          >
            {nodeMetrics.is_orphan && (
              <div className="warning-item">
                <span className="warning-icon">🔸</span>
                <span>Orphaned node (no dependencies)</span>
              </div>
            )}
            {nodeMetrics.in_cycle && (
              <div className="error-item">
                <span className="error-icon">🔄</span>
                <span>In dependency cycle{nodeMetrics.cycle_id && ` #${nodeMetrics.cycle_id}`}</span>
              </div>
            )}
          </Section>
        )}

        {/* Dependencies Section */}
        {(incomingDeps.length > 0 || outgoingDeps.length > 0) && (
          <Section
            title="Dependencies"
            icon="🔗"
            isExpanded={expandedSections.has('dependencies')}
            onToggle={() => toggleSection('dependencies')}
          >
            {incomingDeps.length > 0 && (
              <DependencyList
                title={`← Incoming (${incomingDeps.length})`}
                deps={incomingDeps}
                type="incoming"
              />
            )}
            {outgoingDeps.length > 0 && (
              <DependencyList
                title={`→ Outgoing (${outgoingDeps.length})`}
                deps={outgoingDeps}
                type="outgoing"
              />
            )}
          </Section>
        )}

        {!hasEnhanced && (
          <div className="info-message">
            <div className="info-icon">ℹ️</div>
            <div>
              <strong>Enhanced metrics unavailable</strong>
              <p>Re-analyze to get SLOC, instability, and quality metrics</p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .node-details-panel {
          position: relative;
          width: 100%;
          height: 100%;
          background: white;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          background: #f8fafc;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
        }

        .panel-title {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #1e293b;
        }

        .close-button {
          background: #ef4444;
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .close-button:hover {
          background: #dc2626;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 0;
        }

        .info-message {
          margin: 16px;
          padding: 16px;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          display: flex;
          gap: 12px;
          align-items: start;
        }

        .info-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .info-message strong {
          display: block;
          margin-bottom: 4px;
          color: #92400e;
          font-size: 13px;
        }

        .info-message p {
          margin: 0;
          font-size: 12px;
          color: #78350f;
          line-height: 1.4;
        }

        .warning-item,
        .error-item {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .warning-item {
          background: #fef3c7;
          color: #78350f;
        }

        .error-item {
          background: #fee2e2;
          color: #7f1d1d;
        }

        .warning-icon,
        .error-icon {
          font-size: 14px;
          flex-shrink: 0;
        }

        /* Scrollbar */
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

// Collapsible Section Component
interface SectionProps {
  title: string;
  icon: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, isExpanded, onToggle, children }) => (
  <div className="section">
    <div className="section-header" onClick={onToggle}>
      <span className="section-title">
        <span className="section-icon">{icon}</span>
        {title}
      </span>
      <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
    </div>
    {isExpanded && <div className="section-content">{children}</div>}

    <style jsx>{`
      .section {
        border-bottom: 1px solid #f0f0f0;
      }

      .section-header {
        padding: 10px 12px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #fafafa;
        transition: background 0.15s;
        user-select: none;
      }

      .section-header:hover {
        background: #f0f0f0;
      }

      .section-title {
        font-size: 13px;
        font-weight: 600;
        color: #374151;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .section-icon {
        font-size: 14px;
      }

      .expand-icon {
        font-size: 10px;
        color: #9ca3af;
      }

      .section-content {
        padding: 12px;
      }
    `}</style>
  </div>
);

// Info Row Component
interface InfoRowProps {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  valueClass?: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, mono, highlight, valueClass }) => (
  <div className="info-row">
    <span className="label">{label}</span>
    <span className={`value ${mono ? 'mono' : ''} ${highlight ? 'highlight' : ''} ${valueClass || ''}`}>
      {value}
    </span>

    <style jsx>{`
      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 8px;
        font-size: 12px;
      }

      .info-row:last-child {
        margin-bottom: 0;
      }

      .label {
        color: #64748b;
        font-weight: 500;
      }

      .value {
        color: #1e293b;
        font-weight: 600;
        text-align: right;
        word-break: break-word;
      }

      .value.mono {
        font-family: 'Consolas', 'Courier New', monospace;
        font-size: 11px;
        color: #475569;
        font-weight: 400;
      }

      .value.highlight {
        color: #3b82f6;
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
      }

      .value.quality-good {
        color: #3b82f6;
      }

      .value.quality-poor {
        color: #f59e0b;
      }

      .value.quality-critical {
        color: #ef4444;
      }
    `}</style>
  </div>
);

// Dependency List Component
interface DependencyListProps {
  title: string;
  deps: Array<{ source_file: string; target_file: string; relationship_type: string }>;
  type: 'incoming' | 'outgoing';
}

const DependencyList: React.FC<DependencyListProps> = ({ title, deps, type }) => {
  const maxShow = 5;
  const showMore = deps.length > maxShow;

  return (
    <div className="dep-list">
      <h5>{title}</h5>
      {deps.slice(0, maxShow).map((dep, index) => (
        <div key={index} className={`dep-item ${type}`}>
          <span className="dep-file">
            {(type === 'incoming' ? dep.source_file : dep.target_file).split('/').pop()}
          </span>
          <span className="dep-type">{dep.relationship_type}</span>
        </div>
      ))}
      {showMore && (
        <div className="more-indicator">+{deps.length - maxShow} more</div>
      )}

      <style jsx>{`
        .dep-list {
          margin-bottom: 16px;
        }

        .dep-list:last-child {
          margin-bottom: 0;
        }

        h5 {
          margin: 0 0 8px 0;
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .dep-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .dep-item.incoming {
          background: #fef3cd;
          border-left: 3px solid #f59e0b;
        }

        .dep-item.outgoing {
          background: #dcfce7;
          border-left: 3px solid #22c55e;
        }

        .dep-file {
          font-weight: 600;
          color: #374151;
          font-family: 'Consolas', 'Courier New', monospace;
        }

        .dep-type {
          font-size: 9px;
          color: #6b7280;
          text-transform: uppercase;
        }

        .more-indicator {
          text-align: center;
          font-size: 10px;
          color: #9ca3af;
          font-style: italic;
          padding: 4px;
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
