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
}

export interface CytoscapeEdgeData {
  id: string;
  source: string;
  target: string;
  weight: number;
  relationshipType: string;
  originalDependencies: Dependency[];
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

  // Build hierarchical structure from dependencies
  dependencies.forEach((dep, index) => {
    const sourcePath = normalizePath(dep.source_file);
    const targetPath = normalizePath(dep.target_file);

    // Create hierarchy for source file
    createHierarchicalNodes(sourcePath, viewRootFolder, folderLevel, nodes, updatedFolderState);

    // Create hierarchy for target file
    createHierarchicalNodes(targetPath, viewRootFolder, folderLevel, nodes, updatedFolderState);

    // Create edge between leaf nodes only
    const sourceLeaf = getLeafNodeId(sourcePath, viewRootFolder, folderLevel, updatedFolderState);
    const targetLeaf = getLeafNodeId(targetPath, viewRootFolder, folderLevel, updatedFolderState);

    if (sourceLeaf && targetLeaf && sourceLeaf !== targetLeaf) {
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
  });

  // Convert to Cytoscape elements
  const elements: CytoscapeElement[] = [];

  // Add nodes
  Array.from(nodes.values()).forEach(nodeData => {
    elements.push({
      group: 'nodes',
      data: nodeData,
      classes: [nodeData.type, nodeData.isExpanded ? 'expanded' : 'collapsed']
    });
  });

  // Add edges
  Array.from(edges.values()).forEach(edgeData => {
    elements.push({
      group: 'edges',
      data: edgeData
    });
  });

  return { elements, folderState: updatedFolderState };
};

/**
 * Create hierarchical node structure for a file path
 */
const createHierarchicalNodes = (
  filePath: string,
  viewRootFolder: string,
  folderLevel: number,
  nodes: Map<string, CytoscapeNodeData>,
  folderState: FolderState
): void => {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedViewRoot = normalizePath(viewRootFolder);

  // For root view, handle all files
  const isWithinViewRoot = normalizedViewRoot === '' || normalizedViewRoot === '/' ||
                          normalizedFilePath.startsWith(normalizedViewRoot + '/') ||
                          normalizedFilePath === normalizedViewRoot;

  if (!isWithinViewRoot) {
    return;
  }

  const pathParts = normalizedFilePath.split('/').filter(part => part.length > 0);
  const viewRootParts = normalizedViewRoot === '' || normalizedViewRoot === '/' ? [] :
                       normalizedViewRoot.split('/').filter(part => part.length > 0);

  let parentId: string | undefined = undefined;

  // Create intermediate folder nodes up to the specified level, but always create the file itself
  // folderLevel = 0 means no intermediate folders, just files
  // folderLevel = 1 means 1 level of folders + files, etc.
  const maxDepth = viewRootParts.length + folderLevel;

  // Always create at least the file itself (pathParts.length)
  // But don't exceed the specified folder level depth
  const endLevel = pathParts.length;

  console.log('🔍 Debug createHierarchicalNodes:', {
    filePath,
    folderLevel,
    pathParts: pathParts.length,
    viewRootParts: viewRootParts.length,
    maxDepth,
    endLevel,
    startIndex: viewRootParts.length,
    willCreateNodes: viewRootParts.length < endLevel
  });

  for (let i = viewRootParts.length; i < endLevel; i++) {
    const isFile = i === pathParts.length - 1;
    const nodeId = pathParts.slice(0, i + 1).join('/');
    const label = pathParts[i];

    // Skip intermediate folders beyond the specified level (but always create files)
    if (!isFile && i >= maxDepth) {
      continue;
    }

    if (!nodes.has(nodeId)) {
      // Determine expansion state
      const isExpanded = !isFile && (folderState[nodeId]?.isExpanded ?? true);

      nodes.set(nodeId, {
        id: nodeId,
        label,
        type: isFile ? 'file' : 'folder',
        path: nodeId,
        parent: parentId,
        isExpanded,
        isLeaf: isFile || !isExpanded,
        size: 20 + Math.random() * 20, // Random size for testing
        instability: getConsistentInstability(nodeId)
      });

      // Initialize folder state
      if (!isFile && !folderState[nodeId]) {
        folderState[nodeId] = {
          isExpanded,
          children: [],
          path: nodeId
        };
      }
    }

    // Update parent-child relationships
    if (parentId && folderState[parentId]) {
      if (!folderState[parentId].children.includes(nodeId)) {
        folderState[parentId].children.push(nodeId);
      }
    }

    parentId = nodeId;
  }
};

/**
 * Get the leaf node ID for a file path (considering folder expansion state)
 */
const getLeafNodeId = (
  filePath: string,
  viewRootFolder: string,
  folderLevel: number,
  folderState: FolderState
): string | null => {
  const pathParts = filePath.split('/').filter(part => part.length > 0);
  const viewRootParts = viewRootFolder === '/' ? [] : viewRootFolder.split('/').filter(part => part.length > 0);

  // Find the deepest expanded folder or the file itself
  for (let i = pathParts.length - 1; i >= viewRootParts.length; i--) {
    const nodeId = pathParts.slice(0, i + 1).join('/');

    // If this is a file, it's always a leaf
    if (i === pathParts.length - 1) {
      return nodeId;
    }

    // If this is a collapsed folder, it's a leaf
    if (folderState[nodeId] && !folderState[nodeId].isExpanded) {
      return nodeId;
    }
  }

  return null;
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

/**
 * Toggle folder expansion state
 */
export const toggleFolderExpansion = (
  folderId: string,
  currentElements: CytoscapeElement[],
  allDependencies: Dependency[],
  viewRootFolder: string,
  folderLevel: number,
  folderState: FolderState
): { elements: CytoscapeElement[], folderState: FolderState, shouldRelayout: boolean } => {
  const updatedFolderState = { ...folderState };

  // Toggle expansion state
  if (updatedFolderState[folderId]) {
    updatedFolderState[folderId].isExpanded = !updatedFolderState[folderId].isExpanded;
  }

  // Regenerate elements
  const { elements, folderState: newFolderState } = transformToHierarchicalElements(
    allDependencies,
    viewRootFolder,
    folderLevel,
    updatedFolderState
  );

  // Determine if relayout is needed
  const shouldRelayout = shouldTriggerRelayout(currentElements, elements);

  return { elements, folderState: newFolderState, shouldRelayout };
};

/**
 * Determine if layout change is significant enough to trigger relayout
 */
const shouldTriggerRelayout = (currentElements: CytoscapeElement[], newElements: CytoscapeElement[]): boolean => {
  const currentNodeCount = currentElements.filter(el => el.group === 'nodes').length;
  const newNodeCount = newElements.filter(el => el.group === 'nodes').length;

  const changeRatio = Math.abs(newNodeCount - currentNodeCount) / Math.max(currentNodeCount, 1);
  return changeRatio > 0.2 || Math.abs(newNodeCount - currentNodeCount) > 3;
};