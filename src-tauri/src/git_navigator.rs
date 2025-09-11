use git2::{Repository, Commit, Oid};
use std::path::{Path, PathBuf};
use std::fs;
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub hash: String,
    pub author_name: String,
    pub author_email: String,
    pub message: String,
    pub timestamp: i64,
    pub merge_parent_hash: Option<String>, // For merge commits
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoCloneInfo {
    pub original_url: String,
    pub local_path: PathBuf,
    pub default_branch: String,
    pub clone_timestamp: i64,
}

pub struct GitTemporalNavigator {
    repo: Repository,
    clone_info: RepoCloneInfo,
    merge_sequence: Vec<CommitInfo>,
    current_commit: Option<String>,
}

impl GitTemporalNavigator {
    /// Clone repository from GitHub URL to local temporary directory (with caching)
    pub fn clone_repository(github_url: &str, local_base_dir: &Path) -> Result<Self> {
        let repo_name = Self::extract_repo_name(github_url)?;
        
        // Check for existing repository first
        let cache_path = local_base_dir.join(format!("{}-cache", repo_name));
        
        // Ensure parent directory exists
        if let Some(parent) = cache_path.parent() {
            fs::create_dir_all(parent)
                .context("Failed to create local repository directory")?;
        }

        let repo = if cache_path.exists() && Repository::open(&cache_path).is_ok() {
            println!("Found existing repository at {}, updating...", cache_path.display());
            
            // Open existing repository and fetch updates
            let repo = Repository::open(&cache_path)
                .context("Failed to open cached repository")?;
                
            // Fetch latest changes from origin
            Self::update_repository(&repo, github_url)?;
            
            repo
        } else {
            println!("Cloning {} to {}", github_url, cache_path.display());
            
            // Clone the repository for the first time
            Repository::clone(github_url, &cache_path)
                .context("Failed to clone repository")?
        };

        // Get default branch name
        let default_branch = {
            let head = repo.head().context("Failed to get HEAD reference")?;
            head.shorthand().unwrap_or("main").to_string()
        };

        let clone_info = RepoCloneInfo {
            original_url: github_url.to_string(),
            local_path: cache_path.clone(),
            default_branch: default_branch.clone(),
            clone_timestamp: chrono::Utc::now().timestamp(),
        };

        let mut navigator = Self {
            repo,
            clone_info,
            merge_sequence: Vec::new(),
            current_commit: None,
        };

        // Build merge sequence immediately
        navigator.build_merge_sequence()?;

        Ok(navigator)
    }

    /// Update existing repository by fetching latest changes
    fn update_repository(repo: &Repository, _github_url: &str) -> Result<()> {
        // Find the origin remote
        let mut remote = repo.find_remote("origin")
            .context("Failed to find origin remote")?;
        
        // Fetch updates from origin
        remote.fetch(&["refs/heads/*:refs/remotes/origin/*"], None, None)
            .context("Failed to fetch from origin")?;
            
        // Reset to origin/main (or origin/master)
        let branch_names = ["refs/remotes/origin/main", "refs/remotes/origin/master"];
        let mut reset_successful = false;
        
        for branch_name in &branch_names {
            if let Ok(reference) = repo.find_reference(branch_name) {
                if let Some(target) = reference.target() {
                    let commit = repo.find_commit(target)
                        .context("Failed to find commit")?;
                    
                    // Reset HEAD to the latest commit
                    repo.reset(commit.as_object(), git2::ResetType::Hard, None)
                        .context("Failed to reset to latest commit")?;
                    
                    println!("Updated repository to latest commit: {}", commit.id());
                    reset_successful = true;
                    break;
                }
            }
        }
        
        if !reset_successful {
            println!("Warning: Could not reset to latest commit, using existing state");
        }
        
        Ok(())
    }

    /// Extract repository name from GitHub URL
    fn extract_repo_name(github_url: &str) -> Result<String> {
        let url = github_url.trim_end_matches(".git");
        let parts: Vec<&str> = url.split('/').collect();
        
        if parts.len() >= 2 {
            let owner = parts[parts.len() - 2];
            let repo = parts[parts.len() - 1];
            Ok(format!("{}-{}", owner, repo))
        } else {
            anyhow::bail!("Invalid GitHub URL format: {}", github_url);
        }
    }

    /// Build the merge sequence following first-parent commits to main branch
    pub fn build_merge_sequence(&mut self) -> Result<()> {
        self.build_merge_sequence_with_subfolder(None)
    }

