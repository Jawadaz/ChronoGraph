use crate::chronograph_engine::{ChronoGraphEngine, ChronoGraphConfig, AnalysisProgress, CommitSnapshot};
use crate::lakos_analyzer::LakosAnalyzer;
use crate::analysis_cache::CacheStatistics;
// Removed unused PathBuf import
use tauri::State;
use std::sync::{Arc, Mutex};
use anyhow::Result;

/// Shared state for ChronoGraph engine
pub type ChronoGraphState = Arc<Mutex<Option<ChronoGraphEngine>>>;

/// Progress callback state for analysis updates
pub type ProgressState = Arc<Mutex<Option<AnalysisProgress>>>;

/// Initialize ChronoGraph analysis
#[tauri::command]
pub async fn initialize_analysis(
    github_url: String,
    config_options: Option<serde_json::Value>,
    state: State<'_, ChronoGraphState>,
) -> Result<String, String> {
    println!("Initializing ChronoGraph analysis for: {}", github_url);
    
    // Create configuration
    let mut config = ChronoGraphConfig::default();
    config.github_url = github_url.clone();
    
    // Apply custom configuration if provided
    if let Some(options) = config_options {
        if let Some(sampling) = options.get("commit_sampling").and_then(|v| v.as_u64()) {
            config.commit_sampling = sampling as usize;
        }
        if let Some(max_commits) = options.get("max_commits").and_then(|v| v.as_u64()) {
            config.max_commits = Some(max_commits as usize);
        }
        if let Some(analyzer) = options.get("analyzer").and_then(|v| v.as_str()) {
            config.analyzer_name = analyzer.to_string();
        }
        if let Some(subfolder) = options.get("subfolder").and_then(|v| v.as_str()) {
            // Normalize path separators - convert backslashes to forward slashes
            let normalized_subfolder = subfolder.replace('\\', "/");
            config.subfolder = Some(normalized_subfolder);
        }
    }
    
    // Check if Lakos is available
    if config.analyzer_name == "lakos" && !LakosAnalyzer::is_available() {
        return Err("Lakos analyzer is not installed. Please run: dart pub global activate lakos".to_string());
    }
    
    // Create engine
    let engine = ChronoGraphEngine::new(config);
    
    // Store in state
    let mut state_guard = state.lock().map_err(|e| e.to_string())?;
    *state_guard = Some(engine);
    
    Ok(format!("ChronoGraph initialized for repository: {}", github_url))
}

/// Start the analysis process
#[tauri::command]
pub async fn start_analysis(
    state: State<'_, ChronoGraphState>,
    progress_state: State<'_, ProgressState>,
) -> Result<Vec<CommitSnapshot>, String> {
    println!("Starting ChronoGraph analysis...");
    
    // Extract engine from state
    let mut engine = {
        let mut state_guard = state.lock().map_err(|e| e.to_string())?;
        state_guard.take().ok_or("No analysis initialized")?
    }; // MutexGuard is dropped here
    
    // Run analysis with progress callback in a blocking task
    let progress_state_clone = Arc::clone(&progress_state);
    let result = tokio::task::spawn_blocking(move || {
        let snapshots = engine.analyze_repository(|progress| {
            // Update progress state
            if let Ok(mut progress_guard) = progress_state_clone.lock() {
                *progress_guard = Some(progress);
            }
        });
        (engine, snapshots)
    }).await.map_err(|e| e.to_string())?;
    
    // Handle result and store engine back
    let snapshots = match result {
        (engine_back, Ok(snapshots)) => {
            // Store engine back for future queries
            let mut state_guard = state.lock().map_err(|e| e.to_string())?;
            *state_guard = Some(engine_back);
            snapshots
        }
        (engine_back, Err(e)) => {
            // Still store engine back even if analysis failed
            let mut state_guard = state.lock().map_err(|e| e.to_string())?;
            *state_guard = Some(engine_back);
            return Err(e.to_string());
        }
    };
    
    Ok(snapshots)
}

/// Get current analysis progress
#[tauri::command]
pub async fn get_analysis_progress(
    progress_state: State<'_, ProgressState>,
) -> Result<Option<AnalysisProgress>, String> {
    let progress_guard = progress_state.lock().map_err(|e| e.to_string())?;
    Ok(progress_guard.clone())
}

