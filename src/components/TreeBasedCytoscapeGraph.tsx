import React, { useRef, useEffect, useState, useMemo } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';

import { Dependency, AnalysisResult, hasEnhancedMetrics, getNodeMetrics, calculateVisualEncoding, VisualEncodingConfig } from '../types/Dependency';
import { TreeNode } from '../utils/treeStructure';
import { transformToTreeBasedGraphElements } from '../utils/treeBasedGraphTransforms';
import { GraphSettings } from './GraphSettings';
import { useGraphSettings } from '../hooks/useGraphSettings';

// Register layouts
cytoscape.use(dagre);
cytoscape.use(fcose);

interface TreeBasedCytoscapeGraphProps {
  dependencies: Dependency[];
  treeNodes: Map<string, TreeNode>;
  treeVersion?: number;
  analysisResult?: AnalysisResult;
  visualEncodingConfig?: VisualEncodingConfig;
  onNodeSelect?: (nodeId: string) => void;
  onEdgeDoubleClick?: (sourceId: string, targetId: string, relationshipTypes: string[]) => void;
  hoveredNodeId?: string | null;
  onNodeHover?: (nodeId: string | null) => void;
  onToggleFolderExpansion?: (nodeId: string) => void;
}

export const TreeBasedCytoscapeGraph: React.FC<TreeBasedCytoscapeGraphProps> = ({
  dependencies,
  treeNodes,
  treeVersion,
  analysisResult,
  visualEncodingConfig = {
    enable_size_encoding: true,
    enable_color_encoding: true,
    size_scaling_factor: 1.0,
    color_intensity: 1.0,
    highlight_orphans: true,
    highlight_cycles: true
  },
  onNodeSelect,
  onEdgeDoubleClick,
  hoveredNodeId,
  onNodeHover,
  onToggleFolderExpansion
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { calculateSizes, settings } = useGraphSettings();
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || isInitialized) return;
    const cy = cytoscape({
      container: containerRef.current,

      // Enable compound nodes for hierarchical containers
      compound: true,

      // Initial empty state
      elements: [],

      // Layout configuration optimized for hierarchical trees
      layout: {
        name: 'dagre',
        directed: true,
        padding: 20,
        spacingFactor: 1.5,
        nodeDimensionsIncludeLabels: true,
        animate: true,
        animationDuration: 500,
        fit: true,
        // Dagre-specific options for tree layout
        rankDir: 'TB', // Top to bottom
        rankSep: 80,   // Vertical spacing between ranks
        nodeSep: 60,   // Horizontal spacing between nodes
        edgeSep: 20    // Spacing between edges
      },

      // Interaction settings
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,

      // Styling - will be updated with actual node count
      style: []
    });

    cyRef.current = cy;
    setIsInitialized(true);

    // Event handlers
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeData = node.data();

      if (onNodeSelect) {
        onNodeSelect(nodeData.id);
      }

      console.log('🎯 Node selected:', {
        id: nodeData.id,
        label: nodeData.label,
        type: nodeData.type,
        isLeaf: nodeData.isLeaf
      });
    });

    // Double-click on folder nodes to toggle expansion
    cy.on('dblclick', 'node', (event) => {
      const node = event.target;
      const nodeData = node.data();

      // Only handle folders (compound nodes)
      if (nodeData.type === 'folder' && onToggleFolderExpansion) {
        onToggleFolderExpansion(nodeData.id);
      }
    });

    cy.on('dblclick', 'edge', (event) => {
      const edge = event.target;
      const edgeData = edge.data();

      if (onEdgeDoubleClick) {
        onEdgeDoubleClick(
          edgeData.source,
          edgeData.target,
          [edgeData.relationshipType]
        );
      }

      console.log('🔗 Edge double-clicked:', {
        source: edgeData.source,
        target: edgeData.target,
        type: edgeData.relationshipType
      });
    });

    // Hover effects for nodes
    cy.on('mouseover', 'node', (event) => {
      const node = event.target;
      const nodeId = node.id();

      // Notify parent about hover
      if (onNodeHover) {
        onNodeHover(nodeId);
      }

      // Reset all elements first
      cy.elements().removeClass('highlighted-incoming highlighted-outgoing highlighted-source highlighted-target highlighted-hover');

      // Get connected edges
      const connectedEdges = node.connectedEdges();
      const incomingEdges = connectedEdges.filter(edge => edge.target().id() === nodeId);
      const outgoingEdges = connectedEdges.filter(edge => edge.source().id() === nodeId);

      // Highlight incoming connections (dependencies on this node)
      incomingEdges.addClass('highlighted-incoming');
      incomingEdges.sources().addClass('highlighted-source');

      // Highlight outgoing connections (this node depends on)
      outgoingEdges.addClass('highlighted-outgoing');
      outgoingEdges.targets().addClass('highlighted-target');

      // Highlight the hovered node itself
      node.addClass('highlighted-hover');
    });

    cy.on('mouseout', 'node', (event) => {
      // Notify parent about hover end
      if (onNodeHover) {
        onNodeHover(null);
      }

      // Remove all highlighting
      cy.elements().removeClass('highlighted-incoming highlighted-outgoing highlighted-source highlighted-target highlighted-hover');
    });

    // Hover effects for edges
    cy.on('mouseover', 'edge', (event) => {
      const edge = event.target;

      // Reset all elements first
      cy.elements().removeClass('highlighted-incoming highlighted-outgoing highlighted-source highlighted-target highlighted-hover');

      // Highlight the edge itself
      edge.addClass('highlighted-hover');

      // Highlight source and target nodes
      edge.source().addClass('highlighted-source');
      edge.target().addClass('highlighted-target');
    });

    cy.on('mouseout', 'edge', (event) => {
      // Remove all highlighting
      cy.elements().removeClass('highlighted-incoming highlighted-outgoing highlighted-source highlighted-target highlighted-hover');
    });

    // Cleanup
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
        setIsInitialized(false);
      }
    };
  }, []);

  // Update graph when tree state changes
  useEffect(() => {
    if (!cyRef.current || treeNodes.size === 0) return;

    console.log('🔄 Updating tree-based graph:', {
      dependencies: dependencies.length,
      treeNodes: treeNodes.size,
      checkedNodes: Array.from(treeNodes.values()).filter(n => n.checkboxState === 'checked').length,
      halfCheckedNodes: Array.from(treeNodes.values()).filter(n => n.checkboxState === 'half-checked').length
    });

    // Transform dependencies based on current tree state
    const { elements } = transformToTreeBasedGraphElements(dependencies, treeNodes);
    const nodeCount = elements.filter(el => el.group === 'nodes').length;
    const edges = elements.filter(el => el.group === 'edges');

    // Calculate weight range for dynamic thickness mapping
    const weights = edges.map(edge => edge.data.weight).filter(w => w > 0);
    const weightRange = weights.length > 0 ? {
      min: Math.min(...weights),
      max: Math.max(...weights)
    } : { min: 1, max: 1 };

    console.log('📊 Weight distribution:', {
      weights: weights.slice(0, 10), // Show first 10 weights
      min: weightRange.min,
      max: weightRange.max,
      totalEdges: weights.length
    });

    // Calculate enhanced sizes if we have enhanced metrics
    const hasEnhanced = hasEnhancedMetrics(analysisResult || {} as AnalysisResult);
    console.log('🔍 Size encoding check:', {
      hasEnhanced,
      nodeCount,
      analysisResult: !!analysisResult,
      globalMetrics: analysisResult?.global_metrics,
      nodeMetricsCount: analysisResult?.node_metrics ? Object.keys(analysisResult.node_metrics).length : 0
    });

    const enhancedSizes = hasEnhanced
      ? calculateEnhancedSizes(calculateSizes(nodeCount), analysisResult, visualEncodingConfig)
      : calculateSizes(nodeCount);

    console.log('📏 Size calculation result:', enhancedSizes);

    // Update styles with dynamic sizing and weight mapping
    cyRef.current.style(getTreeBasedCytoscapeStyles(enhancedSizes, weightRange, analysisResult, visualEncodingConfig));

    // Update Cytoscape with new elements
    cyRef.current.elements().remove();
    cyRef.current.add(elements as any);

    // Run layout with all parameters
    cyRef.current.layout({
      name: 'dagre',
      directed: true,
      padding: settings?.layout?.padding || 20,
      spacingFactor: settings?.layout?.spacingFactor || 1.5,
      animate: settings?.layout?.animate ?? true,
      animationDuration: settings?.layout?.animationDuration || 500,
      fit: true,
      rankDir: settings?.layout?.rankDir || 'TB',
      align: settings?.layout?.align || undefined,
      rankSep: settings?.layout?.rankSep || 80,
      nodeSep: settings?.layout?.nodeSep || 60,
      edgeSep: settings?.layout?.edgeSep || 20,
      marginX: settings?.layout?.marginX || 0,
      marginY: settings?.layout?.marginY || 0,
      ranker: settings?.layout?.ranker || 'network-simplex'
    }).run();

    console.log('✅ Graph updated with tree-based filtering:', {
      nodes: cyRef.current.nodes().length,
      edges: cyRef.current.edges().length,
      nodeCount,
      dynamicSizing: nodeCount > 20 ? 'enabled' : 'standard'
    });

  }, [dependencies, treeNodes, treeVersion, forceUpdate]);

  // Handle external hover from tree
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;

    // Remove all previous highlighting
    cy.elements().removeClass('highlighted-incoming highlighted-outgoing highlighted-source highlighted-target highlighted-hover');

    if (hoveredNodeId) {
      const node = cy.getElementById(hoveredNodeId);

      if (node && node.length > 0) {
        const nodeId = node.id();

        // Get connected edges
        const connectedEdges = node.connectedEdges();
        const incomingEdges = connectedEdges.filter(edge => edge.target().id() === nodeId);
        const outgoingEdges = connectedEdges.filter(edge => edge.source().id() === nodeId);

        // Highlight incoming connections
        incomingEdges.addClass('highlighted-incoming');
        incomingEdges.sources().addClass('highlighted-source');

        // Highlight outgoing connections
        outgoingEdges.addClass('highlighted-outgoing');
        outgoingEdges.targets().addClass('highlighted-target');

        // Highlight the hovered node itself
        node.addClass('highlighted-hover');
      }
    }
  }, [hoveredNodeId]);

  // Handle settings changes
  const handleSettingsChange = (nodeCount: number, sizes: any, layout: any) => {
    console.log('🎨 Settings changed:', { nodeCount, sizes, layout });
    if (cyRef.current) {
      // Calculate current weight range from existing edges
      const currentEdges = cyRef.current.edges();
      const weights = currentEdges.map(edge => edge.data('weight')).filter(w => w > 0);
      const weightRange = weights.length > 0 ? {
        min: Math.min(...weights),
        max: Math.max(...weights)
      } : { min: 1, max: 1 };

      // Calculate enhanced sizes if we have enhanced metrics
      const enhancedSizes = hasEnhancedMetrics(analysisResult || {} as AnalysisResult)
        ? calculateEnhancedSizes(sizes, analysisResult, visualEncodingConfig)
        : sizes;

      // Update styles with new sizes and current weight range
      const newStyles = getTreeBasedCytoscapeStyles(enhancedSizes, weightRange, analysisResult, visualEncodingConfig);
      cyRef.current.style(newStyles);

      // Force a re-layout with new layout parameters
      cyRef.current.layout({
        name: 'dagre',
        directed: true,
        padding: layout?.padding || 20,
        spacingFactor: layout?.spacingFactor || 1.5,
        animate: layout?.animate ?? true,
        animationDuration: layout?.animationDuration || 300,
        fit: true,
        rankDir: layout?.rankDir || 'TB',
        align: layout?.align || undefined,
        rankSep: layout?.rankSep || 80,
        nodeSep: layout?.nodeSep || 60,
        edgeSep: layout?.edgeSep || 20,
        marginX: layout?.marginX || 0,
        marginY: layout?.marginY || 0,
        ranker: layout?.ranker || 'network-simplex'
      }).run();

      console.log('✅ Graph layout updated with new sizes and spacing');
    }
  };

  // Calculate current node count for settings (memoized to avoid recalculation)
  const currentElements = useMemo(() =>
    transformToTreeBasedGraphElements(dependencies, treeNodes),
    [dependencies, treeNodes, treeVersion]
  );
  const currentNodeCount = currentElements.elements.filter(el => el.group === 'nodes').length;

  console.log('🎯 TreeBasedCytoscapeGraph RENDERING with enhanced metrics:', {
    hasEnhanced: hasEnhancedMetrics(analysisResult || {} as AnalysisResult),
    dependencies: dependencies.length,
    treeNodes: treeNodes.size
  });

  return (
    <div className={`tree-based-cytoscape-container ${isSettingsCollapsed ? 'settings-collapsed' : ''}`}>
      <div className="graph-content">
        <div
          ref={containerRef}
          className="cytoscape-graph"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            background: '#ffffff'
          }}
        />
        {!isInitialized && (
          <div className="graph-loading">
            🔄 Initializing Cytoscape graph...
          </div>
        )}
        {isSettingsCollapsed && (
          <button
            onClick={() => setIsSettingsCollapsed(false)}
            className="expand-settings-button"
            title="Show settings panel"
          >
            ⚙️ Settings
          </button>
        )}
      </div>
      {!isSettingsCollapsed && (
        <div className="settings-sidebar">
          <div className="settings-header-controls">
            <button
              onClick={() => setIsSettingsCollapsed(true)}
              className="collapse-settings-button"
              title="Hide settings panel"
            >
              ►
            </button>
          </div>
          <GraphSettings
            currentNodeCount={currentNodeCount}
            onSettingsChange={handleSettingsChange}
          />
        </div>
      )}

      <style jsx>{`
        .tree-based-cytoscape-container {
          display: flex;
          gap: 20px;
          width: 100%;
          height: 100%;
          flex: 1;
          min-height: 0;
        }

        .tree-based-cytoscape-container.settings-collapsed {
          gap: 0;
        }

        .graph-content {
          flex: 1;
          position: relative;
          min-width: 0;
        }

        .settings-sidebar {
          width: 350px;
          flex-shrink: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .settings-header-controls {
          display: flex;
          justify-content: flex-end;
          padding: 10px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
        }

        .collapse-settings-button {
          background: #ef4444;
          color: white;
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .collapse-settings-button:hover {
          background: #dc2626;
          transform: scale(1.1);
        }

        .expand-settings-button {
          position: absolute;
          top: 16px;
          right: 16px;
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }

        .expand-settings-button:hover {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .settings-sidebar > :global(.graph-settings) {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 0;
        }

        /* Ensure scrollbar is visible and styled */
        .settings-sidebar > :global(.graph-settings)::-webkit-scrollbar {
          width: 8px;
        }

        .settings-sidebar > :global(.graph-settings)::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }

        .settings-sidebar > :global(.graph-settings)::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 4px;
        }

        .settings-sidebar > :global(.graph-settings)::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        .graph-loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.9);
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
          z-index: 1000;
        }
      `}</style>
    </div>
  );
};

