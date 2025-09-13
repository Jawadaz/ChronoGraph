import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';

interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight: any;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'folder';
  path: string;
  size: number;
  instability: number;
  parent?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: string;
  originalDependencies: Dependency[];
}

interface DependencyGraphProps {
  dependencies: Dependency[];
  onNodeSelect?: (nodeId: string | null) => void;
  onEdgeDoubleClick?: (sourceId: string, targetId: string, relationshipTypes: string[]) => void;
  levelOfDetail: 'file' | 'folder';
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  dependencies,
  onNodeSelect,
  onEdgeDoubleClick,
  levelOfDetail = 'file'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [folderLevel, setFolderLevel] = useState<number>(1);

  // Helper function to get folder path at specific level
  const getFolderAtLevel = (filePath: string, level: number): string => {
    const parts = filePath.split('/').filter(part => part.length > 0);
    if (level === 0 || parts.length === 0) return '/';

    const folderParts = parts.slice(0, Math.min(level, parts.length - 1));
    return folderParts.length > 0 ? folderParts.join('/') : '/';
  };

  // Transform dependencies into graph data
  const transformToGraphData = (deps: Dependency[], level: 'file' | 'folder', folderDepth?: number) => {
    const nodes = new Map<string, GraphNode>();
    const edgeMap = new Map<string, GraphEdge>(); // For edge aggregation

    deps.forEach((dep, index) => {
      let sourceId, targetId;

      if (level === 'folder' && folderDepth !== undefined) {
        // Use specific folder level
        sourceId = getFolderAtLevel(dep.source_file, folderDepth);
        targetId = getFolderAtLevel(dep.target_file, folderDepth);

        // Skip self-dependencies at folder level
        if (sourceId === targetId) return;
      } else if (level === 'folder') {
        // Extract folder paths (everything up to the last '/')
        sourceId = dep.source_file.substring(0, dep.source_file.lastIndexOf('/')) || '/';
        targetId = dep.target_file.substring(0, dep.target_file.lastIndexOf('/')) || '/';

        // Skip self-dependencies at folder level
        if (sourceId === targetId) return;
      } else {
        sourceId = dep.source_file;
        targetId = dep.target_file;
      }

      // Create nodes if they don't exist
      if (!nodes.has(sourceId)) {
        const sourceLabel = level === 'folder'
          ? (sourceId === '/' ? 'root' : sourceId.split('/').pop() || sourceId)
          : dep.source_file.split('/').pop() || dep.source_file;

        nodes.set(sourceId, {
          id: sourceId,
          label: sourceLabel,
          type: level,
          path: sourceId,
          size: 1,
          instability: Math.random(), // TODO: Calculate actual instability
          parent: level === 'folder' && sourceId.includes('/') && sourceId !== '/'
            ? sourceId.substring(0, sourceId.lastIndexOf('/'))
            : undefined
        });
      }

      if (!nodes.has(targetId)) {
        const targetLabel = level === 'folder'
          ? (targetId === '/' ? 'root' : targetId.split('/').pop() || targetId)
          : dep.target_file.split('/').pop() || dep.target_file;

        nodes.set(targetId, {
          id: targetId,
          label: targetLabel,
          type: level,
          path: targetId,
          size: 1,
          instability: Math.random(), // TODO: Calculate actual instability
          parent: level === 'folder' && targetId.includes('/') && targetId !== '/'
            ? targetId.substring(0, targetId.lastIndexOf('/'))
            : undefined
        });
      }

      // Increment node sizes based on usage
      nodes.get(sourceId)!.size += 1;
      nodes.get(targetId)!.size += 1;

      // Aggregate edges between same source and target
      const edgeKey = `${sourceId}->${targetId}`;
      if (edgeMap.has(edgeKey)) {
        // Increment weight of existing edge
        const existingEdge = edgeMap.get(edgeKey)!;
        existingEdge.weight += 1;
        existingEdge.originalDependencies.push(dep);

        // Combine relationship types if different
        if (!existingEdge.type.includes(dep.relationship_type)) {
          existingEdge.type = `${existingEdge.type}, ${dep.relationship_type}`;
        }
      } else {
        // Create new edge
        edgeMap.set(edgeKey, {
          source: sourceId,
          target: targetId,
          weight: 1,
          type: dep.relationship_type,
          originalDependencies: [dep]
        });
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edgeMap.values())
    };
  };

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const { nodes, edges } = transformToGraphData(
      dependencies,
      levelOfDetail,
      levelOfDetail === 'folder' ? folderLevel : undefined
    );

    // Convert to Cytoscape format
    const elements = [
      ...nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          size: node.size,
          instability: node.instability,
          parent: node.parent
        },
        classes: node.type
      })),
      ...edges.map((edge, index) => ({
        data: {
          id: `edge-${index}`,
          source: edge.source,
          target: edge.target,
          weight: edge.weight,
          type: edge.type,
          originalDependencies: edge.originalDependencies
        }
      }))
    ];

    // Cytoscape configuration
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        // Node styles
        {
          selector: 'node',
          style: {
            'background-color': (node: any) => {
              const instability = node.data('instability');
              // Color coding: green (stable) to red (unstable)
              if (instability < 0.3) return '#22c55e'; // Green
              if (instability < 0.7) return '#f59e0b'; // Yellow
              return '#ef4444'; // Red
            },
            'label': 'data(label)',
            'width': (node: any) => Math.max(30, Math.min(100, node.data('size') * 8)),
            'height': (node: any) => Math.max(30, Math.min(100, node.data('size') * 8)),
            'font-size': '12px',
            'text-valign': 'center',
            'text-halign': 'center',
            'overlay-opacity': 0
          }
        },
        // Folder-specific styles
        {
          selector: 'node.folder',
          style: {
            'shape': 'round-rectangle',
            'border-width': 2,
            'border-color': '#64748b'
          }
        },
        // File-specific styles
        {
          selector: 'node.file',
          style: {
            'shape': 'ellipse'
          }
        },
        // Edge styles
        {
          selector: 'edge',
          style: {
            'width': (edge: any) => Math.max(1, Math.min(10, edge.data('weight') * 2)),
            'line-color': (edge: any) => {
              const weight = edge.data('weight');
              // Color intensity based on weight: lighter for single, darker for multiple
              if (weight === 1) return '#cbd5e1'; // Light gray for single dependencies
              if (weight <= 5) return '#94a3b8';  // Medium gray for moderate
              if (weight <= 10) return '#64748b'; // Darker gray for many
              return '#475569'; // Very dark gray for heavy dependencies
            },
            'target-arrow-color': (edge: any) => {
              const weight = edge.data('weight');
              if (weight === 1) return '#cbd5e1';
              if (weight <= 5) return '#94a3b8';
              if (weight <= 10) return '#64748b';
              return '#475569';
            },
            'target-arrow-shape': 'triangle',
            'arrow-scale': (edge: any) => Math.max(1, Math.min(2, 1 + edge.data('weight') * 0.1)),
            'curve-style': 'bezier',
            'overlay-opacity': 0
          }
        },
        // Selected node styles
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#2563eb'
          }
        },
        // Highlighted edges (connected to selected node)
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#2563eb',
            'target-arrow-color': '#2563eb',
            'width': (edge: any) => Math.max(2, Math.min(12, edge.data('weight') * 3))
          }
        }
      ],
      layout: {
        name: 'cose', // Force-directed layout
        idealEdgeLength: 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0
      },
      wheelSensitivity: 0.2,
      minZoom: 0.1,
      maxZoom: 3
    });

    // Store reference
    cyRef.current = cy;

    // Event handlers
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeId = node.id();

      // Clear previous highlights
      cy.elements().removeClass('highlighted');

      // Highlight connected edges
      node.connectedEdges().addClass('highlighted');

      setSelectedNode(nodeId);
      onNodeSelect?.(nodeId);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        // Clicked on background - clear selection
        cy.elements().removeClass('highlighted');
        setSelectedNode(null);
        onNodeSelect?.(null);
      }
    });

    // Double-click handler for edges
    cy.on('dblclick', 'edge', (evt) => {
      const edge = evt.target;
      const sourceId = edge.data('source');
      const targetId = edge.data('target');
      const originalDependencies = edge.data('originalDependencies') as Dependency[];

      if (onEdgeDoubleClick && originalDependencies) {
        // Extract unique relationship types
        const relationshipTypes = [...new Set(originalDependencies.map(dep => dep.relationship_type))];
        onEdgeDoubleClick(sourceId, targetId, relationshipTypes);
      }
    });

    // Fit to view
    cy.fit();

    // Cleanup
    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [dependencies, levelOfDetail, folderLevel, onNodeSelect, onEdgeDoubleClick]);

  const fitToView = () => {
    cyRef.current?.fit();
  };

  const centerView = () => {
    cyRef.current?.center();
  };

  return (
    <div className="dependency-graph">
      {/* Graph Controls */}
      <div className="graph-controls">
        <div className="control-group">
          <button onClick={fitToView} className="control-btn">
            🔍 Fit to View
          </button>
          <button onClick={centerView} className="control-btn">
            🎯 Center
          </button>

          {levelOfDetail === 'folder' && (
            <div className="folder-level-control">
              <label htmlFor="folder-level">📁 Folder Level:</label>
              <select
                id="folder-level"
                value={folderLevel}
                onChange={(e) => setFolderLevel(Number(e.target.value))}
                className="folder-level-select"
              >
                <option value={1}>Level 1</option>
                <option value={2}>Level 2</option>
                <option value={3}>Level 3</option>
                <option value={4}>Level 4</option>
              </select>
            </div>
          )}
        </div>

        <div className="graph-info">
          {selectedNode ? (
            <span className="selected-info">
              Selected: <strong>{selectedNode.split('/').pop()}</strong>
            </span>
          ) : (
            <span className="graph-stats">
              {dependencies.length} dependencies • {levelOfDetail} level
              {levelOfDetail === 'folder' && ` • folder level ${folderLevel}`}
            </span>
          )}
        </div>
      </div>

      {/* Graph Container */}
      <div
        ref={containerRef}
        className="graph-container"
        style={{ width: '100%', height: '600px' }}
      />

      {/* Legend */}
      <div className="graph-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#22c55e' }}></div>
          <span>Stable (low instability)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
          <span>Moderate instability</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ef4444' }}></div>
          <span>Unstable (high instability)</span>
        </div>
      </div>

      <style jsx>{`
        .dependency-graph {
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

        .folder-level-control {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 12px;
          font-size: 12px;
        }

        .folder-level-control label {
          font-weight: 500;
          color: #374151;
        }

        .folder-level-select {
          padding: 4px 8px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          background: white;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .folder-level-select:hover {
          border-color: #2563eb;
        }

        .folder-level-select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 1px #2563eb;
        }

        .graph-info {
          font-size: 14px;
          color: #64748b;
        }

        .selected-info {
          color: #2563eb;
        }

        .graph-container {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          background: white;
        }

        .graph-legend {
          display: flex;
          gap: 24px;
          padding: 12px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
};