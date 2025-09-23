import { transformToTreeBasedGraphElements } from '../treeBasedGraphTransforms';
import { buildProjectTreeFromLakos, TreeNode } from '../treeStructure';
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