use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

/// Raw data layer - persistent structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDependency {
    pub source_file: PathBuf,
    pub target_file: PathBuf,
    pub import_statement: String,
    pub line_number: u32,
    pub import_type: ImportType,
    pub symbols_imported: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImportType {
    Relative,    // './file.dart', '../folder/file.dart'
    Package,     // 'package:project_name/file.dart'
    External,    // 'package:flutter/...', 'dart:core' (filtered out)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitSnapshot {
    pub hash: String,
    pub timestamp: String, // Simplified to String for now
    pub author: String,
    pub message: String,
    pub parent_hashes: Vec<String>,
    pub file_dependencies: Vec<FileDependency>,
    pub file_changes: FileChangeSet,
    pub metrics: CommitMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangeSet {
    pub added_files: HashSet<PathBuf>,
    pub modified_files: HashSet<PathBuf>,
    pub deleted_files: HashSet<PathBuf>,
    pub renamed_files: Vec<(PathBuf, PathBuf)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitMetrics {
    pub total_files: u32,
    pub total_dependencies: u32,
    pub total_sloc: u32,
    pub cyclic_dependencies: Vec<Vec<PathBuf>>,
    pub orphaned_files: Vec<PathBuf>,
}

/// Temporal tracking structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemporalFileDependency {
    pub dependency: FileDependency,
    pub first_seen: String, // CommitHash
    pub last_seen: Option<String>,
    pub authors: HashSet<String>,
    pub stability_score: f64,
    pub strength_over_time: Vec<(String, f64)>, // Simplified timestamp
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemporalMetadata {
    pub creation_commit: String, // CommitHash
    pub modification_commits: Vec<String>,
    pub deletion_commit: Option<String>,
    pub primary_authors: Vec<String>,
    pub change_frequency: f64,
}

/// View layer - computed on-demand structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyView {
    pub folder_depth: usize,
    pub expanded_folders: HashSet<PathBuf>,
    pub visible_dependencies: Vec<ViewDependency>,
    pub layout_state: LayoutState,
    pub filter_criteria: FilterCriteria,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewDependency {
    pub source_node: NodePath,
    pub target_node: NodePath,
    pub node_type: NodeType,
    pub strength: f64,
    pub constituent_files: Vec<(PathBuf, PathBuf)>,
    pub temporal_data: TemporalMetadata,
    pub visual_properties: VisualProperties,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodePath(pub PathBuf);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeType {
    Folder { 
        path: PathBuf, 
        file_count: u32, 
        child_folders: Vec<PathBuf> 
    },
    File { 
        path: PathBuf, 
        sloc: u32, 
        parent_folder: PathBuf 
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCriteria {
    pub min_dependency_strength: f64,
    pub show_external_deps: bool,
    pub author_filter: Option<HashSet<String>>,
    pub time_range: Option<(String, String)>, // Simplified to String timestamps
    pub node_types: HashSet<String>, // Simplified for serialization
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutState {
    pub algorithm: LayoutAlgorithm,
    pub viewport: Viewport,
    pub zoom_level: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LayoutAlgorithm {
    ForceDirected {
        iterations: u32,
        cooling_factor: f64,
        hierarchy_strength: f64,
    },
    Hierarchical {
        direction: LayoutDirection,
        layer_separation: f64,
        node_separation: f64,
    },
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LayoutDirection {
    TopToBottom,
    BottomToTop,
    LeftToRight,
    RightToLeft,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Viewport {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualProperties {
    pub color: String,
    pub thickness: f64,
    pub opacity: f64,
    pub style: EdgeStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EdgeStyle {
    Solid,
    Dashed,
    Dotted,
}

/// Project configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub project_root: PathBuf,
    pub package_name: String,
    pub ignore_patterns: Vec<String>,
    pub folder_depth_default: usize,
    pub sampling_strategy: SamplingStrategy,
    pub layout_algorithm: LayoutAlgorithm,
    pub color_scheme: ColorScheme,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SamplingStrategy {
    EveryCommit,
    TimeInterval(String), // Duration serialized as string
    ChangeThreshold(f64),
    MergeCommitsOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorScheme {
    pub primary: String,
    pub secondary: String,
    pub background: String,
    pub text: String,
    pub author_colors: HashMap<String, String>,
}