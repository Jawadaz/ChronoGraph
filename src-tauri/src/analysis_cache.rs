use crate::dependency_analyzer::{AnalysisResult, AnalysisConfig};
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use rusqlite::{Connection, params, OptionalExtension};
use std::fs;

/// Cache key for analysis results
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AnalysisCacheKey {
    pub repo_url: String,
    pub commit_hash: String,
    pub subfolder: Option<String>,
    pub analyzer_name: String,
    pub analysis_config_hash: String,
}

impl AnalysisCacheKey {
    pub fn new(
        repo_url: String,
        commit_hash: String,
        subfolder: Option<String>,
        analyzer_name: String,
        analysis_config: &AnalysisConfig,
    ) -> Self {
        let config_hash = Self::hash_analysis_config(analysis_config);
        Self {
            repo_url,
            commit_hash,
            subfolder,
            analyzer_name,
            analysis_config_hash: config_hash,
        }
    }

    /// Generate a unique cache key string
    pub fn to_cache_key(&self) -> String {
        let mut hasher = DefaultHasher::new();
        self.repo_url.hash(&mut hasher);
        self.commit_hash.hash(&mut hasher);
        self.subfolder.hash(&mut hasher);
        self.analyzer_name.hash(&mut hasher);
        self.analysis_config_hash.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }

    /// Hash analysis configuration to detect changes
    fn hash_analysis_config(config: &AnalysisConfig) -> String {
        let mut hasher = DefaultHasher::new();
        config.ignore_patterns.hash(&mut hasher);
        config.file_extensions.hash(&mut hasher);
        config.max_depth.hash(&mut hasher);
        config.follow_symlinks.hash(&mut hasher);
        // Hash the sorted analyzer config for consistency
        let mut sorted_config: Vec<_> = config.analyzer_config.iter().collect();
        sorted_config.sort_by_key(|&(k, _)| k);
        sorted_config.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }
}

/// Cache entry metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntryMetadata {
    pub cache_key: String,
    pub repo_url: String,
    pub commit_hash: String,
    pub subfolder: Option<String>,
    pub analyzer_name: String,
    pub created_at: u64,
    pub last_accessed: u64,
    pub file_count: usize,
    pub dependency_count: usize,
    pub file_size: u64,
}

/// Cache statistics
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct CacheStatistics {
    pub total_entries: usize,
    pub total_size_bytes: u64,
    pub hit_count: u64,
    pub miss_count: u64,
    pub repositories: HashMap<String, usize>, // repo_url -> entry count
}

/// Analysis result cache using SQLite index + binary files
pub struct AnalysisCache {
    cache_dir: PathBuf,
    db_path: PathBuf,
    connection: Connection,
}

impl AnalysisCache {
    /// Create or open analysis cache
    pub fn new(cache_dir: PathBuf) -> Result<Self> {
        // Ensure cache directory exists
        fs::create_dir_all(&cache_dir)
            .context("Failed to create cache directory")?;

        // Create analysis subdirectory
        let analysis_dir = cache_dir.join("analysis");
        fs::create_dir_all(&analysis_dir)
            .context("Failed to create analysis cache directory")?;

        // Open SQLite database
        let db_path = cache_dir.join("chronograph.db");
        let connection = Connection::open(&db_path)
            .context("Failed to open cache database")?;

        let mut cache = Self {
            cache_dir,
            db_path,
            connection,
        };

        cache.initialize_schema()?;
        Ok(cache)
    }

