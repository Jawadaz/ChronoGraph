import { Dependency } from '../types/Dependency';

export type CheckboxState = 'checked' | 'unchecked' | 'half-checked';

export interface TreeNode {
  id: string;
  label: string;
  fullPath: string;
  type: 'folder' | 'file';
  parent?: string;
  children: string[];
  checkboxState: CheckboxState;
  isExpanded?: boolean; // For UI tree expansion (separate from graph logic)
}

export interface ProjectTree {
  nodes: Map<string, TreeNode>;
  rootId: string;
}

/**
 * Extract project tree structure from Lakos dependency analysis
 * Finds the common root and builds a hierarchical tree
 */
export function buildProjectTreeFromLakos(dependencies: Dependency[]): ProjectTree {
  const allPaths = new Set<string>();

  // Collect all unique file paths with normalization
  dependencies.forEach(dep => {
    allPaths.add(normalizePath(dep.source_file));
    allPaths.add(normalizePath(dep.target_file));
  });

  console.log('🔍 Raw paths before filtering:', {
    totalPaths: allPaths.size,
    samplePaths: Array.from(allPaths).slice(0, 10)
  });

  // Filter paths to find actual project files vs system/temp paths
  const pathArray = filterSystemPaths(Array.from(allPaths));

  console.log('✅ Clean paths after filtering:', {
    totalPaths: pathArray.length,
    samplePaths: pathArray.slice(0, 10)
  });

  // Find common root from all paths
  const commonRoot = findCommonRoot(pathArray);

  console.log('🌳 Building project tree:', {
    totalPaths: pathArray.length,
    commonRoot,
    samplePaths: pathArray.slice(0, 3)
  });

  console.log('🌳 CRITICAL DEBUG - All cleaned paths (first 20):');
  pathArray.slice(0, 20).forEach((path, index) => {
    console.log(`   [${index.toString().padStart(2, '0')}] ${path}`);
  });


  const nodes = new Map<string, TreeNode>();

  // Always create the root node, even if there are no dependencies
  if (!nodes.has(commonRoot)) {
    nodes.set(commonRoot, {
      id: commonRoot,
      label: commonRoot,
      fullPath: commonRoot,
      type: 'folder',
      children: [],
      checkboxState: 'checked',
      isExpanded: true
    });
  }

  // Build tree structure
  pathArray.forEach(filePath => {
    createTreePath(filePath, commonRoot, nodes);
  });

  // Establish parent-child relationships
  establishTreeRelationships(nodes, commonRoot);

  // Initialize default checkbox states (all checked to start)
  initializeCheckboxStates(nodes, commonRoot);

  return {
    nodes,
    rootId: commonRoot
  };
}

/**
 * Repository-agnostic system path filtering
 * Identifies and removes system/temp paths based on data patterns
 */
function filterSystemPaths(paths: string[]): string[] {
  if (paths.length === 0) return [];

  console.log('🔍 Analyzing paths for filtering:', {
    totalPaths: paths.length,
    samplePaths: paths.slice(0, 5)
  });

  // Analyze path patterns to distinguish project files from system files
  const normalizedPaths = paths.map(path => path.replace(/\\/g, '/'));

  // Group paths by their characteristics
  const pathAnalysis = analyzePaths(normalizedPaths);

  // Filter out system paths based on analysis
  const filteredPaths = normalizedPaths.filter(path => {
    const isProjectPath = isLikelyProjectPath(path, pathAnalysis);
    if (!isProjectPath) {
      console.log('🚫 Filtered out system path:', path);
    }
    return isProjectPath;
  });

  console.log('✅ Path filtering complete:', {
    originalCount: paths.length,
    filteredCount: filteredPaths.length,
    removedCount: paths.length - filteredPaths.length
  });

  return filteredPaths;
}

/**
 * Analyze path patterns to understand the data structure
 */
