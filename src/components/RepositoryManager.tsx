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

interface CacheStatistics {
  total_entries: number;
  total_size_mb: number;
  cache_hits: number;
  cache_misses: number;
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

  // Analysis cache state
  const [cacheStats, setCacheStats] = useState<CacheStatistics | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'repositories' | 'analysis'>('repositories');

  useEffect(() => {
    if (isVisible) {
      loadCachedRepositories();
      loadCacheStatistics();
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

  // Analysis cache functions
  const loadCacheStatistics = async () => {
    setCacheLoading(true);
    try {
      const stats = await invoke('get_cache_statistics');
      setCacheStats(stats as CacheStatistics);
    } catch (error) {
      console.error('Failed to load cache statistics:', error);
    } finally {
      setCacheLoading(false);
    }
  };

  const clearRepositoryCache = async (repoUrl: string) => {
    setCleanupInProgress(`cache-${repoUrl}`);
    try {
      await invoke('clear_repository_cache', { repoUrl });
      await loadCacheStatistics();
    } catch (error) {
      console.error('Failed to clear repository cache:', error);
      alert(`Failed to clear cache: ${error}`);
    } finally {
      setCleanupInProgress(null);
    }
  };

  const cleanupOldCache = async () => {
    setCleanupInProgress('cache-old');
    try {
      const deletedCount = await invoke('cleanup_old_cache', { maxAgeDays: 30 });
      alert(`Cleaned up ${deletedCount} old cache entries`);
      await loadCacheStatistics();
    } catch (error) {
      console.error('Failed to cleanup old cache:', error);
      alert(`Failed to cleanup cache: ${error}`);
    } finally {
      setCleanupInProgress(null);
    }
  };

  const clearAllCache = async () => {
    if (!confirm('Are you sure you want to clear all analysis cache? This will remove all cached analysis results.')) {
      return;
    }
    setCleanupInProgress('cache-all');
    try {
      await invoke('clear_all_cache');
      await loadCacheStatistics();
    } catch (error) {
      console.error('Failed to clear all cache:', error);
      alert(`Failed to clear cache: ${error}`);
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
          <h2>🗂️ Cache Manager</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'repositories' ? 'active' : ''}`}
            onClick={() => setActiveTab('repositories')}
          >
            📁 Repository Cache
          </button>
          <button
            className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            ⚡ Analysis Cache
          </button>
        </div>

        {activeTab === 'repositories' ? (
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
        ) : (
          <div className="cache-summary">
            <div className="summary-item">
              <span className="summary-label">Cache Entries:</span>
              <span className="summary-value">{cacheStats?.total_entries || 0}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Cache Size:</span>
              <span className="summary-value">{formatSize(cacheStats?.total_size_mb || 0)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Hit Rate:</span>
              <span className="summary-value">
                {cacheStats ?
                  `${Math.round((cacheStats.cache_hits / (cacheStats.cache_hits + cacheStats.cache_misses)) * 100)}%` :
                  'N/A'
                }
              </span>
            </div>
            <div className="summary-actions">
              <button
                onClick={loadCacheStatistics}
                disabled={cacheLoading}
                className="refresh-button"
              >
                {cacheLoading ? '🔄 Loading...' : '🔄 Refresh'}
              </button>
              <button
                onClick={cleanupOldCache}
                disabled={cleanupInProgress === 'cache-old'}
                className="cleanup-button"
              >
                {cleanupInProgress === 'cache-old' ? '⏳ Cleaning...' : '🧹 Clean Old (30d)'}
              </button>
              <button
                onClick={clearAllCache}
                disabled={cleanupInProgress === 'cache-all'}
                className="cleanup-all-button"
              >
                {cleanupInProgress === 'cache-all' ? '⏳ Clearing...' : '🗑️ Clear All'}
              </button>
            </div>
          </div>
        )}

        <div className="repository-list">
          {activeTab === 'repositories' ? (
            loading ? (
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
            )
          ) : (
            cacheLoading ? (
              <div className="loading-state">
                <div className="loading-spinner">🔄</div>
                <p>Loading cache statistics...</p>
              </div>
            ) : !cacheStats || cacheStats.total_entries === 0 ? (
              <div className="empty-state">
                <p>⚡ No analysis cache entries yet</p>
                <small>Cache entries will appear here after you run analyses</small>
              </div>
            ) : (
              <div className="cache-info-panel">
                <div className="cache-metrics">
                  <h4>📊 Cache Performance</h4>
                  <div className="metrics-grid">
                    <div className="metric-item">
                      <span className="metric-label">Cache Hits:</span>
                      <span className="metric-value">{cacheStats.cache_hits}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Cache Misses:</span>
                      <span className="metric-value">{cacheStats.cache_misses}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Total Requests:</span>
                      <span className="metric-value">{cacheStats.cache_hits + cacheStats.cache_misses}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Hit Rate:</span>
                      <span className="metric-value performance-metric">
                        {Math.round((cacheStats.cache_hits / (cacheStats.cache_hits + cacheStats.cache_misses)) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
                {cachedRepos.length > 0 && (
                  <div className="repository-cache-actions">
                    <h4>🗂️ Repository-specific Cache</h4>
                    <p>Clear analysis cache for specific repositories:</p>
                    <div className="repo-cache-list">
                      {cachedRepos.map((repo) => (
                        <div key={repo.name} className="repo-cache-item">
                          <span className="repo-cache-name">{repo.name}</span>
                          <button
                            onClick={() => clearRepositoryCache(repo.url)}
                            disabled={cleanupInProgress === `cache-${repo.url}`}
                            className="clear-cache-button"
                          >
                            {cleanupInProgress === `cache-${repo.url}` ? '⏳' : '🗑️ Clear Cache'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        <div className="manager-footer">
          <div className="cache-info">
            {activeTab === 'repositories' ? (
              <>
                <h4>💡 Repository Cache Information</h4>
                <ul>
                  <li>Repositories are cached locally to speed up repeated analyses</li>
                  <li>Cached repositories are automatically updated when needed</li>
                  <li>You can safely delete cached repositories - they will be re-downloaded when needed</li>
                  <li>Cache location: <code>/tmp/chronograph/</code></li>
                </ul>
              </>
            ) : (
              <>
                <h4>💡 Analysis Cache Information</h4>
                <ul>
                  <li>Analysis results are cached to avoid re-computing identical dependency graphs</li>
                  <li>Cache keys are based on repository + commit + subfolder + analyzer + config</li>
                  <li>Cache entries older than 30 days without access are automatically cleaned up</li>
                  <li>Cache hits provide 85-95% speed improvement for repeated analyses</li>
                  <li>Cache location: <code>~/.cache/chronograph/</code> (Windows: <code>%APPDATA%\chronograph\cache\</code>)</li>
                </ul>
              </>
            )}
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

          .tab-navigation {
            display: flex;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
          }

          .tab-button {
            flex: 1;
            padding: 16px 24px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #6b7280;
            border-bottom: 3px solid transparent;
            transition: all 0.2s ease;
          }

          .tab-button:hover {
            background: #f3f4f6;
            color: #374151;
          }

          .tab-button.active {
            color: #3b82f6;
            border-bottom-color: #3b82f6;
            background: white;
          }

          .cleanup-button {
            padding: 8px 16px;
            border: 1px solid #d97706;
            background: #fef3c7;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #92400e;
          }

          .cleanup-button:hover:not(:disabled) {
            background: #fde68a;
            border-color: #d97706;
          }

          .cleanup-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .cache-info-panel {
            padding: 24px;
          }

          .cache-metrics {
            margin-bottom: 32px;
          }

          .cache-metrics h4 {
            margin: 0 0 16px 0;
            font-size: 16px;
            color: #374151;
          }

          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
          }

          .metric-item {
            display: flex;
            justify-content: space-between;
            padding: 12px 16px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }

          .metric-label {
            color: #6b7280;
            font-size: 14px;
          }

          .metric-value {
            font-weight: 600;
            color: #374151;
          }

          .performance-metric {
            color: #059669;
            font-size: 16px;
          }

          .repository-cache-actions {
            border-top: 1px solid #e5e7eb;
            padding-top: 24px;
          }

          .repository-cache-actions h4 {
            margin: 0 0 8px 0;
            font-size: 16px;
            color: #374151;
          }

          .repository-cache-actions p {
            margin: 0 0 16px 0;
            color: #6b7280;
            font-size: 14px;
          }

          .repo-cache-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .repo-cache-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }

          .repo-cache-name {
            font-weight: 500;
            color: #374151;
          }

          .clear-cache-button {
            padding: 6px 12px;
            border: 1px solid #dc2626;
            background: #fef2f2;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            color: #dc2626;
            white-space: nowrap;
          }

          .clear-cache-button:hover:not(:disabled) {
            background: #fee2e2;
            border-color: #dc2626;
          }

          .clear-cache-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
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

            .metrics-grid {
              grid-template-columns: 1fr;
            }

            .repo-cache-item {
              flex-direction: column;
              gap: 8px;
              align-items: stretch;
            }

            .clear-cache-button {
              align-self: flex-end;
            }
          }
        `}</style>
      </div>
    </div>
  );
};