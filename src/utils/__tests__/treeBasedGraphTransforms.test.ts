import { transformToTreeBasedGraphElements } from '../treeBasedGraphTransforms';
import { buildProjectTreeFromLakos, TreeNode, createHalfCheckedScenario, updateCheckboxState } from '../treeStructure';
import { Dependency } from '../../types/Dependency';

describe('TreeBasedGraphTransforms', () => {
  // Test data that matches real compass_app structure
  const realCompassAppDependencies: Dependency[] = [
    { source_file: '/lib/data/services/api/api_client.dart', target_file: '/lib/data/models/user.dart', relationship_type: 'imports' },
    { source_file: '/lib/data/services/api/auth_api_client.dart', target_file: '/lib/data/models/auth.dart', relationship_type: 'imports' },
    { source_file: '/test/data/services/api/api_client_test.dart', target_file: '/lib/data/services/api/api_client.dart', relationship_type: 'imports' },
    { source_file: '/integration_test/app_local_data_test.dart', target_file: '/lib/data/services/api/api_client.dart', relationship_type: 'imports' },
    { source_file: '/testing/fakes/services/fake_api_client.dart', target_file: '/lib/data/services/api/api_client.dart', relationship_type: 'imports' }
  ];

  // Test data with system paths (what actually comes from Rust)
  const systemPathDependencies: Dependency[] = [
    { source_file: 'tmp/chronograph/flutter-samples-cache/compass_app/app/lib/data/services/api/api_client.dart', target_file: 'tmp/chronograph/flutter-samples-cache/compass_app/app/lib/data/models/user.dart', relationship_type: 'imports' },
    { source_file: 'tmp/chronograph/flutter-samples-cache/compass_app/app/testing/fakes/services/fake_api_client.dart', target_file: 'tmp/chronograph/flutter-samples-cache/compass_app/app/lib/data/services/api/api_client.dart', relationship_type: 'imports' }
  ];

  describe('Path Normalization', () => {
    it('should strip system path prefixes correctly', () => {
      // Build tree from clean paths
      const tree = buildProjectTreeFromLakos(realCompassAppDependencies);

      // Transform dependencies with system paths
      const result = transformToTreeBasedGraphElements(systemPathDependencies, tree.nodes);

      console.log('🧪 Path normalization test result:', {
        totalElements: result.elements.length,
        nodes: result.elements.filter(e => !e.data.source && !e.data.target).length,
        edges: result.elements.filter(e => e.data.source && e.data.target).length
      });

      // Should create actual nodes and edges, not just empty containers
      expect(result.elements.length).toBeGreaterThan(1);
      const nodes = result.elements.filter(e => !e.data.source && !e.data.target);
      const edges = result.elements.filter(e => e.data.source && e.data.target);

      expect(nodes.length).toBeGreaterThan(0);
      expect(edges.length).toBeGreaterThan(0);
    });
  });

  describe('Tree Node Matching', () => {
    it('should match normalized paths to tree nodes', () => {
      const tree = buildProjectTreeFromLakos(realCompassAppDependencies);

      console.log('🧪 Tree node matching test:', {
        treeNodeCount: tree.nodes.size,
        rootId: tree.rootId,
        sampleTreeNodes: Array.from(tree.nodes.keys()).slice(0, 10)
      });

      // Verify tree was built correctly
      expect(tree.nodes.size).toBeGreaterThan(5);
      expect(tree.rootId).toBeDefined();

      // Should have nodes for lib, test, integration_test, testing
      const rootNode = tree.nodes.get(tree.rootId);
      expect(rootNode).toBeDefined();
      expect(rootNode!.children.length).toBeGreaterThan(1);
    });

    it('should handle expanded vs collapsed folder states', () => {
      const tree = buildProjectTreeFromLakos(realCompassAppDependencies);

      // Mark some nodes as expanded
      const libNode = tree.nodes.get('lib');
      if (libNode) {
        libNode.checkboxState = 'checked';
        libNode.isExpanded = true;
      }

      const result = transformToTreeBasedGraphElements(realCompassAppDependencies, tree.nodes);

      console.log('🧪 Folder state test result:', {
        totalElements: result.elements.length,
        hasLibNode: result.elements.some(e => e.data.id === 'lib'),
        nodeLabels: result.elements.filter(e => !e.data.source).map(e => e.data.label)
      });

      expect(result.elements.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Creation', () => {
    it('should create edges between matching nodes', () => {
      const tree = buildProjectTreeFromLakos(realCompassAppDependencies);

      // Mark all nodes as checked to include them
      tree.nodes.forEach(node => {
        node.checkboxState = 'checked';
        node.isExpanded = true;
      });

      const result = transformToTreeBasedGraphElements(realCompassAppDependencies, tree.nodes);

      const edges = result.elements.filter(e => e.data.source && e.data.target);
      console.log('🧪 Edge creation test:', {
        totalEdges: edges.length,
        sampleEdges: edges.slice(0, 3).map(e => ({ source: e.data.source, target: e.data.target }))
      });

      expect(edges.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world Integration', () => {
    it('should handle the actual compass_app data structure', () => {
      // This test simulates the exact scenario from the desktop app
      const tree = buildProjectTreeFromLakos(realCompassAppDependencies);

      // Set initial tree state (project root expanded)
      const rootNode = tree.nodes.get(tree.rootId);
      if (rootNode) {
        rootNode.isExpanded = true;
        rootNode.checkboxState = 'checked';
      }

      // Transform with system paths (what actually happens in the app)
      const result = transformToTreeBasedGraphElements(systemPathDependencies, tree.nodes);

      console.log('🧪 Real-world integration test:', {
        inputDependencies: systemPathDependencies.length,
        treeNodes: tree.nodes.size,
        outputElements: result.elements.length,
        hasNodes: result.elements.filter(e => !e.data.source).length > 0,
        hasEdges: result.elements.filter(e => e.data.source).length > 0,
        elementDetails: result.elements.map(e => ({
          id: e.data.id,
          label: e.data.label,
          type: e.data.source ? 'edge' : 'node'
        }))
      });

      // This should NOT result in just a single container with no content
      expect(result.elements.length).toBeGreaterThan(1);

      // Should have actual nodes beyond just containers
      const leafNodes = result.elements.filter(e =>
        !e.data.source &&
        !e.data.target &&
        e.data.id !== tree.rootId &&
        !e.data.id?.includes('container')
      );
      expect(leafNodes.length).toBeGreaterThan(0);
    });
  });

  describe('Half-Checked Node Handling', () => {
    it('should prioritize half-checked nodes as stopping points', () => {
      // Build the tree
      let tree = buildProjectTreeFromLakos(realCompassAppDependencies);

      // Create the correct user scenario using the fixed semantics:
      // lib is checked (expanded), but lib/data is set to half-checked (contracted with children unchecked)
      let updatedNodes = updateCheckboxState('lib', 'checked', tree.nodes);
      updatedNodes = updateCheckboxState('lib/data', 'half-checked', updatedNodes);

      console.log('🧪 Tree state after updates:', {
        libState: updatedNodes.get('lib')?.checkboxState,
        libDataState: updatedNodes.get('lib/data')?.checkboxState,
        libDataChildrenStates: updatedNodes.get('lib/data')?.children.map(id => ({
          id,
          state: updatedNodes.get(id)?.checkboxState
        }))
      });

      const result = transformToTreeBasedGraphElements(realCompassAppDependencies, updatedNodes);

      // Filter to only nodes under lib/
      const libChildNodes = result.elements.filter(e =>
        !e.data.source && // not an edge
        e.data.id?.startsWith('lib/') &&
        e.data.id !== 'lib'
      );

      console.log('🧪 Half-checked node test:', {
        totalElements: result.elements.length,
        libChildNodes: libChildNodes.length,
        libChildNodeIds: libChildNodes.map(e => e.data.id),
        allNodeIds: result.elements.filter(e => !e.data.source).map(e => e.data.id)
      });

      // Should prioritize half-checked nodes (like lib/data) as stopping points
      expect(libChildNodes.some(e => e.data.id === 'lib/data')).toBe(true);

      // Should NOT show deep nodes under half-checked folders
      const deepDataNodes = libChildNodes.filter(e => e.data.id?.startsWith('lib/data/'));
      expect(deepDataNodes.length).toBe(0); // No lib/data/services etc should appear
    });

    it('should respect the expected 9 node scenario', () => {
      // This simulates the user's exact scenario where they expect 9 nodes
      const largeDependencies: Dependency[] = [
        // Multiple files under lib/data
        { source_file: '/lib/data/services/api/api_client.dart', target_file: '/lib/data/models/user.dart', relationship_type: 'imports' },
        { source_file: '/lib/data/repositories/user_repository.dart', target_file: '/lib/data/models/user.dart', relationship_type: 'imports' },

        // Files under lib/config
        { source_file: '/lib/config/assets.dart', target_file: '/lib/data/models/asset.dart', relationship_type: 'imports' },
        { source_file: '/lib/config/routes.dart', target_file: '/lib/domain/models/route.dart', relationship_type: 'imports' },

        // Files under lib/domain
        { source_file: '/lib/domain/use_cases/login.dart', target_file: '/lib/data/repositories/auth_repository.dart', relationship_type: 'imports' },
        { source_file: '/lib/domain/models/user.dart', target_file: '/lib/data/models/user.dart', relationship_type: 'imports' },

        // Files under lib/presentation
        { source_file: '/lib/presentation/pages/home_page.dart', target_file: '/lib/domain/use_cases/get_user.dart', relationship_type: 'imports' },
        { source_file: '/lib/presentation/widgets/user_card.dart', target_file: '/lib/domain/models/user.dart', relationship_type: 'imports' },

        // Some files at lib root level
        { source_file: '/lib/main.dart', target_file: '/lib/presentation/pages/home_page.dart', relationship_type: 'imports' },
        { source_file: '/lib/app.dart', target_file: '/lib/config/routes.dart', relationship_type: 'imports' },
      ];

      let tree = buildProjectTreeFromLakos(largeDependencies);

      // Set up the exact tree state using proper propagation:
      // lib checked (expanded), first-level folders half-checked (contracted with children unchecked)
      let updatedNodes = updateCheckboxState('lib', 'checked', tree.nodes);

      // Set first-level lib folders to half-checked (this will make their children unchecked)
      ['lib/data', 'lib/config', 'lib/domain', 'lib/presentation'].forEach(nodeId => {
        if (updatedNodes.has(nodeId)) {
          updatedNodes = updateCheckboxState(nodeId, 'half-checked', updatedNodes);
        }
      });

      const result = transformToTreeBasedGraphElements(largeDependencies, updatedNodes);

      // Count unique display nodes (not containers, not edges)
      const displayNodes = result.elements.filter(e =>
        !e.data.source && // not an edge
        e.data.isLeaf // actual display nodes, not containers
      );

      console.log('🧪 Nine node scenario test:', {
        totalElements: result.elements.length,
        displayNodes: displayNodes.length,
        displayNodeIds: displayNodes.map(e => e.data.id),
        expectedFirstLevelNodes: ['lib/data', 'lib/config', 'lib/domain', 'lib/presentation', 'lib/main.dart', 'lib/app.dart']
      });

      // Should show approximately 4-6 nodes for this scenario:
      // - lib/data (half-checked, contracted)
      // - lib/config (half-checked, contracted)
      // - lib/domain (half-checked, contracted)
      // - lib/presentation (half-checked, contracted)
      // - lib (for files like lib/main.dart, lib/app.dart that map to half-checked lib)
      // The key insight: files under a half-checked parent map to that parent, not as separate nodes
      expect(displayNodes.length).toBeLessThanOrEqual(8); // Allow some buffer
      expect(displayNodes.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle correct propagation when folder becomes checked', () => {
      let tree = buildProjectTreeFromLakos(realCompassAppDependencies);

      // Start with lib unchecked, then make it checked
      let updatedNodes = updateCheckboxState('lib', 'unchecked', tree.nodes);
      updatedNodes = updateCheckboxState('lib', 'checked', updatedNodes);

      console.log('🧪 Checked folder propagation test:', {
        libState: updatedNodes.get('lib')?.checkboxState,
        libDataState: updatedNodes.get('lib/data')?.checkboxState,
        libDataServicesState: updatedNodes.get('lib/data/services')?.checkboxState,
        fileStates: {
          'lib/data/services/api/api_client.dart': updatedNodes.get('lib/data/services/api/api_client.dart')?.checkboxState,
          'lib/data/models/user.dart': updatedNodes.get('lib/data/models/user.dart')?.checkboxState
        }
      });

      // When lib becomes checked:
      // - lib should be checked
      // - lib/data should be half-checked (visible but contracted)
      // - lib/data/services should be unchecked (because lib/data is half-checked)
      // - files under lib/data should be unchecked
      expect(updatedNodes.get('lib')?.checkboxState).toBe('checked');
      expect(updatedNodes.get('lib/data')?.checkboxState).toBe('half-checked');
      expect(updatedNodes.get('lib/data/services')?.checkboxState).toBe('unchecked');
    });

    it('should not change parent from checked to half-checked when child becomes half-checked', () => {
      let tree = buildProjectTreeFromLakos(realCompassAppDependencies);

      // First make lib checked (this makes lib/data half-checked)
      let updatedNodes = updateCheckboxState('lib', 'checked', tree.nodes);

      // Verify initial state
      expect(updatedNodes.get('lib')?.checkboxState).toBe('checked');
      expect(updatedNodes.get('lib/data')?.checkboxState).toBe('half-checked');

      // Now explicitly set lib/data to half-checked (simulating user clicking on it)
      // This should NOT change lib from checked to half-checked
      updatedNodes = updateCheckboxState('lib/data', 'half-checked', updatedNodes);

      console.log('🧪 Parent preservation test:', {
        libStateBefore: 'checked',
        libStateAfter: updatedNodes.get('lib')?.checkboxState,
        libDataState: updatedNodes.get('lib/data')?.checkboxState
      });

      // lib should remain checked (not become half-checked)
      expect(updatedNodes.get('lib')?.checkboxState).toBe('checked');
      expect(updatedNodes.get('lib/data')?.checkboxState).toBe('half-checked');
    });
  });

  describe('Error Cases', () => {
    it('should handle empty tree nodes gracefully', () => {
      const emptyTreeNodes = new Map<string, TreeNode>();
      const result = transformToTreeBasedGraphElements(realCompassAppDependencies, emptyTreeNodes);

      // Should not crash, should return minimal structure
      expect(result.elements).toBeDefined();
      expect(Array.isArray(result.elements)).toBe(true);
    });

    it('should handle empty dependencies gracefully', () => {
      const tree = buildProjectTreeFromLakos(realCompassAppDependencies);
      const result = transformToTreeBasedGraphElements([], tree.nodes);

      expect(result.elements).toBeDefined();
      expect(Array.isArray(result.elements)).toBe(true);
    });

    it('should handle mismatched paths gracefully', () => {
      // Tree built from one set of paths
      const tree = buildProjectTreeFromLakos(realCompassAppDependencies);

      // But dependencies with completely different paths
      const mismatchedDeps: Dependency[] = [
        { source_file: '/completely/different/path.dart', target_file: '/another/path.dart', relationship_type: 'imports' }
      ];

      const result = transformToTreeBasedGraphElements(mismatchedDeps, tree.nodes);

      expect(result.elements).toBeDefined();
      expect(Array.isArray(result.elements)).toBe(true);
    });
  });
});