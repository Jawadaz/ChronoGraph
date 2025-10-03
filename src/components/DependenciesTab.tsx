import React from 'react';

interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight: number;
}

interface EdgeFilter {
  sourceId: string;
  targetId: string;
  relationshipTypes: string[];
}

interface CommitSnapshot {
  commit_hash: string;
  timestamp: number;
  commit_info: {
    hash: string;
    author_name: string;
    message: string;
    timestamp: number;
  };
  analysis_result: {
    dependencies: Dependency[];
    analyzed_files: string[];
    metrics: {
      analysis_duration_ms: number;
      total_files: number;
      total_dependencies: number;
    };
  };
}

interface DependenciesTabProps {
  selectedCommit: CommitSnapshot;
  dependencyFilter: string;
  setDependencyFilter: (filter: string) => void;
  dependencySort: 'source' | 'target' | 'type';
  setDependencySort: (sort: 'source' | 'target' | 'type') => void;
  showAllDeps: boolean;
  setShowAllDeps: (show: boolean) => void;
  dependencyLimit: number;
  setDependencyLimit: (limit: number) => void;
  edgeFilter: EdgeFilter | null;
  setEdgeFilter: (filter: EdgeFilter | null) => void;
}

export const DependenciesTab: React.FC<DependenciesTabProps> = ({
  selectedCommit,
  dependencyFilter,
  setDependencyFilter,
  dependencySort,
  setDependencySort,
  showAllDeps,
  setShowAllDeps,
  dependencyLimit,
  setDependencyLimit,
  edgeFilter,
  setEdgeFilter
}) => {
  const getFilteredDependencies = (dependencies: Dependency[]) => {
    const filter = dependencyFilter.toLowerCase();
    let filtered = dependencies.filter(dep =>
      dep.source_file.toLowerCase().includes(filter) ||
      dep.target_file.toLowerCase().includes(filter) ||
      dep.relationship_type.toLowerCase().includes(filter)
    );

    if (edgeFilter) {
      // Normalize paths for comparison
      const normalizePathForComparison = (path: string) => {
        let normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
        // Strip cache directory prefix if present
        const cacheMatch = normalized.match(/^(?:tmp\/)?chronograph[\/\\][^\/\\]+[\/\\](.+)$/);
        if (cacheMatch) {
          normalized = cacheMatch[1];
        }
        return normalized;
      };

      const normalizedSourceFilter = normalizePathForComparison(edgeFilter.sourceId);
      const normalizedTargetFilter = normalizePathForComparison(edgeFilter.targetId);

      filtered = filtered.filter(dep => {
        const normalizedSource = normalizePathForComparison(dep.source_file);
        const normalizedTarget = normalizePathForComparison(dep.target_file);

        // Match exact paths OR files within folders
        const sourceMatch =
          normalizedSource === normalizedSourceFilter ||
          normalizedSource.startsWith(normalizedSourceFilter + '/');

        const targetMatch =
          normalizedTarget === normalizedTargetFilter ||
          normalizedTarget.startsWith(normalizedTargetFilter + '/');

        const typeMatch = edgeFilter.relationshipTypes.length === 0 ||
                         edgeFilter.relationshipTypes.includes(dep.relationship_type);

        return sourceMatch && targetMatch && typeMatch;
      });
    }

    filtered.sort((a, b) => {
      switch (dependencySort) {
        case 'source':
          return a.source_file.localeCompare(b.source_file);
        case 'target':
          return a.target_file.localeCompare(b.target_file);
        case 'type':
          return a.relationship_type.localeCompare(b.relationship_type);
        default:
          return 0;
      }
    });

    const limit = showAllDeps ? filtered.length : Math.min(dependencyLimit, filtered.length);

    return {
      total: filtered.length,
      displayed: filtered.slice(0, limit),
      hasMore: filtered.length > limit
    };
  };

  const depData = getFilteredDependencies(selectedCommit.analysis_result.dependencies);

  return (
    <div className="dependencies-view">
      <h3>🔗 Dependencies for Commit {selectedCommit.commit_info.hash.substring(0, 8)}</h3>

      {/* Controls */}
      <div className="dependencies-controls">
        <div className="control-group">
          <input
            type="text"
            placeholder="Filter dependencies..."
            value={dependencyFilter}
            onChange={(e) => setDependencyFilter(e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="control-group">
          <label>Sort by:</label>
          <select
            value={dependencySort}
            onChange={(e) => setDependencySort(e.target.value as 'source' | 'target' | 'type')}
            className="sort-select"
          >
            <option value="source">Source File</option>
            <option value="target">Target File</option>
            <option value="type">Relationship Type</option>
          </select>
        </div>

        <div className="control-group">
          <label>Show:</label>
          <select
            value={showAllDeps ? 'all' : dependencyLimit.toString()}
            onChange={(e) => {
              if (e.target.value === 'all') {
                setShowAllDeps(true);
              } else {
                setShowAllDeps(false);
                setDependencyLimit(parseInt(e.target.value));
              }
            }}
            className="limit-select"
          >
            <option value="25">First 25</option>
            <option value="50">First 50</option>
            <option value="100">First 100</option>
            <option value="250">First 250</option>
            <option value="all">All ({depData.total})</option>
          </select>
        </div>
      </div>

      {/* Edge Filter Display - Compact */}
      {edgeFilter && (
        <div className="edge-filter-compact">
          <span className="filter-badge">
            🔍 {edgeFilter.sourceId.split('/').pop()} → {edgeFilter.targetId.split('/').pop()}
            <span className="filter-type-badge">({edgeFilter.relationshipTypes.join(', ')})</span>
          </span>
          <button
            className="clear-filter-compact"
            onClick={() => setEdgeFilter(null)}
            title="Clear filter"
          >
            ×
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="dependencies-stats">
        Showing {depData.displayed.length} of {depData.total} dependencies
        {dependencyFilter && (
          <span className="filter-indicator"> (filtered)</span>
        )}
      </div>

      {/* Dependencies List */}
      <div className="dependencies-list">
        {depData.displayed.map((dep, index) => (
          <div key={index} className="dependency-item">
            <div className="dependency-source" title={dep.source_file}>
              📄 {dep.source_file.split('/').pop() || dep.source_file}
              <div className="dependency-path">{dep.source_file.substring(0, dep.source_file.lastIndexOf('/'))}</div>
            </div>
            <div className="dependency-arrow">→</div>
            <div className="dependency-target" title={dep.target_file}>
              📄 {dep.target_file.split('/').pop() || dep.target_file}
              <div className="dependency-path">{dep.target_file.substring(0, dep.target_file.lastIndexOf('/'))}</div>
            </div>
            <div className="dependency-type">
              {dep.relationship_type}
            </div>
          </div>
        ))}

        {depData.hasMore && !showAllDeps && (
          <div className="more-dependencies">
            <button
              onClick={() => setShowAllDeps(true)}
              className="show-all-btn"
            >
              Show all {depData.total} dependencies
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .dependencies-view {
          padding: 20px;
        }

        .dependencies-controls {
          display: flex;
          gap: 20px;
          align-items: center;
          margin: 16px 0;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .control-group label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          white-space: nowrap;
        }

        .filter-input {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          width: 200px;
        }

        .sort-select, .limit-select {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .sort-select:focus, .limit-select:focus {
          outline: none;
          border-color: #2563eb;
        }

        .edge-filter-compact {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 0;
          padding: 6px 12px;
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 6px;
          font-size: 14px;
        }

        .filter-badge {
          color: #0369a1;
          font-weight: 500;
        }

        .filter-type-badge {
          color: #64748b;
          font-weight: 400;
          margin-left: 4px;
        }

        .clear-filter-compact {
          background: #ef4444;
          color: white;
          border: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dependencies-stats {
          margin: 8px 0;
          font-size: 14px;
          color: #6b7280;
        }

        .filter-indicator {
          font-weight: 500;
          color: #2563eb;
        }

        .dependencies-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 16px;
          max-height: 600px;
          overflow-y: auto;
        }

        .dependency-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 14px;
        }

        .dependency-source,
        .dependency-target {
          flex: 1;
          font-family: monospace;
          min-width: 0;
        }

        .dependency-path {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dependency-arrow {
          color: #6b7280;
        }

        .dependency-type {
          min-width: 80px;
          font-size: 12px;
          color: #6b7280;
          text-align: right;
        }

        .more-dependencies {
          padding: 12px;
          text-align: center;
          color: #6b7280;
        }

        .show-all-btn {
          background: #2563eb;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .show-all-btn:hover {
          background: #1d4ed8;
        }
      `}</style>
    </div>
  );
};