/// Get analysis results/snapshots
#[tauri::command]
pub async fn get_analysis_snapshots(
    state: State<'_, ChronoGraphState>,
) -> Result<Vec<CommitSnapshot>, String> {
    let state_guard = state.lock().map_err(|e| e.to_string())?;
    
    match state_guard.as_ref() {
        Some(engine) => Ok(engine.get_snapshots().to_vec()),
        None => Err("No analysis available".to_string()),
    }
}

/// Get repository information
#[tauri::command]
pub async fn get_repository_info(
    state: State<'_, ChronoGraphState>,
) -> Result<Option<crate::git_navigator::RepoCloneInfo>, String> {
    let state_guard = state.lock().map_err(|e| e.to_string())?;
    
    match state_guard.as_ref() {
        Some(engine) => Ok(engine.get_repo_info().cloned()),
        None => Ok(None),
    }
}

/// Get analysis statistics
#[tauri::command]
pub async fn get_analysis_statistics(
    state: State<'_, ChronoGraphState>,
) -> Result<crate::chronograph_engine::AnalysisStatistics, String> {
    let state_guard = state.lock().map_err(|e| e.to_string())?;
    
    match state_guard.as_ref() {
        Some(engine) => Ok(engine.get_statistics()),
        None => Err("No analysis available".to_string()),
    }
}

/// List available dependency analyzers
#[tauri::command]
pub async fn list_analyzers(
    state: State<'_, ChronoGraphState>,
) -> Result<Vec<crate::dependency_analyzer::AnalyzerInfo>, String> {
    let state_guard = state.lock().map_err(|e| e.to_string())?;
    
    match state_guard.as_ref() {
        Some(engine) => Ok(engine.list_analyzers()),
        None => {
            // Return default analyzer list if no engine is initialized
            let mut registry = crate::dependency_analyzer::AnalyzerRegistry::new();
            registry.register(Box::new(LakosAnalyzer::new()));
            Ok(registry.list_analyzers())
        }
    }
}

/// Install Lakos analyzer
#[tauri::command]
pub async fn install_lakos() -> Result<String, String> {
    println!("Installing Lakos analyzer...");
    
    LakosAnalyzer::install()
        .map_err(|e| e.to_string())?;
    
    Ok("Lakos analyzer installed successfully".to_string())
}

/// Check if Lakos is available
#[tauri::command]
pub async fn check_lakos_availability() -> Result<bool, String> {
    Ok(LakosAnalyzer::is_available())
}

/// Get dependencies for a specific commit
#[tauri::command]
pub async fn get_commit_dependencies(
    commit_hash: String,
    state: State<'_, ChronoGraphState>,
) -> Result<Option<Vec<crate::dependency_analyzer::RawDependency>>, String> {
    let state_guard = state.lock().map_err(|e| e.to_string())?;
    
    if let Some(engine) = state_guard.as_ref() {
        let snapshot = engine.get_snapshots()
            .iter()
            .find(|s| s.commit_info.hash == commit_hash);
            
        if let Some(snapshot) = snapshot {
            Ok(Some(snapshot.analysis_result.dependencies.clone()))
        } else {
            Ok(None)
        }
    } else {
        Err("No analysis available".to_string())
    }
}

/// Get commit information by hash
#[tauri::command]
pub async fn get_commit_info(
    commit_hash: String,
    state: State<'_, ChronoGraphState>,
) -> Result<Option<crate::git_navigator::CommitInfo>, String> {
    let state_guard = state.lock().map_err(|e| e.to_string())?;
    
    if let Some(engine) = state_guard.as_ref() {
        let snapshot = engine.get_snapshots()
            .iter()
            .find(|s| s.commit_info.hash == commit_hash);
            
        if let Some(snapshot) = snapshot {
            Ok(Some(snapshot.commit_info.clone()))
        } else {
            Ok(None)
        }
    } else {
        Err("No analysis available".to_string())
    }
}

/// Cleanup analysis resources
#[tauri::command]
pub async fn cleanup_analysis(
    state: State<'_, ChronoGraphState>,
) -> Result<String, String> {
    let mut state_guard = state.lock().map_err(|e| e.to_string())?;
    
    if let Some(engine) = state_guard.take() {
        engine.cleanup().map_err(|e| e.to_string())?;
        Ok("Analysis resources cleaned up successfully".to_string())
    } else {
        Ok("No analysis to cleanup".to_string())
    }
}

