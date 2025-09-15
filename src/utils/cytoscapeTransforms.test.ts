import { transformToHierarchicalElements } from './cytoscapeTransforms';

describe('Progressive Disclosure', () => {
  it('should show only root level folders initially (collapsed)', () => {
    // Mock dependency data representing: tmp/chronograph/flutter-samples-cache/compass_app/app/lib/main.dart
    const mockDependencies = [
      {
        source_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/main.dart',
        target_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/config/config.dart',
        relationship_type: 'import'
      }
    ];

    const viewRootFolder = '/';
    const folderLevel = 1;

    const { elements, folderState } = transformToHierarchicalElements(
      mockDependencies,
      viewRootFolder,
      folderLevel,
      {}
    );

    // Extract folder nodes only
    const folderNodes = elements
      .filter(el => el.group === 'nodes' && el.data.type === 'folder')
      .map(el => el.data.id);

    console.log('Folder nodes found:', folderNodes);

    // EXPECTED BEHAVIOR:
    // With folderLevel = 1, we should only show the first level folder (tmp) in collapsed state
    // No deeper folders should be visible until the user expands tmp

    // Should show only the root folder
    expect(folderNodes).toContain('tmp');
    expect(folderNodes).toHaveLength(1);

    // Should not show any deep folders initially
    expect(folderNodes).not.toContain('tmp/chronograph');
    expect(folderNodes).not.toContain('tmp/chronograph/flutter-samples-cache');

    // Root folder should be collapsed
    const tmpFolder = elements.find(el => el.data.id === 'tmp');
    expect(tmpFolder?.data.isExpanded).toBe(false);
  });

  it('should still show only root level initially even with complex structure', () => {
    // Mock data with siblings at compass_app level
    const mockDependencies = [
      {
        source_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/main.dart',
        target_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/config.dart',
        relationship_type: 'import'
      },
      {
        source_file: '/tmp/chronograph/flutter-samples-cache/compass_app/tool/build.dart',
        target_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/main.dart',
        relationship_type: 'import'
      }
    ];

    const { elements } = transformToHierarchicalElements(mockDependencies, '/', 1, {});

    const folderNodes = elements
      .filter(el => el.group === 'nodes' && el.data.type === 'folder')
      .map(el => el.data.id);

    // Even with a complex structure, should still only show root level initially
    expect(folderNodes).toContain('tmp');
    expect(folderNodes).toHaveLength(1);
    expect(folderNodes).not.toContain('tmp/chronograph/flutter-samples-cache/compass_app');
  });

  it('should show immediate children when a folder is expanded', () => {
    // Mock dependency data with a clear hierarchy
    const mockDependencies = [
      {
        source_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/main.dart',
        target_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/config/config.dart',
        relationship_type: 'import'
      }
    ];

    const viewRootFolder = '/';
    const folderLevel = 1;

    // Start with tmp expanded
    const initialFolderState = {
      'tmp': {
        isExpanded: true,
        children: [],
        path: 'tmp'
      }
    };

    const { elements } = transformToHierarchicalElements(
      mockDependencies,
      viewRootFolder,
      folderLevel,
      initialFolderState
    );

    const folderNodes = elements
      .filter(el => el.group === 'nodes' && el.data.type === 'folder')
      .map(el => el.data.id);

    console.log('Folders when tmp is expanded:', folderNodes);

    // When tmp is expanded, should show:
    // - tmp (expanded)
    // - chronograph (collapsed, immediate child of tmp)
    expect(folderNodes).toContain('tmp');
    expect(folderNodes).toContain('tmp/chronograph');

    // Should NOT show deeper levels until chronograph is also expanded
    expect(folderNodes).not.toContain('tmp/chronograph/flutter-samples-cache');
    expect(folderNodes).not.toContain('tmp/chronograph/flutter-samples-cache/compass_app');

    // tmp should be expanded, chronograph should be collapsed
    const tmpFolder = elements.find(el => el.data.id === 'tmp');
    const chronographFolder = elements.find(el => el.data.id === 'tmp/chronograph');

    expect(tmpFolder?.data.isExpanded).toBe(true);
    expect(chronographFolder?.data.isExpanded).toBe(false);
  });

  it('should show two levels when both parent and child are expanded', () => {
    const mockDependencies = [
      {
        source_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/main.dart',
        target_file: '/tmp/chronograph/flutter-samples-cache/compass_app/app/lib/config/config.dart',
        relationship_type: 'import'
      }
    ];

    // Both tmp and chronograph are expanded
    const folderState = {
      'tmp': {
        isExpanded: true,
        children: [],
        path: 'tmp'
      },
      'tmp/chronograph': {
        isExpanded: true,
        children: [],
        path: 'tmp/chronograph'
      }
    };

    const { elements } = transformToHierarchicalElements(
      mockDependencies,
      '/',
      1,
      folderState
    );

    const folderNodes = elements
      .filter(el => el.group === 'nodes' && el.data.type === 'folder')
      .map(el => el.data.id);

    // Should show tmp -> chronograph -> flutter-samples-cache
    expect(folderNodes).toContain('tmp');
    expect(folderNodes).toContain('tmp/chronograph');
    expect(folderNodes).toContain('tmp/chronograph/flutter-samples-cache');

    // Should NOT show deeper levels
    expect(folderNodes).not.toContain('tmp/chronograph/flutter-samples-cache/compass_app');
  });

  it('should handle real Lakos data structure correctly', () => {
    // Real data from Lakos analysis (relative paths)
    const mockDependencies = [
      {
        source_file: '/lib/config/assets.dart',
        target_file: '/lib/data/repositories/activity/activity_repository.dart',
        relationship_type: 'import'
      },
      {
        source_file: '/integration_test/app_local_data_test.dart',
        target_file: '/lib/config/dependencies.dart',
        relationship_type: 'import'
      }
    ];

    const { elements } = transformToHierarchicalElements(
      mockDependencies,
      '/',
      1,
      {}
    );

    const folderNodes = elements
      .filter(el => el.group === 'nodes' && el.data.type === 'folder')
      .map(el => el.data.id);

    console.log('Real Lakos data structure folders:', folderNodes);

    // With real Lakos data, should show top-level folders like 'lib' and 'integration_test'
    expect(folderNodes).toContain('lib');
    expect(folderNodes).toContain('integration_test');
    expect(folderNodes).toHaveLength(2);
  });
});