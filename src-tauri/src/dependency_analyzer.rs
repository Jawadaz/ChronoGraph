use std::path::{Path, PathBuf};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents the weight/strength of a dependency relationship
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DependencyWeight {
    /// Binary relationship - exists or doesn't exist (e.g., Lakos)
    Binary(bool),
    /// Frequency-based weight - how often symbols are used
    Frequency(u32),
    /// Coupling strength - how tightly coupled the modules are
    Coupling(f64),
    /// Critical path weight - importance in architecture
    Critical(f64),
    /// Custom weight with metadata
    Custom {
        value: f64,
        metadata: HashMap<String, String>,
    },
}

impl DependencyWeight {
    /// Convert any weight to a normalized float value (0.0 to 1.0)
    pub fn as_normalized_float(&self) -> f64 {
        match self {
            DependencyWeight::Binary(exists) => if *exists { 1.0 } else { 0.0 },
            DependencyWeight::Frequency(freq) => (*freq as f64).min(100.0) / 100.0,
            DependencyWeight::Coupling(strength) => strength.max(0.0).min(1.0),
            DependencyWeight::Critical(importance) => importance.max(0.0).min(1.0),
            DependencyWeight::Custom { value, .. } => value.max(0.0).min(1.0),
        }
    }

    /// Check if this weight indicates a significant dependency
    pub fn is_significant(&self) -> bool {
        self.as_normalized_float() > 0.1 // Configurable threshold
    }
}

/// Type of dependency relationship
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelationshipType {
    /// Direct import statement
    Import,
    /// Export statement (re-export)
    Export,
    /// Part/library relationship
    Part,
    /// Dynamic import (future)
    Dynamic,
    /// Test dependency
    Test,
    /// Custom relationship type
    Custom(String),
}

/// Raw dependency extracted by an analyzer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawDependency {
    pub source_file: PathBuf,
    pub target_file: PathBuf,
    pub relationship_type: RelationshipType,
    pub weight: DependencyWeight,
    /// Line number where dependency is declared (if available)
    pub line_number: Option<u32>,
    /// Import statement text (if available)
    pub import_statement: Option<String>,
    /// Symbols imported/used (for future weighted analysis)
    pub symbols: Vec<String>,
    /// Additional metadata from the analyzer
    pub metadata: HashMap<String, String>,
}

/// Capabilities of a dependency analyzer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzerCapabilities {
    pub supports_weighted_analysis: bool,
    pub supports_symbol_tracking: bool,
    pub supports_line_numbers: bool,
    pub supports_dynamic_imports: bool,
    pub supported_file_extensions: Vec<String>,
    pub performance_tier: PerformanceTier,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PerformanceTier {
    Fast,      // Simple regex/text parsing
    Medium,    // AST parsing without deep analysis
    Slow,      // Full semantic analysis
}

/// Enhanced result from dependency analysis with full Lakos metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    // Basic Dependencies (backward compatibility)
    pub dependencies: Vec<RawDependency>,

    // Enhanced Dependencies with Lakos metrics
    pub enhanced_dependencies: Option<Vec<EnhancedDependency>>,

    // Global Architectural Metrics
    pub global_metrics: Option<GlobalArchitecturalMetrics>,

    // Node-level metrics keyed by file path
    pub node_metrics: Option<HashMap<String, NodeMetrics>>,

    // Architecture quality score (derived from metrics)
    pub architecture_quality_score: Option<f64>,

    // Existing fields
    pub analyzer_name: String,
    pub analyzer_version: String,
    pub analysis_timestamp: i64,
    pub project_path: PathBuf,
    /// Files that were analyzed
    pub analyzed_files: Vec<PathBuf>,
    /// Files that were skipped (ignored, errors, etc.)
    pub skipped_files: Vec<PathBuf>,
    /// Analysis metrics
    pub metrics: AnalysisMetrics,
    /// Any warnings or errors during analysis
    pub issues: Vec<AnalysisIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisMetrics {
    pub total_files_found: usize,
    pub files_analyzed: usize,
    pub files_skipped: usize,
    pub dependencies_found: usize,
    pub analysis_duration_ms: u64,
}

