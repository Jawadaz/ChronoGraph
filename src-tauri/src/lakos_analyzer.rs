use crate::dependency_analyzer::*;
use std::path::{Path, PathBuf};
use std::process::Command;
use anyhow::{Result, Context};
use serde_json::Value;
use std::collections::HashMap;

/// Lakos dependency analyzer implementation
pub struct LakosAnalyzer {
    version: String,
}

impl LakosAnalyzer {
    pub fn new() -> Self {
        Self {
            version: "1.0.0".to_string(), // Will detect actual version
        }
    }
    
    /// Check if Lakos is installed and available
    pub fn is_available() -> bool {
        println!("🔍 DEBUG: Checking if Lakos is available");
        
        // Use Windows executable directly to bypass shebang issues
        let dart_commands = vec![
            "/mnt/c/Flutter/flutter/bin/cache/dart-sdk/bin/dart.exe",
            "/mnt/c/Flutter/flutter/bin/dart.bat",
        ];
        
        for dart_cmd in dart_commands {
            println!("🔍 DEBUG: Trying dart command for availability check: {}", dart_cmd);
            if let Ok(output) = Command::new(dart_cmd)
                .args(&["pub", "global", "list"])
                .output()
            {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    println!("🔍 DEBUG: dart pub global list output: {}", stdout.trim());
                    if stdout.contains("lakos") {
                        println!("✅ DEBUG: Found Lakos using command: {}", dart_cmd);
                        return true;
                    }
                } else {
                    println!("🔍 DEBUG: Command '{}' failed with status: {}", dart_cmd, output.status);
                }
            } else {
                println!("🔍 DEBUG: Failed to execute command: {}", dart_cmd);
            }
        }
        
        // If direct commands fail, try with bash wrapper
        println!("🔍 DEBUG: Trying bash wrapper for dart command");
        if let Ok(output) = Command::new("bash")
            .args(&["-c", "dart pub global list 2>/dev/null || echo 'dart not found'"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                println!("🔍 DEBUG: bash wrapper output: {}", stdout.trim());
                let available = stdout.contains("lakos") && !stdout.contains("dart not found");
                if available {
                    println!("✅ DEBUG: Found Lakos using bash wrapper");
                } else {
                    println!("❌ DEBUG: Lakos not found in bash wrapper output");
                }
                return available;
            } else {
                println!("🔍 DEBUG: Bash wrapper failed with status: {}", output.status);
            }
        } else {
            println!("🔍 DEBUG: Failed to execute bash wrapper");
        }
        
