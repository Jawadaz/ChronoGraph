import { Dependency } from '../types/Dependency';
import { CytoscapeElement, CytoscapeNodeData, CytoscapeEdgeData } from './cytoscapeTransforms';
import { TreeNode, CheckboxState } from './treeStructure';
import { DependencyDiff } from './commitDiff';

/**
 * Transform dependencies to graph elements based on tree selection state
 */
export function transformToTreeBasedGraphElements(
  dependencies: Dependency[],
  treeNodes: Map<string, TreeNode>,
  dependencyDiff?: DependencyDiff | null
): { elements: CytoscapeElement[] } {
  const nodes = new Map<string, CytoscapeNodeData>();
  const edges = new Map<string, CytoscapeEdgeData>();

  // Helper to get diff status for a dependency
  const getDiffStatus = (dep: Dependency): 'added' | 'removed' | 'unchanged' | null => {
    if (!dependencyDiff) return null;

    const createKey = (d: Dependency) =>
      `${d.source_file}→${d.target_file}→${d.relationship_type}`;
    const key = createKey(dep);

    if (dependencyDiff.added.find(d => createKey(d) === key)) return 'added';
    if (dependencyDiff.removed.find(d => createKey(d) === key)) return 'removed';
    if (dependencyDiff.unchanged.find(d => createKey(d) === key)) return 'unchanged';

    return null;
  };

  // Get filtering info from tree
  const { includedPaths, expandedFolders, collapsedFolders } = getTreeFilteringInfo(treeNodes);

  // Find root node (has no parent) - exclude only artificial roots like 'app'
  const rootNode = Array.from(treeNodes.values()).find(node => !node.parent);
  const rootId = rootNode?.id;

  // Only exclude artificial root nodes, not real project folders
  const shouldExcludeRoot = rootId === 'app' || rootId === 'project' || rootId === 'src';


  let processedCount = 0;
  let skippedCount = 0;

  // Process each dependency
  dependencies.forEach((dep, index) => {
    const sourcePath = normalizePath(dep.source_file);
    const targetPath = normalizePath(dep.target_file);

    // Only process dependencies where both source and target should be visible
    // Check if the source and target paths map to included tree nodes
    const sourceDisplayLevel = determineDisplayLevel(sourcePath, treeNodes, includedPaths, expandedFolders, collapsedFolders);
    const targetDisplayLevel = determineDisplayLevel(targetPath, treeNodes, includedPaths, expandedFolders, collapsedFolders);

    // Skip this dependency if either endpoint is not included in the tree view
    if (!sourceDisplayLevel || !targetDisplayLevel || !includedPaths.has(sourceDisplayLevel) || !includedPaths.has(targetDisplayLevel)) {
      skippedCount++;
      return;
    }

    // Create nodes for source and target (we know they're both included now)
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

        // Update diff status - prioritize added/removed over unchanged
        const depStatus = getDiffStatus(dep);
        if (depStatus === 'added' || depStatus === 'removed') {
          existing.diffStatus = depStatus;
        } else if (!existing.diffStatus) {
          existing.diffStatus = depStatus;
        }
      } else {
        // Create new edge
        edges.set(edgeId, {
          id: edgeId,
          source: sourceLeafId,
          target: targetLeafId,
          weight: 1,
          relationshipType: dep.relationship_type,
          originalDependencies: [dep],
          diffStatus: getDiffStatus(dep)
        });
      }
    } else {
      processedCount++;
    }
  });


  // Create compound parent containers for expanded folders (excluding artificial root)
  createCompoundContainers(treeNodes, expandedFolders, nodes, shouldExcludeRoot ? rootId : undefined);

  // Create nodes for all included paths that don't exist yet (half-checked folders, excluding artificial root)
  createIncludedNodes(treeNodes, includedPaths, expandedFolders, nodes, shouldExcludeRoot ? rootId : undefined);

  // Mark nodes that have dependency changes (added/removed)
  if (dependencyDiff) {
    markNodesWithChanges(nodes, edges);
  }

  // Convert to Cytoscape elements
  const elements: CytoscapeElement[] = [];

  // Add nodes (parents first, then children)
  const nodeArray = Array.from(nodes.values());
  const containerNodes = nodeArray.filter(n => n.type === 'folder' && !n.isLeaf);
  const leafNodes = nodeArray.filter(n => n.isLeaf);

  // Add containers first
  containerNodes.forEach(nodeData => {
    const classes = [nodeData.type, 'expanded'];
    if (nodeData.hasChanges) classes.push('has-changes');

    elements.push({
      group: 'nodes',
      data: nodeData,
      classes
    });
  });

  // Add leaf nodes
  leafNodes.forEach(nodeData => {
    const classes = [nodeData.type, nodeData.isExpanded ? 'expanded' : 'collapsed', 'leaf'];
    if (nodeData.hasChanges) classes.push('has-changes');

    elements.push({
      group: 'nodes',
      data: nodeData,
      classes
    });
  });

  // Add edges
  Array.from(edges.values()).forEach(edgeData => {
    elements.push({
      group: 'edges',
      data: edgeData
    });
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
 * Determine what display level a file path should use without creating the node
 */
function determineDisplayLevel(
  filePath: string,
  treeNodes: Map<string, TreeNode>,
  includedPaths: Set<string>,
  expandedFolders: Set<string>,
  collapsedFolders: Set<string>
): string | null {
  // Look for half-checked nodes first - they are stopping points
  const halfCheckedStoppingPoint = findHalfCheckedStoppingPoint(filePath, treeNodes, includedPaths);
  if (halfCheckedStoppingPoint) {
    return halfCheckedStoppingPoint;
  }

  // No half-checked stopping point, use expanded folder logic
  const expandedParent = findDeepestExpandedParent(filePath, expandedFolders, includedPaths);
  if (expandedParent) {
    return findAppropriateDisplayLevel(filePath, expandedParent, expandedFolders);
  }

  // Look for any included ancestor
  const includedAncestor = findDeepestIncludedAncestor(filePath, treeNodes, includedPaths);
  if (includedAncestor) {
    return includedAncestor;
  }

  return null;
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


  // Determine the display level using the shared logic
  const displayLevel = determineDisplayLevel(filePath, treeNodes, includedPaths, expandedFolders, collapsedFolders);
  let leafNodeId: string | null = null;

  if (displayLevel && includedPaths.has(displayLevel)) {
    // Only create nodes for paths that are included (checked or half-checked)
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
 * Create compound containers for expanded folders with proper nesting
 */
function createCompoundContainers(
  treeNodes: Map<string, TreeNode>,
  expandedFolders: Set<string>,
  nodes: Map<string, CytoscapeNodeData>,
  rootId?: string
): void {
  // First, create all container nodes for expanded folders (process from shallowest to deepest)
  const sortedFolders = Array.from(expandedFolders).sort((a, b) => a.length - b.length);

  for (const folderId of sortedFolders) {
    // Skip root node - we don't want to show it in the visualization
    if (rootId && folderId === rootId) {
      continue;
    }
    const treeNode = treeNodes.get(folderId);
    if (!treeNode) continue;

    // Find the parent container for this folder
    const parentFolderId = findParentExpandedFolder(folderId, expandedFolders);

    // Create container node if it doesn't exist
    if (!nodes.has(folderId)) {
      createGraphNode(folderId, treeNode.label, 'folder', parentFolderId, false, nodes);
    } else {
      // Update existing node to be a container with correct parent
      const existingNode = nodes.get(folderId)!;
      existingNode.parent = parentFolderId;
      existingNode.isLeaf = false;
      existingNode.isExpanded = true;
    }
  }

  // Then, establish parent-child relationships for all other nodes
  for (const nodeData of nodes.values()) {
    if (nodeData.parent || expandedFolders.has(nodeData.id)) continue; // Skip if already has parent or is container

    // Find the deepest expanded folder that contains this node
    const parentFolderId = findDeepestExpandedContainer(nodeData.id, expandedFolders, rootId);
    if (parentFolderId && parentFolderId !== nodeData.id) {
      nodeData.parent = parentFolderId;
    }
  }
}

/**
 * Create nodes for all included paths that don't exist yet (half-checked folders)
 */
function createIncludedNodes(
  treeNodes: Map<string, TreeNode>,
  includedPaths: Set<string>,
  expandedFolders: Set<string>,
  nodes: Map<string, CytoscapeNodeData>,
  rootId?: string
): void {
  // Create nodes for all included paths that aren't already created
  for (const includedPath of includedPaths) {
    // Skip root node - we don't want to show it in the visualization
    if (rootId && includedPath === rootId) {
      continue;
    }

    if (!nodes.has(includedPath)) {
      const treeNode = treeNodes.get(includedPath);
      if (treeNode) {
        // Find the parent for this node
        const parentFolderId = findDeepestExpandedContainer(includedPath, expandedFolders, rootId);

        // Determine if this should be a leaf node or container
        const isLeaf = treeNode.checkboxState === 'half-checked' || treeNode.type === 'file';

        createGraphNode(includedPath, treeNode.label, treeNode.type, parentFolderId, isLeaf, nodes);
      }
    }
  }
}

/**
 * Find the parent expanded folder for a given folder
 */
function findParentExpandedFolder(folderId: string, expandedFolders: Set<string>): string | null {
  const pathParts = folderId.split('/');

  // Check parent paths from immediate parent to root
  for (let i = pathParts.length - 1; i > 0; i--) {
    const parentPath = pathParts.slice(0, i).join('/');
    if (expandedFolders.has(parentPath)) {
      return parentPath;
    }
  }

  return null;
}

/**
 * Find the deepest expanded folder that contains a given node (for container assignment)
 */
function findDeepestExpandedContainer(nodeId: string, expandedFolders: Set<string>, rootId?: string): string | null {
  const pathParts = nodeId.split('/');
  let deepestParent: string | null = null;

  // Check all possible parent paths from deepest to shallowest
  for (let i = pathParts.length - 1; i > 0; i--) {
    const parentPath = pathParts.slice(0, i).join('/');
    if (expandedFolders.has(parentPath)) {
      // Skip root node as a parent - we want children to float freely instead
      if (rootId && parentPath === rootId) {
        continue;
      }
      deepestParent = parentPath;
      break; // Take the deepest (longest) match
    }
  }

  return deepestParent;
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
  // This handles paths like: tmp/chronograph/invoiceninja-admin-portal-cache/lib/...
  // And converts them to: lib/...
  const systemPrefixPatterns = [
    /^tmp\/chronograph\/[^\/]+\/[^\/]+\/app\//, // tmp/chronograph/cache/project_name/app/ (Flutter projects)
    /^tmp\/chronograph\/[^\/]+\//,  // tmp/chronograph/cache/ (keep everything after cache name)
    /^\/tmp\/chronograph\/[^\/]+\/[^\/]+\/app\//, // /tmp/chronograph/cache/project_name/app/ (Flutter projects)
    /^\/tmp\/chronograph\/[^\/]+\//, // /tmp/chronograph/cache/ (keep everything after cache name)
    /^[A-Z]:\/tmp\/chronograph\/[^\/]+\/[^\/]+\/app\//, // Windows temp paths for Flutter
    /^[A-Z]:\/tmp\/chronograph\/[^\/]+\//, // Windows temp paths
  ];

  for (const pattern of systemPrefixPatterns) {
    if (pattern.test(normalized)) {
      const before = normalized;
      normalized = normalized.replace(pattern, '');
      //console.log('🔧 Stripped system prefix from path:', before, '->', normalized);
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

/**
 * Mark nodes that have dependency changes (added/removed dependencies)
 * Also propagate changes up to parent folders
 */
function markNodesWithChanges(
  nodes: Map<string, CytoscapeNodeData>,
  edges: Map<string, CytoscapeEdgeData>
): void {
  const nodesWithChanges = new Set<string>();

  // Find all nodes that are endpoints of added/removed edges
  edges.forEach(edge => {
    if (edge.diffStatus === 'added' || edge.diffStatus === 'removed') {
      nodesWithChanges.add(edge.source);
      nodesWithChanges.add(edge.target);
    }
  });

  // Mark the nodes themselves
  nodesWithChanges.forEach(nodeId => {
    const node = nodes.get(nodeId);
    if (node) {
      node.hasChanges = true;
    }
  });

  // Propagate changes up to parent folders
  nodesWithChanges.forEach(nodeId => {
    const node = nodes.get(nodeId);
    if (node && node.parent) {
      markParentChain(node.parent, nodes);
    }
  });
}

/**
 * Mark all parents in the chain as having changes
 */
function markParentChain(parentId: string, nodes: Map<string, CytoscapeNodeData>): void {
  const parent = nodes.get(parentId);
  if (parent) {
    parent.hasChanges = true;
    if (parent.parent) {
      markParentChain(parent.parent, nodes);
    }
  }
}