import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { RepositorySelectionModal, AnalysisProgress, AnalysisResults, RepositoryManager } from './components'
import { mockAnalysisSnapshots, mockStatistics } from './data/mockAnalysisData'

// Check if we're running in Tauri or in web browser
const isTauri = () => {
  return window.__TAURI__ !== undefined;
};

function App() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [error, setError] = useState('')
  const [showLogs, setShowLogs] = useState(false)
  const [analysisLogs, setAnalysisLogs] = useState([])
  const [showRepositoryManager, setShowRepositoryManager] = useState(false)
  const [showRepositoryModal, setShowRepositoryModal] = useState(false)
  const [isWebVersion, setIsWebVersion] = useState(!isTauri())

  // Poll for progress updates during analysis (Tauri only)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isAnalyzing && !isWebVersion) {
      interval = setInterval(async () => {
        try {
          const currentProgress = await invoke('get_analysis_progress');
          setProgress(currentProgress);

          // Add progress messages to logs
          if (currentProgress) {
            // Add phase messages
            if (currentProgress.message) {
              const newLogEntry = `📋 ${currentProgress.message}`;
              setAnalysisLogs(prev => {
                if (!prev.includes(newLogEntry)) {
                  return [...prev, newLogEntry];
                }
                return prev;
              });
            }

            // Add commit checkout messages
            if (currentProgress.current_commit_hash) {
              const commitLogEntry = `🔄 Checking out commit: ${currentProgress.current_commit_hash.substring(0, 8)}`;
              setAnalysisLogs(prev => {
                if (!prev.includes(commitLogEntry)) {
                  return [...prev, commitLogEntry];
                }
                return prev;
              });
            }
          }

          // Check if analysis is complete
          if (currentProgress && currentProgress.phase === 'Completed') {
            setIsAnalyzing(false);
            await fetchResults();
          } else if (currentProgress && (typeof currentProgress.phase === 'object' && currentProgress.phase.Failed)) {
            // Handle Failed phase (which is an object like {Failed: "error message"})
            setIsAnalyzing(false);
            const errorMsg = currentProgress.phase.Failed || currentProgress.message || 'Unknown error';
            setError('Analysis failed: ' + errorMsg);
            console.error('❌ Analysis failed:', errorMsg);
          } else if (currentProgress && typeof currentProgress.phase === 'string' && currentProgress.phase.includes('Failed')) {
            // Fallback for string-based Failed phase
            setIsAnalyzing(false);
            setError('Analysis failed: ' + currentProgress.message);
            console.error('❌ Analysis failed:', currentProgress.message);
          }
        } catch (err) {
          console.error('Error getting progress:', err);
        }
      }, 1000); // Poll every second
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAnalyzing, isWebVersion]);

  const fetchResults = async () => {
    if (isWebVersion) {
      // In web version, show sample data with realistic Flutter/Dart structure
      console.log('🌐 Web version: Loading sample data');
      setSnapshots(mockAnalysisSnapshots);
      setStatistics(mockStatistics);
      console.log('✅ Web version: Sample data loaded');
      return;
    }

    try {
      const [snapshotsResult, statisticsResult] = await Promise.all([
        invoke('get_analysis_snapshots'),
        invoke('get_analysis_statistics')
      ]);
      setSnapshots(snapshotsResult || []);
      setStatistics(statisticsResult);
    } catch (err) {
      console.error('Error fetching results:', err);
      setError('Failed to fetch analysis results');
    }
  };

  const handleAnalysisStart = async (repoUrl: string, subfolder?: string) => {
    setIsAnalyzing(true);
    setError('');
    setProgress(null);
    setSnapshots([]);
    setStatistics(null);
    setAnalysisLogs([]);
    setShowLogs(true);

    if (isWebVersion) {
      // In web version, simulate analysis with sample data
      console.log('🌐 Web version: Starting analysis simulation');
      setAnalysisLogs(['🌐 Web version detected - showing sample data', '📁 Simulating Flutter/Dart project analysis']);

      setTimeout(() => {
        console.log('🌐 Web version: Setting progress');
        setProgress({
          phase: 'Analyzing dependencies',
          current_commit: 1,
          total_commits: 1,
          current_commit_hash: 'sample-web-data'
        });
        setAnalysisLogs(prev => [...prev, '🔍 Analyzing project structure', '📊 Processing dependencies']);
      }, 1000);

      setTimeout(() => {
        console.log('🌐 Web version: Completing analysis');
        setAnalysisLogs(prev => [...prev, '✅ Analysis complete - displaying results']);
        setIsAnalyzing(false);
        fetchResults();
      }, 3000);
      return;
    }

    try {
      // Detect if this is a local path (starts with / or drive letter like C:\)
      const isLocalPath = /^([A-Za-z]:[\\/]|\/|\\)/.test(repoUrl);

      // Initialize analysis (Tauri only)
      await invoke('initialize_analysis', {
        githubUrl: repoUrl,
        configOptions: {
          commit_sampling: 5, // Every 5th commit
          max_commits: 50,    // Limit for demo
          analyzer: 'lakos',
          subfolder: subfolder || null,
          is_local_path: isLocalPath
        }
      });

      // Start analysis
      await invoke('start_analysis');

    } catch (err: any) {
      setIsAnalyzing(false);
      const errorMessage = err?.toString() || 'Unknown error';

      // Add error to logs for visibility
      setAnalysisLogs(prev => [...prev, `❌ ERROR: ${errorMessage}`]);

      // Set error state
      setError(`Failed to start analysis: ${errorMessage}`);
      console.error('❌ Analysis error:', err);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>🕰️ ChronoGraph {isWebVersion && <span className="web-badge">🌐 Web Demo</span>}</h1>
            <p>Temporal Dependency Analyzer for Flutter/Dart Projects</p>
            {isWebVersion && (
              <p className="web-notice">
                📱 For full functionality, download the desktop app
              </p>
            )}
          </div>
          <div className="header-buttons">
            <button
              onClick={() => setShowRepositoryModal(true)}
              className="repo-modal-button"
              title="Open repository for analysis"
            >
              📂 Open Repository
            </button>
            {!isWebVersion && (
              <button
                onClick={() => setShowRepositoryManager(true)}
                className="repo-manager-button"
                title="Manage cached repositories"
              >
                🗂️ Cache Manager
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-message">
            <strong>❌ Error:</strong> {error}
            <button onClick={() => setError('')}>Dismiss</button>
          </div>
        )}

        {isAnalyzing && (
          <div>
            <AnalysisProgress 
              progress={progress} 
              logs={analysisLogs}
              showLogs={showLogs}
            />
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button 
                onClick={() => setShowLogs(!showLogs)}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  border: '1px solid #ddd',
                  background: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showLogs ? '📁 Hide Logs' : '📄 Show Logs'}
              </button>
            </div>
          </div>
        )}
        
        {!isAnalyzing && snapshots.length > 0 && (
          <AnalysisResults
            snapshots={snapshots}
            statistics={statistics}
          />
        )}
      </main>

      {/* Status Bar */}
      {!isAnalyzing && snapshots.length > 0 && (
        <div className="status-bar">
          <div className="status-left">
            <span className="status-item">
              📊 Commit: {snapshots[0]?.commit_info?.hash?.substring(0, 8) || 'Unknown'}
            </span>
            <span className="status-item">
              📁 {snapshots[0]?.analysis_result?.analyzed_files?.length || 0} files
            </span>
            <span className="status-item">
              🔗 {snapshots[0]?.analysis_result?.dependencies?.length || 0} dependencies
            </span>
          </div>
          <div className="status-right">
            <span className="status-item">
              ⏱️ {Math.round((snapshots[0]?.analysis_result?.metrics?.analysis_duration_ms || 0) / 1000)}s
            </span>
          </div>
        </div>
      )}

      <RepositorySelectionModal
        isVisible={showRepositoryModal}
        onClose={() => setShowRepositoryModal(false)}
        onAnalysisStart={handleAnalysisStart}
        isAnalyzing={isAnalyzing}
      />

      {!isWebVersion && (
        <RepositoryManager
          isVisible={showRepositoryManager}
          onClose={() => setShowRepositoryManager(false)}
        />
      )}

      <style jsx>{`
        .app {
          height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 0;
          display: flex;
          flex-direction: column;
        }

        .app-header {
          color: white;
          flex-shrink: 0;
          padding: 10px 2vw;
          margin-bottom: 0;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 95%;
          max-width: 1400px;
          margin: 0 auto;
        }

        .header-buttons {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .app-header h1 {
          font-size: 2em;
          margin: 0 0 5px 0;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }

        .app-header p {
          font-size: 0.9em;
          opacity: 0.9;
          margin: 0;
        }

        .repo-modal-button,
        .repo-manager-button {
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          white-space: nowrap;
        }

        .repo-modal-button:hover,
        .repo-manager-button:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.5);
          transform: translateY(-1px);
        }

        .app-main {
          flex: 1;
          width: 100%;
          margin: 0;
          background: rgba(255, 255, 255, 0.95);
          padding: 0;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          height: calc(100vh - 90px);
        }

        .error-message {
          background: #fee2e2;
          border: 1px solid #fca5a5;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          color: #dc2626;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .error-message button {
          background: none;
          border: 1px solid #dc2626;
          color: #dc2626;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .error-message button:hover {
          background: #dc2626;
          color: white;
        }

        .web-badge {
          font-size: 0.5em;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 4px 8px;
          border-radius: 12px;
          margin-left: 16px;
          font-weight: normal;
        }

        .web-notice {
          font-size: 0.9em;
          opacity: 0.8;
          margin-top: 8px;
          font-style: italic;
        }

        .status-bar {
          height: 24px;
          background: #007acc;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 16px;
          font-size: 12px;
          font-family: 'Consolas', 'Courier New', monospace;
          border-top: 1px solid #005a9e;
          flex-shrink: 0;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 1000;
        }

        .status-left {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .status-right {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 4px;
          color: rgba(255, 255, 255, 0.9);
        }

        .status-item:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 6px;
          border-radius: 3px;
          cursor: default;
        }

        @media (max-width: 768px) {
          .app {
            padding: 10px;
          }

          .app-main {
            padding: 20px;
          }

          .app-header h1 {
            font-size: 2em;
          }

          .app-header p {
            font-size: 1em;
          }
        }
      `}</style>
    </div>
  )
}

export default App