/// Get current configuration
#[tauri::command]
pub async fn get_analysis_config(
    state: State<'_, ChronoGraphState>,
) -> Result<Option<ChronoGraphConfig>, String> {
    let state_guard = state.lock().map_err(|e| e.to_string())?;
    
    if let Some(engine) = state_guard.as_ref() {
        Ok(Some(engine.get_config().clone()))
    } else {
        Ok(None)
    }
}

/// Export analysis results to JSON
#[tauri::command]
pub async fn export_analysis_results(
    format: String, // "json", "csv", etc.
    state: State<'_, ChronoGraphState>,
) -> Result<String, String> {
    let state_guard = state.lock().map_err(|e| e.to_string())?;
    
    if let Some(engine) = state_guard.as_ref() {
        match format.as_str() {
            "json" => {
                let snapshots = engine.get_snapshots();
                serde_json::to_string_pretty(snapshots)
                    .map_err(|e| e.to_string())
            }
            _ => Err(format!("Unsupported export format: {}", format))
        }
    } else {
        Err("No analysis available to export".to_string())
    }
}

// Repository Management Commands

#[derive(Debug, serde::Serialize)]
pub struct CachedRepository {
    name: String,
    url: String,
    local_path: String,
    last_updated: i64,
    size_mb: f64,
    commit_count: usize,
}

/// Get list of cached repositories
#[tauri::command]
pub async fn get_cached_repositories() -> Result<Vec<CachedRepository>, String> {
    use std::fs;
    use std::path::PathBuf;
    
    let cache_dir = PathBuf::from("/tmp/chronograph");
    
    if !cache_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut repositories = Vec::new();
    
    let entries = fs::read_dir(&cache_dir).map_err(|e| e.to_string())?;
    
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if path.is_dir() {
            let dir_name = path.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("");
                
            // Only process cache directories
            if dir_name.ends_with("-cache") {
                if let Ok(repo_info) = analyze_cached_repo(&path).await {
                    repositories.push(repo_info);
                }
            }
        }
    }
    
    // Sort by last updated (newest first)
    repositories.sort_by(|a, b| b.last_updated.cmp(&a.last_updated));
    
    Ok(repositories)
}

/// Analyze a cached repository to extract information
async fn analyze_cached_repo(repo_path: &std::path::Path) -> Result<CachedRepository, String> {
    use crate::git_navigator::GitTemporalNavigator;
    use std::fs;
    
    // Extract repository name and reconstruct URL
    let dir_name = repo_path.file_name()
        .and_then(|name| name.to_str())
        .ok_or("Invalid directory name")?;
        
    let repo_name = dir_name.strip_suffix("-cache").unwrap_or(dir_name);
    
    // Try to determine URL from git remote
    let url = if let Ok(repo) = git2::Repository::open(repo_path) {
        if let Ok(remote) = repo.find_remote("origin") {
            remote.url().unwrap_or("unknown").to_string()
        } else {
            format!("https://github.com/{}", repo_name.replace('-', "/"))
        }
    } else {
        format!("https://github.com/{}", repo_name.replace('-', "/"))
    };
    
    // Get directory size
    let size_mb = get_directory_size(repo_path)? as f64 / (1024.0 * 1024.0);
    
    // Get last modified time
    let metadata = fs::metadata(repo_path).map_err(|e| e.to_string())?;
    let last_updated = metadata.modified()
        .map_err(|e| e.to_string())?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;
    
    // Try to get commit count
    let commit_count = if let Ok(navigator) = GitTemporalNavigator::clone_repository(&url, &repo_path.parent().unwrap()) {
        navigator.get_merge_sequence().len()
    } else {
        0
    };
    
    Ok(CachedRepository {
        name: repo_name.to_string(),
        url,
        local_path: repo_path.to_string_lossy().to_string(),
        last_updated,
        size_mb,
        commit_count,
    })
}

