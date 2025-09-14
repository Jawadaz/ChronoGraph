// Dependency filtering utilities - extracted for testing

export interface Dependency {
  source_file: string;
  target_file: string;
  relationship_type: string;
  weight: any;
}

export interface FilterResult {
  filtered: Dependency[];
  strategy: string;
  stats: { total: number, internal: number, incoming: number, outgoing: number };
}

/**
 * Normalize paths for consistent comparison
 * - Converts backslashes to forward slashes
 * - Removes duplicate slashes
 * - Removes leading slash for consistent comparison
 */
export const normalizePath = (path: string): string => {
  let normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/');
  // Remove leading slash for consistent comparison
  if (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }
  return normalized;
};

/**
 * Check if a file path is within a folder path
 */
export const isPathWithinFolder = (filePath: string, folderPath: string): boolean => {
  const normalizedFile = normalizePath(filePath);
  const normalizedFolder = normalizePath(folderPath);
  return normalizedFile.startsWith(normalizedFolder + '/') || normalizedFile === normalizedFolder;
};

/**
 * Get relative path from view root
 */
export const getRelativeFromViewRoot = (path: string, viewRootFolder: string): string => {
  if (!path || typeof path !== 'string') {
    console.warn('⚠️ Invalid path in getRelativeFromViewRoot:', path);
    return '/';
  }

  const normalizedPath = normalizePath(path);
  const normalizedViewRoot = normalizePath(viewRootFolder);

  if (normalizedViewRoot === '/') return normalizedPath;
  if (normalizedPath === normalizedViewRoot) return '/';
  if (normalizedPath.startsWith(normalizedViewRoot + '/')) {
    const relativePath = normalizedPath.substring(normalizedViewRoot.length);
    return relativePath || '/';
  }
  return normalizedPath;
};

/**
 * Advanced dependency filtering with multiple strategies
 */
export const filterDependenciesForViewRoot = (deps: Dependency[], viewRoot: string): FilterResult => {
  if (viewRoot === '/') return {
    filtered: deps,
    strategy: 'root-show-all',
    stats: { total: deps.length, internal: 0, incoming: 0, outgoing: 0 }
  };

  const normalizedViewRoot = normalizePath(viewRoot);

  // Categorize dependencies
  const internal = deps.filter(dep =>
    isPathWithinFolder(dep.source_file, normalizedViewRoot) &&
    isPathWithinFolder(dep.target_file, normalizedViewRoot)
  );

  const incoming = deps.filter(dep =>
    !isPathWithinFolder(dep.source_file, normalizedViewRoot) &&
    isPathWithinFolder(dep.target_file, normalizedViewRoot)
  );

  const outgoing = deps.filter(dep =>
    isPathWithinFolder(dep.source_file, normalizedViewRoot) &&
    !isPathWithinFolder(dep.target_file, normalizedViewRoot)
  );

  const stats = {
    total: deps.length,
    internal: internal.length,
    incoming: incoming.length,
    outgoing: outgoing.length
  };

  // For folder zoom: ONLY show internal dependencies (both source AND target within folder)
  if (internal.length > 0) {
    return { filtered: internal, strategy: 'internal-only', stats };
  } else {
    // No internal dependencies found - this may indicate a leaf folder or incorrect filtering
    console.warn(`📂 Folder "${viewRoot}" has no internal dependencies. Stats:`, stats);
    return { filtered: [], strategy: 'no-internal-dependencies', stats };
  }
};

/**
 * Get folder path at specific level
 */
export const getFolderAtLevel = (filePath: string, level: number): string => {
  const parts = filePath.split('/').filter(part => part.length > 0);
  if (level === 0 || parts.length === 0) return '/';

  const folderParts = parts.slice(0, Math.min(level, parts.length - 1));
  return folderParts.length > 0 ? folderParts.join('/') : '/';
};

/**
 * Get folder path at specific level relative to view root
 */
export const getFolderAtLevelRelativeToViewRoot = (filePath: string, level: number, viewRootFolder: string): string => {
  // Handle root view folder specially
  if (viewRootFolder === '/') {
    return getFolderAtLevel(filePath, level);
  }

  // First get the relative path from the view root
  const relativePath = getRelativeFromViewRoot(filePath, viewRootFolder);

  // If it's just '/', return the view root itself
  if (relativePath === '/') return viewRootFolder;

  // Remove leading slash from relative path for processing
  const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;

  // Split into parts and apply level logic
  const parts = cleanRelativePath.split('/').filter(part => part.length > 0);

  if (level === 0 || parts.length === 0) return viewRootFolder;

  // Take up to 'level' folders from the relative path
  const folderParts = parts.slice(0, Math.min(level, parts.length - 1));

  if (folderParts.length === 0) return viewRootFolder;

  // Combine view root with the selected folder parts
  const normalizedViewRoot = normalizePath(viewRootFolder);
  const combinedPath = `${normalizedViewRoot}/${folderParts.join('/')}`;

  return combinedPath;
};