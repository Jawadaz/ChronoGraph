import { Dependency, normalizePath } from './dependencyFiltering';

export interface CytoscapeNodeData {
  id: string;
  label: string;
  type: 'file' | 'folder';
  path: string;
  parent?: string;
  isExpanded: boolean;
  isLeaf: boolean;
  size: number;
  instability: number;
  children?: string[];
}

export interface CytoscapeEdgeData {
  id: string;
  source: string;
  target: string;
  weight: number;
  relationshipType: string;
  originalDependencies: Dependency[];
  diffStatus?: 'added' | 'removed' | 'unchanged' | null;
}

export interface CytoscapeElement {
  group: 'nodes' | 'edges';
  data: CytoscapeNodeData | CytoscapeEdgeData;
  position?: { x: number; y: number };
  classes?: string[];
}

export interface FolderState {
  [folderId: string]: {
    isExpanded: boolean;
    children: string[];
    path: string;
  };
}

/**
 * Transform flat dependencies into hierarchical Cytoscape elements with compound nodes
 */
export const transformToHierarchicalElements = (
  dependencies: Dependency[],
  viewRootFolder: string,
  folderLevel: number,
  folderState: FolderState = {}
): { elements: CytoscapeElement[], folderState: FolderState } => {
  const nodes = new Map<string, CytoscapeNodeData>();
  const edges = new Map<string, CytoscapeEdgeData>();
  const updatedFolderState = { ...folderState };

  console.log('🏗️ Building compound hierarchical structure:', {
    viewRootFolder,
    folderLevel,
    dependenciesCount: dependencies.length,
    existingFolderState: Object.keys(folderState).length
  });

  // Build hierarchical structure from dependencies
  dependencies.forEach((dep, index) => {
    const sourcePath = normalizePath(dep.source_file);
    const targetPath = normalizePath(dep.target_file);

    // Create compound hierarchy for source file
    createCompoundHierarchy(sourcePath, viewRootFolder, folderLevel, nodes, updatedFolderState);

    // Create compound hierarchy for target file
    createCompoundHierarchy(targetPath, viewRootFolder, folderLevel, nodes, updatedFolderState);

    // Create edge between leaf nodes only
    const sourceLeaf = getLeafNodeId(sourcePath, viewRootFolder, folderLevel, updatedFolderState);
    const targetLeaf = getLeafNodeId(targetPath, viewRootFolder, folderLevel, updatedFolderState);

    if (sourceLeaf && targetLeaf && sourceLeaf !== targetLeaf) {
      // Validate that both nodes are actually leaf nodes
      const isValidEdge = validateLeafNodes(sourceLeaf, targetLeaf, nodes);

      if (isValidEdge) {
        const edgeId = `${sourceLeaf}->${targetLeaf}`;

        if (edges.has(edgeId)) {
          // Aggregate existing edge
          const existing = edges.get(edgeId)!;
          existing.weight += 1;
          existing.originalDependencies.push(dep);
        } else {
          // Create new edge
          edges.set(edgeId, {
            id: edgeId,
            source: sourceLeaf,
            target: targetLeaf,
            weight: 1,
            relationshipType: dep.relationship_type,
            originalDependencies: [dep]
          });
        }
      }
    }
  });

  // Update parent-child relationships after all nodes are created
  updateParentChildRelationships(nodes, updatedFolderState);


  // Note: Keep original node labels (just the folder/file name)

  // Convert to Cytoscape elements
  const elements: CytoscapeElement[] = [];

  // Add nodes (folders first, then files)
  const nodeArray = Array.from(nodes.values());
  const folderNodes = nodeArray.filter(n => n.type === 'folder');
  const fileNodes = nodeArray.filter(n => n.type === 'file');

  // Add folders first (parents before children for compound nodes)
  folderNodes.forEach(nodeData => {
    elements.push({
      group: 'nodes',
      data: nodeData,
      classes: [
        nodeData.type,
        nodeData.isExpanded ? 'expanded' : 'collapsed',
        nodeData.isLeaf ? 'leaf' : 'container'
      ]
    });
  });

  // Add files
  fileNodes.forEach(nodeData => {
    elements.push({
      group: 'nodes',
      data: nodeData,
      classes: [nodeData.type, 'leaf']
    });
  });

  // Add edges
  Array.from(edges.values()).forEach(edgeData => {
    elements.push({
      group: 'edges',
      data: edgeData
    });
  });

  console.log('✅ Compound structure built:', {
    totalElements: elements.length,
    nodes: nodeArray.length,
    edges: edges.size,
    folderNodes: folderNodes.length,
    fileNodes: fileNodes.length,
    expandedFolders: folderNodes.filter(n => n.isExpanded).length,
    collapsedFolders: folderNodes.filter(n => !n.isExpanded).length
  });

  return { elements, folderState: updatedFolderState };
};

