import {
  normalizePath,
  isPathWithinFolder,
  getRelativeFromViewRoot,
  filterDependenciesForViewRoot,
  getFolderAtLevel,
  getFolderAtLevelRelativeToViewRoot,
  type Dependency
} from './dependencyFiltering';

describe('normalizePath', () => {
  test('should normalize Windows paths to Unix format', () => {
    expect(normalizePath('C:\\Users\\test\\file.txt')).toBe('C:/Users/test/file.txt');
    expect(normalizePath('/tmp/chronograph\\flutter-samples-cache\\compass_app/app\\lib')).toBe('tmp/chronograph/flutter-samples-cache/compass_app/app/lib');
  });

  test('should remove duplicate slashes', () => {
    expect(normalizePath('/tmp//test///file.txt')).toBe('tmp/test/file.txt');
    expect(normalizePath('//tmp/test/')).toBe('tmp/test/');
  });

  test('should remove leading slash', () => {
    expect(normalizePath('/tmp/test/file.txt')).toBe('tmp/test/file.txt');
    expect(normalizePath('tmp/test/file.txt')).toBe('tmp/test/file.txt');
  });
});

describe('isPathWithinFolder', () => {
  test('should return true for files within folder', () => {
    expect(isPathWithinFolder('/tmp/app/lib/config/deps.dart', 'tmp/app/lib')).toBe(true);
    expect(isPathWithinFolder('tmp/app/lib/ui/screen.dart', 'tmp/app/lib')).toBe(true);
  });

  test('should return false for files outside folder', () => {
    expect(isPathWithinFolder('/tmp/app/test/file.dart', 'tmp/app/lib')).toBe(false);
    expect(isPathWithinFolder('tmp/other/file.dart', 'tmp/app/lib')).toBe(false);
  });

  test('should handle exact folder match', () => {
    expect(isPathWithinFolder('tmp/app/lib', 'tmp/app/lib')).toBe(true);
  });

  test('should handle mixed path separators', () => {
    expect(isPathWithinFolder('/tmp\\app/lib\\config\\deps.dart', 'tmp/app/lib')).toBe(true);
    expect(isPathWithinFolder('/tmp\\app\\test\\file.dart', 'tmp/app/lib')).toBe(false);
  });
});

describe('getRelativeFromViewRoot', () => {
  test('should return relative paths correctly', () => {
    expect(getRelativeFromViewRoot('/tmp/app/lib/config/deps.dart', 'tmp/app/lib')).toBe('/config/deps.dart');
    expect(getRelativeFromViewRoot('tmp/app/lib/ui/screen.dart', 'tmp/app/lib')).toBe('/ui/screen.dart');
  });

  test('should handle root view folder', () => {
    expect(getRelativeFromViewRoot('/tmp/app/lib/file.dart', '/')).toBe('tmp/app/lib/file.dart');
  });

  test('should handle exact folder match', () => {
    expect(getRelativeFromViewRoot('tmp/app/lib', 'tmp/app/lib')).toBe('/');
  });
});

describe('getFolderAtLevel', () => {
  test('should extract folder at specific levels', () => {
    expect(getFolderAtLevel('tmp/app/lib/config/deps.dart', 1)).toBe('tmp');
    expect(getFolderAtLevel('tmp/app/lib/config/deps.dart', 2)).toBe('tmp/app');
    expect(getFolderAtLevel('tmp/app/lib/config/deps.dart', 3)).toBe('tmp/app/lib');
  });

  test('should handle level beyond path depth', () => {
    expect(getFolderAtLevel('tmp/app/file.dart', 5)).toBe('tmp/app');
  });

  test('should handle zero level', () => {
    expect(getFolderAtLevel('tmp/app/file.dart', 0)).toBe('/');
  });
});