/// Get directory size recursively
fn get_directory_size(dir: &std::path::Path) -> Result<u64, String> {
    use std::fs;
    
    let mut size = 0;
    
    if dir.is_dir() {
        let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
        
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            
            if path.is_dir() {
                size += get_directory_size(&path)?;
            } else {
                let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
                size += metadata.len();
            }
        }
    }
    
    Ok(size)
}

/// Clean up a specific cached repository
#[tauri::command]
pub async fn cleanup_cached_repository(repo_name: String) -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;
    
    let cache_dir = PathBuf::from("/tmp/chronograph");
    let repo_dir = cache_dir.join(format!("{}-cache", repo_name));
    
    if repo_dir.exists() {
        fs::remove_dir_all(&repo_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

/// Clean up all cached repositories
#[tauri::command]
pub async fn cleanup_all_cached_repositories() -> Result<(), String> {
    use crate::git_navigator::GitTemporalNavigator;
    use std::path::PathBuf;
    
    let cache_dir = PathBuf::from("/tmp/chronograph");
    GitTemporalNavigator::cleanup_old_repos(&cache_dir).map_err(|e| e.to_string())?;
    
    // Also remove all cache directories
    if cache_dir.exists() {
        let entries = std::fs::read_dir(&cache_dir).map_err(|e| e.to_string())?;
        
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            
            if path.is_dir() {
                let dir_name = path.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("");
                    
                if dir_name.ends_with("-cache") {
                    let _ = std::fs::remove_dir_all(&path);
                }
            }
        }
    }
    
    Ok(())
}

/// Update a cached repository by fetching latest changes
#[tauri::command]
pub async fn update_cached_repository(repo_name: String) -> Result<(), String> {
    use std::path::PathBuf;
    
    let cache_dir = PathBuf::from("/tmp/chronograph");
    let repo_dir = cache_dir.join(format!("{}-cache", repo_name));
    
    if repo_dir.exists() {
        // Open the repository and fetch updates
        let repo = git2::Repository::open(&repo_dir).map_err(|e| e.to_string())?;
        
        let mut remote = repo.find_remote("origin").map_err(|e| e.to_string())?;
        
        // Fetch updates
        remote.fetch(&["refs/heads/*:refs/remotes/origin/*"], None, None)
            .map_err(|e| e.to_string())?;
        
        // Reset to latest commit
        let branch_names = ["refs/remotes/origin/main", "refs/remotes/origin/master"];
        
        for branch_name in &branch_names {
            if let Ok(reference) = repo.find_reference(branch_name) {
                if let Some(target) = reference.target() {
                    if let Ok(commit) = repo.find_commit(target) {
                        repo.reset(commit.as_object(), git2::ResetType::Hard, None)
                            .map_err(|e| e.to_string())?;
                        break;
                    }
                }
            }
        }
    } else {
        return Err("Repository cache not found".to_string());
    }

    Ok(())
}

/// Get cache statistics
#[tauri::command]
pub async fn get_cache_statistics(
    state: State<'_, ChronoGraphState>,
) -> Result<Option<CacheStatistics>, String> {
    let mut state_guard = state.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut engine) = state_guard.as_mut() {
        Ok(engine.get_cache_statistics())
    } else {
        Ok(None)
    }
}

/// Clear analysis cache for current repository
#[tauri::command]
pub async fn clear_repository_cache(
    state: State<'_, ChronoGraphState>,
) -> Result<usize, String> {
    let mut state_guard = state.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut engine) = state_guard.as_mut() {
        engine.clear_repository_cache().map_err(|e| e.to_string())
    } else {
        Ok(0)
    }
}

/// Cleanup old cache entries
#[tauri::command]
pub async fn cleanup_old_cache(
    max_age_days: u64,
    state: State<'_, ChronoGraphState>,
) -> Result<usize, String> {
    let mut state_guard = state.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut engine) = state_guard.as_mut() {
        engine.cleanup_old_cache(max_age_days).map_err(|e| e.to_string())
    } else {
        Ok(0)
    }
}

/// Clear entire analysis cache
#[tauri::command]
pub async fn clear_all_cache(
    state: State<'_, ChronoGraphState>,
) -> Result<usize, String> {
    let mut state_guard = state.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut engine) = state_guard.as_mut() {
        engine.clear_all_cache().map_err(|e| e.to_string())
    } else {
        Ok(0)
    }
}