    /// Build the merge sequence with optional subfolder filtering
    pub fn build_merge_sequence_with_subfolder(&mut self, subfolder: Option<&str>) -> Result<()> {
        println!("Building merge sequence for branch: {}", self.clone_info.default_branch);
        
        if let Some(subfolder) = subfolder {
            println!("Filtering commits for subfolder: {}", subfolder);
        }
        
        // Get the main branch reference
        let branch_ref = format!("refs/heads/{}", self.clone_info.default_branch);
        let reference = self.repo.find_reference(&branch_ref)
            .or_else(|_| self.repo.find_reference("refs/heads/main"))
            .or_else(|_| self.repo.find_reference("refs/heads/master"))
            .context("Failed to find main branch")?;

        let target_oid = reference.target().context("Failed to get branch target")?;
        let mut current_commit = self.repo.find_commit(target_oid)
            .context("Failed to find head commit")?;

        let mut sequence = Vec::new();
        let mut visited = std::collections::HashSet::new();
        let mut total_commits = 0;
        let mut filtered_commits = 0;

        // Walk through first-parent commits (merge sequence)
        loop {
            let commit_hash = current_commit.id().to_string();
            
            // Avoid infinite loops
            if visited.contains(&commit_hash) {
                break;
            }
            visited.insert(commit_hash.clone());
            total_commits += 1;

            // Progress reporting every 100 commits
            if total_commits % 100 == 0 {
                println!("Progress: {} commits processed, {} matching", total_commits, filtered_commits);
            }

            // Check if commit should be included based on subfolder filter
            let should_include = if let Some(subfolder) = subfolder {
                println!("🔍 Checking commit {} against subfolder '{}'", &commit_hash[..8], subfolder);
                match self.commit_touches_subfolder(&current_commit, subfolder) {
                    Ok(touches) => {
                        println!("   Result: {}", if touches { "✓ MATCH" } else { "✗ No match" });
                        touches
                    },
                    Err(e) => {
                        println!("   Error checking commit {}: {}", &commit_hash[..8], e);
                        false // Skip commit on error
                    }
                }
            } else {
                true
            };

            if should_include {
                let commit_info = Self::extract_commit_info(&current_commit);
                sequence.push(commit_info);
                filtered_commits += 1;
                
                println!("✓ MATCHED commit #{}: {} - {}", filtered_commits, &commit_hash[..8], 
                         current_commit.message().unwrap_or("<no message>").lines().next().unwrap_or(""));
                
                // Show a few more matches to verify the fix is working
                if filtered_commits >= 1 {
                    println!("Found {} matches - limiting to 1 commit for testing", filtered_commits);
                    break;
                }
            }

            // Early exit if we have scanned too many commits (performance optimization for testing)
            if total_commits > 100 {
                println!("Performance limit: Scanned {} commits, stopping to avoid UI timeout", total_commits);
                break;
            }

            // Move to first parent (merge sequence)
            match current_commit.parents().next() {
                Some(parent) => current_commit = parent,
                None => break, // Root commit
            }
        }

        // Reverse to get chronological order (oldest first)
        sequence.reverse();
        self.merge_sequence = sequence;

        if let Some(_subfolder) = subfolder {
            println!("Built filtered merge sequence: {} relevant commits out of {} total commits", 
                     filtered_commits, total_commits);
        } else {
            println!("Built merge sequence with {} commits", self.merge_sequence.len());
        }
        
        Ok(())
    }

