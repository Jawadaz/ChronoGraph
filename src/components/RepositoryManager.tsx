import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CachedRepository {
  name: string;
  url: string;
  local_path: string;
  last_updated: number;
  size_mb: number;
  commit_count: number;
}

interface RepositoryManagerProps {
  isVisible: boolean;
  onClose: () => void;
}

export const RepositoryManager: React.FC<RepositoryManagerProps> = ({ isVisible, onClose }) => {
  const [cachedRepos, setCachedRepos] = useState<CachedRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalSize, setTotalSize] = useState(0);
  const [cleanupInProgress, setCleanupInProgress] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadCachedRepositories();
    }
  }, [isVisible]);

  const loadCachedRepositories = async () => {
    setLoading(true);
    try {
      const repos = await invoke('get_cached_repositories');
      const repoList = repos as CachedRepository[];
      setCachedRepos(repoList);
      setTotalSize(repoList.reduce((sum, repo) => sum + repo.size_mb, 0));
    } catch (error) {
      console.error('Failed to load cached repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  const cleanupRepository = async (repoName: string) => {
    setCleanupInProgress(repoName);
    try {
      await invoke('cleanup_cached_repository', { repoName });
      await loadCachedRepositories(); // Refresh the list
    } catch (error) {
      console.error('Failed to cleanup repository:', error);
      alert(`Failed to cleanup repository: ${error}`);
    } finally {
      setCleanupInProgress(null);
    }
  };

  const cleanupAllRepositories = async () => {
    setCleanupInProgress('all');
    try {
      await invoke('cleanup_all_cached_repositories');
      await loadCachedRepositories(); // Refresh the list
    } catch (error) {
      console.error('Failed to cleanup all repositories:', error);
      alert(`Failed to cleanup repositories: ${error}`);
    } finally {
      setCleanupInProgress(null);
    }
  };

  const updateRepository = async (repoName: string) => {
    setCleanupInProgress(repoName);
    try {
      await invoke('update_cached_repository', { repoName });
      await loadCachedRepositories(); // Refresh the list
    } catch (error) {
      console.error('Failed to update repository:', error);
      alert(`Failed to update repository: ${error}`);
    } finally {
      setCleanupInProgress(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSize = (sizeMb: number) => {
    if (sizeMb < 1000) {
      return `${sizeMb.toFixed(1)} MB`;
    }
    return `${(sizeMb / 1000).toFixed(2)} GB`;
  };

  if (!isVisible) return null;

  return (
    <div className="repository-manager-overlay">
      <div className="repository-manager">
        <div className="manager-header">
          <h2>🗂️ Repository Cache Manager</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="cache-summary">
          <div className="summary-item">
            <span className="summary-label">Cached Repositories:</span>
            <span className="summary-value">{cachedRepos.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Disk Usage:</span>
            <span className="summary-value">{formatSize(totalSize)}</span>
          </div>
          <div className="summary-actions">
            <button 
              onClick={loadCachedRepositories}
              disabled={loading}
              className="refresh-button"
            >
              {loading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
            <button 
              onClick={cleanupAllRepositories}
              disabled={cleanupInProgress === 'all' || cachedRepos.length === 0}
              className="cleanup-all-button"
            >
              {cleanupInProgress === 'all' ? '🧹 Cleaning...' : '🧹 Clean All'}
            </button>
          </div>
        </div>

        <div className="repository-list">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner">🔄</div>
              <p>Loading cached repositories...</p>
            </div>
          ) : cachedRepos.length === 0 ? (
            <div className="empty-state">
              <p>🗃️ No repositories cached yet</p>
              <small>Repositories will appear here after you analyze them</small>
            </div>
          ) : (
            cachedRepos.map((repo) => (
              <div key={repo.name} className="repository-item">
                <div className="repo-info">
                  <div className="repo-name">{repo.name}</div>
                  <div className="repo-url">{repo.url}</div>
                  <div className="repo-meta">
                    <span className="meta-item">
                      📅 Updated: {formatDate(repo.last_updated)}
                    </span>
                    <span className="meta-item">
                      💾 Size: {formatSize(repo.size_mb)}
                    </span>
                    <span className="meta-item">
                      📝 Commits: {repo.commit_count}
                    </span>
                  </div>
                </div>
                <div className="repo-actions">
                  <button
                    onClick={() => updateRepository(repo.name)}
                    disabled={cleanupInProgress === repo.name}
                    className="update-button"
                  >
                    {cleanupInProgress === repo.name ? '⏳' : '🔄 Update'}
                  </button>
                  <button
                    onClick={() => cleanupRepository(repo.name)}
                    disabled={cleanupInProgress === repo.name}
                    className="delete-button"
                  >
                    {cleanupInProgress === repo.name ? '⏳' : '🗑️ Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="manager-footer">
          <div className="cache-info">
            <h4>💡 Cache Information</h4>
            <ul>
              <li>Repositories are cached locally to speed up repeated analyses</li>
              <li>Cached repositories are automatically updated when needed</li>
              <li>You can safely delete cached repositories - they will be re-downloaded when needed</li>
              <li>Cache location: <code>/tmp/chronograph/</code></li>
            </ul>
          </div>
        </div>

        <style jsx>{`
          .repository-manager-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            padding: 20px;
          }

          .repository-manager {
            background: white;
            border-radius: 16px;
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
            display: flex;
            flex-direction: column;
          }

          .manager-header {
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f9fafb;
          }

          .manager-header h2 {
            margin: 0;
            font-size: 20px;
            color: #374151;
          }

          .close-button {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            color: #6b7280;
          }

          .close-button:hover {
            background: #e5e7eb;
            color: #374151;
          }

          .cache-summary {
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
            background: #fefefe;
          }

          .summary-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .summary-label {
            color: #6b7280;
            font-size: 14px;
          }

          .summary-value {
            font-weight: 600;
            color: #374151;
          }

          .summary-actions {
            display: flex;
            gap: 12px;
            margin-top: 16px;
          }

          .refresh-button, .cleanup-all-button {
            padding: 8px 16px;
            border: 1px solid #d1d5db;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          }

          .refresh-button:hover:not(:disabled) {
            background: #f3f4f6;
            border-color: #9ca3af;
          }

          .cleanup-all-button {
            background: #fef2f2;
            border-color: #fca5a5;
            color: #dc2626;
          }

          .cleanup-all-button:hover:not(:disabled) {
            background: #fee2e2;
            border-color: #f87171;
          }

          .refresh-button:disabled, .cleanup-all-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .repository-list {
            flex: 1;
            overflow-y: auto;
            padding: 0;
          }

          .loading-state, .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #6b7280;
          }

          .loading-spinner {
            font-size: 32px;
            margin-bottom: 16px;
            animation: spin 2s linear infinite;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          .repository-item {
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .repository-item:hover {
            background: #f9fafb;
          }

          .repo-info {
            flex: 1;
          }

          .repo-name {
            font-weight: 600;
            color: #374151;
            font-size: 16px;
            margin-bottom: 4px;
          }

          .repo-url {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 8px;
            word-break: break-all;
          }

          .repo-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
          }

          .meta-item {
            font-size: 12px;
            color: #6b7280;
            display: flex;
            align-items: center;
          }

          .repo-actions {
            display: flex;
            gap: 8px;
            flex-shrink: 0;
          }

          .update-button, .delete-button {
            padding: 6px 12px;
            border: 1px solid #d1d5db;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
          }

          .update-button:hover:not(:disabled) {
            background: #f3f4f6;
            border-color: #9ca3af;
          }

          .delete-button {
            background: #fef2f2;
            border-color: #fca5a5;
            color: #dc2626;
          }

          .delete-button:hover:not(:disabled) {
            background: #fee2e2;
            border-color: #f87171;
          }

          .update-button:disabled, .delete-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .manager-footer {
            padding: 20px 24px;
            border-top: 1px solid #e5e7eb;
            background: #f9fafb;
          }

          .cache-info h4 {
            margin: 0 0 12px 0;
            font-size: 16px;
            color: #374151;
          }

          .cache-info ul {
            margin: 0;
            padding-left: 16px;
            color: #6b7280;
            font-size: 14px;
            line-height: 1.6;
          }

          .cache-info li {
            margin-bottom: 4px;
          }

          .cache-info code {
            background: #f3f4f6;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 12px;
          }

          @media (max-width: 768px) {
            .repository-manager-overlay {
              padding: 10px;
            }

            .repository-item {
              flex-direction: column;
              align-items: stretch;
              gap: 16px;
            }

            .repo-actions {
              justify-content: flex-end;
            }

            .repo-meta {
              flex-direction: column;
              gap: 4px;
            }
          }
        `}</style>
      </div>
    </div>
  );
};