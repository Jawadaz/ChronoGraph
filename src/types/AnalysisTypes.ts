// Enhanced TypeScript interfaces to match Rust data structures for comprehensive Lakos metrics

export interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight?: any;
}

export interface EnhancedDependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight: number;
  line_number?: number;
  import_statement?: string;
  symbols: string[];
  metadata: Record<string, string>;
}

export interface GlobalArchitecturalMetrics {
  is_acyclic: boolean;
  num_nodes: number;
  num_edges: number;
  avg_degree: number;
  cumulative_component_dependency: number;  // CCD
  average_component_dependency: number;     // ACD
  normalized_ccd: number;                   // NCCD
  total_sloc: number;
  average_sloc: number;
  detected_cycles: string[][];
  orphan_libraries: string[];
}

export interface NodeMetrics {
  file_path: string;
  component_dependency: number;
  in_degree: number;
  out_degree: number;
  instability: number;
  sloc: number;
  is_orphan: boolean;
  in_cycle: boolean;
  cycle_id?: number;
}

export interface AnalysisMetrics {
  total_files_found: number;
  files_analyzed: number;
  files_skipped: number;
  dependencies_found: number;
  analysis_duration_ms: number;
}

export interface AnalysisIssue {
  level: 'Error' | 'Warning' | 'Info';
  message: string;
  file_path?: string;
  line_number?: number;
}

export interface AnalysisResult {
  // Basic dependency data (always present for backward compatibility)
  dependencies: Dependency[];

  // Enhanced metrics (optional, only present when using enhanced Lakos analysis)
  enhanced_dependencies?: EnhancedDependency[];
  global_metrics?: GlobalArchitecturalMetrics;
  node_metrics?: Record<string, NodeMetrics>;
  architecture_quality_score?: number;

  // Metadata
  analyzer_name: string;
  analyzer_version: string;
  analysis_timestamp: number;
  project_path: string;
  analyzed_files: string[];
  skipped_files: string[];
  metrics: AnalysisMetrics;
  issues: AnalysisIssue[];
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: number;
}

export interface AnalysisSnapshot {
  commit_hash: string;
  timestamp: number;
  commit_info: CommitInfo;
  dependencies: Dependency[];
  analysis_result: AnalysisResult;
}

export interface AnalysisStatistics {
  total_files: number;
  total_dependencies: number;
  average_dependencies_per_file: number;
  cycles_detected: number;
  instability_score: number;

  // Enhanced statistics (optional, when enhanced metrics available)
  total_sloc?: number;
  average_sloc?: number;
  cumulative_component_dependency?: number;
  average_component_dependency?: number;
  normalized_ccd?: number;
  orphan_files?: number;
}

export interface AnalysisProgress {
  phase: string;
  current_commit: number;
  total_commits: number;
  current_commit_hash?: string;
  message?: string;
}

// Visual encoding types for enhanced metrics
export interface NodeVisualEncoding {
  file_path: string;
  size_factor: number;      // Based on SLOC (1.0 = default size)
  color_hue: number;        // Based on instability (0-360 degrees)
  is_orphan: boolean;
  in_cycle: boolean;
  quality_indicator: 'excellent' | 'good' | 'poor' | 'critical';
}

export interface VisualEncodingConfig {
  enable_size_encoding: boolean;
  enable_color_encoding: boolean;
  size_scaling_factor: number;
  color_intensity: number;
  highlight_orphans: boolean;
  highlight_cycles: boolean;
}

// Type guards for enhanced metrics
export function hasEnhancedMetrics(result: AnalysisResult): result is AnalysisResult & {
  enhanced_dependencies: EnhancedDependency[];
  global_metrics: GlobalArchitecturalMetrics;
  node_metrics: Record<string, NodeMetrics>;
  architecture_quality_score: number;
} {
  return !!(
    result.enhanced_dependencies &&
    result.global_metrics &&
    result.node_metrics &&
    result.architecture_quality_score !== undefined
  );
}

export function hasNodeMetrics(result: AnalysisResult, filePath: string): boolean {
  return !!(result.node_metrics && result.node_metrics[filePath]);
}

export function getNodeMetrics(result: AnalysisResult, filePath: string): NodeMetrics | null {
  return result.node_metrics?.[filePath] || null;
}

// Utility functions for enhanced metrics
export function calculateVisualEncoding(
  nodeMetrics: NodeMetrics,
  globalMetrics: GlobalArchitecturalMetrics,
  config: VisualEncodingConfig
): NodeVisualEncoding {
  // Size based on SLOC (normalized to average)
  const sizeFactor = config.enable_size_encoding
    ? Math.max(0.5, Math.min(3.0, (nodeMetrics.sloc / globalMetrics.average_sloc) * config.size_scaling_factor))
    : 1.0;

  // Color based on instability (0 = stable/green, 1 = unstable/red)
  const colorHue = config.enable_color_encoding
    ? (1 - nodeMetrics.instability) * 120 * config.color_intensity // 120 = green, 0 = red
    : 120; // Default green

  // Quality indicator based on multiple factors
  let quality_indicator: 'excellent' | 'good' | 'poor' | 'critical' = 'good';

  if (nodeMetrics.is_orphan || nodeMetrics.in_cycle) {
    quality_indicator = 'critical';
  } else if (nodeMetrics.instability > 0.8 || nodeMetrics.sloc > globalMetrics.average_sloc * 2) {
    quality_indicator = 'poor';
  } else if (nodeMetrics.instability < 0.3 && nodeMetrics.sloc <= globalMetrics.average_sloc) {
    quality_indicator = 'excellent';
  }

  return {
    file_path: nodeMetrics.file_path,
    size_factor: sizeFactor,
    color_hue: colorHue,
    is_orphan: nodeMetrics.is_orphan,
    in_cycle: nodeMetrics.in_cycle,
    quality_indicator
  };
}

export function getArchitectureQualityDescription(score?: number): string {
  if (score === undefined) return 'Not available';

  if (score >= 0.8) return 'Excellent';
  if (score >= 0.6) return 'Good';
  if (score >= 0.4) return 'Fair';
  if (score >= 0.2) return 'Poor';
  return 'Critical';
}