describe('getFolderAtLevelRelativeToViewRoot', () => {
  test('should extract folder at specific levels relative to view root', () => {
    // When view root is 'tmp/app/lib', level 1 should show first level folders within lib
    expect(getFolderAtLevelRelativeToViewRoot('tmp/app/lib/config/deps.dart', 1, 'tmp/app/lib')).toBe('tmp/app/lib/config');
    expect(getFolderAtLevelRelativeToViewRoot('tmp/app/lib/ui/screen.dart', 1, 'tmp/app/lib')).toBe('tmp/app/lib/ui');

    // Level 2 would show deeper nesting
    expect(getFolderAtLevelRelativeToViewRoot('tmp/app/lib/config/auth/deps.dart', 2, 'tmp/app/lib')).toBe('tmp/app/lib/config/auth');
  });

  test('should return view root for files at root level', () => {
    expect(getFolderAtLevelRelativeToViewRoot('tmp/app/lib/main.dart', 1, 'tmp/app/lib')).toBe('tmp/app/lib');
  });

  test('should handle root view folder', () => {
    expect(getFolderAtLevelRelativeToViewRoot('tmp/app/lib/config/deps.dart', 1, '/')).toBe('tmp');
    expect(getFolderAtLevelRelativeToViewRoot('tmp/app/lib/config/deps.dart', 3, '/')).toBe('tmp/app/lib');
  });

  test('should handle zero level', () => {
    expect(getFolderAtLevelRelativeToViewRoot('tmp/app/lib/config/deps.dart', 0, 'tmp/app/lib')).toBe('tmp/app/lib');
  });
});

describe('filterDependenciesForViewRoot', () => {
  const sampleDeps: Dependency[] = [
    {
      source_file: '/tmp/app/lib/config/deps.dart',
      target_file: '/tmp/app/lib/main.dart',
      relationship_type: 'import',
      weight: 1
    },
    {
      source_file: '/tmp/app/lib/ui/screen.dart',
      target_file: '/tmp/app/lib/config/deps.dart',
      relationship_type: 'import',
      weight: 1
    },
    {
      source_file: '/tmp/app/test/test.dart',
      target_file: '/tmp/app/lib/main.dart',
      relationship_type: 'import',
      weight: 1
    },
    {
      source_file: '/tmp/app/lib/main.dart',
      target_file: '/tmp/other/external.dart',
      relationship_type: 'import',
      weight: 1
    }
  ];

  test('should filter internal dependencies correctly', () => {
    const result = filterDependenciesForViewRoot(sampleDeps, 'tmp/app/lib');

    expect(result.strategy).toBe('internal-only');
    expect(result.stats.total).toBe(4);
    expect(result.stats.internal).toBe(2); // First two deps are internal
    expect(result.stats.incoming).toBe(1); // Third dep is incoming
    expect(result.stats.outgoing).toBe(1); // Fourth dep is outgoing
    expect(result.filtered.length).toBe(2);
  });

  test('should handle root folder correctly', () => {
    const result = filterDependenciesForViewRoot(sampleDeps, '/');

    expect(result.strategy).toBe('root-show-all');
    expect(result.filtered.length).toBe(4);
  });

  test('should handle folder with no internal dependencies', () => {
    const result = filterDependenciesForViewRoot(sampleDeps, 'tmp/app/test');

    expect(result.strategy).toBe('no-internal-dependencies');
    expect(result.filtered.length).toBe(0);
    expect(result.stats.internal).toBe(0);
  });

  test('should handle real-world paths with mixed separators', () => {
    const realWorldDeps: Dependency[] = [
      {
        source_file: '/tmp/chronograph\\flutter-samples-cache\\compass_app/app\\integration_test/app_local_data_test.dart',
        target_file: '/tmp/chronograph\\flutter-samples-cache\\compass_app/app\\lib/config/dependencies.dart',
        relationship_type: 'import',
        weight: 1
      },
      {
        source_file: '/tmp/chronograph\\flutter-samples-cache\\compass_app/app\\lib/main.dart',
        target_file: '/tmp/chronograph\\flutter-samples-cache\\compass_app/app\\lib/config/dependencies.dart',
        relationship_type: 'import',
        weight: 1
      }
    ];

    const result = filterDependenciesForViewRoot(realWorldDeps, 'tmp/chronograph/flutter-samples-cache/compass_app/app/lib');

    expect(result.strategy).toBe('internal-only');
    expect(result.stats.internal).toBe(1); // Only the lib/main.dart -> lib/config/deps.dart
    expect(result.stats.incoming).toBe(1); // The integration_test -> lib/config/deps.dart
    expect(result.filtered.length).toBe(1);
  });
});