function analyzePaths(paths: string[]): {
  commonPrefixes: string[];
  avgDepth: number;
  topLevelDirs: Set<string>;
  hasAbsolutePaths: boolean;
  hasSystemIndicators: boolean;
} {
  let totalDepth = 0;
  const topLevelDirs = new Set<string>();
  let hasAbsolutePaths = false;
  let hasSystemIndicators = false;

  // Check for common system path indicators
  const systemIndicators = ['/tmp/', '/var/', '/proc/', '/sys/', '/dev/', 'C:/', '/Users/', '/home/'];

  paths.forEach(path => {
    // Check for absolute paths
    if (path.startsWith('/') || path.match(/^[A-Z]:/)) {
      hasAbsolutePaths = true;
    }

    // Check for system indicators
    if (systemIndicators.some(indicator => path.includes(indicator))) {
      hasSystemIndicators = true;
    }

    const parts = path.split('/').filter(part => part.length > 0);
    totalDepth += parts.length;

    if (parts.length > 0) {
      topLevelDirs.add(parts[0]);
    }
  });

  const avgDepth = paths.length > 0 ? totalDepth / paths.length : 0;

  // Find common prefixes by analyzing path beginnings
  const commonPrefixes = findCommonPrefixes(paths);

  return {
    commonPrefixes,
    avgDepth,
    topLevelDirs,
    hasAbsolutePaths,
    hasSystemIndicators
  };
}

/**
 * Find common prefixes in paths that might indicate system vs project structure
 */
function findCommonPrefixes(paths: string[]): string[] {
  const prefixCounts = new Map<string, number>();

  paths.forEach(path => {
    const parts = path.split('/').filter(part => part.length > 0);

    // Look at first 1-3 path segments for common patterns
    for (let depth = 1; depth <= Math.min(3, parts.length); depth++) {
      const prefix = parts.slice(0, depth).join('/');
      prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
    }
  });

  // Return prefixes that appear in a significant portion of paths
  const threshold = Math.max(2, paths.length * 0.1);
  return Array.from(prefixCounts.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([prefix, _]) => prefix)
    .sort((a, b) => b.length - a.length); // Longer prefixes first
}

/**
 * Determine if a path is likely a project file vs system file
 * Simplified to be more permissive - Lakos already gives us clean project paths
 */
function isLikelyProjectPath(path: string, analysis: {
  commonPrefixes: string[];
  avgDepth: number;
  topLevelDirs: Set<string>;
  hasAbsolutePaths: boolean;
  hasSystemIndicators: boolean;
}): boolean {
  // Only filter out very obvious system/build paths
  const obviousSystemPatterns = [
    // /^\/tmp\/chronograph\//,  // Our own temp cache paths (already handled by normalization)
    // /^tmp\/chronograph\//,    // Our own temp cache paths (already handled by normalization)
    /^\/var\/tmp\//,
    /^\/var\/log\//,
    /^\/proc\//,
    /^\/sys\//,
    /^\/dev\//,
    /^[A-Z]:\\Windows\\/,
    /^[A-Z]:\\Users\\.*\\AppData\\/,
    /\/node_modules\/.*\/.*\/.*\//,  // Deep node_modules paths
    /\/\.git\//,
    /\/build\/intermediates\//,
    /\/target\/debug\/build\//,
    /\/target\/release\/build\//
  ];

  if (obviousSystemPatterns.some(pattern => pattern.test(path))) {
    return false;
  }

  return true;
}

/**
 * Find the actual repository root from Lakos file paths
 * Repository-agnostic approach based on data analysis
 */
