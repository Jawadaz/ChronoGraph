import React, { useRef, useEffect, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';

import { Dependency } from '../types/Dependency';
import { TreeNode } from '../utils/treeStructure';
import { transformToTreeBasedGraphElements } from '../utils/treeBasedGraphTransforms';

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

      // Styling
      style: getTreeBasedCytoscapeStyles()
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

    // Update Cytoscape with new elements
    cyRef.current.elements().remove();
    cyRef.current.add(elements as any);

    // Run layout
    cyRef.current.layout({
      name: 'dagre',
      directed: true,
      padding: 20,
      spacingFactor: 1.5,
      animate: true,
      animationDuration: 500,
      fit: true,
      rankDir: 'TB',
      rankSep: 80,
      nodeSep: 60,
      edgeSep: 20
    }).run();

    console.log('✅ Graph updated with tree-based filtering:', {
      nodes: cyRef.current.nodes().length,
      edges: cyRef.current.edges().length
    });

  }, [dependencies, treeNodes]);

  return (
    <div className="tree-based-cytoscape-container">
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
    </div>
  );
};

/**
 * Cytoscape.js styles optimized for tree-based graph visualization
 */
const getTreeBasedCytoscapeStyles = () => [
  // File nodes (always leaf nodes)
  {
    selector: 'node[type="file"]',
    style: {
      'shape': 'ellipse',
      'width': '40px',
      'height': '40px',
      'background-color': (ele: any) => getNodeColor(ele.data('instability')),
      'border-width': '2px',
      'border-color': '#64748b',
      'label': 'data(label)',
      'font-size': '12px',
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
      'width': '60px',
      'height': '40px',
      'background-color': (ele: any) => getNodeColor(ele.data('instability')),
      'border-width': '3px',
      'border-color': '#f59e0b',
      'border-style': 'solid',
      'label': 'data(label)',
      'font-size': '12px',
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
      'font-size': '14px',
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
      'font-size': '14px',
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

  // Edges with enhanced styling
  {
    selector: 'edge',
    style: {
      'width': (ele: any) => Math.max(2, Math.min(6, ele.data('weight'))),
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

  // Edge hover
  {
    selector: 'edge:active',
    style: {
      'line-color': '#2563eb',
      'target-arrow-color': '#2563eb',
      'width': (ele: any) => Math.max(3, Math.min(8, ele.data('weight') + 1))
    }
  }
];

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