/**
 * Create compound hierarchical structure for a file path with progressive folder levels
 */
const createCompoundHierarchy = (
  filePath: string,
  viewRootFolder: string,
  folderLevel: number,
  nodes: Map<string, CytoscapeNodeData>,
  folderState: FolderState
): void => {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedViewRoot = normalizePath(viewRootFolder);

  // Check if file is within view root
  const isWithinViewRoot = normalizedViewRoot === '' || normalizedViewRoot === '/' ||
                          normalizedFilePath.startsWith(normalizedViewRoot + '/') ||
                          normalizedFilePath === normalizedViewRoot;

  if (!isWithinViewRoot) {
    return;
  }

  const pathParts = normalizedFilePath.split('/').filter(part => part.length > 0);
  const viewRootParts = normalizedViewRoot === '' || normalizedViewRoot === '/' ? [] :
                       normalizedViewRoot.split('/').filter(part => part.length > 0);

  console.log('📝 Processing file:', {
    filePath: normalizedFilePath,
    pathParts: pathParts.length,
    viewRootParts: viewRootParts.length
  });


  // Start from the view root level and process each path segment
  for (let i = viewRootParts.length; i < pathParts.length; i++) {
    const isFile = i === pathParts.length - 1;
    const nodeId = pathParts.slice(0, i + 1).join('/');
    const label = pathParts[i];

    let shouldCreateNode = false;
    let isExpanded = false;
    let isLeaf = true;

    if (isFile) {
      // FILES: Only create if parent folder is expanded
      const parentFolderId = pathParts.slice(0, i).join('/');
      const parentIsExpanded = folderState[parentFolderId]?.isExpanded ?? false;

      if (parentIsExpanded) {
        shouldCreateNode = true;
        isLeaf = true;
      }
    } else {
      // FOLDERS: Progressive disclosure based on expansion state
      isExpanded = folderState[nodeId]?.isExpanded ?? false;
      isLeaf = !isExpanded;

      const currentLevel = i + 1 - viewRootParts.length;

      if (currentLevel === 1) {
        // Always show first level folders (collapsed by default)
        shouldCreateNode = true;
      } else {
        // For deeper levels, only show if parent path is expanded
        const parentFolderId = pathParts.slice(0, i).join('/');
        const parentIsExpanded = folderState[parentFolderId]?.isExpanded ?? false;

        if (parentIsExpanded) {
          shouldCreateNode = true;
        }
      }
    }

    // Create the node if it should exist and doesn't already
    if (shouldCreateNode && !nodes.has(nodeId)) {
      nodes.set(nodeId, {
        id: nodeId,
        label,
        type: isFile ? 'file' : 'folder',
        path: nodeId,
        parent: undefined, // Will be set in parent-child relationship phase
        isExpanded,
        isLeaf,
        size: 20 + Math.random() * 20,
        instability: getConsistentInstability(nodeId),
        children: []
      });

      // Initialize folder state for new folders
      if (!isFile && !folderState[nodeId]) {
        folderState[nodeId] = {
          isExpanded,
          children: [],
          path: nodeId
        };

      }
    }
  }
};

/**
 * Update parent-child relationships for compound nodes after all nodes are created
 */
const updateParentChildRelationships = (
  nodes: Map<string, CytoscapeNodeData>,
  folderState: FolderState
): void => {
  // Build proper hierarchy based on path structure, not just expansion state
  const nodeList = Array.from(nodes.values()).sort((a, b) => a.id.length - b.id.length);

  for (const node of nodeList) {
    // Find the parent folder for this node (regardless of expansion state)
    const pathParts = node.id.split('/');

    if (pathParts.length > 1) {
      // Try to find the immediate parent
      for (let i = pathParts.length - 1; i > 0; i--) {
        const parentPath = pathParts.slice(0, i).join('/');
        const parentNode = nodes.get(parentPath);

        if (parentNode && parentNode.type === 'folder') {
          // Set parent-child relationship
          node.parent = parentPath;

          // Update parent node properties (ALWAYS - not just when expanded)
          // This is needed for skeleton container hiding logic
          parentNode.isLeaf = false;
          if (!parentNode.children!.includes(node.id)) {
            parentNode.children!.push(node.id);
          }

          // Update folder state only if expanded
          if (parentNode.isExpanded && folderState[parentPath] && !folderState[parentPath].children.includes(node.id)) {
            folderState[parentPath].children.push(node.id);
          }

          break; // Found immediate parent, stop looking
        }
      }
    }
  }

  // Second pass: ensure expanded folders are marked correctly
  for (const node of nodes.values()) {
    if (node.type === 'folder' && node.isExpanded) {
      node.isLeaf = false;
    }
  }

  console.log('🔗 Parent-child relationships updated:', {
    totalNodes: nodes.size,
    parentContainers: Array.from(nodes.values()).filter(n => n.type === 'folder' && !n.isLeaf).length,
    childNodes: Array.from(nodes.values()).filter(n => n.parent !== undefined).length,
    rootNodes: Array.from(nodes.values()).filter(n => n.parent === undefined).length
  });
};