        println!("❌ DEBUG: Lakos not available - not found in any dart command output");
        false
    }
    
    /// Install Lakos globally
    pub fn install() -> Result<()> {
        println!("Installing Lakos globally...");
        
        // Use Windows executable directly to bypass shebang issues
        let dart_commands = vec![
            "/mnt/c/Flutter/flutter/bin/cache/dart-sdk/bin/dart.exe",
            "/mnt/c/Flutter/flutter/bin/dart.bat",
        ];
        
        let mut last_error = String::new();
        
        for dart_cmd in dart_commands {
            match Command::new(dart_cmd)
                .args(&["pub", "global", "activate", "lakos"])
                .output()
            {
                Ok(output) => {
                    if output.status.success() {
                        println!("Lakos installed successfully using {}", dart_cmd);
                        return Ok(());
                    } else {
                        last_error = format!("Command '{}' failed: {}", 
                            dart_cmd, String::from_utf8_lossy(&output.stderr));
                    }
                }
                Err(e) => {
                    last_error = format!("Failed to run '{}': {}", dart_cmd, e);
                }
            }
        }
        
        // Try with bash wrapper as fallback
        match Command::new("bash")
            .args(&["-c", "dart pub global activate lakos"])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    println!("Lakos installed successfully using bash wrapper");
                    return Ok(());
                } else {
                    last_error = format!("Bash wrapper failed: {}", 
                        String::from_utf8_lossy(&output.stderr));
                }
            }
            Err(e) => {
                last_error = format!("Bash wrapper execution failed: {}", e);
            }
        }
        
        anyhow::bail!("Failed to install Lakos. Last error: {}", last_error);
    }
    
    /// Run lakos command and get JSON output
    fn run_lakos(&self, project_path: &Path, config: &AnalysisConfig) -> Result<String> {
        println!("🔍 DEBUG: Starting Lakos analysis on: {}", project_path.display());
        println!("🔍 DEBUG: Force recompile trigger");
        
        // Check if project path exists and has necessary files
        if !project_path.exists() {
            return Err(anyhow::anyhow!("Project path does not exist: {}", project_path.display()));
        }
        
        println!("🔍 DEBUG: Project path exists, checking for pubspec.yaml");
        let pubspec_path = project_path.join("pubspec.yaml");
        if !pubspec_path.exists() {
            println!("🔍 DEBUG: No pubspec.yaml found at: {}", pubspec_path.display());
            return Err(anyhow::anyhow!("No pubspec.yaml found - not a valid Dart project"));
        }
        
        println!("🔍 DEBUG: Found pubspec.yaml, checking Lakos availability");
        if !Self::is_available() {
            return Err(anyhow::anyhow!("Lakos is not installed or not available"));
        }
        
        // Use Windows executable directly with cmd.exe wrapper to bypass shebang issues
        let dart_commands = vec![
            // Direct path to Windows dart.exe
            "/mnt/c/Flutter/flutter/bin/cache/dart-sdk/bin/dart.exe",
            "/mnt/c/Flutter/flutter/bin/dart.bat",
        ];
        
        let mut last_error = String::new();
        
        for dart_cmd in dart_commands {
            println!("🔍 DEBUG: Trying dart command: {}", dart_cmd);
            let mut cmd = Command::new(dart_cmd);
            cmd.args(&["pub", "global", "run", "lakos"])
                .arg("--format=json")  // Correct format flag
                .arg("--metrics")      // Enable metrics
                .arg("--node-metrics") // Enable node metrics
                .current_dir(project_path);
                
            // Add ignore patterns using correct syntax
            for pattern in &config.ignore_patterns {
                if pattern.contains("test") {
                    cmd.arg("--ignore=**/*test*/**");
                }
            }
            
            // Add the root directory (current directory)
            cmd.arg(".");
            
            println!("🔍 DEBUG: Running command: {:?} in directory: {}", cmd, project_path.display());
            
            match cmd.output() {
                Ok(output) => {
                    let exit_code = output.status.code().unwrap_or(-1);
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    
                    println!("🔍 DEBUG: Command '{}' completed with exit code: {}", dart_cmd, exit_code);
                    println!("🔍 DEBUG: stdout length: {} chars", stdout.len());
                    println!("🔍 DEBUG: stderr length: {} chars", stderr.len());
                    
                    if stderr.len() > 0 {
                        println!("🔍 DEBUG: stderr content: {}", stderr);
                    }
                    
                    // Lakos returns different exit codes:
                    // 0 = success, no cycles
                    // 5 = success, but cycles detected  
                    // Other codes = actual failures
                    if output.status.success() || exit_code == 5 {
                        println!("✅ Lakos completed successfully with exit code: {} ({})", 
                                 exit_code, 
                                 if exit_code == 5 { "cycles detected" } else { "success" });
                        
                        let stdout_string = String::from_utf8(output.stdout)?;
                        if stdout_string.trim().is_empty() {
                            println!("🔍 DEBUG: WARNING - Lakos output is empty");
                        } else {
                            println!("🔍 DEBUG: Lakos output first 200 chars: {}", 
                                   stdout_string.chars().take(200).collect::<String>());
                        }
                        return Ok(stdout_string);
                    } else {
                        last_error = format!("Command '{}' failed with exit code {}: {}", 
                            dart_cmd, exit_code, stderr);
                        println!("🔍 DEBUG: Command failed - {}", last_error);
                    }
                }
                Err(e) => {
                    last_error = format!("Failed to run '{}': {}", dart_cmd, e);
                    println!("🔍 DEBUG: Failed to execute command - {}", last_error);
                }
            }
        }
        
        // Try with bash wrapper as fallback - use correct Lakos command format
        let mut bash_cmd = "/mnt/c/Flutter/flutter/bin/cache/dart-sdk/bin/dart.exe pub global run lakos --format=json --metrics --node-metrics".to_string();
        for pattern in &config.ignore_patterns {
            if pattern.contains("test") {
                bash_cmd.push_str(" --ignore=**/*test*/**");
            }
        }
        bash_cmd.push_str(" .");
        
        println!("🔍 DEBUG: Trying bash fallback: {}", bash_cmd);
        
        match Command::new("bash")
            .args(&["-c", &bash_cmd])
            .current_dir(project_path)
            .output()
        {
            Ok(output) => {
                let exit_code = output.status.code().unwrap_or(-1);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                println!("🔍 DEBUG: Bash fallback exit code: {}", exit_code);
                println!("🔍 DEBUG: Bash fallback stdout: {} chars", stdout.len());
                println!("🔍 DEBUG: Bash fallback stderr: {} chars", stderr.len());
                
                if stderr.len() > 0 {
                    println!("🔍 DEBUG: Bash fallback stderr: {}", stderr);
                }
                
                if output.status.success() || exit_code == 5 {
                    let stdout_string = String::from_utf8(output.stdout)?;
                    if stdout_string.trim().is_empty() {
                        println!("🔍 DEBUG: WARNING - Bash fallback output is empty");
                    } else {
                        println!("🔍 DEBUG: Bash fallback output first 200 chars: {}", 
                               stdout_string.chars().take(200).collect::<String>());
                    }
                    return Ok(stdout_string);
                } else {
                    last_error = format!("Bash wrapper failed with exit code {}: {}", exit_code, stderr);
                    println!("🔍 DEBUG: Bash fallback failed - {}", last_error);
                }
            }
            Err(e) => {
                last_error = format!("Bash wrapper execution failed: {}", e);
                println!("🔍 DEBUG: Bash fallback execution failed - {}", last_error);
            }
        }
        
        println!("❌ DEBUG: All Lakos execution attempts failed");
        anyhow::bail!("Failed to run Lakos analysis. All attempts failed. Last error: {}. \nThis likely means:\n1. Lakos is not installed (run: dart pub global activate lakos)\n2. Dart SDK path issues in WSL environment\n3. Project is not a valid Dart/Flutter project", last_error);
    }
    
    /// Parse lakos JSON output into RawDependency objects
    fn parse_lakos_json(&self, json_str: &str, project_path: &Path) -> Result<Vec<RawDependency>> {
        let json: Value = serde_json::from_str(json_str)
            .context("Failed to parse Lakos JSON output")?;
            
        let mut dependencies = Vec::new();
        
        // Lakos JSON structure: { "nodes": [...], "edges": [...] }
        if let Some(edges) = json.get("edges").and_then(|e| e.as_array()) {
            for edge in edges {
                if let Some(dep) = self.parse_lakos_edge(edge, project_path)? {
                    dependencies.push(dep);
                }
            }
        }
        
        Ok(dependencies)
    }
    
    /// Parse a single edge from Lakos JSON
    fn parse_lakos_edge(&self, edge: &Value, project_path: &Path) -> Result<Option<RawDependency>> {
        let source = edge.get("source")
            .and_then(|s| s.as_str())
            .context("Missing source in lakos edge")?;
            
        let target = edge.get("target")
            .and_then(|t| t.as_str())
            .context("Missing target in lakos edge")?;
            
        // Convert lakos library names back to file paths
        let source_file = self.library_name_to_file_path(source, project_path)?;
        let target_file = self.library_name_to_file_path(target, project_path)?;
        
        // Determine relationship type from edge properties
        let relationship_type = if edge.get("style").and_then(|s| s.as_str()) == Some("dashed") {
            RelationshipType::Export
        } else {
            RelationshipType::Import
        };
        
        // Create metadata
        let mut metadata = HashMap::new();
        if let Some(label) = edge.get("label").and_then(|l| l.as_str()) {
            metadata.insert("label".to_string(), label.to_string());
        }
        
        Ok(Some(RawDependency {
            source_file,
            target_file,
            relationship_type,
            weight: DependencyWeight::Binary(true),
            line_number: None, // Lakos doesn't provide line numbers
            import_statement: None, // Lakos doesn't provide import statements
            symbols: Vec::new(), // Lakos doesn't track individual symbols
            metadata,
        }))
    }
    
    /// Convert lakos library name back to file path
    /// Lakos uses library names like "lib/src/widgets/button.dart"
    fn library_name_to_file_path(&self, library_name: &str, project_path: &Path) -> Result<PathBuf> {
        // Lakos typically outputs relative paths from the project root
        let relative_path = PathBuf::from(library_name);
        let full_path = project_path.join(&relative_path);
        
        // Verify the file exists
        if full_path.exists() {
            Ok(full_path)
        } else {
            // Try common variations
            let variations = vec![
                project_path.join(format!("{}.dart", library_name)),
                project_path.join("lib").join(&relative_path),
                project_path.join("lib").join(format!("{}.dart", library_name)),
            ];
            
            for variation in variations {
                if variation.exists() {
                    return Ok(variation);
                }
            }
            
            // If file doesn't exist, still return the path but log warning
            println!("Warning: File not found for library '{}', using path: {}", 
                    library_name, full_path.display());
            Ok(full_path)
        }
    }
    
    /// Check if project has pubspec.yaml (Flutter/Dart project)
    fn is_dart_project(project_path: &Path) -> bool {
        project_path.join("pubspec.yaml").exists() || 
        project_path.join("pubspec.yml").exists()
    }
}