/**
 * Calculate dynamic width mapping based on weight distribution
 */
const calculateDynamicWidth = (weight: number, minWeight: number, maxWeight: number, isHover: boolean = false) => {
  if (maxWeight === minWeight) {
    // All weights are the same, use middle thickness
    return isHover ? 4 : 3;
  }

  // Map weight to thickness range: normal 2-6px, hover 3-8px
  const minThickness = isHover ? 3 : 2;
  const maxThickness = isHover ? 8 : 6;

  // Normalize weight to 0-1 range
  const normalizedWeight = (weight - minWeight) / (maxWeight - minWeight);

  // Apply exponential scaling to emphasize differences (square root for gentler curve)
  const scaledWeight = Math.sqrt(normalizedWeight);

  // Map to thickness range
  const thickness = minThickness + (scaledWeight * (maxThickness - minThickness));

  return Math.round(thickness * 10) / 10; // Round to 1 decimal place
};

/**
 * Calculate enhanced node sizes based on SLOC metrics
 */
const calculateEnhancedSizes = (
  baseSizes: { fileSize: number; folderWidth: number; folderHeight: number; fontSize: number },
  analysisResult: AnalysisResult,
  config: VisualEncodingConfig
) => {
  if (!hasEnhancedMetrics(analysisResult) || !config.enable_size_encoding) {
    return baseSizes;
  }

  const { global_metrics, node_metrics } = analysisResult;

  // Calculate average SLOC for scaling
  const avgSloc = global_metrics.average_sloc || 100; // Fallback if not available

  return {
    ...baseSizes,
    // Base sizes will be scaled per-node in the styles
    avgSloc,
    scalingFactor: config.size_scaling_factor
  };
};

