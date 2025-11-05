import { getNodeMetrics, NodeMetrics, hasEnhancedMetrics, AnalysisResult } from '../types/Dependency';
import { CytoscapeNodeData, CytoscapeEdgeData } from './cytoscapeTransforms';

/**
 * Generate HTML tooltip content for a graph node
 */
export function generateNodeTooltipHTML(
  nodeData: CytoscapeNodeData,
  analysisResult?: AnalysisResult,
  isCompareMode?: boolean,
  diffStatus?: 'added' | 'removed' | 'unchanged' | null
): string {
  const isFile = nodeData.type === 'file';
  const icon = isFile ? '📄' : '📁';
  const hasMetrics = analysisResult && hasEnhancedMetrics(analysisResult);

  let html = `
    <div style="
      background: white;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 12px;
      min-width: 250px;
      max-width: 350px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    ">
      <div style="font-weight: 600; margin-bottom: 8px; color: #1e293b; display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 16px;">${icon}</span>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;">${nodeData.label}</span>
      </div>
  `;

  // Compare mode status
  if (isCompareMode && diffStatus) {
    const statusInfo = {
      added: { text: '✨ NEW', color: '#22c55e', bg: '#f0fdf4' },
      removed: { text: '🗑️ REMOVED', color: '#ef4444', bg: '#fef2f2' },
      unchanged: { text: '✓ Unchanged', color: '#64748b', bg: '#f8fafc' }
    }[diffStatus];

    html += `
      <div style="
        background: ${statusInfo.bg};
        color: ${statusInfo.color};
        padding: 4px 8px;
        border-radius: 4px;
        margin-bottom: 8px;
        font-weight: 600;
        font-size: 12px;
      ">
        ${statusInfo.text}
      </div>
    `;
  }

  // Metrics section
  if (hasMetrics) {
    const metrics = getNodeMetrics(analysisResult, nodeData.path);

    if (metrics) {
      html += `
        <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;">
          <div style="font-weight: 600; color: #64748b; margin-bottom: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
            📊 Metrics
          </div>
      `;

      // SLOC
      if (metrics.sloc !== undefined) {
        html += `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Lines of Code:</span>
            <span style="font-weight: 600; color: #1e293b;">${metrics.sloc.toLocaleString()}</span>
          </div>
        `;
      }

      // Instability
      if (metrics.instability !== undefined) {
        const instabilityPercent = (metrics.instability * 100).toFixed(0);
        const instabilityColor =
          metrics.instability < 0.3 ? '#22c55e' :
          metrics.instability < 0.7 ? '#f59e0b' : '#ef4444';
        const instabilityLabel =
          metrics.instability < 0.3 ? 'Stable' :
          metrics.instability < 0.7 ? 'Moderate' : 'Unstable';

        html += `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Instability:</span>
            <span style="font-weight: 600; color: ${instabilityColor};">${instabilityPercent}% (${instabilityLabel})</span>
          </div>
        `;
      }

      // Dependencies
      if (metrics.in_degree !== undefined && metrics.out_degree !== undefined) {
        html += `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Dependencies:</span>
            <span style="font-weight: 600; color: #1e293b;">
              ${metrics.in_degree} in, ${metrics.out_degree} out
            </span>
          </div>
        `;
      }

      html += `</div>`;

      // Warnings section
      const warnings = [];
      if (metrics.is_orphan) warnings.push('⚠️ Orphaned file');
      if (metrics.in_cycle) warnings.push(`🔄 In cycle #${metrics.cycle_id || '?'}`);

      if (warnings.length > 0) {
        html += `
          <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;">
            ${warnings.map(w => `
              <div style="
                background: #fef3c7;
                color: #92400e;
                padding: 4px 8px;
                border-radius: 4px;
                margin-bottom: 4px;
                font-size: 12px;
                font-weight: 500;
              ">${w}</div>
            `).join('')}
          </div>
        `;
      }
    }
  } else {
    // Basic info when no enhanced metrics
    html += `
      <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;">
        <div style="color: #64748b; font-size: 12px;">
          ${isFile ? 'File' : 'Folder'} • ${nodeData.isExpanded ? 'Expanded' : 'Collapsed'}
        </div>
      </div>
    `;
  }

  html += `
      <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 8px; font-size: 11px; color: #94a3b8;">
        Click for full details
      </div>
    </div>
  `;

  return html;
}

/**
 * Generate HTML tooltip content for a graph edge
 */
export function generateEdgeTooltipHTML(
  edgeData: CytoscapeEdgeData,
  isCompareMode?: boolean
): string {
  // Extract file names from full paths
  const sourceName = edgeData.source.split('/').pop() || edgeData.source;
  const targetName = edgeData.target.split('/').pop() || edgeData.target;

  let html = `
    <div style="
      background: white;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 12px;
      min-width: 250px;
      max-width: 350px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    ">
      <div style="font-weight: 600; margin-bottom: 8px; color: #1e293b;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span>📄 ${sourceName}</span>
        </div>
        <div style="text-align: center; color: #64748b; font-size: 18px;">↓</div>
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
          <span>📄 ${targetName}</span>
        </div>
      </div>
  `;

  // Compare mode status
  if (isCompareMode && edgeData.diffStatus) {
    const statusInfo = {
      added: { text: '✨ NEW dependency', color: '#22c55e', bg: '#f0fdf4' },
      removed: { text: '🗑️ REMOVED dependency', color: '#ef4444', bg: '#fef2f2' },
      unchanged: { text: '✓ Stable dependency', color: '#64748b', bg: '#f8fafc' }
    }[edgeData.diffStatus];

    html += `
      <div style="
        background: ${statusInfo.bg};
        color: ${statusInfo.color};
        padding: 6px 10px;
        border-radius: 4px;
        margin-bottom: 8px;
        font-weight: 600;
        font-size: 12px;
        text-align: center;
      ">
        ${statusInfo.text}
      </div>
    `;
  }

  // Edge details
  html += `
    <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="color: #64748b;">Relationship:</span>
        <span style="font-weight: 600; color: #1e293b;">${edgeData.relationshipType}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="color: #64748b;">Weight:</span>
        <span style="font-weight: 600; color: #1e293b;">${edgeData.weight} reference${edgeData.weight > 1 ? 's' : ''}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #64748b;">Type:</span>
        <span style="font-weight: 600; color: #1e293b;">Direct dependency</span>
      </div>
    </div>
  `;

  html += `
    </div>
  `;

  return html;
}

/**
 * Generate simple text tooltip for tree panel nodes
 */
export function generateTreeNodeTooltip(
  nodeLabel: string,
  nodeType: 'file' | 'folder',
  childCount?: number,
  aggregatedSLOC?: number,
  checkboxState?: 'checked' | 'unchecked' | 'half-checked'
): string {
  const parts = [];

  if (nodeType === 'folder' && childCount !== undefined) {
    parts.push(`${childCount} file${childCount !== 1 ? 's' : ''}`);
  }

  if (aggregatedSLOC !== undefined) {
    parts.push(`${aggregatedSLOC.toLocaleString()} SLOC`);
  }

  if (checkboxState) {
    const stateText = {
      'checked': 'Fully visible',
      'unchecked': 'Hidden',
      'half-checked': 'Partially visible'
    }[checkboxState];
    parts.push(stateText);
  }

  return parts.length > 0 ? parts.join(' • ') : nodeLabel;
}
