import React from 'react';
import { TimelineTab } from './TimelineTab';
import { StatisticsTab } from './StatisticsTab';
import { DependenciesTab } from './DependenciesTab';
import { GraphTab } from './GraphTab';
import { buildProjectTreeFromLakos, updateCheckboxState } from '../utils/treeStructure';

interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight: number;
}

interface CommitInfo {
  hash: string;
  author_name: string;
  message: string;
  timestamp: number;
}

interface CommitSnapshot {
  commit_hash: string;
  timestamp: number;
  commit_info: CommitInfo;
  dependencies: Dependency[];
  analysis_result: {
    analyzed_files: string[];
    dependencies: Dependency[];
    metrics: {
      analysis_duration_ms: number;
      total_files: number;
      total_dependencies: number;
    };
  };
}

interface Statistics {
  total_snapshots: number;
  total_dependencies: number;
  total_files_analyzed: number;
  time_span_seconds: number;
  authors?: Array<{
    name: string;
    commits: number;
    color?: string;
  }>;
}

interface EdgeFilter {
  sourceId: string;
  targetId: string;
  relationshipTypes: string[];
}

interface TreeNode {
  id: string;
  label: string;
  fullPath: string;
  type: 'folder' | 'file';
  parent?: string;
  children: string[];
  checkboxState: 'checked' | 'unchecked' | 'half-checked';
  isExpanded?: boolean;
}

