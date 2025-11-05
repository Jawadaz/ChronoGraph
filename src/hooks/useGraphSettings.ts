import { useState, useEffect, useCallback } from 'react';

export interface GraphSettings {
  // Base node sizes
  fileSize: number;
  folderWidth: number;
  folderHeight: number;
  fontSize: number;

  // Interaction preferences
  updatePanelOnHover: boolean; // If true, hover updates panel; if false, click updates panel

  // Layout settings for graph compactness and orientation
  layout: {
    name: string;         // Layout engine: dagre, fcose, cose, circle, concentric, grid, breadthfirst
    rankSep: number;      // Vertical spacing between levels (dagre)
    nodeSep: number;      // Horizontal spacing between nodes (dagre)
    edgeSep: number;      // Spacing between edges (dagre)
    spacingFactor: number; // Overall spacing multiplier
    padding: number;      // Padding around graph
    rankDir: string;      // Direction: TB, BT, LR, RL (dagre)
    align: string;        // Alignment: UL, UR, DL, DR, or undefined (dagre)
    marginX: number;      // Left/right margin
    marginY: number;      // Top/bottom margin
    ranker: string;       // Ranking algorithm: network-simplex, tight-tree, longest-path (dagre)
    animate: boolean;     // Whether to animate layout changes
    animationDuration: number; // Animation duration in ms
    // fCOSE specific options
    idealEdgeLength: number;     // Ideal edge length for force-directed layouts
    nodeRepulsion: number;       // Node repulsion force
    gravity: number;             // Gravity force
    numIter: number;             // Number of iterations
  };

  // Node count thresholds and corresponding sizes
  thresholds: {
    nodeCount: number;
    fileSize: number;
    folderWidth: number;
    folderHeight: number;
    fontSize: number;
  }[];
}

export const DEFAULT_SETTINGS: GraphSettings = {
  fileSize: 45,
  folderWidth: 65,
  folderHeight: 40,
  fontSize: 13,
  updatePanelOnHover: false, // Default: click to update panel
  layout: {
    name: 'dagre',      // Layout engine
    rankSep: 80,        // Vertical spacing between levels (40-200)
    nodeSep: 60,        // Horizontal spacing between nodes (20-150)
    edgeSep: 20,        // Spacing between edges (10-50)
    spacingFactor: 1.5, // Overall spacing multiplier (0.5-3.0)
    padding: 20,        // Padding around graph (10-100)
    rankDir: 'TB',      // Direction: TB (top-bottom)
    align: '',          // Alignment: undefined (auto)
    marginX: 0,         // Left/right margin (0-50)
    marginY: 0,         // Top/bottom margin (0-50)
    ranker: 'network-simplex', // Ranking algorithm
    animate: true,      // Enable layout animations
    animationDuration: 500, // Animation duration in ms (100-2000)
    // fCOSE defaults
    idealEdgeLength: 100,
    nodeRepulsion: 4500,
    gravity: 0.25,
    numIter: 2500
  },
  thresholds: [
    { nodeCount: 10, fileSize: 50, folderWidth: 70, folderHeight: 45, fontSize: 14 },
    { nodeCount: 30, fileSize: 45, folderWidth: 65, folderHeight: 40, fontSize: 13 },
    { nodeCount: 60, fileSize: 40, folderWidth: 60, folderHeight: 35, fontSize: 12 },
    { nodeCount: 100, fileSize: 35, folderWidth: 55, folderHeight: 30, fontSize: 11 },
    { nodeCount: 200, fileSize: 30, folderWidth: 50, folderHeight: 28, fontSize: 10 },
    { nodeCount: Infinity, fileSize: 25, folderWidth: 45, folderHeight: 25, fontSize: 9 }
  ]
};

const STORAGE_KEY = 'chronograph-graph-settings';

export const useGraphSettings = () => {
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
      }
    } catch (error) {
      console.warn('Failed to load graph settings from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: GraphSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save graph settings to localStorage:', error);
    }
  }, []);

  // Update specific setting
  const updateSetting = useCallback(<K extends keyof GraphSettings>(
    key: K,
    value: GraphSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Reset to default settings
  const resetToDefaults = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
  }, [saveSettings]);

  // Calculate dynamic sizes based on node count
  const calculateSizes = useCallback((nodeCount: number) => {
    // Find the appropriate threshold
    const threshold = settings.thresholds.find(t => nodeCount <= t.nodeCount) ||
                     settings.thresholds[settings.thresholds.length - 1];

    return {
      fileSize: threshold.fileSize,
      folderWidth: threshold.folderWidth,
      folderHeight: threshold.folderHeight,
      fontSize: threshold.fontSize
    };
  }, [settings.thresholds]);

  // Update a specific threshold
  const updateThreshold = useCallback((index: number, newThreshold: typeof settings.thresholds[0]) => {
    const newThresholds = [...settings.thresholds];
    newThresholds[index] = newThreshold;
    updateSetting('thresholds', newThresholds);
  }, [settings.thresholds, updateSetting]);

  return {
    settings,
    updateSetting,
    resetToDefaults,
    calculateSizes,
    updateThreshold,
    isLoading
  };
};