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

interface RepositoryInputProps {
  onAnalysisStart: (repoUrl: string, subfolder?: string) => void;
  isAnalyzing: boolean;
}

export const RepositoryInput: React.FC<RepositoryInputProps> = ({ onAnalysisStart, isAnalyzing }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [subfolder, setSubfolder] = useState('');
  const [lakosAvailable, setLakosAvailable] = useState<boolean | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [cachedRepos, setCachedRepos] = useState<CachedRepository[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  React.useEffect(() => {
    checkLakosAvailability();
    loadCachedRepositories();
  }, []);

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
  };

  const exampleRepos = [
    'https://github.com/flutter/samples',
    'https://github.com/flutter/gallery',
    'https://github.com/flutter/plugins',
  ];

  return (
    <div className="repository-input">
      <h2>📊 ChronoGraph Analysis</h2>
      <p>Enter a Flutter/Dart GitHub repository URL to analyze its temporal dependencies:</p>
      
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
        <div className="input-group">
          <div className="repo-input-container">
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onFocus={() => setShowDropdown(cachedRepos.length > 0)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="https://github.com/owner/repo"
              className="repo-input"
              disabled={isAnalyzing}
              required
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
          <button 
            type="submit" 
            disabled={isAnalyzing || !lakosAvailable}
            className="analyze-button"
          >
            {isAnalyzing ? '🔍 Analyzing...' : '🚀 Start Analysis'}
          </button>
        </div>
        
        {/* Subfolder selection */}
        <div className="subfolder-group">
          <label htmlFor="subfolder" className="subfolder-label">
            📁 Subfolder (optional - leave empty to analyze entire repository):
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
      </form>

      {/* Example repositories */}
      <div className="examples">
        <p>Try these example repositories:</p>
        <div className="example-buttons">
          {exampleRepos.map((url) => (
            <button
              key={url}
              onClick={() => setRepoUrl(url)}
              className="example-button"
              disabled={isAnalyzing}
            >
              {url.split('/').slice(-2).join('/')}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .repository-input {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }

        .lakos-status {
          margin: 20px 0;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #ddd;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 500;
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
          margin: 20px 0;
        }

        .input-group {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .repo-input-container {
          position: relative;
          flex: 1;
        }

        .subfolder-group {
          margin-bottom: 20px;
        }

        .subfolder-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #374151;
          font-size: 14px;
        }

        .subfolder-input {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .subfolder-input:focus {
          outline: none;
          border-color: #2563eb;
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

        .repo-input {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
        }

        .repo-input:focus {
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
          max-height: 300px;
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

        .analyze-button {
          padding: 12px 24px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
        }

        .analyze-button:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .analyze-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .examples {
          margin-top: 30px;
          text-align: center;
        }

        .examples p {
          margin-bottom: 10px;
          color: #666;
        }

        .example-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .example-button {
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          color: #666;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        }

        .example-button:hover:not(:disabled) {
          border-color: #2563eb;
          color: #2563eb;
        }

        .example-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};