/**
 * Get the leaf node ID for a file path (considering folder expansion state)
 * Only leaf nodes (files or collapsed folders) can participate in dependency edges
 */
const getLeafNodeId = (
  filePath: string,
  viewRootFolder: string,
  folderLevel: number,
  folderState: FolderState
): string | null => {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedViewRoot = normalizePath(viewRootFolder);

  // Check if file is within view root
  const isWithinViewRoot = normalizedViewRoot === '' || normalizedViewRoot === '/' ||
                          normalizedFilePath.startsWith(normalizedViewRoot + '/') ||
                          normalizedFilePath === normalizedViewRoot;

  if (!isWithinViewRoot) {
    return null;
  }

  const pathParts = normalizedFilePath.split('/').filter(part => part.length > 0);
  const viewRootParts = normalizedViewRoot === '' || normalizedViewRoot === '/' ? [] :
                       normalizedViewRoot.split('/').filter(part => part.length > 0);

  const maxInitialFolderDepth = viewRootParts.length + folderLevel;

  // Walk from the file path towards the root to find the first visible leaf node
  for (let i = pathParts.length - 1; i >= viewRootParts.length; i--) {
    const nodeId = pathParts.slice(0, i + 1).join('/');
    const isFile = i === pathParts.length - 1;
    const currentDepth = i;

    if (isFile) {
      // Check if this file is visible (should be created)
      if (currentDepth === viewRootParts.length) {
        // File at view root level - always visible
        return nodeId;
      } else {
        // File inside folder - check if parent is expanded
        const parentFolderId = pathParts.slice(0, currentDepth).join('/');
        if (folderState[parentFolderId]?.isExpanded) {
          return nodeId;
        }
      }
    } else {
      // This is a folder - check if it's visible and collapsed (making it a leaf)
      let shouldExist = false;

      if (currentDepth < maxInitialFolderDepth) {
        // Folder within initial level - should exist
        shouldExist = true;
      } else if (currentDepth === maxInitialFolderDepth) {
        // Folder at boundary - should exist
        shouldExist = true;
      } else {
        // Folder deeper than initial level - check if parent is expanded
        const parentFolderId = pathParts.slice(0, currentDepth).join('/');
        if (folderState[parentFolderId]?.isExpanded) {
          shouldExist = true;
        }
      }

      if (shouldExist) {
        const isExpanded = folderState[nodeId]?.isExpanded ?? false;
        if (!isExpanded) {
          // Collapsed folder is a leaf node
          return nodeId;
        }
      }
    }
  }

  return null;
};

/**
 * Validate that both source and target nodes are leaf nodes (can have edges)
 */
const validateLeafNodes = (
  sourceId: string,
  targetId: string,
  nodes: Map<string, CytoscapeNodeData>
): boolean => {
  const sourceNode = nodes.get(sourceId);
  const targetNode = nodes.get(targetId);

  if (!sourceNode || !targetNode) {
    return false;
  }

  // Both nodes must be leaf nodes to create an edge
  const isValidEdge = sourceNode.isLeaf && targetNode.isLeaf;

  if (!isValidEdge) {
    console.log('🚫 Invalid edge rejected (non-leaf nodes):', {
      source: { id: sourceId, type: sourceNode.type, isLeaf: sourceNode.isLeaf },
      target: { id: targetId, type: targetNode.type, isLeaf: targetNode.isLeaf }
    });
  }

  return isValidEdge;
};

/**
 * Get consistent instability color based on path hash
 */
const getConsistentInstability = (path: string): number => {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) / 2147483647;
};

