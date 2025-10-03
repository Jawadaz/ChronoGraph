import { describe, it, expect } from 'vitest';

// Path normalization function extracted for testing
function normalizePathForComparison(path: string): string {
  let normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  // Strip cache directory prefix if present
  const cacheMatch = normalized.match(/^(?:tmp\/)?chronograph[\/\\][^\/\\]+[\/\\](.+)$/);
  if (cacheMatch) {
    normalized = cacheMatch[1];
  }
  return normalized;
}

// Edge filtering logic extracted for testing
function matchesEdgeFilter(
  dep: { source_file: string; target_file: string; relationship_type: string },
  edgeFilter: { sourceId: string; targetId: string; relationshipTypes: string[] }
): boolean {
  const normalizedSourceFilter = normalizePathForComparison(edgeFilter.sourceId);
  const normalizedTargetFilter = normalizePathForComparison(edgeFilter.targetId);

  const normalizedSource = normalizePathForComparison(dep.source_file);
  const normalizedTarget = normalizePathForComparison(dep.target_file);

  // Match exact paths OR files within folders
  const sourceMatch =
    normalizedSource === normalizedSourceFilter ||
    normalizedSource.startsWith(normalizedSourceFilter + '/');

  const targetMatch =
    normalizedTarget === normalizedTargetFilter ||
    normalizedTarget.startsWith(normalizedTargetFilter + '/');

  const typeMatch =
    edgeFilter.relationshipTypes.length === 0 ||
    edgeFilter.relationshipTypes.includes(dep.relationship_type);

  return sourceMatch && targetMatch && typeMatch;
}

describe('DependenciesTab Edge Filtering', () => {
  describe('Path Normalization', () => {
    it('should normalize Windows paths to Unix-style', () => {
      expect(normalizePathForComparison('lib\\ui\\app.dart')).toBe('lib/ui/app.dart');
    });

    it('should remove leading slashes', () => {
      expect(normalizePathForComparison('/lib/ui/app.dart')).toBe('lib/ui/app.dart');
    });

    it('should strip cache directory prefix', () => {
      expect(
        normalizePathForComparison('tmp/chronograph/repo-cache/lib/ui/app.dart')
      ).toBe('lib/ui/app.dart');
      expect(
        normalizePathForComparison('/tmp/chronograph\\repo-cache\\lib/ui/app.dart')
      ).toBe('lib/ui/app.dart');
    });

    it('should handle paths without cache prefix', () => {
      expect(normalizePathForComparison('lib/ui/app.dart')).toBe('lib/ui/app.dart');
    });
  });

  describe('File-to-File Filtering', () => {
    it('should match exact file paths', () => {
      const dep = {
        source_file: 'lib/ui/app.dart',
        target_file: 'lib/models/user.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui/app.dart',
        targetId: 'lib/models/user.dart',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(true);
    });

    it('should match files with cache prefix', () => {
      const dep = {
        source_file: '/tmp/chronograph/repo-cache/lib/ui/app.dart',
        target_file: '/tmp/chronograph/repo-cache/lib/models/user.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui/app.dart',
        targetId: 'lib/models/user.dart',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(true);
    });

    it('should not match different files', () => {
      const dep = {
        source_file: 'lib/ui/app.dart',
        target_file: 'lib/models/user.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui/home.dart',
        targetId: 'lib/models/user.dart',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(false);
    });

    it('should filter by relationship type', () => {
      const dep = {
        source_file: 'lib/ui/app.dart',
        target_file: 'lib/models/user.dart',
        relationship_type: 'export'
      };

      const filter = {
        sourceId: 'lib/ui/app.dart',
        targetId: 'lib/models/user.dart',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(false);
    });

    it('should match when relationship types array is empty', () => {
      const dep = {
        source_file: 'lib/ui/app.dart',
        target_file: 'lib/models/user.dart',
        relationship_type: 'export'
      };

      const filter = {
        sourceId: 'lib/ui/app.dart',
        targetId: 'lib/models/user.dart',
        relationshipTypes: []
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(true);
    });
  });

  describe('Folder-to-File Filtering', () => {
    it('should match files within source folder', () => {
      const dep = {
        source_file: 'lib/ui/app.dart',
        target_file: 'lib/models/user.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui',
        targetId: 'lib/models/user.dart',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(true);
    });

    it('should match files within target folder', () => {
      const dep = {
        source_file: 'lib/ui/app.dart',
        target_file: 'lib/models/user.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui/app.dart',
        targetId: 'lib/models',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(true);
    });

    it('should not match files outside folder', () => {
      const dep = {
        source_file: 'lib/utils/helper.dart',
        target_file: 'lib/models/user.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui',
        targetId: 'lib/models/user.dart',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(false);
    });
  });

  describe('Folder-to-Folder Filtering', () => {
    it('should match files within both folders', () => {
      const dep = {
        source_file: 'lib/ui/screens/home.dart',
        target_file: 'lib/models/entities/user.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui',
        targetId: 'lib/models',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(true);
    });

    it('should match nested files within folders', () => {
      const dep = {
        source_file: 'lib/ui/screens/nested/deep/component.dart',
        target_file: 'lib/models/complex/nested/entity.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui',
        targetId: 'lib/models',
        relationshipTypes: []
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(true);
    });

    it('should not match when source is outside folder', () => {
      const dep = {
        source_file: 'lib/utils/helper.dart',
        target_file: 'lib/models/user.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui',
        targetId: 'lib/models',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(false);
    });

    it('should not match when target is outside folder', () => {
      const dep = {
        source_file: 'lib/ui/app.dart',
        target_file: 'lib/utils/helper.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui',
        targetId: 'lib/models',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should not match folder name as substring', () => {
      const dep = {
        source_file: 'lib/ui_test/app.dart',
        target_file: 'lib/models/user.dart',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui',
        targetId: 'lib/models/user.dart',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(false);
    });

    it('should match folder exactly when file equals folder', () => {
      const dep = {
        source_file: 'lib/ui',
        target_file: 'lib/models',
        relationship_type: 'import'
      };

      const filter = {
        sourceId: 'lib/ui',
        targetId: 'lib/models',
        relationshipTypes: ['import']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(true);
    });

    it('should handle multiple relationship types', () => {
      const dep = {
        source_file: 'lib/ui/app.dart',
        target_file: 'lib/models/user.dart',
        relationship_type: 'export'
      };

      const filter = {
        sourceId: 'lib/ui/app.dart',
        targetId: 'lib/models/user.dart',
        relationshipTypes: ['import', 'export', 'part']
      };

      expect(matchesEdgeFilter(dep, filter)).toBe(true);
    });
  });
});
