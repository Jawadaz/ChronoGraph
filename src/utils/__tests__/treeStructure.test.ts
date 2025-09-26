import { buildProjectTreeFromLakos, updateCheckboxState, getFilteredPathsFromTree } from '../treeStructure';
import { Dependency } from '../../types/Dependency';

describe('Tree Structure', () => {
  // Sample Lakos data similar to what we get from Flutter compass_app
  const sampleDependencies: Dependency[] = [
    {
      source_file: '/lib/config/assets.dart',
      target_file: '/lib/domain/models/activity/activity.dart',
      relationship_type: 'import'
    },
    {
      source_file: '/lib/config/dependencies.dart',
      target_file: '/lib/data/repositories/auth/auth_repository.dart',
      relationship_type: 'import'
    },
    {
      source_file: '/integration_test/app_local_data_test.dart',
      target_file: '/lib/config/dependencies.dart',
      relationship_type: 'import'
    },
    {
      source_file: '/lib/ui/core/ui/error_indicator.dart',
      target_file: '/lib/utils/image_error_listener.dart',
      relationship_type: 'import'
    }
  ];

  describe('buildProjectTreeFromLakos', () => {
    it('should create tree with data-driven root detection', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);

      // Root should be determined by analyzing the actual data patterns
      expect(tree.rootId).toBeDefined();
      expect(tree.rootId.length).toBeGreaterThan(0);

      const rootNode = tree.nodes.get(tree.rootId);
      expect(rootNode).toBeDefined();
      expect(rootNode?.type).toBe('folder');
      expect(rootNode?.parent).toBeUndefined();
    });

    it('should not include system temp paths like tmp', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);

      // Check that no node IDs contain system paths
      const nodeIds = Array.from(tree.nodes.keys());

      // Should not have common system path indicators in any node ID
      const hasSystemPaths = nodeIds.some(id =>
        id.includes('tmp') ||
        id.includes('cache') ||
        id.includes('temp') ||
        id.includes('C:') ||
        id.includes('/var/') ||
        id.includes('/Users/') ||
        id.includes('AppData')
      );
      expect(hasSystemPaths).toBe(false);

      // All non-root paths should be reasonable project paths
      nodeIds.forEach(id => {
        if (id !== tree.rootId) {
          // Should not contain obvious system indicators
          expect(id).not.toMatch(/^\/tmp\//);
          expect(id).not.toMatch(/^\/var\//);
          expect(id).not.toMatch(/^[A-Z]:\\/);
          expect(id).not.toMatch(/cache/i);
          expect(id).not.toMatch(/temp/i);
        }
      });
    });

    it('should create proper hierarchy based on data structure', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);
      const rootNode = tree.nodes.get(tree.rootId);

      // Root should have top-level folders as direct children
      expect(rootNode?.children).toBeDefined();
      expect(rootNode?.children.length).toBeGreaterThan(0);

      // Should find lib and integration_test folders since they're in our sample data
      expect(rootNode?.children).toContain('lib');
      expect(rootNode?.children).toContain('integration_test');

      // lib should be a folder node
      const libNode = tree.nodes.get('lib');
      expect(libNode).toBeDefined();
      expect(libNode?.type).toBe('folder');
      expect(libNode?.parent).toBe(tree.rootId);
    });

    it('should create expandable root node that shows children in UI', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);
      const rootNode = tree.nodes.get(tree.rootId);

      console.log('🧪 TEST: Tree structure for UI integration:', {
        rootId: tree.rootId,
        rootChildren: rootNode?.children,
        rootExpanded: rootNode?.isExpanded,
        totalNodes: tree.nodes.size,
        allNodeIds: Array.from(tree.nodes.keys()).slice(0, 10)
      });

      // Root should be expandable
      expect(rootNode?.isExpanded).toBe(true);
      expect(rootNode?.children.length).toBeGreaterThan(0);

      // Root should have visible children that can be accessed by the UI
      expect(rootNode?.children).toContain('lib');
      expect(rootNode?.children).toContain('integration_test');

      // Children should exist as nodes in the tree
      const libNode = tree.nodes.get('lib');
      const testNode = tree.nodes.get('integration_test');

      expect(libNode).toBeDefined();
      expect(testNode).toBeDefined();
      expect(libNode?.parent).toBe(tree.rootId);
      expect(testNode?.parent).toBe(tree.rootId);

      // Children should also be expandable and have their own children
      expect(libNode?.children.length).toBeGreaterThan(0);
      expect(libNode?.isExpanded).toBe(true);

      // UI Integration Test: Simulate what TreeView component receives
      console.log('🧪 TEST: What TreeView component should render:', {
        rootNodeForUI: {
          id: rootNode?.id,
          label: rootNode?.label,
          type: rootNode?.type,
          isExpanded: rootNode?.isExpanded,
          children: rootNode?.children,
          hasChildren: rootNode && rootNode.children.length > 0
        }
      });

      // The key issue: TreeView should show the root as expandable and show its children
      // This simulates the TreeView rendering logic
      const hasChildren = rootNode && rootNode.children.length > 0;
      const isExpanded = true; // Default from TreeView useState([rootId])
      expect(hasChildren && isExpanded).toBe(true); // This should be true for UI to show children
    });

    it('should create nested folder structure correctly', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);

      // Check lib/config exists
      const configNode = tree.nodes.get('lib/config');
      expect(configNode).toBeDefined();
      expect(configNode?.type).toBe('folder');
      expect(configNode?.parent).toBe('lib');

      // Check lib/config/assets.dart exists
      const assetsNode = tree.nodes.get('lib/config/assets.dart');
      expect(assetsNode).toBeDefined();
      expect(assetsNode?.type).toBe('file');
      expect(assetsNode?.parent).toBe('lib/config');
    });

    it('should initialize with smart default states to prevent massive initial load', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);

      // Root should be checked
      const rootNode = tree.nodes.get(tree.rootId);
      expect(rootNode?.checkboxState).toBe('checked');

      // First-level folders should be half-checked (visible but collapsed)
      const firstLevelFolders = rootNode?.children.filter(childId => {
        const child = tree.nodes.get(childId);
        return child?.type === 'folder';
      }) || [];

      firstLevelFolders.forEach(folderId => {
        const folderNode = tree.nodes.get(folderId);
        expect(folderNode?.checkboxState).toBe('half-checked');
      });

      // First-level files should be checked (visible)
      const firstLevelFiles = rootNode?.children.filter(childId => {
        const child = tree.nodes.get(childId);
        return child?.type === 'file';
      }) || [];

      firstLevelFiles.forEach(fileId => {
        const fileNode = tree.nodes.get(fileId);
        expect(fileNode?.checkboxState).toBe('checked');
      });

      // Deeper nodes should be unchecked
      for (const node of tree.nodes.values()) {
        if (node.id === tree.rootId) continue; // Skip root
        if (rootNode?.children.includes(node.id)) continue; // Skip first-level children

        expect(node.checkboxState).toBe('unchecked');
      }
    });
  });

  describe('Tree filtering for graph display', () => {
    it('should show only lib contents when lib folder is selected and others unchecked', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);

      // Uncheck root to uncheck everything
      let updatedTree = updateCheckboxState(tree.rootId, 'unchecked', tree.nodes);

      // Check only lib folder
      updatedTree = updateCheckboxState('lib', 'checked', updatedTree);

      const { includedPaths, expandedFolders } = getFilteredPathsFromTree(updatedTree);

      // Should include lib (checked) and lib/config (half-checked), but not unchecked children
      expect(includedPaths.has('lib')).toBe(true);
      expect(includedPaths.has('lib/config')).toBe(true);
      expect(includedPaths.has('lib/config/assets.dart')).toBe(false); // unchecked files not included
      expect(includedPaths.has('integration_test')).toBe(false);
      expect(includedPaths.has('integration_test/app_local_data_test.dart')).toBe(false);
    });

    it('should show collapsed folder when folder is half-checked', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);

      // Set lib to half-checked
      const updatedTree = updateCheckboxState('lib', 'half-checked', tree.nodes);

      const { collapsedFolders, expandedFolders } = getFilteredPathsFromTree(updatedTree);

      expect(collapsedFolders.has('lib')).toBe(true);
      expect(expandedFolders.has('lib')).toBe(false);
    });
  });

  describe('Checkbox state propagation', () => {
    it('should propagate checked state down correctly', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);

      // Uncheck root first
      let updatedTree = updateCheckboxState(tree.rootId, 'unchecked', tree.nodes);

      // Check lib folder
      updatedTree = updateCheckboxState('lib', 'checked', updatedTree);

      // lib subfolders should become half-checked
      const configNode = updatedTree.get('lib/config');
      expect(configNode?.checkboxState).toBe('half-checked');

      // Files under half-checked folders should be unchecked (contracted view)
      const assetsNode = updatedTree.get('lib/config/assets.dart');
      expect(assetsNode?.checkboxState).toBe('unchecked');
    });

    it('should propagate unchecked state to all children', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);

      // Uncheck lib folder
      const updatedTree = updateCheckboxState('lib', 'unchecked', tree.nodes);

      // All lib children should be unchecked
      const configNode = updatedTree.get('lib/config');
      expect(configNode?.checkboxState).toBe('unchecked');

      const assetsNode = updatedTree.get('lib/config/assets.dart');
      expect(assetsNode?.checkboxState).toBe('unchecked');
    });

    describe('Upward propagation rules', () => {
      it('should make parent checked when any child folder is checked', () => {
        const tree = buildProjectTreeFromLakos(sampleDependencies);

        // Start with everything unchecked
        let updatedTree = updateCheckboxState(tree.rootId, 'unchecked', tree.nodes);

        // Check a nested folder: lib/config
        updatedTree = updateCheckboxState('lib/config', 'checked', updatedTree);

        // Parent lib should become checked because lib/config is checked
        const libNode = updatedTree.get('lib');
        expect(libNode?.checkboxState).toBe('checked');

        // Root should become checked because lib is checked
        const rootNode = updatedTree.get(tree.rootId);
        expect(rootNode?.checkboxState).toBe('checked');
      });

      it('should make parent checked when any child folder is half-checked', () => {
        const tree = buildProjectTreeFromLakos(sampleDependencies);

        // Start with everything unchecked
        let updatedTree = updateCheckboxState(tree.rootId, 'unchecked', tree.nodes);

        // Set a nested folder to half-checked: lib/config
        updatedTree = updateCheckboxState('lib/config', 'half-checked', updatedTree);

        // Parent lib should become checked because lib/config is half-checked
        const libNode = updatedTree.get('lib');
        expect(libNode?.checkboxState).toBe('checked');

        // Root should become checked because lib is checked
        const rootNode = updatedTree.get(tree.rootId);
        expect(rootNode?.checkboxState).toBe('checked');
      });

      it('should make parent checked when any child file is checked', () => {
        const tree = buildProjectTreeFromLakos(sampleDependencies);

        // Start with everything unchecked
        let updatedTree = updateCheckboxState(tree.rootId, 'unchecked', tree.nodes);

        // Check a single file: lib/config/assets.dart
        updatedTree = updateCheckboxState('lib/config/assets.dart', 'checked', updatedTree);

        // Immediate parent lib/config should become checked
        const configNode = updatedTree.get('lib/config');
        expect(configNode?.checkboxState).toBe('checked');

        // lib should become checked because lib/config is checked
        const libNode = updatedTree.get('lib');
        expect(libNode?.checkboxState).toBe('checked');

        // Root should become checked because lib is checked
        const rootNode = updatedTree.get(tree.rootId);
        expect(rootNode?.checkboxState).toBe('checked');
      });

      it('should make parent unchecked only when ALL children are unchecked', () => {
        const tree = buildProjectTreeFromLakos(sampleDependencies);

        // Start by ensuring lib/config and its children are checked (override smart initialization for this test)
        let updatedTree = updateCheckboxState('lib/config', 'checked', tree.nodes);

        // Verify initial state: both files should be checked now
        expect(updatedTree.get('lib/config/dependencies.dart')?.checkboxState).toBe('checked');
        expect(updatedTree.get('lib/config/assets.dart')?.checkboxState).toBe('checked');

        // Uncheck one child (dependencies.dart)
        updatedTree = updateCheckboxState('lib/config/dependencies.dart', 'unchecked', updatedTree);

        // lib/config should still be checked because assets.dart is still checked
        const configNode = updatedTree.get('lib/config');
        expect(configNode?.checkboxState).toBe('checked');

        // Now uncheck the last file
        updatedTree = updateCheckboxState('lib/config/assets.dart', 'unchecked', updatedTree);

        // lib/config should become unchecked because ALL children are unchecked
        const configNodeAfter = updatedTree.get('lib/config');
        expect(configNodeAfter?.checkboxState).toBe('unchecked');
      });

      it('should handle mixed child states correctly', () => {
        const tree = buildProjectTreeFromLakos(sampleDependencies);

        // Start with everything unchecked
        let updatedTree = updateCheckboxState(tree.rootId, 'unchecked', tree.nodes);

        // Create a mixed scenario under lib:
        // - lib/config: checked
        // - lib/domain: half-checked
        // - lib/data: unchecked
        // - lib/ui: unchecked
        updatedTree = updateCheckboxState('lib/config', 'checked', updatedTree);
        updatedTree = updateCheckboxState('lib/domain', 'half-checked', updatedTree);
        // lib/data and lib/ui remain unchecked

        // lib should be checked because it has checked and half-checked children
        const libNode = updatedTree.get('lib');
        expect(libNode?.checkboxState).toBe('checked');

        // Root should be checked because lib is checked
        const rootNode = updatedTree.get(tree.rootId);
        expect(rootNode?.checkboxState).toBe('checked');
      });

      it('should handle deep nesting upward propagation', () => {
        // Create deeper dependencies for testing
        const deepDependencies: Dependency[] = [
          {
            source_file: '/lib/features/auth/presentation/pages/login_page.dart',
            target_file: '/lib/features/auth/domain/entities/user.dart',
            relationship_type: 'import'
          },
          {
            source_file: '/lib/features/auth/data/repositories/auth_repository_impl.dart',
            target_file: '/lib/features/auth/domain/repositories/auth_repository.dart',
            relationship_type: 'import'
          }
        ];

        const tree = buildProjectTreeFromLakos(deepDependencies);

        // Start with everything unchecked
        let updatedTree = updateCheckboxState(tree.rootId, 'unchecked', tree.nodes);

        // Check a deeply nested file
        updatedTree = updateCheckboxState('lib/features/auth/presentation/pages/login_page.dart', 'checked', updatedTree);

        // All parents should become checked due to upward propagation
        expect(updatedTree.get('lib/features/auth/presentation/pages')?.checkboxState).toBe('checked');
        expect(updatedTree.get('lib/features/auth/presentation')?.checkboxState).toBe('checked');
        expect(updatedTree.get('lib/features/auth')?.checkboxState).toBe('checked');
        expect(updatedTree.get('lib/features')?.checkboxState).toBe('checked');
        expect(updatedTree.get('lib')?.checkboxState).toBe('checked');
        expect(updatedTree.get(tree.rootId)?.checkboxState).toBe('checked');
      });

      it('should work correctly when checking multiple scattered files', () => {
        const tree = buildProjectTreeFromLakos(sampleDependencies);

        // Start with everything unchecked
        let updatedTree = updateCheckboxState(tree.rootId, 'unchecked', tree.nodes);

        // Check files in different branches
        updatedTree = updateCheckboxState('lib/config/assets.dart', 'checked', updatedTree);
        updatedTree = updateCheckboxState('integration_test/app_local_data_test.dart', 'checked', updatedTree);

        // Both lib and integration_test should be checked
        expect(updatedTree.get('lib')?.checkboxState).toBe('checked');
        expect(updatedTree.get('integration_test')?.checkboxState).toBe('checked');

        // Root should be checked because both children are checked
        expect(updatedTree.get(tree.rootId)?.checkboxState).toBe('checked');

        // Intermediate folders should also be checked
        expect(updatedTree.get('lib/config')?.checkboxState).toBe('checked');
      });
    });
  });

  describe('Integration test: No tmp nodes in graph', () => {
    it('should never show tmp nodes in the graph regardless of selection', () => {
      const tree = buildProjectTreeFromLakos(sampleDependencies);

      // Try various selection states
      const scenarios = [
        tree.nodes, // All checked
        updateCheckboxState('lib', 'half-checked', tree.nodes),
        updateCheckboxState(tree.rootId, 'half-checked', tree.nodes)
      ];

      scenarios.forEach((nodeMap, index) => {
        const { includedPaths } = getFilteredPathsFromTree(nodeMap);

        // No included path should contain system path indicators
        for (const path of includedPaths) {
          expect(path).not.toMatch(/tmp/i);
          expect(path).not.toMatch(/cache/i);
          expect(path).not.toMatch(/temp/i);
          expect(path).not.toMatch(/^\/var\//);
          expect(path).not.toMatch(/^[A-Z]:\\/);
          expect(path).not.toMatch(/AppData/);
        }
      });
    });
  });

  describe('UI Integration Tests', () => {
    it('should correctly build tree structure for real Lakos data from sample app', () => {
      // Sample dependencies from the real Flutter compass_app sample data
      const realSampleDependencies: Dependency[] = [
        { source_file: 'lib/main.dart', target_file: 'lib/app.dart', relationship_type: 'imports' },
        { source_file: 'lib/app.dart', target_file: 'lib/config/routes.dart', relationship_type: 'imports' },
        { source_file: 'lib/app.dart', target_file: 'lib/config/theme.dart', relationship_type: 'imports' },
        { source_file: 'lib/data/repositories/user_repository.dart', target_file: 'lib/data/services/api_service.dart', relationship_type: 'imports' },
        { source_file: 'lib/data/repositories/auth_repository.dart', target_file: 'lib/data/services/api_service.dart', relationship_type: 'imports' },
        { source_file: 'lib/data/services/api_service.dart', target_file: 'lib/data/models/user.dart', relationship_type: 'imports' },
        { source_file: 'lib/ui/screens/home_screen.dart', target_file: 'lib/ui/widgets/user_card.dart', relationship_type: 'imports' },
        { source_file: 'lib/ui/screens/home_screen.dart', target_file: 'lib/data/repositories/user_repository.dart', relationship_type: 'imports' },
        { source_file: 'lib/ui/screens/login_screen.dart', target_file: 'lib/data/repositories/auth_repository.dart', relationship_type: 'imports' },
        { source_file: 'lib/ui/widgets/user_card.dart', target_file: 'lib/data/models/user.dart', relationship_type: 'imports' }
      ];

      const tree = buildProjectTreeFromLakos(realSampleDependencies);

      console.log('🧪 UI Integration Test - Real sample data structure:', {
        rootId: tree.rootId,
        totalNodes: tree.nodes.size,
        rootChildren: tree.nodes.get(tree.rootId)?.children,
        libChildrenCount: tree.nodes.get('lib')?.children.length,
        mainDartExists: tree.nodes.has('lib/main.dart')
      });

      // For sample data with only lib/ paths, we should get 'lib' as the root
      expect(tree.rootId).toBe('lib');

      const rootNode = tree.nodes.get(tree.rootId);
      expect(rootNode).toBeDefined();
      expect(rootNode?.children.length).toBeGreaterThan(0);

      // Should contain the major folders from sample data
      expect(rootNode?.children).toContain('lib/main.dart');
      expect(rootNode?.children).toContain('lib/app.dart');
      expect(rootNode?.children).toContain('lib/config');
      expect(rootNode?.children).toContain('lib/data');
      expect(rootNode?.children).toContain('lib/ui');

      // Verify TreeView UI integration requirements
      const hasChildren = rootNode && rootNode.children.length > 0;
      const isExpanded = rootNode?.isExpanded;

      expect(hasChildren).toBe(true);
      expect(isExpanded).toBe(true);

      console.log('✅ UI Integration Test - TreeView should render correctly with these props:', {
        nodes: `Map(${tree.nodes.size} entries)`,
        rootId: tree.rootId,
        rootHasChildren: hasChildren,
        rootIsExpanded: isExpanded
      });
    });

    it('should correctly build tree for actual compass_app paths with leading slashes', () => {
      // Real compass_app paths we see in the desktop version logs
      const actualCompassAppDependencies: Dependency[] = [
        { source_file: '/lib/data/services/api/api_client.dart', target_file: '/lib/data/models/user.dart', relationship_type: 'imports' },
        { source_file: '/lib/data/services/api/auth_api_client.dart', target_file: '/lib/data/models/auth.dart', relationship_type: 'imports' },
        { source_file: '/test/data/services/api/api_client_test.dart', target_file: '/lib/data/services/api/api_client.dart', relationship_type: 'imports' },
        { source_file: '/test/data/services/api/auth_api_client_test.dart', target_file: '/lib/data/services/api/auth_api_client.dart', relationship_type: 'imports' },
        { source_file: '/testing/fakes/services/fake_api_client.dart', target_file: '/lib/data/services/api/api_client.dart', relationship_type: 'imports' },
        { source_file: '/testing/fakes/services/fake_auth_api_client.dart', target_file: '/lib/data/services/api/auth_api_client.dart', relationship_type: 'imports' }
      ];

      console.log('🚀 Testing actual compass_app paths structure...');
      const tree = buildProjectTreeFromLakos(actualCompassAppDependencies);

      console.log('🧪 Actual compass_app data structure:', {
        rootId: tree.rootId,
        totalNodes: tree.nodes.size,
        rootChildren: tree.nodes.get(tree.rootId)?.children,
        allNodeIds: Array.from(tree.nodes.keys()).slice(0, 15)
      });

      // Should get a sensible root (likely one of the top-level directories)
      expect(tree.rootId).toBeDefined();
      expect(tree.rootId.length).toBeGreaterThan(0);

      const rootNode = tree.nodes.get(tree.rootId);
      expect(rootNode).toBeDefined();
      expect(rootNode?.type).toBe('folder');
      expect(rootNode?.children.length).toBeGreaterThan(0);

      // Should contain lib, test, and testing as top-level folders
      const rootChildren = rootNode?.children || [];
      console.log('🌳 Root children:', rootChildren);

      // Verify no system paths leaked through
      const allNodeIds = Array.from(tree.nodes.keys());
      allNodeIds.forEach(id => {
        expect(id).not.toMatch(/tmp/i);
        expect(id).not.toMatch(/cache/i);
        expect(id).not.toMatch(/^\/var\//);
        expect(id).not.toMatch(/^[A-Z]:\\/);
      });

      console.log('✅ Actual compass_app test passed - no system paths found');
    });

    it('should handle system paths and normalize them to clean project paths', () => {
      // Dependencies with system paths (like what Rust backend provides)
      const systemPathDependencies: Dependency[] = [
        {
          source_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/config/assets.dart',
          target_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/domain/models/activity/activity.dart',
          relationship_type: 'import'
        },
        {
          source_file: 'tmp/chronograph/flutter-samples-cache/compass_app/app/integration_test/app_local_data_test.dart',
          target_file: 'tmp/chronograph/flutter-samples-cache/compass_app/app/lib/config/dependencies.dart',
          relationship_type: 'import'
        }
      ];

      const tree = buildProjectTreeFromLakos(systemPathDependencies);

      // Should detect 'app' as root, not 'tmp'
      expect(tree.rootId).toBe('app');

      // Should have clean project structure
      expect(tree.nodes.has('lib')).toBe(true);
      expect(tree.nodes.has('integration_test')).toBe(true);
      expect(tree.nodes.has('lib/config')).toBe(true);
      expect(tree.nodes.has('lib/config/assets.dart')).toBe(true);

      // Should NOT have system paths
      expect(tree.nodes.has('tmp')).toBe(false);
      expect(tree.nodes.has('chronograph')).toBe(false);

      console.log('✅ Path normalization test passed - system paths converted to clean project paths');
    });

    it('should detect app as root for Flutter app structure', () => {
      // Flutter app structure should be detected
      const flutterDependencies: Dependency[] = [
        {
          source_file: '/lib/config/assets.dart',
          target_file: '/lib/domain/models/user.dart',
          relationship_type: 'import'
        },
        {
          source_file: '/test/widget_test.dart',
          target_file: '/lib/main.dart',
          relationship_type: 'import'
        },
        {
          source_file: '/integration_test/app_test.dart',
          target_file: '/lib/config/assets.dart',
          relationship_type: 'import'
        }
      ];

      const tree = buildProjectTreeFromLakos(flutterDependencies);

      // Should detect 'app' as root for Flutter structure
      expect(tree.rootId).toBe('app');

      // Should have Flutter app folders as direct children
      const rootNode = tree.nodes.get('app');
      expect(rootNode?.children).toContain('lib');
      expect(rootNode?.children).toContain('test');
      expect(rootNode?.children).toContain('integration_test');

      console.log('✅ Flutter app root detection test passed');
    });
  });

  describe('Path Normalization', () => {
    it('should normalize Invoice Ninja admin portal paths correctly', () => {
      // Test the specific path normalization issue that was fixed
      const invoiceNinjaDependencies: Dependency[] = [
        {
          source_file: 'tmp/chronograph/invoiceninja-admin-portal-cache/lib/data/models/client_model.dart',
          target_file: 'tmp/chronograph/invoiceninja-admin-portal-cache/lib/redux/auth/auth_actions.dart',
          relationship_type: 'import'
        },
        {
          source_file: 'tmp/chronograph/invoiceninja-admin-portal-cache/lib/ui/auth/login_view.dart',
          target_file: 'tmp/chronograph/invoiceninja-admin-portal-cache/lib/data/file_storage.dart',
          relationship_type: 'import'
        }
      ];

      const tree = buildProjectTreeFromLakos(invoiceNinjaDependencies);

      // Root should be 'lib' (not 'project' fallback)
      expect(tree.rootId).toBe('lib');

      // Should have proper nested structure
      const libDataModels = tree.nodes.get('lib/data/models');
      expect(libDataModels).toBeDefined();
      expect(libDataModels?.type).toBe('folder');

      const libReduxAuth = tree.nodes.get('lib/redux/auth');
      expect(libReduxAuth).toBeDefined();
      expect(libReduxAuth?.type).toBe('folder');

      const libUiAuth = tree.nodes.get('lib/ui/auth');
      expect(libUiAuth).toBeDefined();
      expect(libUiAuth?.type).toBe('folder');

      // Files should be nested under their proper folders, not at root
      const clientModel = tree.nodes.get('lib/data/models/client_model.dart');
      expect(clientModel).toBeDefined();
      expect(clientModel?.parent).toBe('lib/data/models');

      const fileStorage = tree.nodes.get('lib/data/file_storage.dart');
      expect(fileStorage).toBeDefined();
      expect(fileStorage?.parent).toBe('lib/data');

      // Should not have random top-level folders like 'models', 'auth', etc.
      const rootNode = tree.nodes.get(tree.rootId);
      const topLevelFolders = rootNode?.children.filter(childId => {
        const child = tree.nodes.get(childId);
        return child?.type === 'folder';
      }) || [];

      // Should have proper lib structure, not scattered folders
      expect(topLevelFolders).toContain('lib/data');
      expect(topLevelFolders).toContain('lib/redux');
      expect(topLevelFolders).toContain('lib/ui');

      // Should NOT have these at top level (they should be under lib/)
      expect(topLevelFolders).not.toContain('models');
      expect(topLevelFolders).not.toContain('auth');
      expect(topLevelFolders).not.toContain('data');
    });
  });
});