/**
 * Get enhanced node color based on metrics
 */
const getEnhancedNodeColor = (
  filePath: string,
  analysisResult?: AnalysisResult,
  config?: VisualEncodingConfig
): string => {
  if (!analysisResult || !hasEnhancedMetrics(analysisResult)) {
    return '#64748b'; // Default gray
  }

  // Helper to normalize path for comparison
  const normalizePath = (path: string): string => {
    let normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
    // Strip cache directory prefix if present
    const cacheMatch = normalized.match(/^(?:tmp\/)?chronograph[\/\\][^\/\\]+[\/\\](.+)$/);
    if (cacheMatch) {
      normalized = cacheMatch[1];
    }
    return normalized;
  };

  const normalizedFilePath = normalizePath(filePath);

  // Try to find metrics by normalized path
  let nodeMetrics = getNodeMetrics(analysisResult, filePath);

  // If no exact match, try all keys with normalization
  if (!nodeMetrics && analysisResult.node_metrics) {
    for (const [key, metrics] of Object.entries(analysisResult.node_metrics)) {
      if (normalizePath(key) === normalizedFilePath) {
        nodeMetrics = metrics;
        break;
      }
    }
  }

  // If still no direct metrics (likely a folder), calculate aggregate metrics from children
  if (!nodeMetrics && analysisResult.node_metrics) {
    const childMetrics = Object.entries(analysisResult.node_metrics)
      .filter(([path]) => {
        const normalized = normalizePath(path);
        // Match children: path starts with folder/ (exact prefix match)
        return normalized.startsWith(normalizedFilePath + '/') ||
               // Also match nested folders
               (normalized.startsWith(normalizedFilePath) && normalized !== normalizedFilePath);
      })
      .map(([, metrics]) => metrics);

    if (childMetrics.length > 0) {
      // Calculate average instability for the folder
      const avgInstability = childMetrics.reduce((sum, m) => sum + m.instability, 0) / childMetrics.length;
      const totalSloc = childMetrics.reduce((sum, m) => sum + m.sloc, 0);

      nodeMetrics = {
        instability: avgInstability,
        sloc: totalSloc,
        fan_in: childMetrics.reduce((sum, m) => sum + m.fan_in, 0),
        fan_out: childMetrics.reduce((sum, m) => sum + m.fan_out, 0),
        is_orphan: childMetrics.every(m => m.is_orphan),
        in_cycle: childMetrics.some(m => m.in_cycle)
      };
    }
  }

  if (!nodeMetrics) {
    return '#64748b'; // Default gray if no metrics
  }

  // Use color encoding even if not explicitly enabled, but respect the config if present
  const shouldUseColor = config?.enable_color_encoding !== false; // Default to true

  if (!shouldUseColor) {
    return '#64748b';
  }

  // Calculate visual encoding
  const encoding = calculateVisualEncoding(nodeMetrics, analysisResult.global_metrics, config);

  // Convert HSL to hex color with better variation
  const hue = encoding.color_hue;
  const saturation = 65; // Slightly reduced for better visibility
  const lightness = encoding.is_orphan ? 35 : (encoding.in_cycle ? 42 : 48);

  return hslToHex(hue, saturation, lightness);
};