function findCommonRoot(paths: string[]): string {
  if (paths.length === 0) return 'project'; // Generic fallback

  console.log('🔍 Root detection debug:', {
    totalPaths: paths.length,
    samplePaths: paths.slice(0, 5)
  });

  // Analyze the common structure of paths
  const pathAnalysis = analyzePaths(paths);

  console.log('🔍 Path analysis results:', {
    topLevelDirs: Array.from(pathAnalysis.topLevelDirs),
    commonPrefixes: pathAnalysis.commonPrefixes,
    avgDepth: pathAnalysis.avgDepth
  });

  // If we have clear common prefixes, use the most common shallow one
  // But be careful - we want a true root, not just the most common folder
  if (pathAnalysis.commonPrefixes.length > 0) {
    // Look for single-level prefixes only (no slashes)
    const singleLevelPrefixes = pathAnalysis.commonPrefixes
      .filter(prefix => !prefix.includes('/'));

    // Only use a single-level prefix as root if it covers ALL paths
    if (singleLevelPrefixes.length > 0) {
      const rootCandidate = singleLevelPrefixes[0];
      const allPathsStartWithCandidate = paths.every(path => {
        const parts = path.split('/').filter(part => part.length > 0); // Filter empty parts correctly
        return parts.length > 0 && parts[0] === rootCandidate;
      });

      if (allPathsStartWithCandidate) {
        console.log('🔍 Using single-level prefix as root (covers all paths):', rootCandidate);
        return rootCandidate;
      } else {
        console.log('🔍 Single-level prefix does not cover all paths:', rootCandidate);
      }
    }
  }

  // Fallback: analyze top-level directories
  if (pathAnalysis.topLevelDirs.size > 0) {
    const topDirs = Array.from(pathAnalysis.topLevelDirs);

    // If we have multiple top-level directories that look like a Flutter/Dart app structure
    if (topDirs.length > 1) {
      const appLikeDirs = ['lib', 'test', 'integration_test', 'testing'];
      const hasAppStructure = appLikeDirs.some(dir => topDirs.includes(dir));

      if (hasAppStructure) {
        // This looks like an app structure - use 'app' as root since user specified compass_app/app
        console.log('🔍 App structure detected with dirs:', topDirs, '- using app as root');
        return 'app';
      } else {
        // Unknown structure - use generic root
        console.log('🔍 Multiple top-level dirs detected:', topDirs, '- creating synthetic root');
        return 'project';
      }
    } else if (topDirs.length === 1) {
      // Only one top-level directory, use it as root
      console.log('🔍 Single top-level directory as root:', topDirs[0]);
      return topDirs[0];
    }
  }

  // Final fallback
  console.log('🔍 Using generic fallback root: project');
  return 'project';
}

/**
 * Create tree nodes for a complete file path
 */
function createTreePath(filePath: string, rootName: string, nodes: Map<string, TreeNode>): void {
  const pathParts = filePath.split('/').filter(part => part.length > 0);

  // Create virtual root if it doesn't exist
  if (!nodes.has(rootName)) {
    nodes.set(rootName, {
      id: rootName,
      label: rootName,
      fullPath: rootName,
      type: 'folder',
      children: [],
      checkboxState: 'checked',
      isExpanded: true
    });
  }

  // Create the actual path nodes
  for (let i = 0; i < pathParts.length; i++) {
    const isFile = i === pathParts.length - 1;
    const nodeId = pathParts.slice(0, i + 1).join('/');
    const label = pathParts[i];

    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, {
        id: nodeId,
        label,
        fullPath: isFile ? filePath : nodeId, // Use nodeId for folders, filePath for files
        type: isFile ? 'file' : 'folder',
        children: [],
        checkboxState: 'checked',
        isExpanded: true
      });
    }
  }
}

/**
 * Establish parent-child relationships in the tree
 */
function establishTreeRelationships(nodes: Map<string, TreeNode>, rootId: string): void {
  const rootNode = nodes.get(rootId);

  for (const node of nodes.values()) {
    if (node.id === rootId) continue; // Skip root

    const pathParts = node.id.split('/').filter(part => part.length > 0);

    if (pathParts.length === 1) {
      // Top-level folders (lib, integration_test, etc.) - connect to project root
      node.parent = rootId;
      if (rootNode && !rootNode.children.includes(node.id)) {
        rootNode.children.push(node.id);
      }
    } else if (pathParts.length > 1) {
      // For nested paths, find the immediate parent
      const parentId = pathParts.slice(0, -1).join('/');
      const parentNode = nodes.get(parentId);

      if (parentNode) {
        node.parent = parentId;
        if (!parentNode.children.includes(node.id)) {
          parentNode.children.push(node.id);
        }
      } else {
        console.error(`🚨 PARENT NOT FOUND for node '${node.id}' - looking for parent '${parentId}'`);
        console.error(`   Available node IDs:`, Array.from(nodes.keys()).slice(0, 20));
      }
    }
  }

  // Debug output for path collision investigation
  console.log('🔗 Tree relationships established:');
  console.log(`   Root (${rootId}) children:`, rootNode?.children);
  console.log('   Total nodes:', nodes.size);

  // Look for potential path collision issues
  const authNodes = Array.from(nodes.keys()).filter(key => key.includes('auth'));
  const bankAccountNodes = Array.from(nodes.keys()).filter(key => key.includes('bank_account'));

  if (authNodes.length > 0) {
    console.log('🔍 AUTH nodes found:', authNodes);
    authNodes.forEach(authId => {
      const authNode = nodes.get(authId);
      console.log(`   Auth node '${authId}': parent='${authNode?.parent}', children=[${authNode?.children.join(', ')}]`);
    });
  }

  if (bankAccountNodes.length > 0) {
    console.log('🔍 BANK_ACCOUNT nodes found:', bankAccountNodes);
    bankAccountNodes.forEach(bankId => {
      const bankNode = nodes.get(bankId);
      console.log(`   Bank node '${bankId}': parent='${bankNode?.parent}', children=[${bankNode?.children.join(', ')}]`);
    });
  }

  // Sort children by type (folders first) then alphabetically
  for (const node of nodes.values()) {
    if (node.children.length > 0) {
      node.children.sort((a, b) => {
        const nodeA = nodes.get(a);
        const nodeB = nodes.get(b);
        if (!nodeA || !nodeB) return 0;

        // Folders before files
        if (nodeA.type !== nodeB.type) {
          return nodeA.type === 'folder' ? -1 : 1;
        }

        // Alphabetical within same type
        return nodeA.label.localeCompare(nodeB.label);
      });
    }
  }
}

