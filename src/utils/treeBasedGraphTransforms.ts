import { Dependency } from '../types/Dependency';
import { CytoscapeElement, CytoscapeNodeData, CytoscapeEdgeData } from './cytoscapeTransforms';
import { TreeNode, CheckboxState } from './treeStructure';

/**
 * Transform dependencies to graph elements based on tree selection state
 */
export function transformToTreeBasedGraphElements(
  dependencies: Dependency[],
  treeNodes: Map<string, TreeNode>
): { elements: CytoscapeElement[] } {
  const nodes = new Map<string, CytoscapeNodeData>();
  const edges = new Map<string, CytoscapeEdgeData>();

  // Get filtering info from tree
  const { includedPaths, expandedFolders, collapsedFolders } = getTreeFilteringInfo(treeNodes);

  console.log('🌳 Tree-based filtering:', {
    totalTreeNodes: treeNodes.size,
    includedPaths: includedPaths.size,
    expandedFolders: expandedFolders.size,
    collapsedFolders: collapsedFolders.size,
    sampleIncludedPaths: Array.from(includedPaths).slice(0, 5),
    sampleExpandedFolders: Array.from(expandedFolders).slice(0, 5),
    sampleCollapsedFolders: Array.from(collapsedFolders).slice(0, 5),
    sampleDependencyPaths: dependencies.slice(0, 3).map(d => ({source: d.source_file, target: d.target_file})),
    allTreeNodeIds: Array.from(treeNodes.keys()).slice(0, 10),
    sampleTreeNodes: Array.from(treeNodes.entries()).slice(0, 3).map(([id, node]) => ({id, label: node.label, type: node.type}))
  });

  // Process each dependency
  dependencies.forEach((dep, index) => {
    const sourcePath = normalizePath(dep.source_file);
    const targetPath = normalizePath(dep.target_file);

    // Create nodes for source and target based on tree state
    const sourceLeafId = createTreeBasedNode(sourcePath, treeNodes, includedPaths, expandedFolders, collapsedFolders, nodes);
    const targetLeafId = createTreeBasedNode(targetPath, treeNodes, includedPaths, expandedFolders, collapsedFolders, nodes);

    // Create edge if both endpoints are valid
    if (sourceLeafId && targetLeafId && sourceLeafId !== targetLeafId) {
      const edgeId = `${sourceLeafId}->${targetLeafId}`;

      if (edges.has(edgeId)) {
        // Aggregate existing edge
        const existing = edges.get(edgeId)!;
        existing.weight += 1;
        existing.originalDependencies.push(dep);
      } else {
        // Create new edge
        edges.set(edgeId, {
          id: edgeId,
          source: sourceLeafId,
          target: targetLeafId,
          weight: 1,
          relationshipType: dep.relationship_type,
          originalDependencies: [dep]
        });
      }
    }
  });

  // Create compound parent containers for expanded folders
  createCompoundContainers(treeNodes, expandedFolders, nodes);

  // Convert to Cytoscape elements
  const elements: CytoscapeElement[] = [];

  // Add nodes (parents first, then children)
  const nodeArray = Array.from(nodes.values());
  const containerNodes = nodeArray.filter(n => n.type === 'folder' && !n.isLeaf);
  const leafNodes = nodeArray.filter(n => n.isLeaf);

  // Add containers first
  containerNodes.forEach(nodeData => {
    elements.push({
      group: 'nodes',
      data: nodeData,
      classes: [nodeData.type, 'container', 'expanded']
    });
  });

  // Add leaf nodes
  leafNodes.forEach(nodeData => {
    elements.push({
      group: 'nodes',
      data: nodeData,
      classes: [nodeData.type, nodeData.isExpanded ? 'expanded' : 'collapsed', 'leaf']
    });
  });

  // Add edges
  Array.from(edges.values()).forEach(edgeData => {
    elements.push({
      group: 'edges',
      data: edgeData
    });
  });

  console.log('✅ Tree-based graph elements created:', {
    totalElements: elements.length,
    containers: containerNodes.length,
    leafNodes: leafNodes.length,
    edges: edges.size
  });

  return { elements };
}

/**
 * Extract filtering information from tree checkbox states
 */
function getTreeFilteringInfo(treeNodes: Map<string, TreeNode>): {
  includedPaths: Set<string>;
  expandedFolders: Set<string>;
  collapsedFolders: Set<string>;
} {
  const includedPaths = new Set<string>();
  const expandedFolders = new Set<string>();
  const collapsedFolders = new Set<string>();

  for (const node of treeNodes.values()) {
    switch (node.checkboxState) {
      case 'checked':
        includedPaths.add(node.id);
        if (node.type === 'folder') {
          expandedFolders.add(node.id);
        }
        break;

      case 'half-checked':
        includedPaths.add(node.id);
        if (node.type === 'folder') {
          collapsedFolders.add(node.id);
        }
        break;

      case 'unchecked':
        // Not included
        break;
    }
  }

  return { includedPaths, expandedFolders, collapsedFolders };
}

/**
 * Create a node based on tree filtering state
 * Returns the leaf node ID that should be used for edges
 */
