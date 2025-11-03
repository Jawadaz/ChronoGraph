import React from 'react';

interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight: number;
}

interface CommitInfo {
  hash: string;
  author_name: string;
  message: string;
  timestamp: number;
}

interface CommitSnapshot {
  commit_hash: string;
  timestamp: number;
  commit_info: CommitInfo;
  dependencies: Dependency[];
  analysis_result: {
    analyzed_files: string[];
    dependencies: Dependency[];
    metrics: {
      analysis_duration_ms: number;
      total_files: number;
      total_dependencies: number;
    };
  };
}

interface TimelineTabProps {
  snapshots: CommitSnapshot[];
  selectedCommit: CommitSnapshot | null;
  onCommitSelect: (commit: CommitSnapshot) => void;
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString();
};

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

export const TimelineTab: React.FC<TimelineTabProps> = ({
  snapshots,
  selectedCommit,
  onCommitSelect
}) => {
  // Reverse snapshots to show most recent first
  const reversedSnapshots = [...snapshots].reverse();
  
  return (
    <div className="timeline-content">
      <div className="commits-timeline">
        {reversedSnapshots.map((snapshot, index) => (
          <div
            key={index}
            className={`commit-item ${selectedCommit?.commit_hash === snapshot.commit_hash ? 'selected' : ''}`}
            onClick={() => onCommitSelect(snapshot)}
          >
            <div className="commit-header">
              <span className="commit-hash">
                {snapshot.commit_info.hash.substring(0, 8)}
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
          <h3>📋 Commit Details</h3>
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

      <style>{`
        .timeline-content {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .commits-timeline {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 8px;
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

        .commit-message-full {
          margin-top: 16px;
        }

        .commit-message-full pre {
          background: #f3f4f6;
          padding: 12px;
          border-radius: 4px;
          margin-top: 8px;
          white-space: pre-wrap;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};