/**
 * Initialize checkbox states based on tree hierarchy
 */
function initializeCheckboxStates(nodes: Map<string, TreeNode>, rootId: string): void {
  // Smart initialization: root checked, first-level folders half-checked, first-level files checked
  // This prevents massive initial load times

  const rootNode = nodes.get(rootId);
  if (!rootNode) return;

  // Set root as checked (expanded)
  rootNode.checkboxState = 'checked';

  // Handle direct children of root
  for (const childId of rootNode.children) {
    const childNode = nodes.get(childId);
    if (!childNode) continue;

    if (childNode.type === 'folder') {
      // First-level folders are half-checked (visible but collapsed)
      childNode.checkboxState = 'half-checked';
      // Set all descendants of half-checked folders to unchecked
      setDescendantsUnchecked(childId, nodes);
    } else {
      // First-level files are checked (visible)
      childNode.checkboxState = 'checked';
    }
  }

  // All other nodes (deeper than first level) start as unchecked
  for (const node of nodes.values()) {
    if (node.id === rootId) continue; // Skip root
    if (rootNode.children.includes(node.id)) continue; // Skip first-level children (already handled)

    // All deeper nodes start unchecked
    if (node.checkboxState === undefined) {
      node.checkboxState = 'unchecked';
    }
  }
}

/**
 * Helper function to set all descendants of a node to unchecked
 */
function setDescendantsUnchecked(nodeId: string, nodes: Map<string, TreeNode>): void {
  const node = nodes.get(nodeId);
  if (!node) return;

  for (const childId of node.children) {
    const childNode = nodes.get(childId);
    if (childNode) {
      childNode.checkboxState = 'unchecked';
      setDescendantsUnchecked(childId, nodes); // Recursively set grandchildren
    }
  }
}

/**
 * Update checkbox state and propagate changes up and down the tree
 */
export function updateCheckboxState(
  nodeId: string,
  newState: CheckboxState,
  nodes: Map<string, TreeNode>
): Map<string, TreeNode> {
  const updatedNodes = new Map(nodes);
  const node = updatedNodes.get(nodeId);

  if (!node) return updatedNodes;

  // Update current node
  node.checkboxState = newState;

  // Propagate down to children (all states now propagate correctly)
  propagateDownward(nodeId, newState, updatedNodes);

  // Propagate up to parents (recalculate parent states based on all children)
  propagateUpward(nodeId, updatedNodes);

  return updatedNodes;
}

/**
 * Create a realistic half-checked scenario for testing
 * This simulates the user's desired state where a parent is half-checked (contracted)
 * and all its children are unchecked (not visible)
 */
export function createHalfCheckedScenario(
  nodes: Map<string, TreeNode>,
  parentId: string
): Map<string, TreeNode> {
  const updatedNodes = new Map(nodes);

  // Set the parent to half-checked (contracted view)
  // This will automatically make all children unchecked
  const result = updateCheckboxState(parentId, 'half-checked', updatedNodes);
  result.forEach((node, id) => updatedNodes.set(id, node));

  return updatedNodes;
}