    /// Initialize database schema
    fn initialize_schema(&mut self) -> Result<()> {
        self.connection.execute(
            r#"
            CREATE TABLE IF NOT EXISTS analysis_cache (
                cache_key TEXT PRIMARY KEY,
                repo_url TEXT NOT NULL,
                commit_hash TEXT NOT NULL,
                subfolder TEXT,
                analyzer_name TEXT NOT NULL,
                analysis_config_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                last_accessed INTEGER NOT NULL,
                file_count INTEGER NOT NULL,
                dependency_count INTEGER NOT NULL,
                file_size INTEGER NOT NULL
            )
            "#,
            [],
        )?;

        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_repo_commit ON analysis_cache(repo_url, commit_hash)",
            [],
        )?;

        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_last_accessed ON analysis_cache(last_accessed)",
            [],
        )?;

        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_repo_url ON analysis_cache(repo_url)",
            [],
        )?;

        Ok(())
    }

    /// Get analysis result from cache
    pub fn get(&mut self, key: &AnalysisCacheKey) -> Result<Option<AnalysisResult>> {
        let cache_key = key.to_cache_key();
        let now = Self::current_timestamp();

        // Check if entry exists in database
        let entry: Option<CacheEntryMetadata> = self.connection.query_row(
            "SELECT cache_key, repo_url, commit_hash, subfolder, analyzer_name,
                    created_at, last_accessed, file_count, dependency_count, file_size
             FROM analysis_cache WHERE cache_key = ?",
            params![cache_key],
            |row| {
                Ok(CacheEntryMetadata {
                    cache_key: row.get(0)?,
                    repo_url: row.get(1)?,
                    commit_hash: row.get(2)?,
                    subfolder: row.get(3)?,
                    analyzer_name: row.get(4)?,
                    created_at: row.get(5)?,
                    last_accessed: row.get(6)?,
                    file_count: row.get(7)?,
                    dependency_count: row.get(8)?,
                    file_size: row.get(9)?,
                })
            },
        ).optional()?;

        if let Some(_entry) = entry {
            // Load binary data from file
            let file_path = self.get_cache_file_path(&cache_key);
            if file_path.exists() {
                match self.load_analysis_result(&file_path) {
                    Ok(result) => {
                        // Update last accessed time
                        self.connection.execute(
                            "UPDATE analysis_cache SET last_accessed = ? WHERE cache_key = ?",
                            params![now, cache_key],
                        )?;
                        return Ok(Some(result));
                    }
                    Err(e) => {
                        // File corrupted, remove from cache
                        eprintln!("Warning: Corrupted cache file {}, removing entry: {}",
                                 file_path.display(), e);
                        self.remove_entry(&cache_key)?;
                    }
                }
            } else {
                // File missing, remove database entry
                self.connection.execute(
                    "DELETE FROM analysis_cache WHERE cache_key = ?",
                    params![cache_key],
                )?;
            }
        }

        Ok(None)
    }

    /// Store analysis result in cache
    pub fn put(&mut self, key: &AnalysisCacheKey, result: &AnalysisResult) -> Result<()> {
        let cache_key = key.to_cache_key();
        let now = Self::current_timestamp();

        // Serialize to binary file
        let file_path = self.get_cache_file_path(&cache_key);
        let file_size = self.save_analysis_result(&file_path, result)?;

        // Insert or update database entry
        self.connection.execute(
            r#"
            INSERT OR REPLACE INTO analysis_cache
            (cache_key, repo_url, commit_hash, subfolder, analyzer_name, analysis_config_hash,
             created_at, last_accessed, file_count, dependency_count, file_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            params![
                cache_key,
                key.repo_url,
                key.commit_hash,
                key.subfolder,
                key.analyzer_name,
                key.analysis_config_hash,
                now,
                now,
                result.analyzed_files.len(),
                result.dependencies.len(),
                file_size
            ],
        )?;

        Ok(())
    }

    /// Remove all cache entries for a repository
    pub fn remove_repository(&mut self, repo_url: &str) -> Result<Vec<PathBuf>> {
        let mut removed_files = Vec::new();

        // Get all cache keys for this repository
        let mut stmt = self.connection.prepare(
            "SELECT cache_key FROM analysis_cache WHERE repo_url = ?"
        )?;

        let cache_keys: Vec<String> = stmt.query_map(params![repo_url], |row| {
            Ok(row.get::<_, String>(0)?)
        })?.collect::<Result<Vec<_>, _>>()?;

        // Remove files and database entries
        for cache_key in cache_keys {
            let file_path = self.get_cache_file_path(&cache_key);
            if file_path.exists() {
                fs::remove_file(&file_path)?;
                removed_files.push(file_path);
            }
        }

        // Remove database entries
        self.connection.execute(
            "DELETE FROM analysis_cache WHERE repo_url = ?",
            params![repo_url],
        )?;

        Ok(removed_files)
    }

    /// Cleanup entries older than specified days (based on last access)
    pub fn cleanup_old_entries(&mut self, max_age_days: u64) -> Result<usize> {
        let cutoff_timestamp = Self::current_timestamp() - (max_age_days * 24 * 3600);

        // Get cache keys to remove
        let mut stmt = self.connection.prepare(
            "SELECT cache_key FROM analysis_cache WHERE last_accessed < ?"
        )?;

        let cache_keys: Vec<String> = stmt.query_map(params![cutoff_timestamp], |row| {
            Ok(row.get::<_, String>(0)?)
        })?.collect::<Result<Vec<_>, _>>()?;

        let removed_count = cache_keys.len();

        // Remove files
        for cache_key in &cache_keys {
            let file_path = self.get_cache_file_path(cache_key);
            if file_path.exists() {
                let _ = fs::remove_file(&file_path); // Ignore errors for cleanup
            }
        }

        // Remove database entries
        self.connection.execute(
            "DELETE FROM analysis_cache WHERE last_accessed < ?",
            params![cutoff_timestamp],
        )?;

        Ok(removed_count)
    }

    /// Get cache statistics
    pub fn get_statistics(&mut self) -> Result<CacheStatistics> {
        let mut stats = CacheStatistics::default();

        // Get basic counts and size
        let (total_entries, total_size): (i64, i64) = self.connection.query_row(
            "SELECT COUNT(*), COALESCE(SUM(file_size), 0) FROM analysis_cache",
            [],
            |row| Ok((row.get(0)?, row.get(1)?))
        )?;

        stats.total_entries = total_entries as usize;
        stats.total_size_bytes = total_size as u64;

        // Get repository breakdown
        let mut stmt = self.connection.prepare(
            "SELECT repo_url, COUNT(*) FROM analysis_cache GROUP BY repo_url"
        )?;

        let repo_counts = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as usize))
        })?;

        for result in repo_counts {
            let (repo_url, count) = result?;
            stats.repositories.insert(repo_url, count);
        }

        Ok(stats)
    }

    /// Clear entire cache
    pub fn clear_all(&mut self) -> Result<usize> {
        let stats = self.get_statistics()?;
        let total_entries = stats.total_entries;

        // Remove all files in analysis directory
        let analysis_dir = self.cache_dir.join("analysis");
        if analysis_dir.exists() {
            for entry in fs::read_dir(analysis_dir)? {
                let entry = entry?;
                if entry.path().extension().map_or(false, |ext| ext == "bincode") {
                    let _ = fs::remove_file(entry.path());
                }
            }
        }

        // Clear database
        self.connection.execute("DELETE FROM analysis_cache", [])?;

        Ok(total_entries)
    }

    /// Get path for cache file
    fn get_cache_file_path(&self, cache_key: &str) -> PathBuf {
        self.cache_dir.join("analysis").join(format!("{}.bincode", cache_key))
    }

    /// Save analysis result to binary file
    fn save_analysis_result(&self, file_path: &Path, result: &AnalysisResult) -> Result<u64> {
        let data = bincode::serialize(result)
            .context("Failed to serialize analysis result")?;

        fs::write(file_path, &data)
            .context("Failed to write cache file")?;

        Ok(data.len() as u64)
    }

    /// Load analysis result from binary file
    fn load_analysis_result(&self, file_path: &Path) -> Result<AnalysisResult> {
        let data = fs::read(file_path)
            .context("Failed to read cache file")?;

        bincode::deserialize(&data)
            .context("Failed to deserialize analysis result")
    }

    /// Remove single cache entry
    fn remove_entry(&mut self, cache_key: &str) -> Result<()> {
        let file_path = self.get_cache_file_path(cache_key);
        if file_path.exists() {
            fs::remove_file(&file_path)?;
        }

        self.connection.execute(
            "DELETE FROM analysis_cache WHERE cache_key = ?",
            params![cache_key],
        )?;

        Ok(())
    }

    /// Get current Unix timestamp
    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::collections::HashMap;
    use rusqlite::params;

    fn create_test_analysis_config() -> AnalysisConfig {
        AnalysisConfig {
            ignore_patterns: vec!["**/test/**".to_string()],
            file_extensions: vec!["dart".to_string()],
            max_depth: Some(10),
            follow_symlinks: false,
            analyzer_config: HashMap::new(),
        }
    }

    fn create_test_analysis_result() -> AnalysisResult {
        use crate::dependency_analyzer::{AnalysisMetrics, RawDependency, RelationshipType, DependencyWeight};
        use std::path::PathBuf;

        AnalysisResult {
            dependencies: vec![
                RawDependency {
                    source_file: PathBuf::from("lib/main.dart"),
                    target_file: PathBuf::from("lib/config.dart"),
                    relationship_type: RelationshipType::Import,
                    weight: DependencyWeight::Binary(true),
                    line_number: Some(1),
                    import_statement: Some("import 'config.dart';".to_string()),
                    symbols: vec![],
                    metadata: HashMap::new(),
                }
            ],
            enhanced_dependencies: None,
            global_metrics: None,
            node_metrics: None,
            architecture_quality_score: None,
            analyzer_name: "test".to_string(),
            analyzer_version: "1.0.0".to_string(),
            analysis_timestamp: 1234567890,
            project_path: PathBuf::from("/test/project"),
            analyzed_files: vec![PathBuf::from("lib/main.dart")],
            skipped_files: vec![],
            metrics: AnalysisMetrics {
                total_files_found: 1,
                files_analyzed: 1,
                files_skipped: 0,
                dependencies_found: 1,
                analysis_duration_ms: 100,
            },
            issues: vec![],
        }
    }

    #[test]
    fn test_cache_key_generation() {
        let config = create_test_analysis_config();

        let key1 = AnalysisCacheKey::new(
            "https://github.com/test/repo".to_string(),
            "abc123".to_string(),
            None,
            "lakos".to_string(),
            &config,
        );

        let key2 = AnalysisCacheKey::new(
            "https://github.com/test/repo".to_string(),
            "abc123".to_string(),
            None,
            "lakos".to_string(),
            &config,
        );

        // Same inputs should generate same cache key
        assert_eq!(key1.to_cache_key(), key2.to_cache_key());

        // Different config should generate different cache key
        let mut different_config = config.clone();
        different_config.ignore_patterns.push("**/build/**".to_string());

        let key3 = AnalysisCacheKey::new(
            "https://github.com/test/repo".to_string(),
            "abc123".to_string(),
            None,
            "lakos".to_string(),
            &different_config,
        );

        assert_ne!(key1.to_cache_key(), key3.to_cache_key());
    }

    #[test]
    fn test_cache_basic_operations() -> Result<()> {
        let temp_dir = tempdir()?;
        let mut cache = AnalysisCache::new(temp_dir.path().to_path_buf())?;

        let config = create_test_analysis_config();
        let key = AnalysisCacheKey::new(
            "https://github.com/test/repo".to_string(),
            "abc123".to_string(),
            None,
            "lakos".to_string(),
            &config,
        );

        // Cache should be empty initially
        assert!(cache.get(&key)?.is_none());

        // Store analysis result
        let result = create_test_analysis_result();
        cache.put(&key, &result)?;

        // Should be able to retrieve it
        let cached_result = cache.get(&key)?.expect("Should find cached result");
        assert_eq!(cached_result.dependencies.len(), result.dependencies.len());
        assert_eq!(cached_result.analyzer_name, result.analyzer_name);

        Ok(())
    }

    #[test]
    fn test_cache_repository_cleanup() -> Result<()> {
        let temp_dir = tempdir()?;
        let mut cache = AnalysisCache::new(temp_dir.path().to_path_buf())?;

        let config = create_test_analysis_config();
        let result = create_test_analysis_result();

        // Add entries for two different repositories
        let key1 = AnalysisCacheKey::new(
            "https://github.com/test/repo1".to_string(),
            "abc123".to_string(),
            None,
            "lakos".to_string(),
            &config,
        );

        let key2 = AnalysisCacheKey::new(
            "https://github.com/test/repo2".to_string(),
            "def456".to_string(),
            None,
            "lakos".to_string(),
            &config,
        );

        cache.put(&key1, &result)?;
        cache.put(&key2, &result)?;

        // Verify both exist
        assert!(cache.get(&key1)?.is_some());
        assert!(cache.get(&key2)?.is_some());

        // Remove repo1
        let removed_files = cache.remove_repository("https://github.com/test/repo1")?;
        assert_eq!(removed_files.len(), 1);

        // repo1 should be gone, repo2 should remain
        assert!(cache.get(&key1)?.is_none());
        assert!(cache.get(&key2)?.is_some());

        Ok(())
    }

    #[test]
    fn test_cache_cleanup_old_entries() -> Result<()> {
        let temp_dir = tempdir()?;
        let mut cache = AnalysisCache::new(temp_dir.path().to_path_buf())?;

        let config = create_test_analysis_config();
        let result = create_test_analysis_result();
        let key = AnalysisCacheKey::new(
            "https://github.com/test/repo".to_string(),
            "abc123".to_string(),
            None,
            "lakos".to_string(),
            &config,
        );

        // Store entry
        cache.put(&key, &result)?;
        assert!(cache.get(&key)?.is_some());

        // Manually set last_accessed to an old timestamp to test cleanup
        let cache_key = key.to_cache_key();
        let old_timestamp = AnalysisCache::current_timestamp() - (31 * 24 * 3600); // 31 days ago
        cache.connection.execute(
            "UPDATE analysis_cache SET last_accessed = ? WHERE cache_key = ?",
            params![old_timestamp, cache_key],
        )?;

        // Cleanup entries older than 30 days should remove the entry
        let removed_count = cache.cleanup_old_entries(30)?;
        assert_eq!(removed_count, 1);
        assert!(cache.get(&key)?.is_none());

        Ok(())
    }

    #[test]
    fn test_cache_statistics() -> Result<()> {
        let temp_dir = tempdir()?;
        let mut cache = AnalysisCache::new(temp_dir.path().to_path_buf())?;

        let config = create_test_analysis_config();
        let result = create_test_analysis_result();

        // Add entries for different repositories
        let repos = ["repo1", "repo2"];
        for (i, repo) in repos.iter().enumerate() {
            let key = AnalysisCacheKey::new(
                format!("https://github.com/test/{}", repo),
                format!("commit{}", i),
                None,
                "lakos".to_string(),
                &config,
            );
            cache.put(&key, &result)?;
        }

        let stats = cache.get_statistics()?;
        assert_eq!(stats.total_entries, 2);
        assert!(stats.total_size_bytes > 0);
        assert_eq!(stats.repositories.len(), 2);

        Ok(())
    }

    #[test]
    fn test_cache_corrupted_file_handling() -> Result<()> {
        let temp_dir = tempdir()?;
        let mut cache = AnalysisCache::new(temp_dir.path().to_path_buf())?;

        let config = create_test_analysis_config();
        let result = create_test_analysis_result();
        let key = AnalysisCacheKey::new(
            "https://github.com/test/repo".to_string(),
            "abc123".to_string(),
            None,
            "lakos".to_string(),
            &config,
        );

        // Store entry
        cache.put(&key, &result)?;
        assert!(cache.get(&key)?.is_some());

        // Corrupt the file
        let cache_key = key.to_cache_key();
        let file_path = cache.get_cache_file_path(&cache_key);
        fs::write(&file_path, b"corrupted data")?;

        // Should handle corruption gracefully
        assert!(cache.get(&key)?.is_none());

        // Database entry should be cleaned up
        let stats = cache.get_statistics()?;
        assert_eq!(stats.total_entries, 0);

        Ok(())
    }
}