/**
 * Utility for comparing dependencies between two commits to identify changes
 */

interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight?: number;
}

interface CommitSnapshot {
  commit_hash: string;
  timestamp: number;
  commit_info: {
    hash: string;
    author_name?: string;
    message: string;
    timestamp: number;
  };
  dependencies: Dependency[];
  analysis_result: {
    dependencies: Dependency[];
    [key: string]: any;
  };
}

export interface DependencyDiff {
  added: Dependency[];      // In commit B, not in commit A
  removed: Dependency[];    // In commit A, not in commit B
  unchanged: Dependency[];  // In both commits
}

export interface DependencyDiffSummary {
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  totalA: number;
  totalB: number;
}

/**
 * Create a unique key for a dependency to enable comparison
 */
function createDependencyKey(dep: Dependency): string {
  return `${dep.source_file}→${dep.target_file}→${dep.relationship_type}`;
}

/**
 * Calculate the difference between dependencies in two commits
 *
 * @param commitA - The "from" commit (older)
 * @param commitB - The "to" commit (newer)
 * @returns Categorized dependencies showing what was added, removed, or unchanged
 */
export function calculateDependencyDiff(
  commitA: CommitSnapshot,
  commitB: CommitSnapshot
): DependencyDiff {
  const depsA = commitA.analysis_result.dependencies;
  const depsB = commitB.analysis_result.dependencies;

  // Create maps for fast lookup
  const mapA = new Map<string, Dependency>();
  const mapB = new Map<string, Dependency>();

  depsA.forEach(dep => {
    const key = createDependencyKey(dep);
    mapA.set(key, dep);
  });

  depsB.forEach(dep => {
    const key = createDependencyKey(dep);
    mapB.set(key, dep);
  });

  const added: Dependency[] = [];
  const removed: Dependency[] = [];
  const unchanged: Dependency[] = [];

  // Find added dependencies (in B but not in A)
  mapB.forEach((dep, key) => {
    if (!mapA.has(key)) {
      added.push(dep);
    } else {
      unchanged.push(dep);
    }
  });

  // Find removed dependencies (in A but not in B)
  mapA.forEach((dep, key) => {
    if (!mapB.has(key)) {
      removed.push(dep);
    }
  });

  return { added, removed, unchanged };
}

/**
 * Get a summary of the diff for display purposes
 */
export function getDiffSummary(diff: DependencyDiff, commitA: CommitSnapshot, commitB: CommitSnapshot): DependencyDiffSummary {
  return {
    addedCount: diff.added.length,
    removedCount: diff.removed.length,
    unchangedCount: diff.unchanged.length,
    totalA: commitA.analysis_result.dependencies.length,
    totalB: commitB.analysis_result.dependencies.length,
  };
}

/**
 * Determine the diff status of a specific dependency
 */
export function getDependencyStatus(
  dep: Dependency,
  diff: DependencyDiff
): 'added' | 'removed' | 'unchanged' | null {
  const key = createDependencyKey(dep);

  if (diff.added.find(d => createDependencyKey(d) === key)) return 'added';
  if (diff.removed.find(d => createDependencyKey(d) === key)) return 'removed';
  if (diff.unchanged.find(d => createDependencyKey(d) === key)) return 'unchanged';

  return null;
}