/// Global architectural metrics from Lakos analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalArchitecturalMetrics {
    // Structural Properties
    pub is_acyclic: bool,
    pub num_nodes: u32,
    pub num_edges: u32,
    pub avg_degree: f64,

    // Coupling Metrics
    pub cumulative_component_dependency: u32,  // CCD
    pub average_component_dependency: f64,     // ACD
    pub normalized_ccd: f64,                   // NCCD

    // Code Volume
    pub total_sloc: u32,
    pub average_sloc: f64,

    // Quality Indicators
    pub detected_cycles: Vec<Vec<String>>,     // Cycle paths
    pub orphan_libraries: Vec<String>,         // Isolated nodes
}

impl Default for GlobalArchitecturalMetrics {
    fn default() -> Self {
        Self {
            is_acyclic: true,
            num_nodes: 0,
            num_edges: 0,
            avg_degree: 0.0,
            cumulative_component_dependency: 0,
            average_component_dependency: 0.0,
            normalized_ccd: 0.0,
            total_sloc: 0,
            average_sloc: 0.0,
            detected_cycles: Vec::new(),
            orphan_libraries: Vec::new(),
        }
    }
}

/// Node-level metrics from Lakos analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeMetrics {
    pub file_path: String,

    // Dependency Metrics
    pub component_dependency: u32,            // CD - transitive dependents
    pub in_degree: u32,                       // Direct dependents
    pub out_degree: u32,                      // Direct dependencies
    pub instability: f64,                     // out_degree / (in_degree + out_degree)

    // Code Metrics
    pub sloc: u32,                           // Source Lines of Code

    // Derived Properties
    pub is_orphan: bool,                     // No dependencies in either direction
    pub in_cycle: bool,                      // Part of dependency cycle
    pub cycle_id: Option<u32>,               // Which cycle (if multiple)
}

impl Default for NodeMetrics {
    fn default() -> Self {
        Self {
            file_path: String::new(),
            component_dependency: 0,
            in_degree: 0,
            out_degree: 0,
            instability: 0.0,
            sloc: 0,
            is_orphan: false,
            in_cycle: false,
            cycle_id: None,
        }
    }
}

/// Enhanced dependency with additional Lakos metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedDependency {
    pub source_file: PathBuf,
    pub target_file: PathBuf,
    pub relationship_type: RelationshipType,
    pub weight: DependencyWeight,
    pub line_number: Option<u32>,
    pub import_statement: Option<String>,
    pub symbols: Vec<String>,
    pub metadata: HashMap<String, String>,

    // Lakos Enhancements
    pub is_critical: bool,                   // Part of shortest path between key components
    pub creates_cycle: bool,                 // Removing this edge breaks a cycle
    pub coupling_strength: f64,              // Contribution to CCD
}

impl From<RawDependency> for EnhancedDependency {
    fn from(raw: RawDependency) -> Self {
        Self {
            source_file: raw.source_file,
            target_file: raw.target_file,
            relationship_type: raw.relationship_type,
            weight: raw.weight,
            line_number: raw.line_number,
            import_statement: raw.import_statement,
            symbols: raw.symbols,
            metadata: raw.metadata,
            is_critical: false,
            creates_cycle: false,
            coupling_strength: 0.0,
        }
    }
}

impl AnalysisResult {
    /// Calculate a composite architecture quality score from Lakos metrics
    pub fn calculate_quality_score(&mut self) {
        if let Some(global_metrics) = &self.global_metrics {
            let mut score = 100.0; // Start with perfect score

            // Penalize for cycles (major architectural issue)
            if !global_metrics.is_acyclic {
                score -= 30.0;
                score -= (global_metrics.detected_cycles.len() as f64) * 5.0;
            }

            // Penalize for high coupling (NCCD > 0.5 is concerning)
            if global_metrics.normalized_ccd > 0.5 {
                score -= (global_metrics.normalized_ccd - 0.5) * 40.0;
            }

            // Penalize for orphan libraries (indicates poor architecture)
            score -= (global_metrics.orphan_libraries.len() as f64) * 2.0;

            // Bonus for good average instability (around 0.5 is ideal)
            if let Some(node_metrics) = &self.node_metrics {
                let instabilities: Vec<f64> = node_metrics.values()
                    .map(|nm| nm.instability)
                    .filter(|i| *i > 0.0) // Filter out zero instabilities
                    .collect();

                if !instabilities.is_empty() {
                    let avg_instability = instabilities.iter().sum::<f64>() / instabilities.len() as f64;
                    let instability_deviation = (avg_instability - 0.5).abs();
                    score += (0.2 - instability_deviation.min(0.2)) * 25.0; // Bonus for good balance
                }
            }

            // Ensure score is between 0 and 100
            self.architecture_quality_score = Some(score.max(0.0).min(100.0));
        }
    }

