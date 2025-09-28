import React from 'react';

interface Statistics {
  total_snapshots: number;
  total_dependencies: number;
  total_files_analyzed: number;
  time_span_seconds: number;
  authors?: Array<{
    name: string;
    commits: number;
    color?: string;
  }>;
}

interface StatisticsTabProps {
  statistics: Statistics;
}

export const StatisticsTab: React.FC<StatisticsTabProps> = ({ statistics }) => {
  return (
    <div className="statistics-content">
      <h3>📈 Project Statistics</h3>
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
        <h4>👨‍💻 Author Activity</h4>
        <div className="authors-list">
          {statistics.authors?.map((author, index) => (
            <div key={index} className="author-item">
              <div className="author-info">
                <div className="author-name">{author.name}</div>
                <div className="author-commits">{author.commits} commits</div>
              </div>
              <div
                className="author-bar"
                style={{
                  width: `${(author.commits / Math.max(...(statistics.authors?.map(a => a.commits) || [1]))) * 100}%`,
                  backgroundColor: author.color || '#4CAF50'
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .statistics-content {
          padding: 20px;
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
          background: white;
        }

        .author-info {
          flex: 1;
        }

        .author-name {
          font-weight: 500;
          font-size: 14px;
          color: #374151;
        }

        .author-commits {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }

        .author-bar {
          height: 6px;
          border-radius: 3px;
          min-width: 20px;
          flex: 0 0 100px;
        }
      `}</style>
    </div>
  );
};