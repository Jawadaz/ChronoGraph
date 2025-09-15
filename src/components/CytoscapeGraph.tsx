import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';

import {
  transformToHierarchicalElements,
  CytoscapeElement,
  FolderState
} from '../utils/cytoscapeTransforms';
import { type Dependency } from '../utils/dependencyFiltering';

// Register layout extensions
cytoscape.use(dagre);
cytoscape.use(fcose);

interface CytoscapeGraphProps {
  dependencies: Dependency[];
  onNodeSelect?: (nodeId: string | null) => void;
  onEdgeDoubleClick?: (sourceId: string, targetId: string, relationshipTypes: string[]) => void;
  levelOfDetail: 'file' | 'folder';
  viewRootFolder: string;
  folderLevel: number;
}

export const CytoscapeGraph: React.FC<CytoscapeGraphProps> = ({
  dependencies,
  onNodeSelect,
  onEdgeDoubleClick,
  levelOfDetail,
  viewRootFolder,
  folderLevel
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [folderState, setFolderState] = useState<FolderState>({});
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Initialize Cytoscape instance
  useEffect(() => {
    if (!containerRef.current || !dependencies.length) return;

    // Transform data to hierarchical elements
    const { elements, folderState: initialFolderState } = transformToHierarchicalElements(
      dependencies,
      viewRootFolder,
      folderLevel,
      folderState
    );

    setFolderState(initialFolderState);

    console.log('🎨 Cytoscape elements:', {
      nodes: elements.filter(el => el.group === 'nodes').length,
      edges: elements.filter(el => el.group === 'edges').length,
      viewRootFolder
    });

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,

      elements: elements as ElementDefinition[],

      style: getCytoscapeStyles(),

      layout: {
        name: 'dagre',
        directed: true,
        padding: 20,
        spacingFactor: 1.25,
        nodeDimensionsIncludeLabels: true,
        animate: true,
        animationDuration: 500,
        fit: true,
        // Enhanced compound node support
        rankDir: 'TB',
        edgeWeight: function(edge: any) { return edge.data('weight'); },
        // Compound-specific options
        rankSep: 50,
        nodeSep: 30,
        edgeSep: 10
      },

      // Interaction settings
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      selectionType: 'single',

      // Performance
      textureOnViewport: false,
      motionBlur: false
    });

    cyRef.current = cy;

    // Event handlers
    setupEventHandlers(cy);

    // Cleanup
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [dependencies, viewRootFolder, folderLevel]);

  // Update elements when folder state changes
  useEffect(() => {
    if (!cyRef.current || !dependencies.length) return;

    const { elements } = transformToHierarchicalElements(
      dependencies,
      viewRootFolder,
      folderLevel,
      folderState
    );

    // Update elements without recreating the instance
    cyRef.current.elements().remove();
    cyRef.current.add(elements as ElementDefinition[]);

    // Re-run layout
    cyRef.current.layout({
      name: 'dagre',
      directed: true,
      padding: 20,
      spacingFactor: 1.25,
      animate: true,
      animationDuration: 300,
      fit: true
    }).run();

  }, [folderState, dependencies, viewRootFolder, folderLevel]);

  const setupEventHandlers = (cy: Core) => {
    // Node click
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeId = node.id();

      // Clear previous selection
      cy.elements().removeClass('selected');
      node.addClass('selected');

      setSelectedNode(nodeId);
      onNodeSelect?.(nodeId);
    });

    // Node double-click for expand/collapse
    cy.on('dblclick', 'node', (event) => {
      const node = event.target;
      const nodeData = node.data();

      if (nodeData.type === 'folder') {
        console.log('📁 Double-clicked folder:', nodeData.id, 'current state:', nodeData.isExpanded);

        // Toggle expansion state in folderState
        const newFolderState = { ...folderState };
        if (!newFolderState[nodeData.id]) {
          newFolderState[nodeData.id] = {
            isExpanded: false, // Initialize as collapsed
            children: [],
            path: nodeData.id
          };
        }
        // Toggle: if currently collapsed (false) or undefined, expand (true)
        newFolderState[nodeData.id].isExpanded = !newFolderState[nodeData.id].isExpanded;

        console.log('📁 Toggling folder:', {
          folderId: nodeData.id,
          nodeType: nodeData.type,
          isLeaf: nodeData.isLeaf,
          oldState: folderState[nodeData.id]?.isExpanded,
          newState: newFolderState[nodeData.id].isExpanded,
          existingFolderState: !!folderState[nodeData.id],
          allFolderStateKeys: Object.keys(folderState)
        });

        // Re-transform dependencies with new folder state
        const { elements } = transformToHierarchicalElements(
          dependencies,
          viewRootFolder,
          folderLevel,
          newFolderState
        );

        // Update folder state
        setFolderState(newFolderState);

        // Update Cytoscape with new elements
        console.log('🔄 Updating Cytoscape with new elements:', elements.length);
        cy.elements().remove();
        cy.add(elements as any);

        // Re-run layout with compound support
        cy.layout({
          name: 'dagre',
          directed: true,
          padding: 20,
          spacingFactor: 1.25,
          animate: true,
          animationDuration: 500,
          fit: true,
          // Dagre compound node support
          rankDir: 'TB',
          nodeDimensionsIncludeLabels: true,
          edgeWeight: function(edge: any) { return edge.data('weight'); }
        }).run();

        console.log('✅ Folder expansion toggle completed');
      }
    });

    // Edge double-click
    cy.on('dblclick', 'edge', (event) => {
      const edge = event.target;
      const edgeData = edge.data();

      if (onEdgeDoubleClick && edgeData.originalDependencies) {
        const relationshipTypes = [...new Set(edgeData.originalDependencies.map((dep: Dependency) => dep.relationship_type))];
        onEdgeDoubleClick(edgeData.source, edgeData.target, relationshipTypes);
      }
    });

    // Background click
    cy.on('tap', (event) => {
      if (event.target === cy) {
        cy.elements().removeClass('selected');
        setSelectedNode(null);
        onNodeSelect?.(null);
      }
    });
  };

  const fitToView = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50);
    }
  };

  const centerView = () => {
    if (cyRef.current) {
      cyRef.current.center();
    }
  };

  const relayout = () => {
    if (cyRef.current) {
      cyRef.current.layout({
        name: 'dagre',
        directed: true,
        padding: 20,
        spacingFactor: 1.25,
        animate: true,
        animationDuration: 500,
        fit: true
      }).run();
    }
  };

  return (
    <div className="cytoscape-graph">
      {/* Graph Controls */}
      <div className="graph-controls">
        <div className="control-group">
          <button onClick={fitToView} className="control-btn">
            🔍 Fit to View
          </button>
          <button onClick={centerView} className="control-btn">
            🎯 Center
          </button>
          <button onClick={relayout} className="control-btn">
            🔄 Re-layout
          </button>
        </div>

        <div className="graph-info">
          {selectedNode ? (
            <span className="selected-info">
              Selected: <strong>{selectedNode.split('/').pop()}</strong>
            </span>
          ) : (
            <span className="graph-stats">
              📁 <strong>{viewRootFolder === '/' ? 'Root' : viewRootFolder.split('/').pop()}</strong> •{' '}
              {dependencies.length} dependencies • {levelOfDetail} level
            </span>
          )}
        </div>
      </div>

      {/* Graph Container */}
      <div
        ref={containerRef}
        className="cytoscape-container"
        style={{ width: '100%', height: '600px' }}
      />

      <style jsx>{`
        .cytoscape-graph {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .graph-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        .control-group {
          display: flex;
          gap: 8px;
        }

        .control-btn {
          padding: 6px 12px;
          border: 1px solid #cbd5e1;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .control-btn:hover {
          border-color: #2563eb;
          color: #2563eb;
        }

        .graph-info {
          font-size: 14px;
          color: #64748b;
        }

        .selected-info {
          color: #2563eb;
        }

        .cytoscape-container {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          background: white;
        }
      `}</style>
    </div>
  );
};

