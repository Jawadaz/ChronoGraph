use crate::git_navigator::{GitTemporalNavigator, CommitInfo, RepoCloneInfo};
use crate::dependency_analyzer::{AnalyzerRegistry, DependencyAnalyzer, AnalysisConfig, AnalysisResult};
use crate::lakos_analyzer::LakosAnalyzer;
use crate::analysis_cache::{AnalysisCache, AnalysisCacheKey, CacheStatistics};
use std::path::PathBuf;
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Complete snapshot of dependencies at a specific commit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitSnapshot {
    pub commit_info: CommitInfo,
    pub analysis_result: AnalysisResult,
    pub project_path: PathBuf,
}

/// Progress information for long-running analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisProgress {
    pub phase: AnalysisPhase,
    pub current_commit: usize,
    pub total_commits: usize,
    pub current_commit_hash: String,
    pub message: String,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnalysisPhase {
    Cloning,
    BuildingCommitSequence,
    AnalyzingCommits,
    Completed,
    Failed(String),
}

/// Configuration for ChronoGraph analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChronoGraphConfig {
    pub github_url: String,
    pub local_base_dir: PathBuf,
    pub analyzer_name: String,
    pub analysis_config: AnalysisConfig,
    /// Sample every N commits (1 = every commit, 2 = every other commit, etc.)
    pub commit_sampling: usize,
    /// Maximum number of commits to analyze (for performance)
    pub max_commits: Option<usize>,
    /// Whether to cleanup local repo after analysis
    pub cleanup_after_analysis: bool,
    /// Optional subfolder to analyze (e.g., "samples/web/gallery")
    pub subfolder: Option<String>,
    /// Whether the github_url is actually a local path
    pub is_local_repository: bool,
}

impl Default for ChronoGraphConfig {
    fn default() -> Self {
        // Use platform-specific temporary directory
        let temp_dir = std::env::temp_dir().join("chronograph");
        
        Self {
            github_url: String::new(),
            local_base_dir: temp_dir,
            analyzer_name: "lakos".to_string(),
            analysis_config: AnalysisConfig::default(),
            commit_sampling: 5, // Every 5th commit for performance
            max_commits: Some(100), // Limit for initial testing
            cleanup_after_analysis: true,
            subfolder: None,
            is_local_repository: false,
        }
    }
}

/// Main ChronoGraph analysis engine
pub struct ChronoGraphEngine {
    config: ChronoGraphConfig,
    git_navigator: Option<GitTemporalNavigator>,
    analyzer_registry: AnalyzerRegistry,
    snapshots: Vec<CommitSnapshot>,
    cache: Option<AnalysisCache>,
}

impl ChronoGraphEngine {
    pub fn new(config: ChronoGraphConfig) -> Self {
        let mut registry = AnalyzerRegistry::new();

        // Register Lakos analyzer by default
        registry.register(Box::new(LakosAnalyzer::new()));

        // Initialize cache
        let cache = Self::initialize_cache(&config).ok();
        if cache.is_none() {
            eprintln!("Warning: Failed to initialize analysis cache, running without cache");
        }

        Self {
            config,
            git_navigator: None,
            analyzer_registry: registry,
            snapshots: Vec::new(),
            cache,
        }
    }

    /// Initialize the analysis cache
    fn initialize_cache(config: &ChronoGraphConfig) -> Result<AnalysisCache> {
        // Get user cache directory or fallback to temp
        let cache_dir = if let Some(cache_dir) = dirs::cache_dir() {
            cache_dir.join("chronograph")
        } else {
            config.local_base_dir.join(".cache")
        };

        AnalysisCache::new(cache_dir)
            .context("Failed to initialize analysis cache")
    }
    
