import React, { useState, useCallback } from 'react';
import { TreeNode, CheckboxState, updateCheckboxState } from '../utils/treeStructure';

interface TreeViewProps {
  nodes: Map<string, TreeNode>;
  rootId: string;
  onCheckboxChange: (nodeId: string, newState: CheckboxState) => void;
  hoveredNodeId?: string | null;
  onNodeHover?: (nodeId: string | null) => void;
}

interface TreeNodeItemProps {
  node: TreeNode;
  nodes: Map<string, TreeNode>;
  onCheckboxChange: (nodeId: string, newState: CheckboxState) => void;
  onToggleExpansion: (nodeId: string) => void;
  expandedNodes: Set<string>;
  level: number;
  hoveredNodeId?: string | null;
  onNodeHover?: (nodeId: string | null) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({ nodes, rootId, onCheckboxChange, hoveredNodeId, onNodeHover }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([rootId]));

  // Debug logging
  React.useEffect(() => {
    console.log('🌳 TreeView mounted with nodes:', nodes.size, 'rootId:', rootId);
  }, [nodes, rootId]);

  const handleToggleExpansion = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      const wasExpanded = newSet.has(nodeId);
      if (wasExpanded) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const rootNode = nodes.get(rootId);
  if (!rootNode) return <div>No tree data available</div>;


  return (
    <>
      <div className="tree-view" style={{ height: '100%', overflow: 'hidden' }}>
        <div className="tree-content" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
          <TreeNodeRenderer
            nodeId={rootId}
            nodes={nodes}
            onCheckboxChange={onCheckboxChange}
            onToggleExpansion={handleToggleExpansion}
            expandedNodes={expandedNodes}
            level={0}
            hoveredNodeId={hoveredNodeId}
            onNodeHover={onNodeHover}
          />
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: treeViewStyles }} />
    </>
  );
};

interface TreeNodeRendererProps {
  nodeId: string;
  nodes: Map<string, TreeNode>;
  onCheckboxChange: (nodeId: string, newState: CheckboxState) => void;
  onToggleExpansion: (nodeId: string) => void;
  expandedNodes: Set<string>;
  level: number;
  hoveredNodeId?: string | null;
  onNodeHover?: (nodeId: string | null) => void;
}