impl DependencyAnalyzer for LakosAnalyzer {
    fn name(&self) -> &str {
        "lakos"
    }
    
    fn version(&self) -> &str {
        &self.version
    }
    
    fn capabilities(&self) -> AnalyzerCapabilities {
        AnalyzerCapabilities {
            supports_weighted_analysis: false,
            supports_symbol_tracking: false,
            supports_line_numbers: false,
            supports_dynamic_imports: false,
            supported_file_extensions: vec!["dart".to_string()],
            performance_tier: PerformanceTier::Fast,
        }
    }
    
    fn analyze_project(
        &self, 
        project_path: &Path, 
        config: &AnalysisConfig
    ) -> Result<AnalysisResult> {
        let start_time = std::time::Instant::now();
        let mut issues = Vec::new();
        
        // Verify this is a Dart project
        if !Self::is_dart_project(project_path) {
            issues.push(AnalysisIssue {
                level: IssueLevel::Warning,
                message: "No pubspec.yaml found - may not be a Dart/Flutter project".to_string(),
                file_path: None,
                line_number: None,
            });
        }
        
        // Check if Lakos is available
        if !Self::is_available() {
            return Err(anyhow::anyhow!(
                "Lakos is not installed. Run 'dart pub global activate lakos' first."
            ));
        }
        
        // Find Dart files for metrics
        let dart_files = utils::find_dart_files(project_path, config)
            .unwrap_or_else(|_| Vec::new());
            
        // Run lakos analysis
        let json_output = self.run_lakos(project_path, config)?;
        
        // Parse dependencies
        let dependencies = self.parse_lakos_json(&json_output, project_path)
            .context("Failed to parse Lakos output")?;
        
        let analysis_duration = start_time.elapsed();
        
        // Create metrics
        let metrics = AnalysisMetrics {
            total_files_found: dart_files.len(),
            files_analyzed: dart_files.len(), // Lakos analyzes all found Dart files
            files_skipped: 0,
            dependencies_found: dependencies.len(),
            analysis_duration_ms: analysis_duration.as_millis() as u64,
        };
        
        Ok(AnalysisResult {
            dependencies,
            analyzer_name: self.name().to_string(),
            analyzer_version: self.version().to_string(),
            analysis_timestamp: chrono::Utc::now().timestamp(),
            project_path: project_path.to_path_buf(),
            analyzed_files: dart_files.clone(),
            skipped_files: Vec::new(),
            metrics,
            issues,
        })
    }
    