/**
 * Convert HSL to hex color
 */
const hslToHex = (h: number, s: number, l: number): string => {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs((hNorm * 6) % 2 - 1));
  const m = lNorm - c / 2;

  let r, g, b;
  if (hNorm < 1/6) { r = c; g = x; b = 0; }
  else if (hNorm < 2/6) { r = x; g = c; b = 0; }
  else if (hNorm < 3/6) { r = 0; g = c; b = x; }
  else if (hNorm < 4/6) { r = 0; g = x; b = c; }
  else if (hNorm < 5/6) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Calculate total SLOC for all files within a folder
 */
const calculateFolderSLOC = (
  folderPath: string,
  analysisResult: AnalysisResult
): number => {
  if (!analysisResult.node_metrics) {
    console.log(`📁 calculateFolderSLOC: No node_metrics for folder ${folderPath}`);
    return 0;
  }

  // Normalize paths: remove leading/trailing slashes for consistent comparison
  const normalizedFolderPath = folderPath.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');

  let totalSLOC = 0;
  let matchedFiles: string[] = [];

  for (const [filePath, metrics] of Object.entries(analysisResult.node_metrics)) {
    // Normalize file path: remove leading slash, convert backslashes to forward slashes
    let normalizedFilePath = filePath.replace(/^\/+/g, '').replace(/\\/g, '/');

    // Strip the cache directory prefix if present (e.g., "tmp/chronograph/repo-cache/")
    // This handles paths like "/tmp/chronograph\repo-cache\lib/file.dart"
    const cacheMatch = normalizedFilePath.match(/^(?:tmp\/)?chronograph[\/\\][^\/\\]+[\/\\](.+)$/);
    if (cacheMatch) {
      normalizedFilePath = cacheMatch[1];
    }

    // Check if file is within the folder (file path starts with folder path + /)
    // OR if the folder path exactly matches the file path (for root-level files)
    if (normalizedFilePath === normalizedFolderPath ||
        normalizedFilePath.startsWith(normalizedFolderPath + '/')) {
      const sloc = metrics.sloc || 0;
      totalSLOC += sloc;
      matchedFiles.push(`${normalizedFilePath} (${sloc} SLOC)`);
    }
  }

  return totalSLOC;
};

