import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Check if we're in a Tauri environment
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

interface CachedRepository {
  name: string;
  url: string;
  local_path: string;
  last_updated: number;
  size_mb: number;
  commit_count: number;
}

interface RepositorySelectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onAnalysisStart: (repoUrl: string, subfolder?: string) => void;
  isAnalyzing: boolean;
}

export const RepositorySelectionModal: React.FC<RepositorySelectionModalProps> = ({
  isVisible,
  onClose,
  onAnalysisStart,
  isAnalyzing
}) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [subfolder, setSubfolder] = useState('');
  const [lakosAvailable, setLakosAvailable] = useState<boolean | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [cachedRepos, setCachedRepos] = useState<CachedRepository[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  React.useEffect(() => {
    if (isVisible) {
      checkLakosAvailability();
      loadCachedRepositories();
    }
  }, [isVisible]);

  const loadCachedRepositories = async () => {
    if (!isTauri) return;

    try {
      const repos = await invoke('get_cached_repositories');
      setCachedRepos(repos as CachedRepository[]);
    } catch (error) {
      console.error('Failed to load cached repositories:', error);
    }
  };

  const checkLakosAvailability = async () => {
    if (!isTauri) {
      console.log('Web version - enabling sample data analysis');
      setLakosAvailable(true); // Allow web version to work with sample data
      return;
    }

    try {
      console.log('Checking Lakos availability...');
      const available = await invoke('check_lakos_availability');
      console.log('Lakos availability result:', available);
      setLakosAvailable(available as boolean);
    } catch (error) {
      console.error('Error checking Lakos availability:', error);
      setLakosAvailable(false);
    }
  };

  const installLakos = async () => {
    if (!isTauri) {
      alert('Lakos installation is only available in the desktop app');
      return;
    }

    setIsInstalling(true);
    try {
      const result = await invoke('install_lakos');
      console.log('Lakos installation result:', result);
      setLakosAvailable(true);
      alert('Lakos installed successfully!');
    } catch (error) {
      console.error('Error installing Lakos:', error);
      alert(`Failed to install Lakos: ${error}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    if (!lakosAvailable) {
      if (!isTauri) {
        alert('Analysis is only available in the desktop app. Please download and use the desktop version of ChronoGraph.');
      } else {
        alert('Lakos analyzer is required. Please install it first.');
      }
      return;
    }

    onAnalysisStart(repoUrl.trim(), subfolder.trim() || undefined);
    onClose(); // Close modal after starting analysis
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const exampleRepos = [
    'https://github.com/flutter/samples',
    'https://github.com/flutter/gallery',
    'https://github.com/flutter/plugins',
  ];

  if (!isVisible) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>📂 Open Repository for Analysis</h2>
          <button onClick={onClose} className="close-button" title="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Lakos Status */}
          <div className="lakos-status">
            {lakosAvailable === null ? (
              <div className="status checking">🔍 Checking Lakos availability...</div>
            ) : lakosAvailable && !isTauri ? (
              <div className="status available">🌐 Web demo mode - using sample data</div>
            ) : lakosAvailable ? (
              <div className="status available">✅ Lakos analyzer ready</div>
            ) : (
              <div className="status unavailable">
                ❌ Lakos analyzer not installed
                {!isTauri ? (
                  <div className="web-notice">
                    <small>Analysis requires the desktop app. Please download and use the desktop version.</small>
                  </div>
                ) : (
                  <button
                    onClick={installLakos}
                    disabled={isInstalling}
                    className="install-button"
                  >
                    {isInstalling ? 'Installing...' : 'Install Lakos'}
                  </button>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="repo-form">
            {/* Repository URL */}
            <div className="form-group">
              <label htmlFor="repo-url" className="form-label">
                🔗 Repository URL
              </label>
              <div className="repo-input-container">
                <input
                  id="repo-url"
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onFocus={() => setShowDropdown(cachedRepos.length > 0)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="https://github.com/owner/repo"
                  className="repo-input"
                  disabled={isAnalyzing}
                  required
                  autoFocus
                />
                {showDropdown && cachedRepos.length > 0 && (
                  <div className="repo-dropdown">
                    <div className="dropdown-header">📂 Recently Cached Repositories</div>
                    {cachedRepos.map((repo) => (
                      <div
                        key={repo.name}
                        className="dropdown-item"
                        onClick={() => {
                          setRepoUrl(repo.url);
                          setShowDropdown(false);
                        }}
                      >
                        <div className="repo-dropdown-name">{repo.name}</div>
                        <div className="repo-dropdown-url">{repo.url}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Subfolder */}
            <div className="form-group">
              <label htmlFor="subfolder" className="form-label">
                📁 Subfolder (optional - leave empty to analyze entire repository)
              </label>
              <input
                id="subfolder"
                type="text"
                value={subfolder}
                onChange={(e) => setSubfolder(e.target.value)}
                placeholder="e.g., compass_app, animations, desktop_photo_search"
                className="subfolder-input"
                disabled={isAnalyzing}
              />
              <div className="subfolder-help">
                <small>
                  💡 For flutter/samples, try: "compass_app", "animations", or "desktop_photo_search"
                  to analyze a specific sample app instead of the entire repository.
                </small>
                {subfolder.trim() && (subfolder.includes('  ') || subfolder.startsWith(' ') || subfolder.endsWith(' ')) && (
                  <div className="validation-warning">
                    ⚠️ Warning: Path contains extra spaces. These will be trimmed automatically.
                  </div>
                )}
                {subfolder.includes('\\') && (
                  <div className="validation-warning">
                    ⚠️ Path separators normalized: "{subfolder}" → "{subfolder.replace(/\\/g, '/')}"
                  </div>
                )}
              </div>
            </div>

            {/* Example repositories */}
            <div className="form-group">
              <label className="form-label">📚 Quick Select</label>
              <div className="example-buttons">
                {exampleRepos.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setRepoUrl(url)}
                    className="example-button"
                    disabled={isAnalyzing}
                  >
                    {url.split('/').slice(-2).join('/')}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="cancel-button"
            disabled={isAnalyzing}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="repo-form"
            disabled={isAnalyzing || !lakosAvailable || !repoUrl.trim()}
            className="analyze-button"
            onClick={handleSubmit}
          >
            {isAnalyzing ? '🔍 Analyzing...' : '🚀 Start Analysis'}
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .modal-content {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 600px;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
            background: #f8fafc;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 1.25em;
            color: #374151;
            font-weight: 600;
          }

          .close-button {
            background: none;
            border: none;
            font-size: 24px;
            color: #6b7280;
            cursor: pointer;
            padding: 4px;
            line-height: 1;
            border-radius: 4px;
            transition: all 0.2s;
          }

          .close-button:hover {
            background: #f3f4f6;
            color: #374151;
          }

          .modal-body {
            flex: 1;
            padding: 24px;
            overflow-y: auto;
          }

          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding: 20px 24px;
            border-top: 1px solid #e5e7eb;
            background: #f8fafc;
          }

          .lakos-status {
            margin-bottom: 24px;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #ddd;
          }

          .status {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 500;
            font-size: 14px;
          }

          .status.checking {
            color: #666;
            background: #f5f5f5;
          }

          .status.available {
            color: #10b981;
            background: #ecfdf5;
            border-color: #10b981;
          }

          .status.unavailable {
            color: #ef4444;
            background: #fef2f2;
            border-color: #ef4444;
          }

          .install-button {
            padding: 4px 12px;
            border: 1px solid #ef4444;
            background: white;
            color: #ef4444;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-left: 8px;
          }

          .install-button:hover:not(:disabled) {
            background: #ef4444;
            color: white;
          }

          .install-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .web-notice {
            margin-top: 8px;
            padding: 8px 12px;
            background: #fef2f2;
            border: 1px solid #fca5a5;
            border-radius: 4px;
            color: #dc2626;
            font-size: 12px;
          }

          .repo-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .form-label {
            font-weight: 500;
            color: #374151;
            font-size: 14px;
          }

          .repo-input-container {
            position: relative;
          }

          .repo-input, .subfolder-input {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.2s;
          }

          .repo-input:focus, .subfolder-input:focus {
            outline: none;
            border-color: #2563eb;
          }

          .repo-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 2px solid #2563eb;
            border-radius: 8px;
            border-top-left-radius: 0;
            border-top-right-radius: 0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            max-height: 200px;
            overflow-y: auto;
          }

          .dropdown-header {
            padding: 8px 12px;
            background: #f3f4f6;
            border-bottom: 1px solid #e5e7eb;
            font-size: 12px;
            font-weight: 600;
            color: #374151;
          }

          .dropdown-item {
            padding: 10px 12px;
            border-bottom: 1px solid #f3f4f6;
            cursor: pointer;
            transition: background-color 0.2s;
          }

          .dropdown-item:hover {
            background: #f8fafc;
          }

          .dropdown-item:last-child {
            border-bottom: none;
          }

          .repo-dropdown-name {
            font-weight: 600;
            font-size: 14px;
            color: #374151;
            margin-bottom: 2px;
          }

          .repo-dropdown-url {
            font-size: 12px;
            color: #6b7280;
            word-break: break-all;
          }

          .subfolder-help {
            color: #6b7280;
            font-size: 12px;
            line-height: 1.4;
          }

          .validation-warning {
            margin-top: 6px;
            padding: 6px 10px;
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 4px;
            color: #92400e;
            font-size: 11px;
            font-weight: 500;
          }

          .example-buttons {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .example-button {
            padding: 6px 12px;
            border: 1px solid #ddd;
            background: white;
            color: #666;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
          }

          .example-button:hover:not(:disabled) {
            border-color: #2563eb;
            color: #2563eb;
          }

          .example-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .cancel-button {
            padding: 10px 20px;
            border: 1px solid #d1d5db;
            background: white;
            color: #374151;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          }

          .cancel-button:hover:not(:disabled) {
            background: #f9fafb;
            border-color: #9ca3af;
          }

          .cancel-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .analyze-button {
            padding: 10px 20px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
          }

          .analyze-button:hover:not(:disabled) {
            background: #1d4ed8;
          }

          .analyze-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          @media (max-width: 640px) {
            .modal-content {
              margin: 10px;
              max-width: none;
            }

            .modal-header, .modal-body, .modal-footer {
              padding: 16px;
            }

            .example-buttons {
              flex-direction: column;
            }

            .example-button {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </div>
  );
};