    fn can_analyze_project(&self, project_path: &Path) -> bool {
        Self::is_dart_project(project_path) && Self::is_available()
    }
    
    fn config_schema(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "ignore_test": {
                    "type": "boolean",
                    "description": "Ignore test files",
                    "default": false
                },
                "include_metrics": {
                    "type": "boolean", 
                    "description": "Include dependency metrics",
                    "default": true
                }
            }
        })
    }
}

impl Default for LakosAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs;
    
    #[test]
    fn test_library_name_conversion() {
        let temp_dir = tempdir().unwrap();
        let project_path = temp_dir.path();
        
        // Create a test file
        let lib_dir = project_path.join("lib");
        fs::create_dir_all(&lib_dir).unwrap();
        let test_file = lib_dir.join("test.dart");
        fs::write(&test_file, "// test file").unwrap();
        
        let analyzer = LakosAnalyzer::new();
        let result = analyzer.library_name_to_file_path("lib/test.dart", project_path).unwrap();
        
        assert_eq!(result, test_file);
    }
    
    #[test]
    fn test_dart_project_detection() {
        let temp_dir = tempdir().unwrap();
        let project_path = temp_dir.path();
        
        // Should not be detected as Dart project initially
        assert!(!LakosAnalyzer::is_dart_project(project_path));
        
        // Create pubspec.yaml
        fs::write(project_path.join("pubspec.yaml"), "name: test").unwrap();
        
        // Should now be detected
        assert!(LakosAnalyzer::is_dart_project(project_path));
    }
}