/**
 * Fallback: Calculate approximate folder size based on file count when enhanced metrics aren't available
 */
const calculateFolderSizeFallback = (
  folderPath: string,
  analysisResult: AnalysisResult
): number => {
  if (!analysisResult.analyzed_files) return 0;

  let fileCount = 0;
  for (const filePath of analysisResult.analyzed_files) {
    const pathStr = typeof filePath === 'string' ? filePath : filePath.toString();
    // Check if file is within the folder
    if (pathStr.startsWith(folderPath + '/')) {
      fileCount++;
    }
  }

  // Approximate SLOC based on file count (rough estimate: 100 SLOC per file)
  return fileCount * 100;
};

/**
 * Get enhanced node size based on SLOC (for files) or total folder contents SLOC (for folders)
 */
const getEnhancedNodeSize = (
  filePath: string,
  baseSize: number,
  analysisResult?: AnalysisResult,
  config?: VisualEncodingConfig
): number => {
  if (!analysisResult || !config?.enable_size_encoding) {
    return baseSize;
  }

  // Debug enhanced metrics availability for real repos
  if (!hasEnhancedMetrics(analysisResult)) {
    // Log what's missing only once per analysis to avoid spam
    if (typeof (window as any).__enhanced_metrics_debug_logged === 'undefined') {
      console.log('❌ Enhanced metrics not available:', {
        hasEnhancedDependencies: !!analysisResult.enhanced_dependencies,
        enhancedDependenciesLength: analysisResult.enhanced_dependencies?.length || 0,
        hasGlobalMetrics: !!analysisResult.global_metrics,
        hasNodeMetrics: !!analysisResult.node_metrics,
        nodeMetricsCount: analysisResult.node_metrics ? Object.keys(analysisResult.node_metrics).length : 0,
        hasArchitectureScore: analysisResult.architecture_quality_score !== undefined,
        analyzerName: (analysisResult as any).analyzer_name || 'unknown'
      });
      (window as any).__enhanced_metrics_debug_logged = true;
    }
    return baseSize;
  }

  // Try to get direct file metrics first
  let nodeMetrics = getNodeMetrics(analysisResult, filePath);
  let totalSLOC = 0;

  if (nodeMetrics) {
    // It's a file with direct metrics
    totalSLOC = nodeMetrics.sloc || 0;
  } else {
    // It might be a folder - calculate total SLOC of contents
    if (hasEnhancedMetrics(analysisResult)) {
      // Use precise SLOC calculation when available
      totalSLOC = calculateFolderSLOC(filePath, analysisResult);
    } else {
      // Use fallback estimation when enhanced metrics aren't available
      totalSLOC = calculateFolderSizeFallback(filePath, analysisResult);

      // Debug fallback calculation
      if (totalSLOC > 0 && filePath.includes('/') && !filePath.includes('.')) {
        console.log(`📁 Fallback folder sizing: ${filePath} = ${totalSLOC} estimated SLOC`);
      }
    }

    // If no SLOC found, return base size
    if (totalSLOC === 0) {
      return baseSize;
    }

    // Create synthetic metrics for folder visualization
    nodeMetrics = {
      sloc: totalSLOC,
      instability: 0.5, // Default instability for folders
      incoming_dependencies: 0,
      outgoing_dependencies: 0,
      component_dependency_count: 0
    };
  }

  // Calculate visual encoding
  let encoding;

  // Check if this is a folder (no file extension) - folders need different scaling
  const isFolder = !filePath.includes('.');

  if (hasEnhancedMetrics(analysisResult) && analysisResult.global_metrics) {
    if (isFolder) {
      // For folders, use logarithmic scaling to handle the huge range of folder sizes
      // This provides good visual distinction across orders of magnitude
      const minSLOC = 100; // Minimum for scaling baseline
      const logScale = Math.log10(Math.max(nodeMetrics.sloc, minSLOC) / minSLOC);
      // Use full range from 0.5 to 3.0 across the logarithmic scale
      // log10(100/100) = 0 → 0.5
      // log10(1000/100) = 1 → 1.125
      // log10(10000/100) = 2 → 1.75
      // log10(60000/100) = 2.78 → 2.24
      // log10(100000/100) = 3 → 2.375
      // log10(365901/100) = 3.56 → 2.73
      const maxLog = 4.0; // Maximum expected log scale (10,000x baseline = 1M SLOC)
      const normalizedLog = Math.min(logScale / maxLog, 1.0);
      const sizeFactor = 0.5 + (normalizedLog * 2.5) * (config.size_scaling_factor || 1.0);

      encoding = {
        size_factor: sizeFactor,
        color_factor: 0.5 // Folders get neutral color
      };
    } else {
      // For files, use the standard visual encoding
      encoding = calculateVisualEncoding(nodeMetrics, analysisResult.global_metrics, config);
    }
  } else {
    // Fallback: simple size calculation based on relative SLOC
    const avgSLOC = 100; // Default average when no global metrics available
    const sizeFactor = Math.sqrt(nodeMetrics.sloc / avgSLOC) * (config.size_scaling_factor || 1.0);
    const boundedSizeFactor = Math.max(0.5, Math.min(3.0, sizeFactor));

    encoding = {
      size_factor: boundedSizeFactor,
      color_factor: 0.5 // Default neutral color
    };
  }

  const enhancedSize = Math.round(baseSize * encoding.size_factor);

  return enhancedSize;
};