    /// Check if a commit touches the specified subfolder
    fn commit_touches_subfolder(&self, commit: &Commit, subfolder: &str) -> Result<bool> {
        // For root commits, check if the subfolder exists in the commit's tree
        if commit.parent_count() == 0 {
            return self.tree_contains_subfolder(commit, subfolder);
        }

        // For non-root commits, check the diff against the first parent
        let parent = commit.parent(0)
            .context("Failed to get commit parent")?;
        
        let parent_tree = parent.tree()
            .context("Failed to get parent tree")?;
        let current_tree = commit.tree()
            .context("Failed to get current commit tree")?;

        // Create diff with limited context for performance
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.context_lines(0);
        diff_opts.interhunk_lines(0);
        diff_opts.max_size(1024 * 1024); // Limit diff size to 1MB

        let diff = self.repo.diff_tree_to_tree(
            Some(&parent_tree),
            Some(&current_tree),
            Some(&mut diff_opts),
        ).context("Failed to create diff")?;

        // Check if any changed file is in the subfolder
        let subfolder_prefix = format!("{}/", subfolder);
        let mut touches_subfolder = false;
        let mut files_checked = 0;
        let mut sample_files = Vec::new();

        let result = diff.foreach(
            &mut |delta, _progress| {
                files_checked += 1;
                
                if touches_subfolder {
                    return false; // Early exit if we already found a match
                }

                let file_path = match delta.new_file().path() {
                    Some(path) => path.to_string_lossy(),
                    None => {
                        // Also check old file path for deletions
                        match delta.old_file().path() {
                            Some(path) => path.to_string_lossy(),
                            None => return true, // Continue iteration
                        }
                    }
                };

                // Store first few file paths for debugging
                if sample_files.len() < 3 {
                    sample_files.push(file_path.to_string());
                }

                // Check if the file is directly in the subfolder or its subdirectories
                if file_path.starts_with(&subfolder_prefix) || file_path == subfolder {
                    touches_subfolder = true;
                    println!("✓ MATCH: {} touches {}", file_path, subfolder);
                    return false; // Stop iteration
                }

                // Limit the number of files we check per commit for performance
                if files_checked >= 1000 {
                    return false;
                }

                true
            },
            None,
            None,
            None,
        );

        if let Err(e) = result {
            // Check if this is actually a user cancellation (early exit) rather than a real error
            let error_code = e.code();
            if error_code == git2::ErrorCode::User {
                // GIT_EUSER (-7): This is not an error, just early termination from callback
                // This happens when we return false from the callback (normal operation)
                println!("   🏁 Diff iteration stopped early (normal - found match or hit limit)");
            } else {
                println!("   ⚠️  Real error processing diff for commit {}: {} (code: {:?})", 
                         &commit.id().to_string()[..8], e, error_code);
                return Ok(false); // Skip commit only on real errors
            }
        }

        // Enhanced debug output showing comparison logic
        if files_checked > 0 {
            println!("   📁 Commit {} processed {} files. Target: '{}'", 
                     &commit.id().to_string()[..8], files_checked, subfolder);
            println!("      Looking for paths starting with: '{}'", subfolder_prefix);
            if !sample_files.is_empty() {
                println!("      Sample file paths: {:?}", sample_files);
                // Show the matching test for the first sample file
                if let Some(first_file) = sample_files.first() {
                    println!("      Test: '{}' starts_with('{}') = {}", 
                             first_file, subfolder_prefix, first_file.starts_with(&subfolder_prefix));
                    println!("      Test: '{}' == '{}' = {}", 
                             first_file, subfolder, first_file == subfolder);
                }
            }
            if !touches_subfolder {
                println!("      ❌ No match found");
            }
        }

        Ok(touches_subfolder)
    }

    /// Check if a tree contains the specified subfolder (for root commits)
    fn tree_contains_subfolder(&self, commit: &Commit, subfolder: &str) -> Result<bool> {
        let tree = commit.tree()
            .context("Failed to get commit tree")?;
        
        // Split subfolder path and navigate through tree
        let path_components: Vec<&str> = subfolder.split('/').filter(|s| !s.is_empty()).collect();
        
        self.tree_has_path(&tree, &path_components)
    }

    /// Recursive helper to check if a path exists in a tree
    fn tree_has_path(&self, tree: &git2::Tree, path_components: &[&str]) -> Result<bool> {
        if path_components.is_empty() {
            return Ok(true);
        }

        let component = path_components[0];
        let remaining = &path_components[1..];

        match tree.get_name(component) {
            Some(entry) => {
                if remaining.is_empty() {
                    // This is the last component, check if it's a directory
                    Ok(entry.kind() == Some(git2::ObjectType::Tree))
                } else if entry.kind() == Some(git2::ObjectType::Tree) {
                    // Navigate to the next level
                    let subtree = self.repo.find_tree(entry.id())
                        .context("Failed to find tree object")?;
                    self.tree_has_path(&subtree, remaining)
                } else {
                    Ok(false) // Path component is not a directory
                }
            }
            None => Ok(false), // Path component doesn't exist
        }
    }

    /// Extract commit information including author details
    fn extract_commit_info(commit: &Commit) -> CommitInfo {
        let signature = commit.author();
        let author_name = signature.name().unwrap_or("Unknown").to_string();
        let author_email = signature.email().unwrap_or("unknown@unknown").to_string();
        let message = commit.message().unwrap_or("").trim().to_string();
        let timestamp = signature.when().seconds();

        // Check if this is a merge commit
        let merge_parent_hash = if commit.parent_count() > 1 {
            commit.parents().nth(1).map(|p| p.id().to_string())
        } else {
            None
        };

        CommitInfo {
            hash: commit.id().to_string(),
            author_name,
            author_email,
            message,
            timestamp,
            merge_parent_hash,
        }
    }

    /// Checkout a specific commit by hash
    pub fn checkout_commit(&mut self, commit_hash: &str) -> Result<()> {
        println!("Checking out commit: {}", commit_hash);
        
        let oid = Oid::from_str(commit_hash)
            .context("Invalid commit hash")?;
        
        let commit = self.repo.find_commit(oid)
            .context("Commit not found")?;

        // Create a detached HEAD at this commit
        self.repo.set_head_detached(commit.id())
            .context("Failed to detach HEAD")?;

        // Reset working directory to match commit
        let mut checkout_builder = git2::build::CheckoutBuilder::new();
        checkout_builder.force();
        
        self.repo.checkout_head(Some(&mut checkout_builder))
            .context("Failed to checkout commit")?;

        self.current_commit = Some(commit_hash.to_string());
        println!("Successfully checked out commit: {}", commit_hash);
        
        Ok(())
    }

