/**
 * Mock Analysis Data for Web Version Testing
 *
 * This file contains sample analysis results used for testing the web version
 * of ChronoGraph without requiring a real Tauri backend.
 */

import { CommitSnapshot } from '../types/AnalysisTypes';

export const mockAnalysisSnapshots: CommitSnapshot[] = [
  {
    commit_hash: 'sample-web-commit',
    timestamp: Date.now() / 1000,
    commit_info: {
      hash: 'sample-web-commit',
      author_name: 'Demo User',
      message: 'Sample commit for web demo',
      timestamp: Date.now() / 1000
    },
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
      // Enhanced dependencies with detailed metadata for Lakos metrics
      enhanced_dependencies: [
        { source_file: 'lib/main.dart', target_file: 'lib/app.dart', relationship_type: 'imports', weight: 1, line_number: 3, import_statement: 'import "app.dart";', symbols: ['App'], metadata: { 'coupling_strength': 'strong' } },
        { source_file: 'lib/app.dart', target_file: 'lib/config/routes.dart', relationship_type: 'imports', weight: 1, line_number: 5, import_statement: 'import "config/routes.dart";', symbols: ['AppRoutes'], metadata: { 'coupling_strength': 'medium' } },
        { source_file: 'lib/app.dart', target_file: 'lib/config/theme.dart', relationship_type: 'imports', weight: 1, line_number: 6, import_statement: 'import "config/theme.dart";', symbols: ['AppTheme'], metadata: { 'coupling_strength': 'medium' } },
        { source_file: 'lib/data/repositories/user_repository.dart', target_file: 'lib/data/services/api_service.dart', relationship_type: 'imports', weight: 2, line_number: 8, import_statement: 'import "../services/api_service.dart";', symbols: ['ApiService', 'HttpClient'], metadata: { 'coupling_strength': 'strong' } },
        { source_file: 'lib/data/repositories/auth_repository.dart', target_file: 'lib/data/services/api_service.dart', relationship_type: 'imports', weight: 3, line_number: 12, import_statement: 'import "../services/api_service.dart";', symbols: ['ApiService', 'AuthClient', 'TokenManager'], metadata: { 'coupling_strength': 'very_strong' } },
        { source_file: 'lib/data/services/api_service.dart', target_file: 'lib/data/models/user.dart', relationship_type: 'imports', weight: 1, line_number: 15, import_statement: 'import "../models/user.dart";', symbols: ['User'], metadata: { 'coupling_strength': 'medium' } },
        { source_file: 'lib/ui/screens/home_screen.dart', target_file: 'lib/ui/widgets/user_card.dart', relationship_type: 'imports', weight: 2, line_number: 18, import_statement: 'import "../widgets/user_card.dart";', symbols: ['UserCard', 'UserCardState'], metadata: { 'coupling_strength': 'strong' } },
        { source_file: 'lib/ui/screens/home_screen.dart', target_file: 'lib/data/repositories/user_repository.dart', relationship_type: 'imports', weight: 1, line_number: 22, import_statement: 'import "../../data/repositories/user_repository.dart";', symbols: ['UserRepository'], metadata: { 'coupling_strength': 'medium' } },
        { source_file: 'lib/ui/screens/login_screen.dart', target_file: 'lib/data/repositories/auth_repository.dart', relationship_type: 'imports', weight: 1, line_number: 25, import_statement: 'import "../../data/repositories/auth_repository.dart";', symbols: ['AuthRepository'], metadata: { 'coupling_strength': 'medium' } },
        { source_file: 'lib/ui/widgets/user_card.dart', target_file: 'lib/data/models/user.dart', relationship_type: 'imports', weight: 1, line_number: 28, import_statement: 'import "../../data/models/user.dart";', symbols: ['User'], metadata: { 'coupling_strength': 'medium' } },
        { source_file: 'lib/config/routes.dart', target_file: 'lib/ui/screens/home_screen.dart', relationship_type: 'imports', weight: 1, line_number: 31, import_statement: 'import "../ui/screens/home_screen.dart";', symbols: ['HomeScreen'], metadata: { 'coupling_strength': 'weak' } },
        { source_file: 'lib/config/routes.dart', target_file: 'lib/ui/screens/login_screen.dart', relationship_type: 'imports', weight: 1, line_number: 32, import_statement: 'import "../ui/screens/login_screen.dart";', symbols: ['LoginScreen'], metadata: { 'coupling_strength': 'weak' } },
        { source_file: 'lib/utils/validators.dart', target_file: 'lib/ui/screens/login_screen.dart', relationship_type: 'imports', weight: 1, line_number: 35, import_statement: 'import "../ui/screens/login_screen.dart";', symbols: ['LoginForm'], metadata: { 'coupling_strength': 'weak' } },
        { source_file: 'lib/data/models/user.dart', target_file: 'lib/utils/json_serializable.dart', relationship_type: 'implements', weight: 1, line_number: 38, import_statement: 'import "../../utils/json_serializable.dart";', symbols: ['JsonSerializable'], metadata: { 'coupling_strength': 'medium' } },
        { source_file: 'lib/ui/widgets/user_card.dart', target_file: 'lib/ui/widgets/base_card.dart', relationship_type: 'extends', weight: 1, line_number: 41, import_statement: 'import "base_card.dart";', symbols: ['BaseCard'], metadata: { 'coupling_strength': 'strong' } },
      ],
      // Enhanced Lakos metrics for TDD testing
      global_metrics: {
        total_sloc: 1847,
        average_sloc: 123.1,
        quality_score: 87.5,
        architectural_instability: 0.34,
        component_count: 15,
        cycle_count: 0,
        max_component_size: 342,
        dependency_inversion_ratio: 0.73
      },
      node_metrics: {
        'lib/main.dart': { file_path: 'lib/main.dart', sloc: 42, instability: 0.1, in_degree: 0, out_degree: 1, component_dependency: 1, is_orphan: false, in_cycle: false },
        'lib/app.dart': { file_path: 'lib/app.dart', sloc: 156, instability: 0.67, in_degree: 1, out_degree: 2, component_dependency: 3, is_orphan: false, in_cycle: false },
        'lib/config/routes.dart': { file_path: 'lib/config/routes.dart', sloc: 89, instability: 0.0, in_degree: 1, out_degree: 2, component_dependency: 3, is_orphan: false, in_cycle: false },
        'lib/config/theme.dart': { file_path: 'lib/config/theme.dart', sloc: 67, instability: 0.0, in_degree: 1, out_degree: 0, component_dependency: 1, is_orphan: false, in_cycle: false },
        'lib/data/repositories/user_repository.dart': { file_path: 'lib/data/repositories/user_repository.dart', sloc: 134, instability: 0.5, in_degree: 1, out_degree: 1, component_dependency: 2, is_orphan: false, in_cycle: false },
        'lib/data/repositories/auth_repository.dart': { file_path: 'lib/data/repositories/auth_repository.dart', sloc: 98, instability: 0.5, in_degree: 1, out_degree: 1, component_dependency: 2, is_orphan: false, in_cycle: false },
        'lib/data/services/api_service.dart': { file_path: 'lib/data/services/api_service.dart', sloc: 342, instability: 0.33, in_degree: 2, out_degree: 1, component_dependency: 3, is_orphan: false, in_cycle: false, fan_in: 5, fan_out: 3 },
        'lib/data/models/user.dart': { file_path: 'lib/data/models/user.dart', sloc: 76, instability: 0.5, in_degree: 2, out_degree: 1, component_dependency: 3, is_orphan: false, in_cycle: false },
        'lib/ui/screens/home_screen.dart': { file_path: 'lib/ui/screens/home_screen.dart', sloc: 287, instability: 0.67, in_degree: 1, out_degree: 2, component_dependency: 3, is_orphan: false, in_cycle: false, fan_in: 2, fan_out: 4 },
        'lib/ui/screens/login_screen.dart': { file_path: 'lib/ui/screens/login_screen.dart', sloc: 198, instability: 0.67, in_degree: 1, out_degree: 2, component_dependency: 3, is_orphan: false, in_cycle: false },
        'lib/ui/widgets/user_card.dart': { file_path: 'lib/ui/widgets/user_card.dart', sloc: 123, instability: 0.67, in_degree: 1, out_degree: 2, component_dependency: 3, is_orphan: false, in_cycle: false },
        'lib/ui/widgets/base_card.dart': { file_path: 'lib/ui/widgets/base_card.dart', sloc: 87, instability: 0.0, in_degree: 1, out_degree: 0, component_dependency: 1, is_orphan: false, in_cycle: false },
        'lib/utils/validators.dart': { file_path: 'lib/utils/validators.dart', sloc: 54, instability: 0.0, in_degree: 0, out_degree: 1, component_dependency: 1, is_orphan: false, in_cycle: false },
        'lib/utils/json_serializable.dart': { file_path: 'lib/utils/json_serializable.dart', sloc: 94, instability: 0.0, in_degree: 1, out_degree: 0, component_dependency: 1, is_orphan: false, in_cycle: false }
      },
      architecture_quality_score: 87.5,
      enhanced_analysis: true,
      metrics: {
        analysis_duration_ms: 1500,
        total_files: 15,
        total_dependencies: 15
      }
    }
  }
];

export const mockStatistics = {
  total_snapshots: 1,
  total_dependencies: 15,
  total_files_analyzed: 15,
  time_span_seconds: 0,
  authors: [
    { name: 'Demo User', commits: 1, color: '#667eea' }
  ]
};
