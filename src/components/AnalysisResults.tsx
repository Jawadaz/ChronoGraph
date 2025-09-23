import React, { useState } from 'react';
import { DependencyGraph } from './DependencyGraph';
import { CytoscapeGraph } from './CytoscapeGraph';
import { TreeView, treeViewStyles } from './TreeView';
import { TreeBasedCytoscapeGraph } from './TreeBasedCytoscapeGraph';
import { buildProjectTreeFromLakos, updateCheckboxState, CheckboxState, TreeNode } from '../utils/treeStructure';
import { transformToTreeBasedGraphElements } from '../utils/treeBasedGraphTransforms';

interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight: any;
}

interface CommitInfo {
  hash: string;
  author_name: string;
  message: string;
  timestamp: number;
}

interface CommitSnapshot {
  commit_info: CommitInfo;
  analysis_result: {
    dependencies: Dependency[];
    analyzed_files: string[];
    metrics: {
      total_files_found: number;
      files_analyzed: number;
      dependencies_found: number;
      analysis_duration_ms: number;
    };
  };
}

interface AnalysisResultsProps {
  snapshots: CommitSnapshot[];
  statistics: {
    total_snapshots: number;
    total_dependencies: number;
    total_files_analyzed: number;
    time_span_seconds: number;
    first_commit_hash: string;
    last_commit_hash: string;
    author_commit_counts: Record<string, number>;
  } | null;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ snapshots, statistics }) => {
  const [selectedCommit, setSelectedCommit] = React.useState<CommitSnapshot | null>(null);
  const [viewMode, setViewMode] = React.useState<'timeline' | 'statistics' | 'dependencies' | 'graph'>('timeline');

  // Dependencies view state
  const [dependencyFilter, setDependencyFilter] = React.useState('');
  const [dependencySort, setDependencySort] = React.useState<'source' | 'target' | 'type'>('source');
  const [dependencyLimit, setDependencyLimit] = React.useState(100);
  const [showAllDeps, setShowAllDeps] = React.useState(false);

  // Edge filter state
  const [edgeFilter, setEdgeFilter] = React.useState<{
    sourceId: string;
    targetId: string;
    relationshipTypes: string[];
  } | null>(null);

  // Graph view state
  const [levelOfDetail, setLevelOfDetail] = React.useState<'file' | 'folder'>('file');
  const [selectedGraphNode, setSelectedGraphNode] = React.useState<string | null>(null);
  const [graphType, setGraphType] = useState<'d3' | 'cytoscape' | 'tree-based'>('tree-based');

  // Tree-based graph state
  const [treeNodes, setTreeNodes] = useState<Map<string, TreeNode>>(new Map());
  const [treeRootId, setTreeRootId] = useState<string>('');

  if (snapshots.length === 0) {
    return (
      <div className="no-results">
        <h3>📊 No Analysis Results Yet</h3>
        <p>Start an analysis to see temporal dependency data here.</p>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Handle edge double-click from graph
  const handleEdgeDoubleClick = (sourceId: string, targetId: string, relationshipTypes: string[]) => {
    setEdgeFilter({ sourceId, targetId, relationshipTypes });
    setViewMode('dependencies');
  };

  // Build tree when commit changes or graph type changes to tree-based
  React.useEffect(() => {
    console.log('🔍 Tree useEffect triggered:', {
      hasSelectedCommit: !!selectedCommit,
      graphType,
      dependenciesCount: selectedCommit?.analysis_result.dependencies.length || 0
    });

    if (selectedCommit && graphType === 'tree-based') {
      console.log('🌲 Building tree for real compass_app data...');
      const projectTree = buildProjectTreeFromLakos(selectedCommit.analysis_result.dependencies);
      setTreeNodes(projectTree.nodes);
      setTreeRootId(projectTree.rootId);

      console.log('🌳 Built project tree:', {
        rootId: projectTree.rootId,
        totalNodes: projectTree.nodes.size,
        sampleNodes: Array.from(projectTree.nodes.keys()).slice(0, 5)
      });
    }
  }, [selectedCommit, graphType]);

  // Handle tree checkbox changes
  const handleTreeCheckboxChange = (nodeId: string, newState: CheckboxState) => {
    const updatedNodes = updateCheckboxState(nodeId, newState, treeNodes);
    setTreeNodes(updatedNodes);

    console.log('🔄 Tree checkbox changed:', {
      nodeId,
      newState,
      updatedNodesCount: updatedNodes.size
    });
  };

  // Helper functions for dependency management
  const getFilteredDependencies = (dependencies: Dependency[]) => {
    let filtered = dependencies;

    // Apply text filter
    if (dependencyFilter.trim()) {
      const filter = dependencyFilter.toLowerCase();
      filtered = filtered.filter(dep =>
        dep.source_file.toLowerCase().includes(filter) ||
        dep.target_file.toLowerCase().includes(filter) ||
        dep.relationship_type.toLowerCase().includes(filter)
      );
    }

    // Apply edge filter from graph double-click
    if (edgeFilter) {
      filtered = filtered.filter(dep => {
        const sourceMatch = dep.source_file.includes(edgeFilter.sourceId) ||
                           edgeFilter.sourceId.includes(dep.source_file) ||
                           dep.source_file === edgeFilter.sourceId;
        const targetMatch = dep.target_file.includes(edgeFilter.targetId) ||
                           edgeFilter.targetId.includes(dep.target_file) ||
                           dep.target_file === edgeFilter.targetId;
        const typeMatch = edgeFilter.relationshipTypes.includes(dep.relationship_type);

        return sourceMatch && targetMatch && typeMatch;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (dependencySort) {
        case 'source':
          return a.source_file.localeCompare(b.source_file);
        case 'target':
          return a.target_file.localeCompare(b.target_file);
        case 'type':
          return a.relationship_type.localeCompare(b.relationship_type);
        default:
          return 0;
      }
    });

    // Apply display limit
    const limit = showAllDeps ? filtered.length : dependencyLimit;
    return {
      displayed: filtered.slice(0, limit),
      total: filtered.length,
      hasMore: filtered.length > limit
    };
  };

  return (
    <div className="analysis-results">
      <div className="results-header">
        <h2>📈 Analysis Results</h2>
        <div className="view-controls">
          <button 
            className={viewMode === 'timeline' ? 'active' : ''}
            onClick={() => setViewMode('timeline')}
          >
            📅 Timeline
          </button>
          <button 
            className={viewMode === 'statistics' ? 'active' : ''}
            onClick={() => setViewMode('statistics')}
          >
            📊 Statistics
          </button>
          <button
            className={viewMode === 'dependencies' ? 'active' : ''}
            onClick={() => setViewMode('dependencies')}
          >
            🔗 Dependencies
          </button>
          <button
            className={viewMode === 'graph' ? 'active' : ''}
            onClick={() => setViewMode('graph')}
          >
            📊 Graph
          </button>
        </div>
      </div>

      {viewMode === 'timeline' && (
        <div className="timeline-view">
          <h3>🕐 Commit Timeline ({snapshots.length} snapshots)</h3>
          <div className="commits-list">
            {snapshots.map((snapshot, index) => (
              <div 
                key={snapshot.commit_info.hash}
                className={`commit-item ${selectedCommit?.commit_info.hash === snapshot.commit_info.hash ? 'selected' : ''}`}
                onClick={() => setSelectedCommit(selectedCommit?.commit_info.hash === snapshot.commit_info.hash ? null : snapshot)}
              >
                <div className="commit-header">
                  <span className="commit-hash">
                    {snapshot.commit_info.hash.substring(0, 8)}
                  </span>
                  <span className="commit-author">
                    👤 {snapshot.commit_info.author_name}
                  </span>
                  <span className="commit-date">
                    📅 {formatDate(snapshot.commit_info.timestamp)}
                  </span>
                </div>
                <div className="commit-message">
                  {snapshot.commit_info.message.split('\n')[0]}
                </div>
                <div className="commit-stats">
                  📁 {snapshot.analysis_result.analyzed_files.length} files • 
                  🔗 {snapshot.analysis_result.dependencies.length} dependencies • 
                  ⏱️ {formatDuration(snapshot.analysis_result.metrics.analysis_duration_ms)}
                </div>
              </div>
            ))}
          </div>

          {selectedCommit && (
            <div className="commit-details">
              <h4>📋 Commit Details</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>Hash:</strong> <code>{selectedCommit.commit_info.hash}</code>
                </div>
                <div className="detail-item">
                  <strong>Author:</strong> {selectedCommit.commit_info.author_name}
                </div>
                <div className="detail-item">
                  <strong>Date:</strong> {formatDate(selectedCommit.commit_info.timestamp)}
                </div>
                <div className="detail-item">
                  <strong>Files Analyzed:</strong> {selectedCommit.analysis_result.analyzed_files.length}
                </div>
                <div className="detail-item">
                  <strong>Dependencies:</strong> {selectedCommit.analysis_result.dependencies.length}
                </div>
                <div className="detail-item">
                  <strong>Analysis Time:</strong> {formatDuration(selectedCommit.analysis_result.metrics.analysis_duration_ms)}
                </div>
              </div>
              <div className="commit-message-full">
                <strong>Message:</strong>
                <pre>{selectedCommit.commit_info.message}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'statistics' && statistics && (
        <div className="statistics-view">
          <h3>📊 Analysis Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{statistics.total_snapshots}</div>
              <div className="stat-label">Commits Analyzed</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{statistics.total_dependencies}</div>
              <div className="stat-label">Total Dependencies</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{statistics.total_files_analyzed}</div>
              <div className="stat-label">Files Analyzed</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{Math.round(statistics.time_span_seconds / 86400)}</div>
              <div className="stat-label">Days Covered</div>
            </div>
          </div>

          <div className="authors-section">
            <h4>👥 Author Contributions</h4>
            <div className="authors-list">
              {Object.entries(statistics.author_commit_counts)
                .sort(([,a], [,b]) => b - a)
                .map(([author, count]) => (
                  <div key={author} className="author-item">
                    <span className="author-name">{author}</span>
                    <span className="author-count">{count} commits</span>
                    <div className="author-bar">
                      <div 
                        className="author-bar-fill"
                        style={{ 
                          width: `${(count / Math.max(...Object.values(statistics.author_commit_counts))) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'dependencies' && selectedCommit && (() => {
        const depData = getFilteredDependencies(selectedCommit.analysis_result.dependencies);
        return (
          <div className="dependencies-view">
            <h3>🔗 Dependencies for Commit {selectedCommit.commit_info.hash.substring(0, 8)}</h3>

            {/* Controls */}
            <div className="dependencies-controls">
              <div className="control-group">
                <input
                  type="text"
                  placeholder="Filter dependencies..."
                  value={dependencyFilter}
                  onChange={(e) => setDependencyFilter(e.target.value)}
                  className="filter-input"
                />
              </div>

              <div className="control-group">
                <label>Sort by:</label>
                <select
                  value={dependencySort}
                  onChange={(e) => setDependencySort(e.target.value as 'source' | 'target' | 'type')}
                  className="sort-select"
                >
                  <option value="source">Source File</option>
                  <option value="target">Target File</option>
                  <option value="type">Relationship Type</option>
                </select>
              </div>

              <div className="control-group">
                <label>Show:</label>
                <select
                  value={showAllDeps ? 'all' : dependencyLimit.toString()}
                  onChange={(e) => {
                    if (e.target.value === 'all') {
                      setShowAllDeps(true);
                    } else {
                      setShowAllDeps(false);
                      setDependencyLimit(parseInt(e.target.value));
                    }
                  }}
                  className="limit-select"
                >
                  <option value="25">First 25</option>
                  <option value="50">First 50</option>
                  <option value="100">First 100</option>
                  <option value="250">First 250</option>
                  <option value="all">All ({depData.total})</option>
                </select>
              </div>
            </div>

            {/* Edge Filter Display - Compact */}
            {edgeFilter && (
              <div className="edge-filter-compact">
                <span className="filter-badge">
                  🔍 {edgeFilter.sourceId.split('/').pop()} → {edgeFilter.targetId.split('/').pop()}
                  <span className="filter-type-badge">({edgeFilter.relationshipTypes.join(', ')})</span>
                </span>
                <button
                  className="clear-filter-compact"
                  onClick={() => setEdgeFilter(null)}
                  title="Clear filter"
                >
                  ×
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="dependencies-stats">
              Showing {depData.displayed.length} of {depData.total} dependencies
              {dependencyFilter && (
                <span className="filter-indicator"> (filtered)</span>
              )}
            </div>

            {/* Dependencies List */}
            <div className="dependencies-list">
              {depData.displayed.map((dep, index) => (
                <div key={index} className="dependency-item">
                  <div className="dependency-source" title={dep.source_file}>
                    📄 {dep.source_file.split('/').pop() || dep.source_file}
                    <div className="dependency-path">{dep.source_file.substring(0, dep.source_file.lastIndexOf('/'))}</div>
                  </div>
                  <div className="dependency-arrow">→</div>
                  <div className="dependency-target" title={dep.target_file}>
                    📄 {dep.target_file.split('/').pop() || dep.target_file}
                    <div className="dependency-path">{dep.target_file.substring(0, dep.target_file.lastIndexOf('/'))}</div>
                  </div>
                  <div className="dependency-type">
                    {dep.relationship_type}
                  </div>
                </div>
              ))}

              {depData.hasMore && !showAllDeps && (
                <div className="more-dependencies">
                  <button
                    onClick={() => setShowAllDeps(true)}
                    className="show-all-btn"
                  >
                    Show all {depData.total} dependencies
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Graph View */}
      {viewMode === 'graph' && selectedCommit && (
        <div className="graph-view">
          <div className="graph-header">
            <h3>📊 Dependency Graph for Commit {selectedCommit.commit_info.hash.substring(0, 8)}</h3>

            <div className="graph-controls">
              <div className="control-group">
                <label>Level of Detail:</label>
                <select
                  value={levelOfDetail}
                  onChange={(e) => setLevelOfDetail(e.target.value as 'file' | 'folder')}
                  className="lod-select"
                >
                  <option value="file">📄 Files</option>
                  <option value="folder">📁 Folders</option>
                </select>
              </div>

              {selectedGraphNode && (
                <div className="selected-node-info">
                  <strong>Selected:</strong> {selectedGraphNode.split('/').pop()}
                </div>
              )}
            </div>
          </div>

          {/* Graph Type Selector */}
          <div className="graph-type-selector">
            <div className="selector-group">
              <label>📊 Graph Engine:</label>
              <select
                value={graphType}
                onChange={(e) => setGraphType(e.target.value as 'd3' | 'cytoscape' | 'tree-based')}
                className="graph-type-select"
              >
                <option value="tree-based">🌳 Tree-Based Control (New)</option>
                <option value="cytoscape">🆕 Cytoscape.js (Hierarchical)</option>
                <option value="d3">🔧 D3.js (Current)</option>
              </select>
            </div>
            <div className="graph-description">
              {graphType === 'tree-based' ?
                '🌳 Tree-controlled visualization with three-state checkboxes for precise filtering' :
                graphType === 'cytoscape' ?
                '✨ New hierarchical layout with expandable folders and compound nodes' :
                '🔧 Current force-directed layout for comparison'
              }
            </div>
          </div>

          {/* Conditional Graph Rendering */}
          {graphType === 'tree-based' ? (
            <div className="tree-based-graph-container">
              <div className="tree-sidebar">
                {treeNodes.size > 0 && treeRootId ? (
                  <TreeView
                    nodes={treeNodes}
                    rootId={treeRootId}
                    onCheckboxChange={handleTreeCheckboxChange}
                  />
                ) : (
                  <div className="tree-loading">
                    🌳 Building project tree...
                  </div>
                )}
              </div>
              <div className="graph-main">
                <TreeBasedCytoscapeGraph
                  dependencies={selectedCommit.analysis_result.dependencies}
                  treeNodes={treeNodes}
                  onNodeSelect={setSelectedGraphNode}
                  onEdgeDoubleClick={handleEdgeDoubleClick}
                />
              </div>
            </div>
          ) : graphType === 'cytoscape' ? (
            <CytoscapeGraph
              dependencies={selectedCommit.analysis_result.dependencies}
              levelOfDetail={levelOfDetail}
              onNodeSelect={setSelectedGraphNode}
              onEdgeDoubleClick={handleEdgeDoubleClick}
              viewRootFolder="/"
              folderLevel={1}
            />
          ) : (
            <DependencyGraph
              dependencies={selectedCommit.analysis_result.dependencies}
              levelOfDetail={levelOfDetail}
              onNodeSelect={setSelectedGraphNode}
              onEdgeDoubleClick={handleEdgeDoubleClick}
            />
          )}
        </div>
      )}

      <style jsx>{`
        .analysis-results {
          margin-top: 30px;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .view-controls {
          display: flex;
          gap: 10px;
        }

        .view-controls button {
          padding: 8px 16px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .view-controls button.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .view-controls button:hover:not(.active) {
          border-color: #2563eb;
          color: #2563eb;
        }

        .commits-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .commit-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .commit-item:hover {
          border-color: #2563eb;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .commit-item.selected {
          border-color: #2563eb;
          background: #eff6ff;
        }

        .commit-header {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .commit-hash {
          font-family: monospace;
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .commit-message {
          font-weight: 500;
          margin-bottom: 8px;
          color: #374151;
        }

        .commit-stats {
          font-size: 12px;
          color: #6b7280;
        }

        .commit-details {
          margin-top: 20px;
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin: 16px 0;
        }

        .detail-item {
          font-size: 14px;
        }

        .commit-message-full pre {
          background: white;
          padding: 12px;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
          white-space: pre-wrap;
          font-size: 13px;
          margin: 8px 0 0 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin: 20px 0;
        }

        .stat-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
        }

        .stat-number {
          font-size: 32px;
          font-weight: bold;
          color: #2563eb;
        }

        .stat-label {
          font-size: 14px;
          color: #6b7280;
          margin-top: 4px;
        }

        .authors-section {
          margin-top: 30px;
        }

        .authors-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }

        .author-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }

        .author-name {
          min-width: 150px;
          font-weight: 500;
        }

        .author-count {
          min-width: 80px;
          font-size: 14px;
          color: #6b7280;
        }

        .author-bar {
          flex: 1;
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
        }

        .author-bar-fill {
          height: 100%;
          background: #2563eb;
          transition: width 0.3s ease;
        }

        .dependencies-controls {
          display: flex;
          gap: 20px;
          align-items: center;
          margin: 16px 0;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .control-group label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          white-space: nowrap;
        }

        .filter-input {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          width: 200px;
        }

        .filter-input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .sort-select, .limit-select {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .sort-select:focus, .limit-select:focus {
          outline: none;
          border-color: #2563eb;
        }

        .dependencies-stats {
          margin: 8px 0;
          font-size: 14px;
          color: #6b7280;
        }

        .filter-indicator {
          font-weight: 500;
          color: #2563eb;
        }

        .dependencies-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 16px;
          max-height: 600px;
          overflow-y: auto;
        }

        .dependency-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 14px;
        }

        .dependency-source,
        .dependency-target {
          flex: 1;
          font-family: monospace;
          min-width: 0; /* Allow flex items to shrink */
        }

        .dependency-path {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dependency-arrow {
          color: #6b7280;
        }

        .dependency-type {
          min-width: 80px;
          font-size: 12px;
          color: #6b7280;
          text-align: right;
        }

        .more-dependencies {
          padding: 12px;
          text-align: center;
          color: #6b7280;
        }

        .show-all-btn {
          background: #2563eb;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .show-all-btn:hover {
          background: #1d4ed8;
        }

        .no-results {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        /* Graph View Styles */
        .graph-view {
          margin-top: 20px;
        }

        .graph-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 16px 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        .graph-controls {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .lod-select {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .lod-select:focus {
          outline: none;
          border-color: #2563eb;
        }

        .selected-node-info {
          font-size: 14px;
          color: #2563eb;
          padding: 6px 12px;
          background: #eff6ff;
          border-radius: 6px;
        }

        .graph-type-selector {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          margin: 16px 0;
        }

        .selector-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .selector-group label {
          font-weight: 600;
          color: #0c4a6e;
          font-size: 14px;
        }

        .graph-type-select {
          padding: 6px 12px;
          border: 1px solid #0284c7;
          border-radius: 6px;
          background: white;
          font-size: 14px;
          cursor: pointer;
          min-width: 200px;
        }

        .graph-type-select:focus {
          outline: none;
          border-color: #0369a1;
          box-shadow: 0 0 0 2px #bae6fd;
        }

        .graph-description {
          font-size: 13px;
          color: #0369a1;
          font-style: italic;
        }

        .edge-filter-compact {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 0;
          padding: 6px 12px;
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 6px;
          font-size: 14px;
        }

        .filter-badge {
          color: #0369a1;
          font-weight: 500;
        }

        .filter-type-badge {
          color: #64748b;
          font-weight: 400;
          margin-left: 4px;
        }

        .clear-filter-compact {
          background: #ef4444;
          color: white;
          border: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .clear-filter-compact:hover {
          background: #dc2626;
          transform: scale(1.1);
        }

        /* Tree-based graph layout */
        .tree-based-graph-container {
          display: flex;
          gap: 20px;
          margin-top: 20px;
          height: 650px;
        }

        .tree-sidebar {
          width: 350px;
          flex-shrink: 0;
          height: 100%;
          overflow: hidden;
        }

        .tree-loading {
          padding: 40px 20px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .graph-main {
          flex: 1;
          height: 100%;
          min-width: 0;
        }

        .tree-based-cytoscape-container {
          width: 100%;
          height: 100%;
          position: relative;
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

        /* Responsive adjustments */
        @media (max-width: 1200px) {
          .tree-based-graph-container {
            flex-direction: column;
            height: auto;
          }

          .tree-sidebar {
            width: 100%;
            height: 400px;
          }

          .graph-main {
            height: 500px;
          }
        }
      `}</style>
      <style jsx>{treeViewStyles}</style>
    </div>
  );
};