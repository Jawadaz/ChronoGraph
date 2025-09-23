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
        // Half-checked folders should show as individual nodes, not collapsed containers
        // They participate in the graph as their own entities
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

  // Find the most appropriate display level for this file path
  // Priority: half-checked nodes > expanded folders > collapsed folders
  let leafNodeId: string | null = null;
  let displayLevel: string | null = null;

  // Look for half-checked nodes first - they are stopping points
  const halfCheckedStoppingPoint = findHalfCheckedStoppingPoint(filePath, treeNodes, includedPaths);
  if (halfCheckedStoppingPoint) {
    displayLevel = halfCheckedStoppingPoint;
    console.log('🛑 Half-checked stopping point found:', displayLevel);
  } else {
    // No half-checked stopping point, use expanded folder logic
    const expandedParent = findDeepestExpandedParent(filePath, expandedFolders, includedPaths);
    if (expandedParent) {
      displayLevel = findAppropriateDisplayLevel(filePath, expandedParent, expandedFolders);
      console.log('📂 Expanded parent logic, display level:', displayLevel);
    } else {
      // Look for any included ancestor
      const includedAncestor = findDeepestIncludedAncestor(filePath, treeNodes, includedPaths);
      if (includedAncestor) {
        displayLevel = includedAncestor;
        console.log('📁 Included ancestor found:', displayLevel);
      }
    }
  }

  if (displayLevel) {
    leafNodeId = displayLevel;
    const treeNode = treeNodes.get(displayLevel);
    if (treeNode) {
      const levelParts = displayLevel.split('/');
      const levelLabel = levelParts[levelParts.length - 1];
      const parentContainer = levelParts.length > 1 ? levelParts.slice(0, -1).join('/') : null;

      // Determine if this level represents a file or folder
      const isFileLevel = displayLevel === filePath;
      createGraphNode(displayLevel, levelLabel, isFileLevel ? 'file' : 'folder', parentContainer, true, nodes);
    }
  }

  console.log('🎯 Final leaf node ID:', leafNodeId);
  return leafNodeId;
}

/**
 * Find half-checked node that should serve as a stopping point for this file path
 * Half-checked nodes represent the appropriate display level and should not be expanded further
 */
function findHalfCheckedStoppingPoint(filePath: string, treeNodes: Map<string, TreeNode>, includedPaths: Set<string>): string | null {
  const pathParts = filePath.split('/').filter(part => part.length > 0);

  // Look for half-checked nodes that are ancestors of this file path
  let deepestHalfChecked: string | null = null;

  for (const [treeNodeId, treeNode] of treeNodes.entries()) {
    if (treeNode.checkboxState === 'half-checked' && includedPaths.has(treeNodeId)) {
      const treeNodeParts = treeNodeId.split('/').filter(part => part.length > 0);

      // Check if this half-checked node is an ancestor of the file path
      if (pathParts.length >= treeNodeParts.length) {
        const isAncestor = treeNodeParts.every((part, index) => pathParts[index] === part);

        if (isAncestor) {
          // This is a valid half-checked ancestor, keep the deepest one
          if (!deepestHalfChecked || treeNodeParts.length > deepestHalfChecked.split('/').length) {
            deepestHalfChecked = treeNodeId;
          }
        }
      }
    }
  }

  return deepestHalfChecked;
}

/**
 * Find the deepest expanded parent folder for this file path
 */
function findDeepestExpandedParent(filePath: string, expandedFolders: Set<string>, includedPaths: Set<string>): string | null {
  const pathParts = filePath.split('/').filter(part => part.length > 0);

  let deepestExpanded: string | null = null;

  for (const expandedFolder of expandedFolders) {
    if (includedPaths.has(expandedFolder)) {
      const expandedParts = expandedFolder.split('/').filter(part => part.length > 0);

      // Check if this expanded folder is an ancestor of the file path
      if (pathParts.length >= expandedParts.length) {
        const isAncestor = expandedParts.every((part, index) => pathParts[index] === part);

        if (isAncestor) {
          // This is a valid expanded ancestor, keep the deepest one
          if (!deepestExpanded || expandedParts.length > deepestExpanded.split('/').length) {
            deepestExpanded = expandedFolder;
          }
        }
      }
    }
  }

  return deepestExpanded;
}

/**
 * Find the deepest included ancestor for this file path
 */
function findDeepestIncludedAncestor(filePath: string, treeNodes: Map<string, TreeNode>, includedPaths: Set<string>): string | null {
  const pathParts = filePath.split('/').filter(part => part.length > 0);

  let deepestIncluded: string | null = null;

  for (const [treeNodeId, treeNode] of treeNodes.entries()) {
    if (treeNodeId === 'project') continue; // Skip root

    if (includedPaths.has(treeNodeId)) {
      const treeNodeParts = treeNodeId.split('/').filter(part => part.length > 0);

      // Check if this node is an ancestor of the file path
      if (pathParts.length >= treeNodeParts.length) {
        const isAncestor = treeNodeParts.every((part, index) => pathParts[index] === part);

        if (isAncestor) {
          // This is a valid included ancestor, keep the deepest one
          if (!deepestIncluded || treeNodeParts.length > deepestIncluded.split('/').length) {
            deepestIncluded = treeNodeId;
          }
        }
      }
    }
  }

  return deepestIncluded;
}

/**
 * Find the appropriate level to display this file path based on expanded folders
 * When lib is expanded, lib/data/services/api/file.dart should show as lib/data
 */
function findAppropriateDisplayLevel(filePath: string, expandedFolderId: string, expandedFolders: Set<string>): string {
  const pathParts = filePath.split('/').filter(part => part.length > 0);
  const expandedParts = expandedFolderId.split('/').filter(part => part.length > 0);

  // The file should be displayed at the level immediately below the expanded folder
  // E.g., if 'lib' is expanded, 'lib/data/services/api/file.dart' should show as 'lib/data'
  const targetLevel = expandedParts.length + 1;

  if (pathParts.length > targetLevel) {
    // Show as a folder at the target level
    return pathParts.slice(0, targetLevel).join('/');
  } else {
    // Show the actual file/folder
    return filePath;
  }
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