/**
 * Cytoscape.js styles for compound hierarchical nodes
 */
const getCytoscapeStyles = () => [
  // File nodes (always leaf nodes)
  {
    selector: 'node[type="file"]',
    style: {
      'shape': 'ellipse',
      'width': '32px',
      'height': '32px',
      'background-color': (ele: any) => getNodeColor(ele.data('instability')),
      'label': 'data(label)',
      'font-size': '10px',
      'text-valign': 'center',
      'text-halign': 'center',
      'color': '#ffffff',
      'text-outline-width': '1px',
      'text-outline-color': '#000000',
      'z-index': 2
    }
  },

  // Collapsed folder nodes (act as leaf nodes)
  {
    selector: 'node[type="folder"].collapsed',
    style: {
      'shape': 'round-rectangle',
      'width': '50px',
      'height': '35px',
      'background-color': (ele: any) => getNodeColor(ele.data('instability')),
      'border-width': '2px',
      'border-color': '#64748b',
      'border-style': 'solid',
      'label': 'data(label)',
      'font-size': '10px',
      'text-valign': 'center',
      'text-halign': 'center',
      'color': '#ffffff',
      'text-outline-width': '1px',
      'text-outline-color': '#000000',
      'z-index': 2
    }
  },

  // Expanded folder nodes (container parents)
  {
    selector: 'node[type="folder"].expanded',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#f8fafc',
      'background-opacity': 0.4,
      'border-width': '2px',
      'border-color': '#94a3b8',
      'border-style': 'dashed',
      'label': 'data(label)',
      'font-size': '12px',
      'font-weight': '600',
      'text-valign': 'top',
      'text-halign': 'center',
      'text-margin-y': '8px',
      'color': '#374151',
      'compound-sizing-wrt-labels': 'include',
      'min-width': '100px',
      'min-height': '60px',
      'padding': '15px',
      'z-index': 1
    }
  },

  // Alternative selector for parent nodes (Cytoscape compound pattern)
  {
    selector: ':parent',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#f8fafc',
      'background-opacity': 0.4,
      'border-width': '2px',
      'border-color': '#94a3b8',
      'border-style': 'dashed',
      'label': 'data(label)',
      'font-size': '12px',
      'font-weight': '600',
      'text-valign': 'top',
      'text-halign': 'center',
      'text-margin-y': '8px',
      'color': '#374151',
      'compound-sizing-wrt-labels': 'include',
      'min-width': '100px',
      'min-height': '60px',
      'padding': '15px',
      'z-index': 1
    }
  },

  // Edges - only between leaf nodes
  {
    selector: 'edge',
    style: {
      'width': (ele: any) => Math.max(1.5, Math.min(4, ele.data('weight'))),
      'line-color': '#94a3b8',
      'target-arrow-color': '#94a3b8',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1.2,
      'z-index': 3
    }
  },

  // Selected elements
  {
    selector: '.selected',
    style: {
      'border-width': '3px',
      'border-color': '#2563eb'
    }
  },

  // Hover effects for interactive elements
  {
    selector: 'node[type="folder"]:active',
    style: {
      'border-color': '#2563eb',
      'border-width': '3px'
    }
  },

  // Container class styling
  {
    selector: '.container',
    style: {
      'background-color': '#f1f5f9',
      'background-opacity': 0.5
    }
  },

  // Leaf class styling
  {
    selector: '.leaf',
    style: {
      'overlay-opacity': 0,
      'overlay-color': '#transparent'
    }
  }
];

/**
 * Get node color based on instability
 */
const getNodeColor = (instability: number): string => {
  if (instability < 0.3) return '#22c55e'; // Green - stable
  if (instability < 0.7) return '#f59e0b'; // Orange - moderate
  return '#ef4444'; // Red - unstable
};