/**
 * Normalize file path by stripping system prefixes
 */
function normalizePath(path: string): string {
  let normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/, '');

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
      console.log(`🔧 Normalized: ${before} → ${normalized}`);
      break;
    }
  }

  return normalized;
}

/**
 * Propagate checkbox state down to all children
 *
 * Checkbox state semantics:
 * - checked: Node is expanded and visible, all children are also checked/expanded
 * - unchecked: Node is not visible at all
 * - half-checked: Node is visible as a contracted/collapsed node, all children are unchecked
 */
function propagateDownward(nodeId: string, state: CheckboxState, nodes: Map<string, TreeNode>): void {
  const node = nodes.get(nodeId);
  if (!node) return;

  node.children.forEach(childId => {
    const childNode = nodes.get(childId);
    if (!childNode) return;

    if (state === 'checked') {
      // When parent becomes checked: folder children become half-checked (visible but contracted)
      // file children become checked
      if (childNode.type === 'folder') {
        childNode.checkboxState = 'half-checked';
        // Don't automatically propagate here - let half-checked state be handled separately
      } else {
        childNode.checkboxState = 'checked';
      }
    } else if (state === 'unchecked') {
      // When parent becomes unchecked: ALL children become unchecked
      childNode.checkboxState = 'unchecked';
      propagateDownward(childId, 'unchecked', nodes);
    } else if (state === 'half-checked') {
      // When parent becomes half-checked: ALL children become unchecked (contracted view)
      childNode.checkboxState = 'unchecked';
      propagateDownward(childId, 'unchecked', nodes);
    }
  });
}

/**
 * Propagate checkbox state changes up to parent nodes - ONLY UPWARD
 *
 * Parent state calculation based on new semantics:
 * - checked: All children are checked (fully expanded)
 * - unchecked: All children are unchecked (not visible)
 * - half-checked: Mixed children states OR parent wants to be shown as contracted
 */
function propagateUpward(nodeId: string, nodes: Map<string, TreeNode>): void {
  const node = nodes.get(nodeId);
  if (!node || !node.parent) return;

  const parentNode = nodes.get(node.parent);
  if (!parentNode) return;

  // Calculate what the parent state should be based on its children
  const childStates = parentNode.children.map(childId => {
    const child = nodes.get(childId);
    return child?.checkboxState || 'unchecked';
  });

  const checkedCount = childStates.filter(state => state === 'checked').length;
  const halfCheckedCount = childStates.filter(state => state === 'half-checked').length;
  const uncheckedCount = childStates.filter(state => state === 'unchecked').length;
  const totalCount = childStates.length;

  // Determine parent state based on children
  // RULE: If ANY child is checked or half-checked, parent MUST be checked
  let newParentState: CheckboxState;

  if (checkedCount > 0 || halfCheckedCount > 0) {
    // If ANY child is checked or half-checked -> parent MUST be checked
    newParentState = 'checked';
  } else {
    // ALL children are unchecked -> parent becomes unchecked
    newParentState = 'unchecked';
  }

  // Update parent if it changed and continue upward
  if (parentNode.checkboxState !== newParentState) {
    parentNode.checkboxState = newParentState;
    propagateUpward(node.parent, nodes);
  }
}

/**
 * Legacy function for initialization - uses new propagateDownward
 */
function propagateCheckboxState(nodeId: string, state: CheckboxState, nodes: Map<string, TreeNode>): void {
  propagateDownward(nodeId, state, nodes);
}

/**
 * Get filtered paths based on tree checkbox states for graph rendering
 */
export function getFilteredPathsFromTree(nodes: Map<string, TreeNode>): {
  includedPaths: Set<string>;
  expandedFolders: Set<string>;
  collapsedFolders: Set<string>;
} {
  const includedPaths = new Set<string>();
  const expandedFolders = new Set<string>();
  const collapsedFolders = new Set<string>();

  for (const node of nodes.values()) {
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
        // Not included in graph
        break;
    }
  }

  return { includedPaths, expandedFolders, collapsedFolders };
}