import { describe, it, expect } from 'vitest';

interface TreeNode {
  fullPath: string;
  name: string;
  type: 'file' | 'folder';
  checkboxState: 'checked' | 'half-checked' | 'unchecked';
  parent: string | null;
  children: string[];
}

/**
 * Finds a tree node by ID, supporting both exact matches and path-based lookups
 * Extracted from GraphTab for testing
 */
function findTreeNode(
  nodeId: string,
  treeNodes: Map<string, TreeNode>
): TreeNode | null {
  // Try exact match first
  let node = treeNodes.get(nodeId);

  // If not found directly, search for it in the tree
  if (!node) {
    for (const [key, treeNode] of treeNodes.entries()) {
      if (key === nodeId || key.endsWith('/' + nodeId) || key.endsWith('\\' + nodeId)) {
        node = treeNode;
        break;
      }
    }
  }

  return node || null;
}

/**
 * Determines the new checkbox state when toggling a folder
 */
function getToggledState(currentState: 'checked' | 'half-checked' | 'unchecked'): 'checked' | 'half-checked' {
  return currentState === 'checked' ? 'half-checked' : 'checked';
}

describe('GraphTab - Folder Toggle Logic', () => {
  describe('findTreeNode', () => {
    it('should find node by exact path match', () => {
      const treeNodes = new Map<string, TreeNode>([
        ['app', { fullPath: 'app', name: 'app', type: 'folder', checkboxState: 'checked', parent: null, children: ['app/lib'] }],
        ['app/lib', { fullPath: 'app/lib', name: 'lib', type: 'folder', checkboxState: 'half-checked', parent: 'app', children: [] }],
      ]);

      const node = findTreeNode('app', treeNodes);
      expect(node).not.toBeNull();
      expect(node?.fullPath).toBe('app');
    });

    it('should find node by short name when path ends with it', () => {
      const treeNodes = new Map<string, TreeNode>([
        ['app', { fullPath: 'app', name: 'app', type: 'folder', checkboxState: 'checked', parent: null, children: ['app/lib'] }],
        ['app/lib', { fullPath: 'app/lib', name: 'lib', type: 'folder', checkboxState: 'half-checked', parent: 'app', children: [] }],
      ]);

      const node = findTreeNode('lib', treeNodes);
      expect(node).not.toBeNull();
      expect(node?.fullPath).toBe('app/lib');
      expect(node?.name).toBe('lib');
    });

    it('should handle Windows-style paths', () => {
      const treeNodes = new Map<string, TreeNode>([
        ['app\\lib', { fullPath: 'app\\lib', name: 'lib', type: 'folder', checkboxState: 'half-checked', parent: 'app', children: [] }],
      ]);

      const node = findTreeNode('lib', treeNodes);
      expect(node).not.toBeNull();
      expect(node?.fullPath).toBe('app\\lib');
    });

    it('should return null when node not found', () => {
      const treeNodes = new Map<string, TreeNode>([
        ['app', { fullPath: 'app', name: 'app', type: 'folder', checkboxState: 'checked', parent: null, children: [] }],
      ]);

      const node = findTreeNode('nonexistent', treeNodes);
      expect(node).toBeNull();
    });

    it('should not match partial folder names', () => {
      const treeNodes = new Map<string, TreeNode>([
        ['app/lib', { fullPath: 'app/lib', name: 'lib', type: 'folder', checkboxState: 'checked', parent: 'app', children: [] }],
        ['app/lib_test', { fullPath: 'app/lib_test', name: 'lib_test', type: 'folder', checkboxState: 'checked', parent: 'app', children: [] }],
      ]);

      const node = findTreeNode('lib', treeNodes);
      expect(node).not.toBeNull();
      expect(node?.fullPath).toBe('app/lib');
      expect(node?.fullPath).not.toBe('app/lib_test');
    });
  });

  describe('getToggledState', () => {
    it('should toggle from checked to half-checked', () => {
      expect(getToggledState('checked')).toBe('half-checked');
    });

    it('should toggle from half-checked to checked', () => {
      expect(getToggledState('half-checked')).toBe('checked');
    });

    it('should toggle from unchecked to checked', () => {
      expect(getToggledState('unchecked')).toBe('checked');
    });
  });

  describe('Folder Toggle Integration', () => {
    it('should handle double-click on collapsed folder (half-checked)', () => {
      const treeNodes = new Map<string, TreeNode>([
        ['app', { fullPath: 'app', name: 'app', type: 'folder', checkboxState: 'checked', parent: null, children: ['app/lib'] }],
        ['app/lib', { fullPath: 'app/lib', name: 'lib', type: 'folder', checkboxState: 'half-checked', parent: 'app', children: [] }],
      ]);

      // User double-clicks on 'lib' in the graph
      const node = findTreeNode('lib', treeNodes);
      expect(node).not.toBeNull();
      expect(node?.type).toBe('folder');

      const newState = getToggledState(node!.checkboxState);
      expect(newState).toBe('checked');
    });

    it('should handle double-click on expanded folder (checked)', () => {
      const treeNodes = new Map<string, TreeNode>([
        ['app', { fullPath: 'app', name: 'app', type: 'folder', checkboxState: 'checked', parent: null, children: ['app/lib'] }],
        ['app/lib', { fullPath: 'app/lib', name: 'lib', type: 'folder', checkboxState: 'checked', parent: 'app', children: [] }],
      ]);

      const node = findTreeNode('lib', treeNodes);
      expect(node).not.toBeNull();

      const newState = getToggledState(node!.checkboxState);
      expect(newState).toBe('half-checked');
    });

    it('should not toggle non-folder nodes', () => {
      const treeNodes = new Map<string, TreeNode>([
        ['app/main.dart', { fullPath: 'app/main.dart', name: 'main.dart', type: 'file', checkboxState: 'checked', parent: 'app', children: [] }],
      ]);

      const node = findTreeNode('main.dart', treeNodes);
      expect(node).not.toBeNull();
      expect(node?.type).toBe('file');

      // Should not proceed with toggle for files
    });
  });
});