function createTreeBasedNode(
  filePath: string,
  treeNodes: Map<string, TreeNode>,
  includedPaths: Set<string>,
  expandedFolders: Set<string>,
  collapsedFolders: Set<string>,
  nodes: Map<string, CytoscapeNodeData>
): string | null {
  const pathParts = filePath.split('/').filter(part => part.length > 0);

  console.log('🔍 Creating tree-based node for:', filePath, 'pathParts:', pathParts);

  // Find the appropriate tree node that contains this file
  let leafNodeId: string | null = null;
  let bestMatchingTreeNode: TreeNode | null = null;

  // Look for the deepest tree node that contains this file path
  for (const [treeNodeId, treeNode] of treeNodes.entries()) {
    if (treeNodeId === 'project') continue; // Skip root

    // Check if this tree node is an ancestor of or matches the file path
    const treeNodeParts = treeNodeId.split('/').filter(part => part.length > 0);

    // Check if file path starts with this tree node path
    if (pathParts.length >= treeNodeParts.length) {
      const matches = treeNodeParts.every((part, index) => pathParts[index] === part);

      if (matches && includedPaths.has(treeNodeId)) {
        // This tree node contains our file and is included
        if (!bestMatchingTreeNode || treeNodeParts.length > bestMatchingTreeNode.id.split('/').length) {
          bestMatchingTreeNode = treeNode;
        }
      }
    }
  }

  if (bestMatchingTreeNode) {
    const treeNodeId = bestMatchingTreeNode.id;
    console.log('📍 Best matching tree node:', treeNodeId, 'for file:', filePath);

    if (bestMatchingTreeNode.type === 'file') {
      // Direct file match
      leafNodeId = treeNodeId;
      createGraphNode(treeNodeId, bestMatchingTreeNode.label, 'file', null, true, nodes);
    } else {
      // Folder match - check if it's expanded or collapsed
      if (collapsedFolders.has(treeNodeId)) {
        // Folder is collapsed - represent the whole folder as one node
        leafNodeId = treeNodeId;
        createGraphNode(treeNodeId, bestMatchingTreeNode.label, 'folder', null, true, nodes);
      } else if (expandedFolders.has(treeNodeId)) {
        // Folder is expanded - show the actual file
        leafNodeId = filePath;
        const fileName = pathParts[pathParts.length - 1];

        // Find appropriate parent container
        const parentId = findExpandedParentContainer(filePath, expandedFolders);
        createGraphNode(filePath, fileName, 'file', parentId, true, nodes);
      }
    }
  }

  console.log('🎯 Final leaf node ID:', leafNodeId);
  return leafNodeId;
}

/**
 * Find the deepest expanded folder that contains this file path
 */
function findExpandedParentContainer(filePath: string, expandedFolders: Set<string>): string | null {
  const pathParts = filePath.split('/').filter(part => part.length > 0);

  // Check from deepest to shallowest folder
  for (let i = pathParts.length - 1; i >= 1; i--) {
    const folderPath = pathParts.slice(0, i).join('/');
    if (expandedFolders.has(folderPath)) {
      return folderPath;
    }
  }

  return null;
}

/**
 * Create compound containers for expanded folders
 */
function createCompoundContainers(
  treeNodes: Map<string, TreeNode>,
  expandedFolders: Set<string>,
  nodes: Map<string, CytoscapeNodeData>
): void {
  // Create container nodes for expanded folders and establish parent-child relationships
  for (const folderId of expandedFolders) {
    const treeNode = treeNodes.get(folderId);
    if (!treeNode) continue;

    // Create container node if it doesn't exist
    if (!nodes.has(folderId)) {
      createGraphNode(folderId, treeNode.label, 'folder', null, false, nodes);
    }

    // Set up parent-child relationships for nodes within this folder
    for (const nodeData of nodes.values()) {
      if (nodeData.id.startsWith(folderId + '/') && nodeData.id !== folderId) {
        // This node is a child of the expanded folder
        const nodePathParts = nodeData.id.split('/');
        const folderPathParts = folderId.split('/');

        // Check if this is a direct child (not grandchild)
        if (nodePathParts.length === folderPathParts.length + 1) {
          nodeData.parent = folderId;
        }
      }
    }
  }
}

/**
 * Create a graph node with proper metadata
 */
function createGraphNode(
  nodeId: string,
  label: string,
  type: 'file' | 'folder',
  parent: string | null,
  isLeaf: boolean,
  nodes: Map<string, CytoscapeNodeData>
): void {
  if (nodes.has(nodeId)) return;

  nodes.set(nodeId, {
    id: nodeId,
    label,
    type,
    path: nodeId,
    parent,
    isExpanded: !isLeaf,
    isLeaf,
    size: 20 + Math.random() * 20,
    instability: getConsistentInstability(nodeId)
  });
}

/**
 * Normalize file path
 */
function normalizePath(path: string): string {
  let normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');

  // Strip system/temp path prefixes to get project-relative paths
  // This handles paths like: tmp/chronograph/flutter-samples-cache/compass_app/app/lib/...
  // And converts them to: lib/...
  const systemPrefixPatterns = [
    /^tmp\/chronograph\/[^\/]+\/[^\/]+\/[^\/]+\//,  // tmp/chronograph/cache/repo/subfolder/
    /^\/tmp\/chronograph\/[^\/]+\/[^\/]+\/[^\/]+\//, // /tmp/chronograph/cache/repo/subfolder/
    /^[A-Z]:\/tmp\/chronograph\/[^\/]+\/[^\/]+\/[^\/]+\//, // Windows temp paths
  ];

  for (const pattern of systemPrefixPatterns) {
    if (pattern.test(normalized)) {
      const before = normalized;
      normalized = normalized.replace(pattern, '');
      console.log('🔧 Stripped system prefix from path:', before, '->', normalized);
      break;
    }
  }

  return normalized;
}

/**
 * Get consistent instability based on path hash
 */
function getConsistentInstability(path: string): number {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) / 2147483647;
}