interface AnalysisResultsProps {
  snapshots: CommitSnapshot[];
  statistics: Statistics | null;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ snapshots, statistics }) => {
  // Tab state
  const [activeTab, setActiveTab] = React.useState<'timeline' | 'statistics' | 'dependencies' | 'graph'>('graph');

  // Selected commit state
  const [selectedCommit, setSelectedCommit] = React.useState<CommitSnapshot | null>(snapshots[0] || null);

  // Dependencies tab state
  const [dependencyFilter, setDependencyFilter] = React.useState('');
  const [dependencySort, setDependencySort] = React.useState<'source' | 'target' | 'type'>('source');
  const [showAllDeps, setShowAllDeps] = React.useState(false);
  const [dependencyLimit, setDependencyLimit] = React.useState(50);
  const [edgeFilter, setEdgeFilter] = React.useState<EdgeFilter | null>(null);

  // Graph tab state
  const [selectedGraphNode, setSelectedGraphNode] = React.useState<string | null>(null);
  const [isTreePanelCollapsed, setIsTreePanelCollapsed] = React.useState(false);

  // Compare mode state
  const [compareMode, setCompareMode] = React.useState(false);
  const [compareCommitA, setCompareCommitA] = React.useState<CommitSnapshot | null>(snapshots[0] || null);
  const [compareCommitB, setCompareCommitB] = React.useState<CommitSnapshot | null>(snapshots[1] || null);

  // Build tree immediately from selected commit (using useMemo for synchronous initialization)
  const projectTree = React.useMemo(() => {
    if (!selectedCommit) {
      return { nodes: new Map<string, TreeNode>(), rootId: null };
    }

    const tree = buildProjectTreeFromLakos(selectedCommit.analysis_result.dependencies);
    return tree;
  }, [selectedCommit]);

  // Use useRef for stable tree reference - never recreated, only mutated in place
  const treeNodesRef = React.useRef<Map<string, TreeNode>>(projectTree.nodes);
  const [treeRootId, setTreeRootId] = React.useState<string | null>(projectTree.rootId);

  // Version counter to trigger re-renders when tree state changes
  const [treeVersion, setTreeVersion] = React.useState(0);

  // Update ref when tree changes (happens when selectedCommit changes)
  React.useEffect(() => {
    treeNodesRef.current = projectTree.nodes;
    setTreeRootId(projectTree.rootId);
    setTreeVersion(v => v + 1);
  }, [projectTree]);

  // Handle tree node checkbox changes with in-place mutation
  const handleTreeCheckboxChange = (nodeId: string, newState: 'checked' | 'unchecked' | 'half-checked') => {
    // Mutate the Map in place instead of creating a new one
    updateCheckboxState(nodeId, newState, treeNodesRef.current);
    // Increment version to trigger re-render
    setTreeVersion(v => v + 1);
  };

  // Handle edge double-click for filtering
  const handleEdgeDoubleClick = (sourceId: string, targetId: string, relationshipTypes: string[]) => {
    setEdgeFilter({ sourceId, targetId, relationshipTypes });
    setActiveTab('dependencies');
  };

  if (snapshots.length === 0) {
    return (
      <div className="analysis-results-empty">
        <h3>📊 No Analysis Results Yet</h3>
        <p>Start an analysis to see temporal dependency data here.</p>
      </div>
    );
  }

  return (
    <div className="analysis-results">
      <div className="results-header">
        <h2>📈 Analysis Results</h2>
        <div className="tab-navigation">
          <button
            className={`tab ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            🔗 Graph
          </button>
          <button
            className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            📅 Timeline
          </button>
          <button
            className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
            onClick={() => setActiveTab('statistics')}
          >
            📊 Statistics
          </button>
          <button
            className={`tab ${activeTab === 'dependencies' ? 'active' : ''}`}
            onClick={() => setActiveTab('dependencies')}
          >
            🔗 Dependencies
          </button>
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'timeline' && (
          <TimelineTab
            snapshots={snapshots}
            selectedCommit={selectedCommit}
            onCommitSelect={setSelectedCommit}
          />
        )}

        {activeTab === 'statistics' && statistics && (
          <StatisticsTab statistics={statistics} />
        )}

        {activeTab === 'dependencies' && selectedCommit && (
          <DependenciesTab
            selectedCommit={selectedCommit}
            dependencyFilter={dependencyFilter}
            setDependencyFilter={setDependencyFilter}
            dependencySort={dependencySort}
            setDependencySort={setDependencySort}
            showAllDeps={showAllDeps}
            setShowAllDeps={setShowAllDeps}
            dependencyLimit={dependencyLimit}
            setDependencyLimit={setDependencyLimit}
            edgeFilter={edgeFilter}
            setEdgeFilter={setEdgeFilter}
          />
        )}

        {activeTab === 'graph' && selectedCommit && (
          <GraphTab
            selectedCommit={selectedCommit}
            selectedGraphNode={selectedGraphNode}
            setSelectedGraphNode={setSelectedGraphNode}
            isTreePanelCollapsed={isTreePanelCollapsed}
            setIsTreePanelCollapsed={setIsTreePanelCollapsed}
            treeNodes={treeNodesRef.current}
            treeRootId={treeRootId}
            treeVersion={treeVersion}
            handleTreeCheckboxChange={handleTreeCheckboxChange}
            handleEdgeDoubleClick={handleEdgeDoubleClick}
            compareMode={compareMode}
            setCompareMode={setCompareMode}
            compareCommitA={compareCommitA}
            setCompareCommitA={setCompareCommitA}
            compareCommitB={compareCommitB}
            setCompareCommitB={setCompareCommitB}
            allSnapshots={snapshots}
          />
        )}
      </div>

      <style jsx>{`
        .analysis-results {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          max-height: 100%;
          overflow: hidden;
          height: 100%;
        }

        .analysis-results-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 2px solid #e0e7ff;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin: 0;
        }

        .results-header h2 {
          margin: 0;
          font-size: 1.5em;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        .tab-navigation {
          display: flex;
          gap: 4px;
        }

        .tab {
          padding: 8px 16px;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9em;
          font-weight: 500;
          transition: all 0.2s ease;
          backdrop-filter: blur(10px);
        }

        .tab:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }

        .tab.active {
          background: rgba(255, 255, 255, 0.9);
          color: #4C51BF;
          font-weight: 600;
        }

        .tab-content {
          flex: 1;
          padding: 0;
          overflow: hidden;
          min-height: 0;
          max-height: calc(100vh - 200px);
          height: auto;
        }
      `}</style>
    </div>
  );
};