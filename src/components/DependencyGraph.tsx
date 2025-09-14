import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  normalizePath,
  isPathWithinFolder,
  getRelativeFromViewRoot,
  filterDependenciesForViewRoot,
  getFolderAtLevel,
  getFolderAtLevelRelativeToViewRoot,
  type Dependency
} from '../utils/dependencyFiltering';


interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'file' | 'folder';
  path: string;
  size: number;
  instability: number;
  parent?: string;
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: GraphNode;
  target: GraphNode;
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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [folderLevel, setFolderLevel] = useState<number>(1);
  const [viewRootFolder, setViewRootFolder] = useState<string>('/'); // Current zoom level root

  // Helper function to get consistent instability based on path hash
  const getConsistentInstability = (path: string): number => {
    // Create a simple hash from the path string for consistent coloring
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      const char = path.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert hash to a value between 0 and 1
    return Math.abs(hash) / 2147483647; // Max 32-bit signed integer
  };

  // Helper function to get parent folder
  const getParentFolder = (folderPath: string): string => {
    if (folderPath === '/') return '/';
    const lastSlashIndex = folderPath.lastIndexOf('/');
    if (lastSlashIndex <= 0) return '/';
    return folderPath.substring(0, lastSlashIndex);
  };

  // Transform dependencies into graph data
  const transformToGraphData = (deps: Dependency[], level: 'file' | 'folder', folderDepth?: number) => {
    try {
      const nodes = new Map<string, GraphNode>();
      const edgeMap = new Map<string, GraphEdge>(); // For edge aggregation

      // Use advanced filtering
      const { filtered: filteredDeps, strategy, stats } = filterDependenciesForViewRoot(deps, viewRootFolder);

      // Comprehensive debug logging
      if (viewRootFolder !== '/') {
        console.log(`🔍 ViewRoot Analysis: ${viewRootFolder}`);
        console.log(`📊 Dependency Stats:`, stats);
        console.log(`🎯 Strategy Selected: ${strategy}`);
        console.log(`📈 FilteredDeps: ${filteredDeps.length} (from ${deps.length} total)`);

        if (filteredDeps.length > 0) {
          console.log('✅ Sample filtered dependencies:', filteredDeps.slice(0, 3).map(dep => ({
            source: dep.source_file,
            target: dep.target_file,
            relationship: dep.relationship_type
          })));
        } else {
          console.warn('⚠️ No dependencies found with current strategy!');
          console.log('🔍 ViewRoot filtering debug:', {
            viewRootFolder,
            normalizedViewRoot: normalizePath(viewRootFolder),
            sampleDependencies: deps.slice(0, 5).map(dep => ({
              source: dep.source_file,
              target: dep.target_file,
              sourceNorm: normalizePath(dep.source_file),
              targetNorm: normalizePath(dep.target_file),
              sourceWithin: isPathWithinFolder(dep.source_file, viewRootFolder),
              targetWithin: isPathWithinFolder(dep.target_file, viewRootFolder),
              sourceStartsWithViewRoot: normalizePath(dep.source_file).startsWith(normalizePath(viewRootFolder) + '/'),
              targetStartsWithViewRoot: normalizePath(dep.target_file).startsWith(normalizePath(viewRootFolder) + '/'),
            }))
          });
        }
      }

    filteredDeps.forEach((dep, index) => {
      let sourceId, targetId;

      // Since we only show internal dependencies, both source and target are within viewRootFolder
      if (level === 'folder' && folderDepth !== undefined) {
        // Use specific folder level relative to view root
        const sourceFullPath = getFolderAtLevelRelativeToViewRoot(dep.source_file, folderDepth, viewRootFolder);
        const targetFullPath = getFolderAtLevelRelativeToViewRoot(dep.target_file, folderDepth, viewRootFolder);

        sourceId = getRelativeFromViewRoot(sourceFullPath, viewRootFolder);
        targetId = getRelativeFromViewRoot(targetFullPath, viewRootFolder);
      } else if (level === 'folder') {
        // Extract folder paths relative to view root
        const sourceFull = dep.source_file.substring(0, dep.source_file.lastIndexOf('/')) || '/';
        const targetFull = dep.target_file.substring(0, dep.target_file.lastIndexOf('/')) || '/';

        sourceId = getRelativeFromViewRoot(sourceFull, viewRootFolder);
        targetId = getRelativeFromViewRoot(targetFull, viewRootFolder);
      } else {
        // File level - just use relative file paths
        sourceId = getRelativeFromViewRoot(dep.source_file, viewRootFolder);
        targetId = getRelativeFromViewRoot(dep.target_file, viewRootFolder);
      }

      // Skip self-dependencies and invalid IDs
      if (!sourceId || !targetId || sourceId === targetId) return;

      // Create nodes if they don't exist
      if (!nodes.has(sourceId)) {
        const sourceLabel = level === 'folder'
          ? (sourceId === '/' ? (viewRootFolder === '/' ? 'root' : viewRootFolder.split('/').pop() || 'root') : sourceId.split('/').filter(p => p).pop() || sourceId)
          : (getRelativeFromViewRoot(dep.source_file, viewRootFolder).split('/').pop() || dep.source_file.split('/').pop() || dep.source_file);

        nodes.set(sourceId, {
          id: sourceId,
          label: sourceLabel,
          type: level,
          path: sourceId,
          size: 1,
          instability: getConsistentInstability(sourceId),
          parent: level === 'folder' && sourceId.includes('/') && sourceId !== '/'
            ? sourceId.substring(0, sourceId.lastIndexOf('/'))
            : undefined
        });
      }

      if (!nodes.has(targetId)) {
        const targetLabel = level === 'folder'
          ? (targetId === '/' ? (viewRootFolder === '/' ? 'root' : viewRootFolder.split('/').pop() || 'root') : targetId.split('/').filter(p => p).pop() || targetId)
          : (getRelativeFromViewRoot(dep.target_file, viewRootFolder).split('/').pop() || dep.target_file.split('/').pop() || dep.target_file);

        nodes.set(targetId, {
          id: targetId,
          label: targetLabel,
          type: level,
          path: targetId,
          size: 1,
          instability: getConsistentInstability(targetId),
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
        // Create new edge - we'll resolve source/target references later
        edgeMap.set(edgeKey, {
          source: sourceId as any,
          target: targetId as any,
          weight: 1,
          type: dep.relationship_type,
          originalDependencies: [dep]
        });
      }
    });

    const nodeArray = Array.from(nodes.values());
    const edgeArray = Array.from(edgeMap.values());

    // Resolve edge source/target references to actual node objects
    const nodeMap = new Map(nodeArray.map(n => [n.id, n]));
    const resolvedEdges = edgeArray.map(edge => ({
      ...edge,
      source: nodeMap.get(edge.source as string)!,
      target: nodeMap.get(edge.target as string)!
    }));

    return {
      nodes: nodeArray,
      edges: resolvedEdges
    };
    } catch (error) {
      console.error('❌ Error in transformToGraphData:', error);
      console.error('Error details:', {
        viewRootFolder,
        level,
        folderDepth,
        depsCount: deps.length,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Return empty graph data on error
      return {
        nodes: [],
        edges: []
      };
    }
  };

  // Initialize D3.js graph
  useEffect(() => {
    if (!containerRef.current || !dependencies || dependencies.length === 0) {
      console.log('⚠️ Skipping D3 initialization:', {
        containerAvailable: !!containerRef.current,
        dependenciesCount: dependencies?.length || 0
      });
      return;
    }

    try {
      const { nodes, edges } = transformToGraphData(
        dependencies,
        levelOfDetail,
        levelOfDetail === 'folder' ? folderLevel : undefined
      );

      console.log('📊 Graph data generated:', { nodesCount: nodes.length, edgesCount: edges.length, viewRootFolder });

      // Clear previous SVG first
      d3.select(containerRef.current).selectAll('svg').remove();

      // Don't create graph if no data - but leave empty canvas
      if (nodes.length === 0) {
        console.log('⚠️ No nodes to display, creating empty canvas');

        // Create empty SVG for consistent UI
        const width = containerRef.current.clientWidth;
        const height = 600;
        const svg = d3.select(containerRef.current)
          .append('svg')
          .attr('width', width)
          .attr('height', height)
          .attr('viewBox', `0 0 ${width} ${height}`);

        // Add a message for empty state
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('font-size', '16px')
          .attr('font-family', 'system-ui, -apple-system, sans-serif')
          .attr('fill', '#64748b')
          .text(`No dependencies found within "${viewRootFolder === '/' ? 'root' : viewRootFolder.split(/[/\\]/).pop()}"`);

        return;
      }


      // Create SVG
      const width = containerRef.current.clientWidth;
      const height = 600;

      const svg = d3.select(containerRef.current)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`);

      svgRef.current = svg.node();

      // Create zoom behavior
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
          container.attr('transform', event.transform);
        });

      svg.call(zoom);

      // Create arrowhead marker FIRST
      const defs = svg.append('defs');
      defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', 0)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#94a3b8');

      // Create container for all graph elements
      const container = svg.append('g');

      // Create force simulation
      const simulation = d3.forceSimulation<GraphNode, GraphEdge>(nodes)
        .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id(d => d.id).distance(150).strength(0.5))
        .force('charge', d3.forceManyBody().strength(-800))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => Math.max(25, Math.min(45, Math.sqrt(d.size) * 8 + 5))))
        .force('x', d3.forceX(width / 2).strength(0.1))
        .force('y', d3.forceY(height / 2).strength(0.1));

      simulationRef.current = simulation;

      // Color scale for node instability
      const getNodeColor = (instability: number) => {
        if (instability < 0.3) return '#22c55e'; // Green - stable
        if (instability < 0.7) return '#f59e0b'; // Orange - moderate
        return '#ef4444'; // Red - unstable
      };

      console.log('🎨 Creating graph elements:', { nodeCount: nodes.length, edgeCount: edges.length });

      // Create links (edges) FIRST so they appear behind nodes
      const link = container.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(edges)
        .enter().append('line')
        .attr('class', 'edge')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', d => Math.max(1.5, Math.min(4, d.weight)))
        .attr('stroke-opacity', 0.7)
        .attr('marker-end', 'url(#arrowhead)');

      // Create nodes AFTER edges so they appear on top
      const node = container.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(nodes)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag<SVGGElement, GraphNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      console.log('🔗 Created', link.size(), 'edges and', node.size(), 'nodes');

      // Add circles to nodes
      const circles = node.append('circle')
        .attr('r', d => Math.max(20, Math.min(40, Math.sqrt(d.size) * 8)))
        .attr('fill', d => getNodeColor(d.instability))
        .attr('stroke', d => d.type === 'folder' ? '#64748b' : '#ffffff')
        .attr('stroke-width', d => d.type === 'folder' ? 3 : 1)
        .attr('opacity', 0.9);

      console.log('⭕ Created', circles.size(), 'circles');

      // Add labels to nodes
      node.append('text')
        .text(d => {
          // Truncate long labels
          const label = d.label || d.id;
          return label.length > 12 ? label.substring(0, 12) + '...' : label;
        })
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '11px')
        .attr('font-family', 'system-ui, -apple-system, sans-serif')
        .attr('font-weight', '500')
        .attr('fill', '#ffffff')
        .attr('stroke', '#000000')
        .attr('stroke-width', '0.5px')
        .attr('paint-order', 'stroke fill')
        .attr('pointer-events', 'none');

      // Node click handlers
      node.on('click', function(event, d) {
        // Clear previous highlights
        node.select('circle')
          .attr('stroke', n => n.type === 'folder' ? '#64748b' : '#ffffff')
          .attr('stroke-width', n => n.type === 'folder' ? 3 : 1);
        link
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', e => Math.max(1.5, Math.min(4, e.weight)))
          .attr('stroke-opacity', 0.7);

        // Highlight selected node and connected edges
        d3.select(this).select('circle')
          .attr('stroke', '#2563eb')
          .attr('stroke-width', 4);

        // Highlight connected edges
        link.filter(l => l.source.id === d.id || l.target.id === d.id)
          .attr('stroke', '#2563eb')
          .attr('stroke-width', 4)
          .attr('stroke-opacity', 1);

        setSelectedNode(d.id);
        onNodeSelect?.(d.id);
      });

      // Double-click handler for folder navigation
      node.on('dblclick', function(event, d) {
        event.stopPropagation();

        if (d.type === 'folder' && d.id !== '/') {
          // Calculate the absolute path for the folder to zoom into
          let absolutePath;

          if (viewRootFolder === '/') {
            // We're at root level, so node.id is already the full path
            absolutePath = d.id;
          } else {
            // We're in a subfolder, need to construct the full absolute path
            // d.id is relative to current viewRoot, so prepend the viewRoot
            if (d.id.startsWith('/')) {
              // If nodeId already starts with '/', it's relative from viewRoot
              absolutePath = `${viewRootFolder}${d.id}`;
            } else {
              // If nodeId doesn't start with '/', add a separator
              absolutePath = `${viewRootFolder}/${d.id}`;
            }
          }

          // Normalize path separators to forward slashes and clean up
          absolutePath = absolutePath.replace(/\\/g, '/').replace(/\/+/g, '/');

          // Remove trailing slash if any
          if (absolutePath !== '/' && absolutePath.endsWith('/')) {
            absolutePath = absolutePath.slice(0, -1);
          }

          console.log('📁 Zooming into folder:', {
            nodeId: d.id,
            nodeType: d.type,
            currentViewRoot: viewRootFolder,
            calculatedAbsolutePath: absolutePath
          });

          setViewRootFolder(absolutePath);
          setSelectedNode(null);
          // Reset folder level to 1 when changing view root
          setFolderLevel(1);
        } else {
          console.log('⚠️ Skipping zoom - not a valid folder:', {
            nodeId: d.id,
            nodeType: d.type
          });
        }
      });

      // Edge double-click handler
      link.on('dblclick', function(event, d) {
        if (onEdgeDoubleClick && d.originalDependencies) {
          const relationshipTypes = [...new Set(d.originalDependencies.map(dep => dep.relationship_type))];
          onEdgeDoubleClick(d.source.id, d.target.id, relationshipTypes);
        }
      });

      // Background click to clear selection
      svg.on('click', function(event) {
        if (event.target === this) {
          node.select('circle')
            .attr('stroke', n => n.type === 'folder' ? '#64748b' : '#ffffff')
            .attr('stroke-width', n => n.type === 'folder' ? 3 : 1);
          link
            .attr('stroke', '#94a3b8')
            .attr('stroke-width', e => Math.max(1.5, Math.min(4, e.weight)))
            .attr('stroke-opacity', 0.7);
          setSelectedNode(null);
          onNodeSelect?.(null);
        }
      });

      // Simulation tick function
      simulation.on('tick', () => {
        // Position edges from edge to edge of circles, not center to center
        link
          .attr('x1', d => {
            const dx = d.target.x! - d.source.x!;
            const dy = d.target.y! - d.source.y!;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const sourceRadius = Math.max(20, Math.min(40, Math.sqrt(d.source.size) * 8));
            return d.source.x! + (dx / dist) * sourceRadius;
          })
          .attr('y1', d => {
            const dx = d.target.x! - d.source.x!;
            const dy = d.target.y! - d.source.y!;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const sourceRadius = Math.max(20, Math.min(40, Math.sqrt(d.source.size) * 8));
            return d.source.y! + (dy / dist) * sourceRadius;
          })
          .attr('x2', d => {
            const dx = d.source.x! - d.target.x!;
            const dy = d.source.y! - d.target.y!;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const targetRadius = Math.max(20, Math.min(40, Math.sqrt(d.target.size) * 8));
            return d.target.x! + (dx / dist) * targetRadius;
          })
          .attr('y2', d => {
            const dx = d.source.x! - d.target.x!;
            const dy = d.source.y! - d.target.y!;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const targetRadius = Math.max(20, Math.min(40, Math.sqrt(d.target.size) * 8));
            return d.target.y! + (dy / dist) * targetRadius;
          });

        node
          .attr('transform', d => `translate(${d.x},${d.y})`);
      });

      // Drag functions
      function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }

      console.log('✅ D3.js graph fully initialized and ready');

      // Cleanup
      return () => {
        simulation.stop();
        simulationRef.current = null;
      };
    } catch (error) {
      console.error('❌ Error initializing D3.js graph:', error);
      console.error('D3.js Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        viewRootFolder,
        levelOfDetail,
        folderLevel,
        dependenciesCount: dependencies.length
      });
    }
  }, [dependencies, levelOfDetail, folderLevel, viewRootFolder, onNodeSelect, onEdgeDoubleClick]);

  const fitToView = () => {
    if (svgRef.current && simulationRef.current) {
      const svg = d3.select(svgRef.current);
      const bounds = (svg.select('g').node() as SVGGElement)?.getBBox();
      if (bounds) {
        const width = +svg.attr('width');
        const height = +svg.attr('height');
        const scale = Math.min(width / bounds.width, height / bounds.height) * 0.9;
        const translateX = width / 2 - scale * (bounds.x + bounds.width / 2);
        const translateY = height / 2 - scale * (bounds.y + bounds.height / 2);

        svg.transition().duration(750)
          .call(d3.zoom<SVGSVGElement, unknown>().transform as any,
                d3.zoomIdentity.translate(translateX, translateY).scale(scale));
      }
    }
  };

  const centerView = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const width = +svg.attr('width');
      const height = +svg.attr('height');

      svg.transition().duration(750)
        .call(d3.zoom<SVGSVGElement, unknown>().transform as any,
              d3.zoomIdentity.translate(width / 2, height / 2).scale(1));
    }
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

          {/* Navigation Controls */}
          {viewRootFolder !== '/' && (
            <button
              onClick={() => setViewRootFolder(getParentFolder(viewRootFolder))}
              className="control-btn go-up-btn"
              title={`Go up to ${getParentFolder(viewRootFolder)}`}
            >
              ⬆️ Go Up
            </button>
          )}

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
              📁 <strong>{viewRootFolder === '/' ? 'Root' : viewRootFolder.split('/').pop()}</strong> •{' '}
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

        .go-up-btn {
          background: #f0f9ff;
          border-color: #0ea5e9;
          color: #0369a1;
        }

        .go-up-btn:hover {
          background: #e0f2fe;
          border-color: #0284c7;
          color: #0c4a6e;
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