    /// Start the complete analysis process
    pub fn analyze_repository<F>(&mut self, progress_callback: F) -> Result<Vec<CommitSnapshot>>
    where
        F: Fn(AnalysisProgress),
    {
        progress_callback(AnalysisProgress {
            phase: AnalysisPhase::Cloning,
            current_commit: 0,
            total_commits: 0,
            current_commit_hash: String::new(),
            message: format!("Cloning repository: {}", self.config.github_url),
            percentage: 0.0,
        });
        
        // Step 1: Clone repository and build commit sequence
        let mut git_navigator = self.clone_and_setup()
            .context("Failed to clone repository")?;
            
        let merge_sequence = git_navigator.get_merge_sequence().to_vec();
        let total_commits = merge_sequence.len();
        
        progress_callback(AnalysisProgress {
            phase: AnalysisPhase::BuildingCommitSequence,
            current_commit: 0,
            total_commits,
            current_commit_hash: String::new(),
            message: format!("Found {} commits in merge sequence", total_commits),
            percentage: 10.0,
        });
        
        // Step 1.5: Validate subfolder exists (if specified)
        if let Some(ref subfolder) = self.config.subfolder {
            self.validate_subfolder_exists(&git_navigator, subfolder)
                .context("Subfolder validation failed")?;
        }
        
        // Step 2: Sample commits if needed
        let commits_to_analyze = self.sample_commits(&merge_sequence);
        let analysis_count = commits_to_analyze.len();
        
        progress_callback(AnalysisProgress {
            phase: AnalysisPhase::AnalyzingCommits,
            current_commit: 0,
            total_commits: analysis_count,
            current_commit_hash: String::new(),
            message: format!("Analyzing {} commits", analysis_count),
            percentage: 15.0,
        });
        
        // Step 3: Analyze each commit
        let mut snapshots = Vec::new();
        
        for (index, commit_info) in commits_to_analyze.iter().enumerate() {
            progress_callback(AnalysisProgress {
                phase: AnalysisPhase::AnalyzingCommits,
                current_commit: index + 1,
                total_commits: analysis_count,
                current_commit_hash: commit_info.hash.clone(),
                message: format!("Analyzing commit {}: {}", 
                               &commit_info.hash[..8], 
                               commit_info.message.split('\n').next().unwrap_or("")),
                percentage: 15.0 + (index as f64 / analysis_count as f64) * 80.0,
            });
            
            match self.analyze_commit(&mut git_navigator, commit_info) {
                Ok(snapshot) => {
                    snapshots.push(snapshot);
                }
                Err(e) => {
                    let error_string = e.to_string();
                    let error_msg = format!("{}", error_string);
                    println!("⚠️  Error analyzing commit {}: {}", &commit_info.hash[..8], error_msg);

                    // Check if this is a missing project files error
                    let is_missing_project_files = error_string.contains("Cannot analyze project") ||
                                                   error_string.contains("Required project files not found");
                    
                    // Check if this is truly a critical infrastructure error
                    let is_infrastructure_error = error_string.contains("Failed to checkout commit") ||
                                                 error_string.contains("Directory listing failed");

                    // Only fail immediately for infrastructure errors (git/filesystem problems)
                    // For missing project files, we'll check at the end if we got ANY successful analyses
                    if is_infrastructure_error {
                        // Send failed progress update before returning
                        progress_callback(AnalysisProgress {
                            phase: AnalysisPhase::Failed(error_msg.clone()),
                            current_commit: index + 1,
                            total_commits: analysis_count,
                            current_commit_hash: commit_info.hash.clone(),
                            message: error_msg.clone(),
                            percentage: 15.0 + (index as f64 / analysis_count as f64) * 80.0,
                        });
                        return Err(anyhow::anyhow!("{}", error_msg));
                    }

                    // For missing project files and other errors, continue with warning
                    if is_missing_project_files {
                        println!("⏭️  Skipping commit {} (project files not found yet) and continuing...", &commit_info.hash[..8]);
                    } else {
                        println!("⏭️  Skipping commit {} and continuing with next commit...", &commit_info.hash[..8]);
                    }
                }
            }
        }
        
        // Check if we got at least some successful analyses
        if snapshots.is_empty() {
            let error_msg = format!(
                "Failed to analyze any commits. This could mean:\n\
                 1. The repository doesn't contain a Flutter/Dart project (no pubspec.yaml found)\n\
                 2. The project is in a subfolder - please specify the subfolder path in settings\n\
                 3. The project was added in later commits - try analyzing more commits"
            );
            
            progress_callback(AnalysisProgress {
                phase: AnalysisPhase::Failed(error_msg.clone()),
                current_commit: analysis_count,
                total_commits: analysis_count,
                current_commit_hash: String::new(),
                message: error_msg.clone(),
                percentage: 100.0,
            });
            
            return Err(anyhow::anyhow!("{}", error_msg));
        }
        
        // Store results
        self.snapshots = snapshots.clone();
        self.git_navigator = Some(git_navigator);
        
        let success_rate = (snapshots.len() as f64 / analysis_count as f64 * 100.0) as usize;
        let message = if snapshots.len() < analysis_count {
            format!("Analysis completed. {} of {} commits analyzed successfully ({}% success rate). {} commits skipped due to missing project files.", 
                   snapshots.len(), analysis_count, success_rate, analysis_count - snapshots.len())
        } else {
            format!("Analysis completed. {} snapshots generated.", snapshots.len())
        };
        
        progress_callback(AnalysisProgress {
            phase: AnalysisPhase::Completed,
            current_commit: analysis_count,
            total_commits: analysis_count,
            current_commit_hash: String::new(),
            message,
            percentage: 100.0,
        });
        
        Ok(snapshots)
    }
    