    /// Get the merge sequence (architectural evolution)
    pub fn get_merge_sequence(&self) -> &[CommitInfo] {
        &self.merge_sequence
    }

    /// Get current commit hash
    pub fn current_commit(&self) -> Option<&str> {
        self.current_commit.as_deref()
    }

    /// Get repository local path
    pub fn local_path(&self) -> &Path {
        &self.clone_info.local_path
    }

    /// Get repository clone information
    pub fn clone_info(&self) -> &RepoCloneInfo {
        &self.clone_info
    }
    
    /// Clean up old timestamped repositories (keep only cache versions)
    pub fn cleanup_old_repos(local_base_dir: &Path) -> Result<()> {
        if !local_base_dir.exists() {
            return Ok(());
        }
        
        let mut cleaned_count = 0;
        
        for entry in fs::read_dir(local_base_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                let dir_name = path.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("");
                
                // Remove old timestamped directories (but keep -cache directories)
                if dir_name.contains('-') && !dir_name.ends_with("-cache") {
                    // Check if this looks like a timestamped directory
                    if let Some(timestamp_part) = dir_name.split('-').last() {
                        if timestamp_part.chars().all(|c| c.is_ascii_digit()) {
                            println!("Cleaning up old repository: {}", path.display());
                            if let Err(e) = fs::remove_dir_all(&path) {
                                println!("Warning: Failed to remove {}: {}", path.display(), e);
                            } else {
                                cleaned_count += 1;
                            }
                        }
                    }
                }
            }
        }
        
        if cleaned_count > 0 {
            println!("Cleaned up {} old repository directories", cleaned_count);
        }
        
        Ok(())
    }

    /// Get commit by hash from the merge sequence
    pub fn get_commit_info(&self, hash: &str) -> Option<&CommitInfo> {
        self.merge_sequence.iter().find(|c| c.hash == hash)
    }

    /// Get author statistics for team analysis (future use)
    pub fn get_author_statistics(&self) -> HashMap<String, AuthorStats> {
        let mut stats = HashMap::new();
        
        for commit in &self.merge_sequence {
            let entry = stats.entry(commit.author_name.clone()).or_insert(AuthorStats::default());
            entry.commit_count += 1;
            entry.emails.insert(commit.author_email.clone());
            
            if let Some(first_commit) = entry.first_commit_timestamp {
                if commit.timestamp < first_commit {
                    entry.first_commit_timestamp = Some(commit.timestamp);
                }
            } else {
                entry.first_commit_timestamp = Some(commit.timestamp);
            }
            
            if let Some(last_commit) = entry.last_commit_timestamp {
                if commit.timestamp > last_commit {
                    entry.last_commit_timestamp = Some(commit.timestamp);
                }
            } else {
                entry.last_commit_timestamp = Some(commit.timestamp);
            }
        }
        
        stats
    }

    /// Return to HEAD of main branch
    pub fn return_to_head(&mut self) -> Result<()> {
        let branch_ref = format!("refs/heads/{}", self.clone_info.default_branch);
        let _reference = self.repo.find_reference(&branch_ref)
            .context("Failed to find main branch")?;

        self.repo.set_head(&branch_ref)
            .context("Failed to set HEAD to main branch")?;

        let mut checkout_builder = git2::build::CheckoutBuilder::new();
        checkout_builder.force();
        
        self.repo.checkout_head(Some(&mut checkout_builder))
            .context("Failed to checkout HEAD")?;

        self.current_commit = None;
        println!("Returned to HEAD of {}", self.clone_info.default_branch);
        
        Ok(())
    }

    /// Clean up - remove local repository
    pub fn cleanup(self) -> Result<()> {
        println!("Cleaning up local repository: {}", self.clone_info.local_path.display());
        
        if self.clone_info.local_path.exists() {
            fs::remove_dir_all(&self.clone_info.local_path)
                .context("Failed to remove local repository")?;
        }
        
        Ok(())
    }
}

#[derive(Debug, Default)]
pub struct AuthorStats {
    pub commit_count: usize,
    pub emails: std::collections::HashSet<String>,
    pub first_commit_timestamp: Option<i64>,
    pub last_commit_timestamp: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_extract_repo_name() {
        assert_eq!(
            GitTemporalNavigator::extract_repo_name("https://github.com/flutter/flutter.git").unwrap(),
            "flutter-flutter"
        );
        assert_eq!(
            GitTemporalNavigator::extract_repo_name("https://github.com/user/repo").unwrap(),
            "user-repo"
        );
    }

    // Note: Integration tests would require actual repositories
    // These should be run separately with real GitHub URLs
}