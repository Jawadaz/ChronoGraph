import React from 'react';

interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight: any;
}

interface CommitInfo {
  hash: string;
  author_name: string;
  message: string;
  timestamp: number;
}

interface CommitSnapshot {
  commit_info: CommitInfo;
  analysis_result: {
    dependencies: Dependency[];
    analyzed_files: string[];
    metrics: {
      total_files_found: number;
      files_analyzed: number;
      dependencies_found: number;
      analysis_duration_ms: number;
    };
  };
}

interface AnalysisResultsProps {
  snapshots: CommitSnapshot[];
  statistics: {
    total_snapshots: number;
    total_dependencies: number;
    total_files_analyzed: number;
    time_span_seconds: number;
    first_commit_hash: string;
    last_commit_hash: string;
    author_commit_counts: Record<string, number>;
  } | null;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ snapshots, statistics }) => {
  const [selectedCommit, setSelectedCommit] = React.useState<CommitSnapshot | null>(null);
  const [viewMode, setViewMode] = React.useState<'timeline' | 'statistics' | 'dependencies'>('timeline');

  if (snapshots.length === 0) {
    return (
      <div className="no-results">
        <h3>📊 No Analysis Results Yet</h3>
        <p>Start an analysis to see temporal dependency data here.</p>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="analysis-results">
      <div className="results-header">
        <h2>📈 Analysis Results</h2>
        <div className="view-controls">
          <button 
            className={viewMode === 'timeline' ? 'active' : ''}
            onClick={() => setViewMode('timeline')}
          >
            📅 Timeline
          </button>
          <button 
            className={viewMode === 'statistics' ? 'active' : ''}
            onClick={() => setViewMode('statistics')}
          >
            📊 Statistics
          </button>
          <button 
            className={viewMode === 'dependencies' ? 'active' : ''}
            onClick={() => setViewMode('dependencies')}
          >
            🔗 Dependencies
          </button>
        </div>
      </div>

      {viewMode === 'timeline' && (
        <div className="timeline-view">
          <h3>🕐 Commit Timeline ({snapshots.length} snapshots)</h3>
          <div className="commits-list">
            {snapshots.map((snapshot, index) => (
              <div 
                key={snapshot.commit_info.hash}
                className={`commit-item ${selectedCommit?.commit_info.hash === snapshot.commit_info.hash ? 'selected' : ''}`}
                onClick={() => setSelectedCommit(selectedCommit?.commit_info.hash === snapshot.commit_info.hash ? null : snapshot)}
              >
                <div className="commit-header">
                  <span className="commit-hash">
                    {snapshot.commit_info.hash.substring(0, 8)}
                  </span>
                  <span className="commit-author">
                    👤 {snapshot.commit_info.author_name}
                  </span>
                  <span className="commit-date">
                    📅 {formatDate(snapshot.commit_info.timestamp)}
                  </span>
                </div>
                <div className="commit-message">
                  {snapshot.commit_info.message.split('\n')[0]}
                </div>
                <div className="commit-stats">
                  📁 {snapshot.analysis_result.analyzed_files.length} files • 
                  🔗 {snapshot.analysis_result.dependencies.length} dependencies • 
                  ⏱️ {formatDuration(snapshot.analysis_result.metrics.analysis_duration_ms)}
                </div>
              </div>
            ))}
          </div>

          {selectedCommit && (
            <div className="commit-details">
              <h4>📋 Commit Details</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>Hash:</strong> <code>{selectedCommit.commit_info.hash}</code>
                </div>
                <div className="detail-item">
                  <strong>Author:</strong> {selectedCommit.commit_info.author_name}
                </div>
                <div className="detail-item">
                  <strong>Date:</strong> {formatDate(selectedCommit.commit_info.timestamp)}
                </div>
                <div className="detail-item">
                  <strong>Files Analyzed:</strong> {selectedCommit.analysis_result.analyzed_files.length}
                </div>
                <div className="detail-item">
                  <strong>Dependencies:</strong> {selectedCommit.analysis_result.dependencies.length}
                </div>
                <div className="detail-item">
                  <strong>Analysis Time:</strong> {formatDuration(selectedCommit.analysis_result.metrics.analysis_duration_ms)}
                </div>
              </div>
              <div className="commit-message-full">
                <strong>Message:</strong>
                <pre>{selectedCommit.commit_info.message}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'statistics' && statistics && (
        <div className="statistics-view">
          <h3>📊 Analysis Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{statistics.total_snapshots}</div>
              <div className="stat-label">Commits Analyzed</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{statistics.total_dependencies}</div>
              <div className="stat-label">Total Dependencies</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{statistics.total_files_analyzed}</div>
              <div className="stat-label">Files Analyzed</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{Math.round(statistics.time_span_seconds / 86400)}</div>
              <div className="stat-label">Days Covered</div>
            </div>
          </div>

          <div className="authors-section">
            <h4>👥 Author Contributions</h4>
            <div className="authors-list">
              {Object.entries(statistics.author_commit_counts)
                .sort(([,a], [,b]) => b - a)
                .map(([author, count]) => (
                  <div key={author} className="author-item">
                    <span className="author-name">{author}</span>
                    <span className="author-count">{count} commits</span>
                    <div className="author-bar">
                      <div 
                        className="author-bar-fill"
                        style={{ 
                          width: `${(count / Math.max(...Object.values(statistics.author_commit_counts))) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'dependencies' && selectedCommit && (
        <div className="dependencies-view">
          <h3>🔗 Dependencies for Commit {selectedCommit.commit_info.hash.substring(0, 8)}</h3>
          <div className="dependencies-list">
            {selectedCommit.analysis_result.dependencies.slice(0, 50).map((dep, index) => (
              <div key={index} className="dependency-item">
                <div className="dependency-source">
                  📄 {dep.source_file.split('/').pop()}
                </div>
                <div className="dependency-arrow">→</div>
                <div className="dependency-target">
                  📄 {dep.target_file.split('/').pop()}
                </div>
                <div className="dependency-type">
                  {dep.relationship_type}
                </div>
              </div>
            ))}
            {selectedCommit.analysis_result.dependencies.length > 50 && (
              <div className="more-dependencies">
                ... and {selectedCommit.analysis_result.dependencies.length - 50} more dependencies
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .analysis-results {
          margin-top: 30px;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .view-controls {
          display: flex;
          gap: 10px;
        }

        .view-controls button {
          padding: 8px 16px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .view-controls button.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .view-controls button:hover:not(.active) {
          border-color: #2563eb;
          color: #2563eb;
        }

        .commits-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .commit-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .commit-item:hover {
          border-color: #2563eb;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .commit-item.selected {
          border-color: #2563eb;
          background: #eff6ff;
        }

        .commit-header {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .commit-hash {
          font-family: monospace;
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .commit-message {
          font-weight: 500;
          margin-bottom: 8px;
          color: #374151;
        }

        .commit-stats {
          font-size: 12px;
          color: #6b7280;
        }

        .commit-details {
          margin-top: 20px;
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin: 16px 0;
        }

        .detail-item {
          font-size: 14px;
        }

        .commit-message-full pre {
          background: white;
          padding: 12px;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
          white-space: pre-wrap;
          font-size: 13px;
          margin: 8px 0 0 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin: 20px 0;
        }

        .stat-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
        }

        .stat-number {
          font-size: 32px;
          font-weight: bold;
          color: #2563eb;
        }

        .stat-label {
          font-size: 14px;
          color: #6b7280;
          margin-top: 4px;
        }

        .authors-section {
          margin-top: 30px;
        }

        .authors-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }

        .author-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }

        .author-name {
          min-width: 150px;
          font-weight: 500;
        }

        .author-count {
          min-width: 80px;
          font-size: 14px;
          color: #6b7280;
        }

        .author-bar {
          flex: 1;
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
        }

        .author-bar-fill {
          height: 100%;
          background: #2563eb;
          transition: width 0.3s ease;
        }

        .dependencies-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 16px;
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
          font-style: italic;
        }

        .no-results {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
};