const TreeNodeRenderer: React.FC<TreeNodeRendererProps> = ({
  nodeId,
  nodes,
  onCheckboxChange,
  onToggleExpansion,
  expandedNodes,
  level,
  hoveredNodeId,
  onNodeHover
}) => {
  const node = nodes.get(nodeId);
  if (!node) return null;

  const isExpanded = expandedNodes.has(nodeId);
  const hasChildren = node.children.length > 0;

  return (
    <div className="tree-node-container">
      <TreeNodeItem
        node={node}
        nodes={nodes}
        onCheckboxChange={onCheckboxChange}
        onToggleExpansion={onToggleExpansion}
        expandedNodes={expandedNodes}
        level={level}
        hoveredNodeId={hoveredNodeId}
        onNodeHover={onNodeHover}
      />
      {hasChildren && isExpanded && (
        <div className="tree-children">
          {node.children.map(childId => (
            <TreeNodeRenderer
              key={childId}
              nodeId={childId}
              nodes={nodes}
              onCheckboxChange={onCheckboxChange}
              onToggleExpansion={onToggleExpansion}
              expandedNodes={expandedNodes}
              level={level + 1}
              hoveredNodeId={hoveredNodeId}
              onNodeHover={onNodeHover}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  nodes,
  onCheckboxChange,
  onToggleExpansion,
  expandedNodes,
  level,
  hoveredNodeId,
  onNodeHover
}) => {
  const hasChildren = node.children.length > 0;
  const indentLevel = level * 20;
  const isHovered = hoveredNodeId === node.fullPath;

  // Debug logging for root node - repository agnostic
  if (level === 0) {
    console.log('🌳 Root node debug:', {
      nodeId: node.id,
      childrenCount: node.children.length,
      children: node.children,
      hasChildren,
      expandedNodes: Array.from(expandedNodes),
      isRootExpanded: expandedNodes.has(node.id)
    });
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let nextState: CheckboxState;

    if (node.type === 'file') {
      // Files toggle between checked/unchecked
      nextState = node.checkboxState === 'checked' ? 'unchecked' : 'checked';
    } else {
      // Folders cycle through checked -> half-checked -> unchecked -> checked
      switch (node.checkboxState) {
        case 'checked':
          nextState = 'half-checked';
          break;
        case 'half-checked':
          nextState = 'unchecked';
          break;
        case 'unchecked':
          nextState = 'checked';
          break;
        default:
          nextState = 'checked';
      }
    }

    onCheckboxChange(node.id, nextState);
  };

  const handleExpanderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpansion(node.id);
    }
  };

  return (
    <div
      className={`tree-node ${node.type} checkbox-${node.checkboxState} ${isHovered ? 'hovered' : ''}`}
      style={{ paddingLeft: `${indentLevel}px` }}
      onMouseEnter={() => onNodeHover?.(node.fullPath)}
      onMouseLeave={() => onNodeHover?.(null)}
    >
      <div className="tree-node-content">
        {/* Expander for folders with children */}
        <span
          className={`tree-expander ${hasChildren ? 'has-children' : 'no-children'}`}
          onClick={handleExpanderClick}
          style={{
            cursor: hasChildren ? 'pointer' : 'default',
            userSelect: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            fontSize: '10px',
            color: '#64748b'
          }}
        >
          {hasChildren ? (expandedNodes.has(node.id) ? '▼' : '▶') : '○'}
        </span>

        {/* Checkbox */}
        <span
          className={`tree-checkbox ${node.type}-checkbox checkbox-${node.checkboxState}`}
          onClick={handleCheckboxClick}
          title={getCheckboxTitle(node)}
          style={{
            cursor: 'pointer',
            userSelect: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            fontSize: '14px'
          }}
        >
          {getCheckboxSymbol(node.checkboxState, node.type)}
        </span>

        {/* Node icon */}
        <span className={`tree-icon ${node.type}-icon`}>
          {node.type === 'folder' ? '📁' : '📄'}
        </span>

        {/* Node label */}
        <span className="tree-label">{node.label}</span>

        {/* Node count for folders */}
        {node.type === 'folder' && hasChildren && (
          <span className="tree-count">({node.children.length})</span>
        )}
      </div>
    </div>
  );
};

function getCheckboxSymbol(state: CheckboxState, nodeType: 'folder' | 'file'): string {
  if (nodeType === 'file') {
    return state === 'checked' ? '☑' : '☐';
  }

  // Folder checkboxes
  switch (state) {
    case 'checked': return '☑';      // Checked - expanded in graph
    case 'half-checked': return '⊟';  // Half-checked - collapsed in graph
    case 'unchecked': return '☐';     // Unchecked - not in graph
    default: return '☐';
  }
}

function getCheckboxTitle(node: TreeNode): string {
  if (node.type === 'file') {
    return node.checkboxState === 'checked'
      ? 'File included in graph'
      : 'File excluded from graph';
  }

  switch (node.checkboxState) {
    case 'checked':
      return 'Folder included and expanded in graph';
    case 'half-checked':
      return 'Folder included but collapsed in graph';
    case 'unchecked':
      return 'Folder excluded from graph';
    default:
      return '';
  }
}

// CSS styles for TreeView component
export const treeViewStyles = `
.tree-view {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  height: 100%;
  overflow: hidden;
}

.tree-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}

.tree-content {
  position: relative;
}

.tree-node-container {
  position: relative;
}

.tree-children {
  position: relative;
  border-left: 1px solid #cbd5e1;
  margin-left: 10px;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 2px 0;
  margin: 1px 0;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.tree-node:hover {
  background-color: #f1f5f9;
}

.tree-node.hovered {
  background-color: #dbeafe;
  border-left: 3px solid #3b82f6;
  padding-left: calc(var(--indent-level) - 3px);
}

.tree-node-content {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 6px;
}

.tree-expander {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  font-size: 10px;
  cursor: pointer;
  padding: 0 !important;
  margin: 0 !important;
  min-width: 16px;
  width: 16px;
  height: 16px;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none !important;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

.tree-expander:hover:not(:disabled) {
  color: #334155;
  background: transparent !important;
  border: none !important;
}

.tree-expander:focus {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

.tree-expander:disabled {
  cursor: default;
  opacity: 0.5;
}

.tree-expander.no-children {
  cursor: default;
  visibility: hidden;
}

.tree-checkbox {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  font-size: 14px;
  cursor: pointer;
  padding: 0 !important;
  margin: 0 !important;
  min-width: 18px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none !important;
  transition: color 0.15s ease;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

.tree-checkbox:hover {
  transform: scale(1.1);
  background: transparent !important;
  border: none !important;
}

.tree-checkbox:focus {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

.folder-checkbox.checkbox-checked {
  color: #16a34a;
}

.folder-checkbox.checkbox-half-checked {
  color: #ca8a04;
}

.folder-checkbox.checkbox-unchecked {
  color: #6b7280;
}

.file-checkbox.checkbox-checked {
  color: #2563eb;
}

.file-checkbox.checkbox-unchecked {
  color: #9ca3af;
}

.tree-icon {
  font-size: 14px;
  min-width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tree-label {
  color: #374151;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.folder .tree-label {
  font-weight: 600;
}

.tree-count {
  color: #6b7280;
  font-size: 12px;
  font-weight: normal;
  margin-left: auto;
  padding-right: 4px;
}

/* State-specific styling */
.tree-node.folder.checkbox-checked {
  background-color: rgba(34, 197, 94, 0.1);
}

.tree-node.folder.checkbox-half-checked {
  background-color: rgba(234, 179, 8, 0.1);
}

.tree-node.folder.checkbox-unchecked {
  opacity: 0.6;
}

.tree-node.file.checkbox-checked {
  background-color: rgba(37, 99, 235, 0.05);
}

.tree-node.file.checkbox-unchecked {
  opacity: 0.5;
}
`;