/**
 * Cytoscape.js styles optimized for tree-based graph visualization with dynamic sizing and weight mapping
 */
const getTreeBasedCytoscapeStyles = (
  sizes: { fileSize: number; folderWidth: number; folderHeight: number; fontSize: number; avgSloc?: number; scalingFactor?: number },
  weightRange?: { min: number; max: number },
  analysisResult?: AnalysisResult,
  visualEncodingConfig?: VisualEncodingConfig
) => {

  return [
  // File nodes (always leaf nodes) - simple rectangles
  {
    selector: 'node[type="file"]',
    style: {
      'shape': 'rectangle',
      'width': (ele: any) => {
        const filePath = ele.data('id') || ele.data('label');
        const baseSize = getEnhancedNodeSize(filePath, sizes.fileSize, analysisResult, visualEncodingConfig);
        return baseSize * 1.2; // Slightly wider than tall
      },
      'height': (ele: any) => {
        const filePath = ele.data('id') || ele.data('label');
        const baseSize = getEnhancedNodeSize(filePath, sizes.fileSize, analysisResult, visualEncodingConfig);
        return baseSize * 0.8; // Smaller height to make files more compact
      },
      'background-color': (ele: any) => {
        const filePath = ele.data('id') || ele.data('label');
        return getEnhancedNodeColor(filePath, analysisResult, visualEncodingConfig);
      },
      'border-width': (ele: any) => {
        const filePath = ele.data('id') || ele.data('label');
        const nodeMetrics = analysisResult && hasEnhancedMetrics(analysisResult)
          ? getNodeMetrics(analysisResult, filePath)
          : null;

        // Thicker border for orphans and nodes in cycles
        if (nodeMetrics && visualEncodingConfig?.highlight_orphans && nodeMetrics.is_orphan) return '4px';
        if (nodeMetrics && visualEncodingConfig?.highlight_cycles && nodeMetrics.in_cycle) return '4px';
        return '2px';
      },
      'border-color': (ele: any) => {
        const filePath = ele.data('id') || ele.data('label');
        const nodeMetrics = analysisResult && hasEnhancedMetrics(analysisResult)
          ? getNodeMetrics(analysisResult, filePath)
          : null;

        // Special border colors for problematic nodes
        if (nodeMetrics && visualEncodingConfig?.highlight_orphans && nodeMetrics.is_orphan) return '#ef4444'; // Red for orphans
        if (nodeMetrics && visualEncodingConfig?.highlight_cycles && nodeMetrics.in_cycle) return '#f59e0b'; // Orange for cycles
        return '#64748b';
      },
      'label': 'data(label)',
      'font-size': `${sizes.fontSize}px`,
      'text-valign': 'center',
      'text-halign': 'center',
      'color': '#ffffff',
      'text-outline-width': '2px',
      'text-outline-color': '#000000',
      'z-index': 3
    }
  },

  // Collapsed folder nodes (act as leaf nodes) - folder-tab shape
  {
    selector: 'node[type="folder"].leaf',
    style: {
      'shape': 'barrel', // Closest to folder-tab appearance in Cytoscape
      'width': (ele: any) => {
        const filePath = ele.data('id') || ele.data('label');
        const baseSize = getEnhancedNodeSize(filePath, sizes.folderWidth, analysisResult, visualEncodingConfig);
        return baseSize * 1.3; // Make folders larger than files
      },
      'height': (ele: any) => {
        const filePath = ele.data('id') || ele.data('label');
        const baseSize = getEnhancedNodeSize(filePath, sizes.folderHeight, analysisResult, visualEncodingConfig);
        return baseSize * 1.1; // Slightly taller
      },
      'background-color': (ele: any) => {
        const filePath = ele.data('id') || ele.data('label');
        return getEnhancedNodeColor(filePath, analysisResult, visualEncodingConfig);
      },
      'border-width': (ele: any) => {
        const filePath = ele.data('id') || ele.data('label');
        const nodeMetrics = analysisResult && hasEnhancedMetrics(analysisResult)
          ? getNodeMetrics(analysisResult, filePath)
          : null;

        // Thicker border for orphans and nodes in cycles
        if (nodeMetrics && visualEncodingConfig?.highlight_orphans && nodeMetrics.is_orphan) return '5px';
        if (nodeMetrics && visualEncodingConfig?.highlight_cycles && nodeMetrics.in_cycle) return '5px';
        return '3px';
      },
      'border-color': (ele: any) => {
        const filePath = ele.data('id') || ele.data('label');
        const nodeMetrics = analysisResult && hasEnhancedMetrics(analysisResult)
          ? getNodeMetrics(analysisResult, filePath)
          : null;

        // Special border colors for problematic nodes
        if (nodeMetrics && visualEncodingConfig?.highlight_orphans && nodeMetrics.is_orphan) return '#ef4444'; // Red for orphans
        if (nodeMetrics && visualEncodingConfig?.highlight_cycles && nodeMetrics.in_cycle) return '#dc2626'; // Darker red for cycles
        return '#f59e0b';
      },
      'border-style': 'solid',
      'label': 'data(label)',
      'font-size': `${sizes.fontSize}px`,
      'font-weight': '600',
      'text-valign': 'center',
      'text-halign': 'center',
      'color': '#ffffff',
      'text-outline-width': '2px',
      'text-outline-color': '#000000',
      'z-index': 3
    }
  },


  // Parent nodes (Cytoscape compound pattern) - with alternating colors by depth
  {
    selector: ':parent',
    style: {
      'shape': 'round-rectangle',
      'background-color': (ele: any) => {
        // Calculate folder depth by counting slashes in the path
        const filePath = ele.data('id') || '';
        const depth = (filePath.match(/\//g) || []).length;

        // Alternate between more contrasting shades
        const colors = [
          '#dbeafe', // Light blue (even depth)
          '#f3f4f6', // Light gray (odd depth)
        ];
        return colors[depth % 2];
      },
      'background-opacity': 0.7,
      'border-width': '2px',
      'border-color': (ele: any) => {
        const filePath = ele.data('id') || '';
        const depth = (filePath.match(/\//g) || []).length;

        // Alternate border colors with more contrast
        const colors = [
          '#60a5fa', // Blue (even depth)
          '#9ca3af', // Gray (odd depth)
        ];
        return colors[depth % 2];
      },
      'border-style': 'dashed',
      'label': 'data(label)',
      'font-size': `${Math.max(sizes.fontSize + 2, 8)}px`,
      'font-weight': 'bold',
      'text-valign': 'top',
      'text-halign': 'center',
      'text-margin-y': '10px',
      'color': '#1e293b',
      'compound-sizing-wrt-labels': 'include',
      'min-width': '120px',
      'min-height': '80px',
      'padding': '20px',
      'z-index': 1
    }
  },

  // Edges with dynamic width based on weight distribution
  {
    selector: 'edge',
    style: {
      'width': (ele: any) => {
        const weight = ele.data('weight');
        if (weightRange && weightRange.min !== undefined && weightRange.max !== undefined) {
          return calculateDynamicWidth(weight, weightRange.min, weightRange.max, false);
        }
        // Fallback to original logic if no weight range provided
        return Math.max(2, Math.min(6, weight));
      },
      'line-color': '#64748b',
      'target-arrow-color': '#64748b',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1.5,
      'z-index': 2
    }
  },

  // Selected node highlighting
  {
    selector: 'node:selected',
    style: {
      'border-color': '#2563eb',
      'border-width': '4px'
    }
  },

  // Hover effects
  {
    selector: 'node:active',
    style: {
      'overlay-opacity': 0.2,
      'overlay-color': '#2563eb'
    }
  },

  // Edge hover with dynamic width
  {
    selector: 'edge:active',
    style: {
      'line-color': '#2563eb',
      'target-arrow-color': '#2563eb',
      'width': (ele: any) => {
        const weight = ele.data('weight');
        if (weightRange && weightRange.min !== undefined && weightRange.max !== undefined) {
          return calculateDynamicWidth(weight, weightRange.min, weightRange.max, true);
        }
        // Fallback to original logic if no weight range provided
        return Math.max(3, Math.min(8, weight + 1));
      }
    }
  },

  // Hover highlighting styles

  // Highlighted incoming edges (dependencies pointing TO the hovered node)
  {
    selector: 'edge.highlighted-incoming',
    style: {
      'line-color': '#ef4444', // Red for incoming
      'target-arrow-color': '#ef4444',
      'width': (ele: any) => {
        const weight = ele.data('weight');
        if (weightRange && weightRange.min !== undefined && weightRange.max !== undefined) {
          return calculateDynamicWidth(weight, weightRange.min, weightRange.max, true);
        }
        return Math.max(3, Math.min(8, weight + 1));
      },
      'z-index': 10
    }
  },

  // Highlighted outgoing edges (dependencies FROM the hovered node)
  {
    selector: 'edge.highlighted-outgoing',
    style: {
      'line-color': '#22c55e', // Green for outgoing
      'target-arrow-color': '#22c55e',
      'width': (ele: any) => {
        const weight = ele.data('weight');
        if (weightRange && weightRange.min !== undefined && weightRange.max !== undefined) {
          return calculateDynamicWidth(weight, weightRange.min, weightRange.max, true);
        }
        return Math.max(3, Math.min(8, weight + 1));
      },
      'z-index': 10
    }
  },

  // Source nodes (where highlighted edges come from)
  {
    selector: 'node.highlighted-source',
    style: {
      'border-color': '#ef4444', // Red border for source nodes
      'border-width': '4px',
      'border-opacity': 0.8,
      'overlay-opacity': 0.1,
      'overlay-color': '#ef4444',
      'z-index': 5
    }
  },

  // Target nodes (where highlighted edges go to)
  {
    selector: 'node.highlighted-target',
    style: {
      'border-color': '#22c55e', // Green border for target nodes
      'border-width': '4px',
      'border-opacity': 0.8,
      'overlay-opacity': 0.1,
      'overlay-color': '#22c55e',
      'z-index': 5
    }
  },

  // Hovered element itself
  {
    selector: '.highlighted-hover',
    style: {
      'border-color': '#3b82f6', // Blue for the hovered element
      'border-width': '5px',
      'overlay-opacity': 0.2,
      'overlay-color': '#3b82f6',
      'z-index': 15
    }
  },

  // Dim non-highlighted elements during hover (excluding compound nodes)
  {
    selector: 'node:unselected:simple',  // Only simple nodes, not compound nodes
    style: {
      'opacity': (ele: any) => {
        // Check if any highlighting is active
        const hasHighlighted = ele.cy().elements('.highlighted-incoming, .highlighted-outgoing, .highlighted-source, .highlighted-target, .highlighted-hover').length > 0;
        if (hasHighlighted) {
          // If this element is highlighted, keep it visible
          const isHighlighted = ele.hasClass('highlighted-incoming') ||
                               ele.hasClass('highlighted-outgoing') ||
                               ele.hasClass('highlighted-source') ||
                               ele.hasClass('highlighted-target') ||
                               ele.hasClass('highlighted-hover');

          if (isHighlighted) {
            return 1;
          }

          // Don't dim children of hovered compound nodes (expanded folders)
          const hoveredCompoundNodes = ele.cy().elements('node.highlighted-hover:parent');
          if (hoveredCompoundNodes.length > 0) {
            // Check if this element is a descendant of any hovered compound node
            for (let i = 0; i < hoveredCompoundNodes.length; i++) {
              const compoundNode = hoveredCompoundNodes[i];
              if (ele.isChild() && ele.ancestors().includes(compoundNode)) {
                return 1; // Keep children of hovered expanded folders at full opacity
              }
            }
          }

          return 0.3; // Dim other simple nodes only
        }
        return 1;
      }
    }
  },

  // Keep compound nodes (expanded containers) always visible
  {
    selector: 'node:parent',
    style: {
      'opacity': 1  // Never dim expanded containers
    }
  },

  {
    selector: 'edge:unselected',
    style: {
      'opacity': (ele: any) => {
        // Check if any highlighting is active
        const hasHighlighted = ele.cy().elements('.highlighted-incoming, .highlighted-outgoing, .highlighted-source, .highlighted-target, .highlighted-hover').length > 0;
        if (hasHighlighted) {
          // If this element is highlighted, keep it visible
          const isHighlighted = ele.hasClass('highlighted-incoming') ||
                               ele.hasClass('highlighted-outgoing') ||
                               ele.hasClass('highlighted-hover');

          if (isHighlighted) {
            return 1;
          }

          // Don't dim edges between children of hovered compound nodes
          const hoveredCompoundNodes = ele.cy().elements('node.highlighted-hover:parent');
          if (hoveredCompoundNodes.length > 0) {
            const source = ele.source();
            const target = ele.target();

            for (let i = 0; i < hoveredCompoundNodes.length; i++) {
              const compoundNode = hoveredCompoundNodes[i];
              // Check if both source and target are children of the hovered compound node
              const sourceIsChild = source.isChild() && source.ancestors().includes(compoundNode);
              const targetIsChild = target.isChild() && target.ancestors().includes(compoundNode);

              if (sourceIsChild && targetIsChild) {
                return 1; // Keep internal edges of hovered expanded folders at full opacity
              }
            }
          }

          return 0.2; // Dim other edges
        }
        return 1;
      }
    }
  }
];
};

