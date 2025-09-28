import React from 'react';
import { TreeBasedCytoscapeGraph } from './TreeBasedCytoscapeGraph';
import { TreeView } from './TreeView';

interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight: number;
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

interface CommitSnapshot {
  commit_hash: string;
  timestamp: number;
  commit_info: {
    hash: string;
    author_name: string;
    message: string;
    timestamp: number;
  };
  analysis_result: {
    dependencies: Dependency[];
    analyzed_files: string[];
    metrics: {
      analysis_duration_ms: number;
      total_files: number;
      total_dependencies: number;
    };
  };
}

interface GraphTabProps {
  selectedCommit: CommitSnapshot;
  selectedGraphNode: string | null;
  setSelectedGraphNode: (node: string | null) => void;
  isTreePanelCollapsed: boolean;
  setIsTreePanelCollapsed: (collapsed: boolean) => void;
  treeNodes: Map<string, TreeNode>;
  treeRootId: string | null;
  handleTreeCheckboxChange: (nodeId: string, newState: 'checked' | 'unchecked' | 'half-checked') => void;
  handleEdgeDoubleClick: (sourceId: string, targetId: string, relationshipTypes: string[]) => void;
}

export const GraphTab: React.FC<GraphTabProps> = ({
  selectedCommit,
  selectedGraphNode,
  setSelectedGraphNode,
  isTreePanelCollapsed,
  setIsTreePanelCollapsed,
  treeNodes,
  treeRootId,
  handleTreeCheckboxChange,
  handleEdgeDoubleClick
}) => {
  return (
    <div className="graph-view">

      {/* Tree-Based Graph - Full Width with Collapsible Tree */}
      <div className={`tree-based-graph-container ${isTreePanelCollapsed ? 'tree-collapsed' : ''}`}>
        {!isTreePanelCollapsed && (
          <div className="tree-sidebar">
            <div className="tree-sidebar-header">
              <h4>🌳 Project Structure</h4>
              <button
                onClick={() => setIsTreePanelCollapsed(true)}
                className="collapse-button"
                title="Hide tree panel"
              >
                ◄
              </button>
            </div>
            {treeNodes.size > 0 && treeRootId ? (
              <div className="tree-content">
                <TreeView
                  nodes={treeNodes}
                  rootId={treeRootId}
                  onCheckboxChange={handleTreeCheckboxChange}
                />
              </div>
            ) : (
              <div className="tree-loading">
                🌳 Building project tree...
              </div>
            )}
          </div>
        )}

        <div className="graph-main">
          {isTreePanelCollapsed && (
            <button
              onClick={() => setIsTreePanelCollapsed(false)}
              className="expand-tree-button"
              title="Show tree panel"
            >
              ► Tree
            </button>
          )}
          <TreeBasedCytoscapeGraph
            dependencies={selectedCommit.analysis_result.dependencies}
            treeNodes={treeNodes}
            onNodeSelect={setSelectedGraphNode}
            onEdgeDoubleClick={handleEdgeDoubleClick}
          />
        </div>
      </div>

      <style jsx>{`
        .graph-view {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .tree-based-graph-container {
          display: flex;
          gap: 20px;
          flex: 1;
          margin: 0;
          padding: 20px;
          background: #fafbfc;
          border-top: 1px solid #e2e8f0;
          height: calc(100vh - 200px);
          max-height: calc(100vh - 200px);
          overflow: hidden;
        }

        .tree-sidebar {
          width: 350px;
          flex-shrink: 0;
          height: 100%;
          overflow: hidden;
          background: white;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease;
        }

        .tree-based-graph-container.tree-collapsed .tree-sidebar {
          width: 0;
          opacity: 0;
        }

        .tree-sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
        }

        .tree-sidebar-header h4 {
          margin: 0;
          font-size: 14px;
          color: #374151;
          font-weight: 600;
        }

        .collapse-button {
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

        .collapse-button:hover {
          background: #dc2626;
          transform: scale(1.1);
        }

        .tree-content {
          flex: 1;
          overflow: hidden;
          height: calc(100% - 60px);
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
          position: relative;
          background: white;
        }

        .expand-tree-button {
          position: absolute;
          top: 16px;
          left: 16px;
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

        .expand-tree-button:hover {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        @media (max-width: 1200px) {
          .tree-based-graph-container {
            flex-direction: column;
            height: auto;
            margin-left: -10px;
            margin-right: -10px;
            padding: 0 10px;
          }

          .tree-sidebar {
            width: 100%;
            height: 300px;
          }

          .tree-based-graph-container.tree-collapsed .tree-sidebar {
            height: 0;
          }

          .graph-main {
            height: 500px;
          }

          .expand-tree-button {
            top: 8px;
            left: 8px;
            padding: 6px 10px;
            font-size: 11px;
          }
        }

        @media (max-width: 768px) {
          .tree-based-graph-container {
            margin-left: -10px;
            margin-right: -10px;
            padding: 0 10px;
            height: calc(100vh - 250px);
          }
        }
      `}</style>
    </div>
  );
};