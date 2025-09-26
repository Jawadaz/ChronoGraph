import React, { useRef, useEffect, useState, useMemo } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';

import { Dependency } from '../types/Dependency';
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
  onNodeSelect?: (nodeId: string) => void;
  onEdgeDoubleClick?: (sourceId: string, targetId: string, relationshipTypes: string[]) => void;
}

export const TreeBasedCytoscapeGraph: React.FC<TreeBasedCytoscapeGraphProps> = ({
  dependencies,
  treeNodes,
  onNodeSelect,
  onEdgeDoubleClick
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

    // Update styles with dynamic sizing and weight mapping
    const currentSizes = calculateSizes(nodeCount);
    cyRef.current.style(getTreeBasedCytoscapeStyles(currentSizes, weightRange));

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

  }, [dependencies, treeNodes, forceUpdate]);

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

      // Update styles with new sizes and current weight range
      const newStyles = getTreeBasedCytoscapeStyles(sizes, weightRange);
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
    [dependencies, treeNodes]
  );
  const currentNodeCount = currentElements.elements.filter(el => el.group === 'nodes').length;

  return (
    <div className={`tree-based-cytoscape-container ${isSettingsCollapsed ? 'settings-collapsed' : ''}`}>
      <div className="graph-content">
        <div
          ref={containerRef}
          className="cytoscape-graph"
          style={{
            width: '100%',
            height: '600px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            background: '#ffffff'
          }}
        />
        {!isInitialized && (
          <div className="graph-loading">
            🔄 Initializing graph...
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
          height: 600px;
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
          height: 600px;
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
          padding: 8px;
          background: #f1f5f9;
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
 * Cytoscape.js styles optimized for tree-based graph visualization with dynamic sizing and weight mapping
 */
const getTreeBasedCytoscapeStyles = (
  sizes: { fileSize: number; folderWidth: number; folderHeight: number; fontSize: number },
  weightRange?: { min: number; max: number }
) => {

  return [
  // File nodes (always leaf nodes)
  {
    selector: 'node[type="file"]',
    style: {
      'shape': 'ellipse',
      'width': `${sizes.fileSize}px`,
      'height': `${sizes.fileSize}px`,
      'background-color': (ele: any) => getNodeColor(ele.data('instability')),
      'border-width': '2px',
      'border-color': '#64748b',
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

  // Collapsed folder nodes (act as leaf nodes)
  {
    selector: 'node[type="folder"].leaf',
    style: {
      'shape': 'round-rectangle',
      'width': `${sizes.folderWidth}px`,
      'height': `${sizes.folderHeight}px`,
      'background-color': (ele: any) => getNodeColor(ele.data('instability')),
      'border-width': '3px',
      'border-color': '#f59e0b',
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

  // Expanded folder nodes (container parents)
  {
    selector: 'node[type="folder"].container',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#f8fafc',
      'background-opacity': 0.6,
      'border-width': '2px',
      'border-color': '#94a3b8',
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

  // Parent nodes (Cytoscape compound pattern)
  {
    selector: ':parent',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#f1f5f9',
      'background-opacity': 0.7,
      'border-width': '2px',
      'border-color': '#94a3b8',
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
  }
];
};

/**
 * Get node color based on instability value
 */
function getNodeColor(instability: number): string {
  // Create a gradient from green (stable) to red (unstable)
  if (instability < 0.3) return '#22c55e'; // Green
  if (instability < 0.6) return '#eab308'; // Yellow
  if (instability < 0.8) return '#f97316'; // Orange
  return '#ef4444'; // Red
}