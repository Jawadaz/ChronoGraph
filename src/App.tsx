import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { RepositoryInput, AnalysisProgress, AnalysisResults, RepositoryManager } from './components'

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
  const [isWebVersion, setIsWebVersion] = useState(!isTauri())

  // Poll for progress updates during analysis (Tauri only)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isAnalyzing && !isWebVersion) {
      interval = setInterval(async () => {
        try {
          const currentProgress = await invoke('get_analysis_progress');
          setProgress(currentProgress);

          // Simulate adding logs based on progress (this would come from backend in real implementation)
          if (currentProgress && currentProgress.current_commit_hash) {
            const newLogEntry = `Checking out commit: ${currentProgress.current_commit_hash}`;
            setAnalysisLogs(prev => {
              if (!prev.includes(newLogEntry)) {
                return [...prev, newLogEntry];
              }
              return prev;
            });
          }

          // Check if analysis is complete
          if (currentProgress && currentProgress.phase === 'Completed') {
            setIsAnalyzing(false);
            await fetchResults();
          } else if (currentProgress && currentProgress.phase.includes('Failed')) {
            setIsAnalyzing(false);
            setError('Analysis failed: ' + currentProgress.message);
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
      console.log('🌐 Web version: Generating sample data');
      setSnapshots([
        {
          commit_hash: 'sample-web-commit',
          timestamp: Date.now(),
          commit_info: {
            hash: 'sample-web-commit',
            message: 'Sample Flutter/Dart project structure',
            author: 'Web Demo',
            timestamp: Date.now()
          },
          dependencies: [
            // Main app structure
            { source_file: 'lib/main.dart', target_file: 'lib/app.dart', relationship_type: 'imports', weight: 1 },
            { source_file: 'lib/app.dart', target_file: 'lib/config/routes.dart', relationship_type: 'imports', weight: 1 },
            { source_file: 'lib/app.dart', target_file: 'lib/config/theme.dart', relationship_type: 'imports', weight: 1 },

            // Data layer
            { source_file: 'lib/data/repositories/user_repository.dart', target_file: 'lib/data/services/api_service.dart', relationship_type: 'imports', weight: 2 },
            { source_file: 'lib/data/repositories/auth_repository.dart', target_file: 'lib/data/services/api_service.dart', relationship_type: 'imports', weight: 3 },
            { source_file: 'lib/data/services/api_service.dart', target_file: 'lib/data/models/user.dart', relationship_type: 'imports', weight: 1 },

            // UI layer
            { source_file: 'lib/ui/screens/home_screen.dart', target_file: 'lib/ui/widgets/user_card.dart', relationship_type: 'imports', weight: 2 },
            { source_file: 'lib/ui/screens/home_screen.dart', target_file: 'lib/data/repositories/user_repository.dart', relationship_type: 'imports', weight: 1 },
            { source_file: 'lib/ui/screens/login_screen.dart', target_file: 'lib/data/repositories/auth_repository.dart', relationship_type: 'imports', weight: 1 },
            { source_file: 'lib/ui/widgets/user_card.dart', target_file: 'lib/data/models/user.dart', relationship_type: 'imports', weight: 1 },

            // Utils and config
            { source_file: 'lib/config/routes.dart', target_file: 'lib/ui/screens/home_screen.dart', relationship_type: 'imports', weight: 1 },
            { source_file: 'lib/config/routes.dart', target_file: 'lib/ui/screens/login_screen.dart', relationship_type: 'imports', weight: 1 },
            { source_file: 'lib/utils/validators.dart', target_file: 'lib/ui/screens/login_screen.dart', relationship_type: 'imports', weight: 1 },

            // Cross-dependencies
            { source_file: 'lib/data/models/user.dart', target_file: 'lib/utils/json_serializable.dart', relationship_type: 'implements', weight: 1 },
            { source_file: 'lib/ui/widgets/user_card.dart', target_file: 'lib/ui/widgets/base_card.dart', relationship_type: 'extends', weight: 1 },
          ],
          analysis_result: {
            analyzed_files: [
              'lib/main.dart', 'lib/app.dart', 'lib/config/routes.dart', 'lib/config/theme.dart',
              'lib/data/repositories/user_repository.dart', 'lib/data/repositories/auth_repository.dart',
              'lib/data/services/api_service.dart', 'lib/data/models/user.dart', 'lib/ui/screens/home_screen.dart',
              'lib/ui/screens/login_screen.dart', 'lib/ui/widgets/user_card.dart', 'lib/ui/widgets/base_card.dart',
              'lib/config/routes.dart', 'lib/utils/validators.dart', 'lib/utils/json_serializable.dart'
            ],
            dependencies: [
              { source_file: 'lib/main.dart', target_file: 'lib/app.dart', relationship_type: 'imports', weight: 1 },
              { source_file: 'lib/app.dart', target_file: 'lib/config/routes.dart', relationship_type: 'imports', weight: 1 },
              { source_file: 'lib/app.dart', target_file: 'lib/config/theme.dart', relationship_type: 'imports', weight: 1 },
              { source_file: 'lib/data/repositories/user_repository.dart', target_file: 'lib/data/services/api_service.dart', relationship_type: 'imports', weight: 2 },
              { source_file: 'lib/data/repositories/auth_repository.dart', target_file: 'lib/data/services/api_service.dart', relationship_type: 'imports', weight: 3 },
              { source_file: 'lib/data/services/api_service.dart', target_file: 'lib/data/models/user.dart', relationship_type: 'imports', weight: 1 },
              { source_file: 'lib/ui/screens/home_screen.dart', target_file: 'lib/ui/widgets/user_card.dart', relationship_type: 'imports', weight: 2 },
              { source_file: 'lib/ui/screens/home_screen.dart', target_file: 'lib/data/repositories/user_repository.dart', relationship_type: 'imports', weight: 1 },
              { source_file: 'lib/ui/screens/login_screen.dart', target_file: 'lib/data/repositories/auth_repository.dart', relationship_type: 'imports', weight: 1 },
              { source_file: 'lib/ui/widgets/user_card.dart', target_file: 'lib/data/models/user.dart', relationship_type: 'imports', weight: 1 },
              { source_file: 'lib/config/routes.dart', target_file: 'lib/ui/screens/home_screen.dart', relationship_type: 'imports', weight: 1 },
              { source_file: 'lib/config/routes.dart', target_file: 'lib/ui/screens/login_screen.dart', relationship_type: 'imports', weight: 1 },
              { source_file: 'lib/utils/validators.dart', target_file: 'lib/ui/screens/login_screen.dart', relationship_type: 'imports', weight: 1 },
              { source_file: 'lib/data/models/user.dart', target_file: 'lib/utils/json_serializable.dart', relationship_type: 'implements', weight: 1 },
              { source_file: 'lib/ui/widgets/user_card.dart', target_file: 'lib/ui/widgets/base_card.dart', relationship_type: 'extends', weight: 1 },
            ],
            metrics: {
              analysis_duration_ms: 1500,
              total_files: 15,
              total_dependencies: 15
            }
          }
        }
      ]);
      setStatistics({
        total_files: 15,
        total_dependencies: 15,
        average_dependencies_per_file: 1.0,
        cycles_detected: 0,
        instability_score: 0.45
      });
      console.log('✅ Web version: Sample data generated');
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
      // Initialize analysis (Tauri only)
      await invoke('initialize_analysis', {
        githubUrl: repoUrl,
        configOptions: {
          commit_sampling: 5, // Every 5th commit
          max_commits: 50,    // Limit for demo
          analyzer: 'lakos',
          subfolder: subfolder || null
        }
      });

      // Start analysis
      await invoke('start_analysis');

    } catch (err: any) {
      setIsAnalyzing(false);
      setError(`Failed to start analysis: ${err}`);
      console.error('Analysis error:', err);
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
      </header>

      <main className="app-main">
        {error && (
          <div className="error-message">
            <strong>❌ Error:</strong> {error}
            <button onClick={() => setError('')}>Dismiss</button>
          </div>
        )}

        <RepositoryInput 
          onAnalysisStart={handleAnalysisStart}
          isAnalyzing={isAnalyzing}
        />

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

      {!isWebVersion && (
        <RepositoryManager
          isVisible={showRepositoryManager}
          onClose={() => setShowRepositoryManager(false)}
        />
      )}

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .app-header {
          color: white;
          margin-bottom: 30px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1000px;
          margin: 0 auto;
        }

        .app-header h1 {
          font-size: 3em;
          margin: 0 0 10px 0;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }

        .app-header p {
          font-size: 1.2em;
          opacity: 0.9;
          margin: 0;
        }

        .repo-manager-button {
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .repo-manager-button:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.5);
          transform: translateY(-1px);
        }

        .app-main {
          max-width: 1000px;
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
          padding: 30px;
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