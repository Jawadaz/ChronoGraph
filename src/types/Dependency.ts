export interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight?: any;
}