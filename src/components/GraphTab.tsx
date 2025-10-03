import React from 'react';
import { TreeBasedCytoscapeGraph } from './TreeBasedCytoscapeGraph';
import { TreeView } from './TreeView';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { AnalysisResult, VisualEncodingConfig } from '../types/Dependency';

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
  analysis_result: AnalysisResult;
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
  const [detailsPanelHeight, setDetailsPanelHeight] = React.useState(50);
  const [isDragging, setIsDragging] = React.useState(false);
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);

  const handleFolderToggle = (nodeId: string) => {
    console.log('🔍 Searching for node:', nodeId, 'in tree with', treeNodes.size, 'nodes');

    // Find the node - it might be a full path or just the folder name
    let node = treeNodes.get(nodeId);
    let foundKey = nodeId;

    // If not found directly, search for it in the tree
    if (!node) {
      for (const [key, treeNode] of treeNodes.entries()) {
        if (key === nodeId || key.endsWith('/' + nodeId) || key.endsWith('\\' + nodeId)) {
          console.log('✅ Found match:', key, 'for nodeId:', nodeId);
          node = treeNode;
          foundKey = key;
          break;
        }
      }
    }

    if (!node) {
      console.log('❌ Node not found. Available keys:', Array.from(treeNodes.keys()).slice(0, 10));
      return;
    }

    if (node.type !== 'folder') {
      console.log('❌ Not a folder, type:', node.type);
      return;
    }

    // Toggle between checked (expanded) and half-checked (collapsed)
    const newState = node.checkboxState === 'checked' ? 'half-checked' : 'checked';
    console.log(`🔄 Toggling ${foundKey} from ${node.checkboxState} to ${newState}`);
    handleTreeCheckboxChange(foundKey, newState);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const sidebar = document.querySelector('.tree-sidebar') as HTMLElement;
      if (!sidebar) return;

      const rect = sidebar.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const percentage = (offsetY / rect.height) * 100;

      // Clamp between 20% and 80%
      const clampedPercentage = Math.max(20, Math.min(80, 100 - percentage));
      setDetailsPanelHeight(clampedPercentage);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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
                  hoveredNodeId={hoveredNodeId}
                  onNodeHover={setHoveredNodeId}
                />
              </div>
            ) : (
              <div className="tree-loading">
                🌳 Building project tree...
              </div>
            )}

            {/* Node Details Panel below tree */}
            {selectedGraphNode && (
              <>
                <div
                  className="resize-handle"
                  onMouseDown={handleMouseDown}
                  title="Drag to resize"
                />
                <div
                  className="node-details-container"
                  style={{ flex: `0 0 ${detailsPanelHeight}%` }}
                >
                  <NodeDetailsPanel
                    selectedNodeId={selectedGraphNode}
                    analysisResult={selectedCommit.analysis_result}
                    visualEncodingConfig={{
                      enable_size_encoding: true,
                      enable_color_encoding: true,
                      size_scaling_factor: 1.0,
                      color_intensity: 1.0,
                      highlight_orphans: true,
                      highlight_cycles: true
                    }}
                    onClose={() => setSelectedGraphNode(null)}
                  />
                </div>
              </>
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
            analysisResult={selectedCommit.analysis_result}
            visualEncodingConfig={{
              enable_size_encoding: true,
              enable_color_encoding: true,
              size_scaling_factor: 1.0,
              color_intensity: 1.0,
              highlight_orphans: true,
              highlight_cycles: true
            }}
            onNodeSelect={setSelectedGraphNode}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            hoveredNodeId={hoveredNodeId}
            onNodeHover={setHoveredNodeId}
            onToggleFolderExpansion={handleFolderToggle}
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
          padding: 10px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
        }

        .tree-sidebar-header h4 {
          margin: 0;
          font-size: 13px;
          color: #374151;
          font-weight: 600;
        }

        .collapse-button {
          background: #ef4444;
          color: white;
          border: none;
          width: 22px;
          height: 22px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
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
          min-height: 0;
        }

        .resize-handle {
          height: 4px;
          background: #cbd5e1;
          cursor: ns-resize;
          flex-shrink: 0;
          transition: background 0.2s;
          position: relative;
        }

        .resize-handle:hover {
          background: #94a3b8;
        }

        .resize-handle:active {
          background: #64748b;
        }

        .node-details-container {
          overflow: hidden;
          min-height: 0;
          flex-shrink: 0;
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
            flex-direction: row;
            height: auto;
            margin-left: -10px;
            margin-right: -10px;
            padding: 0 10px;
          }

          .tree-sidebar {
            width: 300px;
            max-width: 40%;
            height: 100%;
          }

          .tree-based-graph-container.tree-collapsed .tree-sidebar {
            width: 0;
            opacity: 0;
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