    /// Get enhanced dependencies, falling back to basic dependencies
    pub fn get_dependencies(&self) -> &[RawDependency] {
        &self.dependencies
    }

    /// Get enhanced dependencies if available
    pub fn get_enhanced_dependencies(&self) -> Option<&[EnhancedDependency]> {
        self.enhanced_dependencies.as_deref()
    }

    /// Check if this result includes enhanced Lakos metrics
    pub fn has_enhanced_metrics(&self) -> bool {
        self.global_metrics.is_some() && self.node_metrics.is_some()
    }
}

impl NodeMetrics {
    /// Calculate architectural role based on metrics
    pub fn architectural_role(&self) -> &'static str {
        if self.is_orphan {
            "orphan"
        } else if self.in_cycle {
            "cyclic"
        } else if self.in_degree == 0 && self.out_degree > 0 {
            "leaf"
        } else if self.in_degree > 5 && self.out_degree < 2 {
            "core"
        } else if self.in_degree > 2 && self.out_degree > 2 {
            "connector"
        } else {
            "component"
        }
    }

    /// Assess coupling level based on component dependency
    pub fn coupling_level(&self) -> &'static str {
        if self.component_dependency == 0 {
            "isolated"
        } else if self.component_dependency < 3 {
            "low"
        } else if self.component_dependency < 8 {
            "medium"
        } else {
            "high"
        }
    }

    /// Stability assessment based on instability metric
    pub fn stability_assessment(&self) -> &'static str {
        if self.instability < 0.2 {
            "very_stable"
        } else if self.instability < 0.4 {
            "stable"
        } else if self.instability < 0.6 {
            "balanced"
        } else if self.instability < 0.8 {
            "unstable"
        } else {
            "very_unstable"
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisIssue {
    pub level: IssueLevel,
    pub message: String,
    pub file_path: Option<PathBuf>,
    pub line_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueLevel {
    Warning,
    Error,
    Info,
}

/// Configuration for dependency analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisConfig {
    /// Patterns to ignore (glob patterns)
    pub ignore_patterns: Vec<String>,
    /// File extensions to analyze
    pub file_extensions: Vec<String>,
    /// Maximum depth for directory traversal
    pub max_depth: Option<usize>,
    /// Whether to follow symlinks
    pub follow_symlinks: bool,
    /// Analyzer-specific configuration
    pub analyzer_config: HashMap<String, String>,
}

impl Default for AnalysisConfig {
    fn default() -> Self {
        Self {
            ignore_patterns: vec![
                "**/.git/**".to_string(),
                "**/node_modules/**".to_string(),
                "**/build/**".to_string(),
                "**/.dart_tool/**".to_string(),
                "**/pubspec.lock".to_string(),
            ],
            file_extensions: vec![
                "dart".to_string(),
            ],
            max_depth: Some(50),
            follow_symlinks: false,
            analyzer_config: HashMap::new(),
        }
    }
}

/// Trait for dependency analyzers - pluggable architecture
pub trait DependencyAnalyzer: Send + Sync {
    /// Name of the analyzer (e.g., "lakos", "chronograph")
    fn name(&self) -> &str;
    
    /// Version of the analyzer
    fn version(&self) -> &str;
    
    /// Get analyzer capabilities
    fn capabilities(&self) -> AnalyzerCapabilities;
    
    /// Analyze dependencies in a project
    fn analyze_project(
        &self, 
        project_path: &Path, 
        config: &AnalysisConfig
    ) -> Result<AnalysisResult>;
    
    /// Validate that the project can be analyzed
    fn can_analyze_project(&self, project_path: &Path) -> bool {
        // Default: check if any supported files exist
        let caps = self.capabilities();
        for ext in &caps.supported_file_extensions {
            let pattern = format!("**/*.{}", ext);
            if glob::glob(&format!("{}/{}", project_path.display(), pattern))
                .map(|glob| glob.count() > 0)
                .unwrap_or(false) {
                return true;
            }
        }
        false
    }
    
    /// Get configuration schema (for UI generation)
    fn config_schema(&self) -> serde_json::Value {
        serde_json::json!({})
    }
}

/// Registry for managing multiple analyzers
pub struct AnalyzerRegistry {
    analyzers: HashMap<String, Box<dyn DependencyAnalyzer>>,
    default_analyzer: Option<String>,
}

impl AnalyzerRegistry {
    pub fn new() -> Self {
        Self {
            analyzers: HashMap::new(),
            default_analyzer: None,
        }
    }
    
    /// Register a new analyzer
    pub fn register(&mut self, analyzer: Box<dyn DependencyAnalyzer>) {
        let name = analyzer.name().to_string();
        
        // Set as default if it's the first one
        if self.default_analyzer.is_none() {
            self.default_analyzer = Some(name.clone());
        }
        
        self.analyzers.insert(name, analyzer);
    }
    
    /// Get analyzer by name
    pub fn get_analyzer(&self, name: &str) -> Option<&dyn DependencyAnalyzer> {
        self.analyzers.get(name).map(|a| a.as_ref())
    }
    
    /// Get default analyzer
    pub fn get_default_analyzer(&self) -> Option<&dyn DependencyAnalyzer> {
        self.default_analyzer.as_ref()
            .and_then(|name| self.get_analyzer(name))
    }
    
    /// List all available analyzers
    pub fn list_analyzers(&self) -> Vec<AnalyzerInfo> {
        self.analyzers.iter().map(|(name, analyzer)| {
            AnalyzerInfo {
                name: name.clone(),
                version: analyzer.version().to_string(),
                capabilities: analyzer.capabilities(),
                is_default: self.default_analyzer.as_ref() == Some(name),
            }
        }).collect()
    }
    
    /// Set default analyzer
    pub fn set_default_analyzer(&mut self, name: &str) -> Result<()> {
        if self.analyzers.contains_key(name) {
            self.default_analyzer = Some(name.to_string());
            Ok(())
        } else {
            anyhow::bail!("Analyzer '{}' not found", name);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzerInfo {
    pub name: String,
    pub version: String,
    pub capabilities: AnalyzerCapabilities,
    pub is_default: bool,
}

impl Default for AnalyzerRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Utility functions for dependency analysis
pub mod utils {
    use super::*;
    use std::fs;
    
    /// Find Dart files in a directory
    pub fn find_dart_files(
        root: &Path, 
        config: &AnalysisConfig
    ) -> Result<Vec<PathBuf>> {
        let mut files = Vec::new();
        find_files_recursive(root, &mut files, config, 0)?;
        Ok(files)
    }
    
    fn find_files_recursive(
        dir: &Path, 
        files: &mut Vec<PathBuf>, 
        config: &AnalysisConfig,
        depth: usize
    ) -> Result<()> {
        if let Some(max_depth) = config.max_depth {
            if depth > max_depth {
                return Ok(());
            }
        }
        
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            
            // Check ignore patterns
            if should_ignore(&path, &config.ignore_patterns) {
                continue;
            }
            
            if path.is_dir() {
                if config.follow_symlinks || !is_symlink(&path) {
                    find_files_recursive(&path, files, config, depth + 1)?;
                }
            } else if let Some(extension) = path.extension() {
                if config.file_extensions.contains(&extension.to_string_lossy().to_string()) {
                    files.push(path);
                }
            }
        }
        
        Ok(())
    }
    
    fn should_ignore(path: &Path, patterns: &[String]) -> bool {
        for pattern in patterns {
            if glob::Pattern::new(pattern)
                .map(|p| p.matches_path(path))
                .unwrap_or(false) {
                return true;
            }
        }
        false
    }
    
    fn is_symlink(path: &Path) -> bool {
        path.symlink_metadata()
            .map(|m| m.file_type().is_symlink())
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_dependency_weight_normalization() {
        assert_eq!(DependencyWeight::Binary(true).as_normalized_float(), 1.0);
        assert_eq!(DependencyWeight::Binary(false).as_normalized_float(), 0.0);
        assert_eq!(DependencyWeight::Frequency(50).as_normalized_float(), 0.5);
        assert_eq!(DependencyWeight::Coupling(0.75).as_normalized_float(), 0.75);
    }
    
    #[test]
    fn test_significance() {
        assert!(DependencyWeight::Binary(true).is_significant());
        assert!(!DependencyWeight::Binary(false).is_significant());
        assert!(DependencyWeight::Frequency(20).is_significant());
        assert!(!DependencyWeight::Frequency(5).is_significant());
    }
}