    /// Clone repository and set up git navigator
    fn clone_and_setup(&mut self) -> Result<GitTemporalNavigator> {
        // Ensure local directory exists
        std::fs::create_dir_all(&self.config.local_base_dir)?;

        // Clean up old timestamped repositories before cloning
        let _ = GitTemporalNavigator::cleanup_old_repos(&self.config.local_base_dir);

        let mut git_navigator = if self.config.is_local_repository {
            // For local repositories, clone to a temp location to avoid modifying user's working directory
            GitTemporalNavigator::clone_local_repository(
                &self.config.github_url,
                &self.config.local_base_dir
            )?
        } else {
            // For remote repositories, clone normally
            GitTemporalNavigator::clone_repository(
                &self.config.github_url,
                &self.config.local_base_dir
            )?
        };

        // If we have a subfolder, rebuild merge sequence with filtering (normalize path separators)
        if let Some(ref subfolder) = self.config.subfolder {
            let normalized_subfolder = subfolder.replace('\\', "/");
            println!("Rebuilding merge sequence with subfolder filter: {} -> {}", subfolder, normalized_subfolder);
            git_navigator.build_merge_sequence_with_subfolder(Some(&normalized_subfolder))?;
        }

        Ok(git_navigator)
    }
    
    /// Validate that the specified subfolder exists in the latest commit
    fn validate_subfolder_exists(&self, git_navigator: &GitTemporalNavigator, subfolder: &str) -> Result<()> {
        // Normalize path separators - convert backslashes to forward slashes
        let normalized_subfolder = subfolder.replace('\\', "/");
        let base_path = git_navigator.local_path();
        let subfolder_path = base_path.join(&normalized_subfolder);
        
        println!("Validating subfolder: '{}' -> normalized: '{}' at path: {}", 
                 subfolder, normalized_subfolder, subfolder_path.display());
        
        if !subfolder_path.exists() {
            // Check if it's a case sensitivity issue or suggest alternatives
            let mut suggestions = Vec::new();
            
            // Try to find similar folders
            if let Some(parent) = subfolder_path.parent() {
                if parent.exists() {
                    if let Ok(entries) = std::fs::read_dir(parent) {
                        for entry in entries.flatten() {
                            if entry.path().is_dir() {
                                if let Some(dir_name) = entry.file_name().to_str() {
                                    let similarity_score = self.string_similarity(&normalized_subfolder, dir_name);
                                    if similarity_score > 0.6 {
                                        suggestions.push(dir_name.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            let mut error_msg = if subfolder != normalized_subfolder {
                format!(
                    "Subfolder '{}' (normalized to '{}') does not exist in the repository.\n\nRepository path: {}", 
                    subfolder, normalized_subfolder, base_path.display()
                )
            } else {
                format!(
                    "Subfolder '{}' does not exist in the repository.\n\nRepository path: {}", 
                    subfolder, base_path.display()
                )
            };
            
            if !suggestions.is_empty() {
                error_msg.push_str("\n\nDid you mean one of these?");
                for suggestion in suggestions.iter().take(5) {
                    error_msg.push_str(&format!("\n  - {}", suggestion));
                }
            } else {
                // List available top-level directories
                if let Ok(entries) = std::fs::read_dir(base_path) {
                    let mut dirs: Vec<String> = entries
                        .flatten()
                        .filter(|e| e.path().is_dir())
                        .filter_map(|e| e.file_name().to_str().map(String::from))
                        .collect();
                    
                    if !dirs.is_empty() {
                        dirs.sort();
                        error_msg.push_str("\n\nAvailable directories:");
                        for dir in dirs.iter().take(10) {
                            error_msg.push_str(&format!("\n  - {}", dir));
                        }
                        if dirs.len() > 10 {
                            error_msg.push_str(&format!("\n  ... and {} more", dirs.len() - 10));
                        }
                    }
                }
            }
            
            anyhow::bail!(error_msg);
        }
        
        // Check if it's actually a Flutter/Dart project
        let pubspec_path = subfolder_path.join("pubspec.yaml");
        if !pubspec_path.exists() {
            let mut warning = format!(
                "Warning: '{}' doesn't contain pubspec.yaml.\n", subfolder
            );
            warning.push_str("This might not be a Flutter/Dart project, but analysis will continue.");
            println!("{}", warning);
        }
        
        println!("✅ Subfolder '{}' validated successfully", subfolder);
        Ok(())
    }
    
    /// Simple string similarity calculation (Jaro-Winkler-like)
    fn string_similarity(&self, s1: &str, s2: &str) -> f64 {
        let s1_lower = s1.to_lowercase();
        let s2_lower = s2.to_lowercase();
        
        if s1_lower == s2_lower {
            return 1.0;
        }
        
        // Simple similarity: count common characters divided by max length
        let max_len = s1_lower.len().max(s2_lower.len()) as f64;
        let mut common_chars = 0;
        
        for c1 in s1_lower.chars() {
            if s2_lower.contains(c1) {
                common_chars += 1;
            }
        }
        
        common_chars as f64 / max_len
    }
    
    /// Sample commits based on configuration
    fn sample_commits(&self, merge_sequence: &[CommitInfo]) -> Vec<CommitInfo> {
        let mut sampled = Vec::new();
        
        for (index, commit) in merge_sequence.iter().enumerate() {
            // Always include first and last commits
            if index == 0 || index == merge_sequence.len() - 1 {
                sampled.push(commit.clone());
                continue;
            }
            
            // Sample based on sampling rate
            if index % self.config.commit_sampling == 0 {
                sampled.push(commit.clone());
            }
        }
        
        // Apply max commits limit
        if let Some(max_commits) = self.config.max_commits {
            if sampled.len() > max_commits {
                // Take evenly distributed samples
                let step = sampled.len() / max_commits;
                let mut limited = Vec::new();
                
                for i in 0..max_commits {
                    if i * step < sampled.len() {
                        limited.push(sampled[i * step].clone());
                    }
                }
                
                // Always include the last commit
                if let Some(last) = sampled.last() {
                    if !limited.iter().any(|c| c.hash == last.hash) {
                        limited.push(last.clone());
                    }
                }
                
                sampled = limited;
            }
        }
        
        sampled
    }
    
    /// Analyze dependencies at a specific commit
    fn analyze_commit(
        &mut self,
        git_navigator: &mut GitTemporalNavigator,
        commit_info: &CommitInfo
    ) -> Result<CommitSnapshot> {
        // Checkout the commit
        git_navigator.checkout_commit(&commit_info.hash)
            .context("Failed to checkout commit")?;

        // Get the analyzer
        let analyzer = self.analyzer_registry
            .get_analyzer(&self.config.analyzer_name)
            .ok_or_else(|| anyhow::anyhow!("Analyzer '{}' not found", self.config.analyzer_name))?;

        // Determine analysis path (subfolder or root)
        let base_project_path = git_navigator.local_path();
        let analysis_path = if let Some(ref subfolder) = self.config.subfolder {
            let subfolder_path = base_project_path.join(subfolder);
            if !subfolder_path.exists() {
                anyhow::bail!("Subfolder '{}' does not exist at commit {}",
                             subfolder, commit_info.hash);
            }
            subfolder_path
        } else {
            base_project_path.to_path_buf()
        };

        // Verify project can be analyzed at this commit
        if !analyzer.can_analyze_project(&analysis_path) {
            let suggestion = if analyzer.name() == "lakos" {
                " (No pubspec.yaml found - this doesn't appear to be a Flutter/Dart project. If the project is in a subfolder, please specify it in the analysis settings.)"
            } else {
                ""
            };
            anyhow::bail!("Cannot analyze project at commit {}: Required project files not found{}",
                         &commit_info.hash[..8], suggestion);
        }

        // Try to get analysis result from cache first
        let cache_key = AnalysisCacheKey::new(
            self.config.github_url.clone(),
            commit_info.hash.clone(),
            self.config.subfolder.clone(),
            self.config.analyzer_name.clone(),
            &self.config.analysis_config,
        );

        // Check cache if available
        if let Some(ref mut cache) = self.cache {
            if let Ok(Some(cached_result)) = cache.get(&cache_key) {
                println!("✅ Cache hit for commit {}", &commit_info.hash[..8]);
                return Ok(CommitSnapshot {
                    commit_info: commit_info.clone(),
                    analysis_result: cached_result,
                    project_path: analysis_path,
                });
            }
        }

        println!("🔄 Cache miss, analyzing commit {}", &commit_info.hash[..8]);

        // Run analysis on the specified path
        let analysis_result = analyzer.analyze_project(&analysis_path, &self.config.analysis_config)
            .context("Failed to run dependency analysis")?;

        // Store result in cache if available
        if let Some(ref mut cache) = self.cache {
            if let Err(e) = cache.put(&cache_key, &analysis_result) {
                eprintln!("Warning: Failed to cache analysis result for commit {}: {}",
                         commit_info.hash, e);
            }
        }

        Ok(CommitSnapshot {
            commit_info: commit_info.clone(),
            analysis_result,
            project_path: analysis_path,
        })
    }
    
    /// Get analysis results
    pub fn get_snapshots(&self) -> &[CommitSnapshot] {
        &self.snapshots
    }
    
    /// Get repository information
    pub fn get_repo_info(&self) -> Option<&RepoCloneInfo> {
        self.git_navigator.as_ref().map(|nav| nav.clone_info())
    }
    
    /// Get current configuration
    pub fn get_config(&self) -> &ChronoGraphConfig {
        &self.config
    }
    
    /// Update configuration
    pub fn update_config(&mut self, config: ChronoGraphConfig) {
        self.config = config;
    }
    
    /// Add a custom analyzer
    pub fn register_analyzer(&mut self, analyzer: Box<dyn DependencyAnalyzer>) {
        self.analyzer_registry.register(analyzer);
    }
    
    /// List available analyzers
    pub fn list_analyzers(&self) -> Vec<crate::dependency_analyzer::AnalyzerInfo> {
        self.analyzer_registry.list_analyzers()
    }

    /// Get cache statistics
    pub fn get_cache_statistics(&mut self) -> Option<CacheStatistics> {
        self.cache.as_mut().and_then(|cache| cache.get_statistics().ok())
    }

    /// Clear cache for current repository
    pub fn clear_repository_cache(&mut self) -> Result<usize> {
        if let Some(ref mut cache) = self.cache {
            let removed_files = cache.remove_repository(&self.config.github_url)?;
            Ok(removed_files.len())
        } else {
            Ok(0)
        }
    }

    /// Cleanup old cache entries
    pub fn cleanup_old_cache(&mut self, max_age_days: u64) -> Result<usize> {
        if let Some(ref mut cache) = self.cache {
            cache.cleanup_old_entries(max_age_days)
        } else {
            Ok(0)
        }
    }

    /// Clear entire cache
    pub fn clear_all_cache(&mut self) -> Result<usize> {
        if let Some(ref mut cache) = self.cache {
            cache.clear_all()
        } else {
            Ok(0)
        }
    }
    
    /// Get analysis statistics
    pub fn get_statistics(&self) -> AnalysisStatistics {
        let mut stats = AnalysisStatistics::default();
        
        if self.snapshots.is_empty() {
            return stats;
        }
        
        // Basic statistics
        stats.total_snapshots = self.snapshots.len();
        stats.total_dependencies = self.snapshots.iter()
            .map(|s| s.analysis_result.dependencies.len())
            .sum();
        stats.total_files_analyzed = self.snapshots.iter()
            .map(|s| s.analysis_result.analyzed_files.len())
            .sum();
        
        // Temporal statistics
        if let (Some(first), Some(last)) = (self.snapshots.first(), self.snapshots.last()) {
            stats.time_span_seconds = last.commit_info.timestamp - first.commit_info.timestamp;
            stats.first_commit_hash = first.commit_info.hash.clone();
            stats.last_commit_hash = last.commit_info.hash.clone();
        }
        
        // Author statistics
        let mut authors = HashMap::new();
        for snapshot in &self.snapshots {
            let count = authors.entry(snapshot.commit_info.author_name.clone()).or_insert(0);
            *count += 1;
        }
        stats.author_commit_counts = authors;
        
        stats
    }
    
    /// Cleanup resources
    pub fn cleanup(mut self) -> Result<()> {
        if self.config.cleanup_after_analysis {
            if let Some(git_navigator) = self.git_navigator.take() {
                git_navigator.cleanup()?;
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AnalysisStatistics {
    pub total_snapshots: usize,
    pub total_dependencies: usize,
    pub total_files_analyzed: usize,
    pub time_span_seconds: i64,
    pub first_commit_hash: String,
    pub last_commit_hash: String,
    pub author_commit_counts: HashMap<String, usize>,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_config_defaults() {
        let config = ChronoGraphConfig::default();
        assert_eq!(config.analyzer_name, "lakos");
        assert_eq!(config.commit_sampling, 5);
        assert_eq!(config.max_commits, Some(100));
        assert!(config.cleanup_after_analysis);
    }
    
    #[test]
    fn test_commit_sampling() {
        let engine = ChronoGraphEngine::new(ChronoGraphConfig {
            commit_sampling: 2,
            max_commits: None,
            is_local_repository: false,
            ..Default::default()
        });
        
        // Create test commits
        let commits: Vec<CommitInfo> = (0..10).map(|i| CommitInfo {
            hash: format!("hash{}", i),
            author_name: "test".to_string(),
            author_email: "test@test.com".to_string(),
            message: format!("Commit {}", i),
            timestamp: i,
            merge_parent_hash: None,
        }).collect();
        
        let sampled = engine.sample_commits(&commits);
        
        // Should include first, last, and every 2nd commit
        assert!(sampled.len() >= 3); // At least first, last, and some in between
        assert_eq!(sampled[0].hash, "hash0"); // First commit
        assert_eq!(sampled.last().unwrap().hash, "hash9"); // Last commit
    }
}