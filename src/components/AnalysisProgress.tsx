import React from 'react';

interface AnalysisProgressProps {
  progress: {
    phase: string;
    current_commit: number;
    total_commits: number;
    current_commit_hash: string;
    message: string;
    percentage: number;
  } | null;
  logs?: string[];
  showLogs?: boolean;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ progress, logs = [], showLogs = false }) => {
  if (!progress) return null;

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'Cloning': return '📥';
      case 'BuildingCommitSequence': return '🔗';
      case 'AnalyzingCommits': return '🔍';
      case 'Completed': return '✅';
      case 'Failed': return '❌';
      default: return '⚙️';
    }
  };

  const getPhaseTitle = (phase: string) => {
    switch (phase) {
      case 'Cloning': return 'Cloning Repository';
      case 'BuildingCommitSequence': return 'Building Commit Sequence';
      case 'AnalyzingCommits': return 'Analyzing Dependencies';
      case 'Completed': return 'Analysis Complete';
      case 'Failed': return 'Analysis Failed';
      default: return phase;
    }
  };

  return (
    <div className="analysis-progress">
      <div className="progress-header">
        <h3>
          {getPhaseIcon(progress.phase)} {getPhaseTitle(progress.phase)}
        </h3>
        <div className="progress-stats">
          {progress.total_commits > 0 && (
            <span>{progress.current_commit} / {progress.total_commits} commits</span>
          )}
          <span>{Math.round(progress.percentage)}%</span>
        </div>
      </div>

      <div className="progress-bar-container">
        <div 
          className="progress-bar"
          style={{ width: `${Math.max(0, Math.min(100, progress.percentage))}%` }}
        />
      </div>

      <div className="progress-message">
        {progress.message}
      </div>

      {progress.current_commit_hash && (
        <div className="current-commit">
          <strong>Current commit:</strong> 
          <code>{progress.current_commit_hash.substring(0, 8)}</code>
        </div>
      )}

      {progress.phase === 'AnalyzingCommits' && progress.total_commits > 0 && (
        <div className="commit-progress">
          <div className="commit-dots">
            {Array.from({ length: Math.min(progress.total_commits, 20) }, (_, i) => {
              const commitIndex = Math.floor((i / 20) * progress.total_commits);
              const isCompleted = commitIndex < progress.current_commit;
              const isCurrent = commitIndex === progress.current_commit - 1;
              
              return (
                <div
                  key={i}
                  className={`commit-dot ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Real-time logging */}
      {showLogs && logs.length > 0 && (
        <div className="analysis-logs">
          <div className="logs-header">
            <h4>📄 Analysis Logs</h4>
            <small>{logs.length} messages</small>
          </div>
          <div className="logs-container">
            {logs.slice(-20).map((log, index) => (
              <div key={index} className={`log-entry ${
                log.includes('Warning:') ? 'warning' : 
                log.includes('Error:') ? 'error' :
                log.includes('Successfully') ? 'success' : 
                'info'
              }`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .analysis-progress {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
          margin: 20px 0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .progress-header h3 {
          margin: 0;
          font-size: 18px;
          color: #374151;
        }

        .progress-stats {
          display: flex;
          gap: 16px;
          font-size: 14px;
          color: #6b7280;
        }

        .progress-bar-container {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin: 12px 0;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-message {
          font-size: 14px;
          color: #6b7280;
          margin: 12px 0;
          line-height: 1.4;
        }

        .current-commit {
          font-size: 12px;
          color: #6b7280;
          margin-top: 8px;
        }

        .current-commit code {
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          margin-left: 8px;
        }

        .commit-progress {
          margin-top: 16px;
        }

        .commit-dots {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .commit-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #e5e7eb;
          transition: all 0.3s ease;
        }

        .commit-dot.completed {
          background: #10b981;
        }

        .commit-dot.current {
          background: #3b82f6;
          transform: scale(1.2);
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
        }

        .analysis-logs {
          margin-top: 20px;
          border-top: 1px solid #e5e7eb;
          padding-top: 16px;
        }

        .logs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .logs-header h4 {
          margin: 0;
          font-size: 16px;
          color: #374151;
        }

        .logs-header small {
          color: #6b7280;
          font-size: 12px;
        }

        .logs-container {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          max-height: 200px;
          overflow-y: auto;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 12px;
        }

        .log-entry {
          padding: 4px 12px;
          border-bottom: 1px solid #e5e7eb;
          word-break: break-all;
          line-height: 1.4;
        }

        .log-entry:last-child {
          border-bottom: none;
        }

        .log-entry.info {
          color: #374151;
        }

        .log-entry.success {
          color: #10b981;
          background: #ecfdf5;
        }

        .log-entry.warning {
          color: #f59e0b;
          background: #fffbeb;
        }

        .log-entry.error {
          color: #ef4444;
          background: #fef2f2;
        }
      `}</style>
    </div>
  );
};