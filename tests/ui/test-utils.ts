import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Test utilities for ChronoGraph UI testing
 * Common patterns and helpers for testing the React/TypeScript/Tauri application
 */

// Mock repository URLs for testing
export const MOCK_REPOS = {
  small: 'https://github.com/flutter/samples',
  medium: 'https://github.com/facebook/react',
  large: 'https://github.com/microsoft/vscode'
};

// Common viewport sizes for responsive testing
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  wide: { width: 1920, height: 1080 },
  narrow: { width: 600, height: 800 }
};

/**
 * Setup and start analysis with a mock repository
 */
export async function setupAnalysis(page: Page, repoUrl: string = MOCK_REPOS.small) {
  await page.goto('/');

  // Start analysis
  await page.click('button:has-text("📂 Open Repository")');
  await page.fill('#repo-url', repoUrl);
  await page.click('button:has-text("🚀 Start Analysis")');

  // Wait for analysis to complete and results to appear
  await page.waitForSelector('.analysis-results', { timeout: 15000 });
  await page.waitForSelector('.tree-view', { timeout: 10000 });
}

/**
 * Wait for analysis to complete with enhanced metrics
 */
export async function waitForEnhancedMetrics(page: Page, timeout: number = 20000) {
  // Wait for enhanced metrics to be available
  await page.waitForFunction(() => {
    const elements = document.querySelectorAll('[data-testid="enhanced-metrics"]');
    return elements.length > 0;
  }, { timeout });
}

/**
 * Get tree view measurements for responsive testing
 */
export async function getTreeViewMeasurements(page: Page) {
  return await page.evaluate(() => {
    const treeView = document.querySelector('.tree-view');
    const treeContent = document.querySelector('.tree-content');

    if (!treeView || !treeContent) {
      throw new Error('Tree view elements not found');
    }

    const treeViewRect = treeView.getBoundingClientRect();
    const treeContentRect = treeContent.getBoundingClientRect();
    const treeViewStyle = window.getComputedStyle(treeView);

    return {
      treeView: {
        width: treeViewRect.width,
        height: treeViewRect.height,
        x: treeViewRect.x,
        y: treeViewRect.y,
        minWidth: treeViewStyle.minWidth,
        maxWidth: treeViewStyle.maxWidth
      },
      treeContent: {
        width: treeContentRect.width,
        height: treeContentRect.height,
        scrollHeight: (treeContent as HTMLElement).scrollHeight,
        overflowY: window.getComputedStyle(treeContent).overflowY
      }
    };
  });
}

/**
 * Select a node in the graph/tree and get its details
 */
export async function selectNode(page: Page, nodeId: string) {
  // Click on a node in the graph or tree
  await page.click(`[data-node-id="${nodeId}"]`);

  // Wait for node details panel to appear
  await page.waitForSelector('.node-details-panel', { timeout: 5000 });
}

/**
 * Get node size information from the graph visualization
 */
export async function getNodeSizeInfo(page: Page, nodeId: string) {
  return await page.evaluate((id) => {
    // Look for the node in Cytoscape graph
    const nodeElement = document.querySelector(`[data-node-id="${id}"]`);
    if (!nodeElement) {
      throw new Error(`Node ${id} not found in graph`);
    }

    const rect = nodeElement.getBoundingClientRect();

    // Try to get SLOC info from the element's attributes or data
    const slocData = nodeElement.getAttribute('data-sloc') ||
                     nodeElement.getAttribute('data-metrics');

    return {
      width: rect.width,
      height: rect.height,
      slocData: slocData ? JSON.parse(slocData) : null,
      visualSize: Math.max(rect.width, rect.height)
    };
  }, nodeId);
}

/**
 * Test responsive behavior at different viewport sizes
 */
export async function testResponsiveBehavior(
  page: Page,
  testFn: (page: Page, viewport: typeof VIEWPORTS.mobile) => Promise<void>
) {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    await test.step(`Testing ${name} viewport (${viewport.width}x${viewport.height})`, async () => {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500); // Allow layout to settle
      await testFn(page, viewport);
    });
  }
}

/**
 * Get dependency information from NodeDetailsPanel
 */
export async function getDependencyInfo(page: Page) {
  await page.waitForSelector('.node-details-panel', { timeout: 5000 });

  return await page.evaluate(() => {
    const panel = document.querySelector('.node-details-panel');
    if (!panel) throw new Error('NodeDetailsPanel not found');

    const incomingDeps = panel.querySelectorAll('.dependency-item.incoming');
    const outgoingDeps = panel.querySelectorAll('.dependency-item.outgoing');

    const slocElement = panel.querySelector('[data-testid="sloc-value"]') ||
                       panel.querySelector('.value.highlight');
    const sloc = slocElement ? parseInt(slocElement.textContent?.replace(/,/g, '') || '0') : 0;

    const qualityElement = panel.querySelector('[class*="quality-"]');
    const quality = qualityElement?.className.match(/quality-(\w+)/)?.[1] || null;

    return {
      incomingCount: incomingDeps.length,
      outgoingCount: outgoingDeps.length,
      sloc,
      quality,
      hasEnhancedMetrics: panel.querySelector('.section h4:has-text("📈 Lakos Metrics")') !== null
    };
  });
}

/**
 * Test edge double-click filtering in Dependencies tab
 */
export async function testEdgeFiltering(page: Page, sourceFile: string, targetFile: string) {
  // Navigate to Dependencies tab
  await page.click('text="Dependencies"');
  await page.waitForSelector('.dependencies-view', { timeout: 5000 });

  // Find and double-click an edge in the graph
  const edgeSelector = `[data-edge-source="${sourceFile}"][data-edge-target="${targetFile}"]`;
  await page.dblclick(edgeSelector);

  // Wait for filter to be applied
  await page.waitForSelector('.edge-filter-compact', { timeout: 5000 });

  // Get filtered results
  return await page.evaluate(() => {
    const filterBadge = document.querySelector('.filter-badge');
    const dependencies = document.querySelectorAll('.dependency-item');
    const statsText = document.querySelector('.dependencies-stats')?.textContent || '';

    return {
      filterActive: !!filterBadge,
      filterText: filterBadge?.textContent || '',
      visibleDependencies: dependencies.length,
      statsText
    };
  });
}

/**
 * Clear edge filter in Dependencies tab
 */
export async function clearEdgeFilter(page: Page) {
  await page.click('.clear-filter-compact');
  await page.waitForFunction(() => {
    return !document.querySelector('.edge-filter-compact');
  });
}

/**
 * Wait for graph to be fully rendered
 */
export async function waitForGraphRender(page: Page, timeout: number = 10000) {
  await page.waitForSelector('.cytoscape-graph', { timeout });

  // Wait for nodes to be rendered (try both Cytoscape and D3/SVG nodes)
  await page.waitForFunction(() => {
    const cytoscapeContainer = document.querySelector('.cytoscape-graph');
    const svgContainer = document.querySelector('svg');

    if (cytoscapeContainer) {
      // Check for Cytoscape nodes
      const cytoscapeNodes = cytoscapeContainer.querySelectorAll('[data-node-id]');
      if (cytoscapeNodes.length > 0) return true;
    }

    if (svgContainer) {
      // Check for SVG/D3 nodes (fallback rendering)
      const svgNodes = svgContainer.querySelectorAll('circle, rect, .node');
      if (svgNodes.length > 0) return true;
    }

    return false;
  }, { timeout });
}

/**
 * Get viewport and element dimensions for layout testing
 */
export async function getLayoutDimensions(page: Page) {
  return await page.evaluate(() => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    const elements = {
      app: document.querySelector('.app'),
      main: document.querySelector('.app-main'),
      sidebar: document.querySelector('.sidebar'),
      treeView: document.querySelector('.tree-view'),
      graphContainer: document.querySelector('.graph-container')
    };

    const measurements: any = { viewport };

    Object.entries(elements).forEach(([key, el]) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        measurements[key] = {
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          overflow: style.overflow,
          overflowX: style.overflowX,
          overflowY: style.overflowY
        };
      }
    });

    return measurements;
  });
}

/**
 * Simulate tree node expansion/collapse
 */
export async function toggleTreeNode(page: Page, nodeId: string) {
  await page.click(`.tree-expander[data-node-id="${nodeId}"]`);
  await page.waitForTimeout(300); // Allow animation to complete
}

/**
 * Get all visible tree nodes
 */
export async function getVisibleTreeNodes(page: Page) {
  return await page.evaluate(() => {
    const nodes = document.querySelectorAll('.tree-node');
    return Array.from(nodes).map(node => ({
      id: node.getAttribute('data-node-id'),
      type: node.classList.contains('folder') ? 'folder' : 'file',
      checkboxState: node.className.match(/checkbox-(\w+)/)?.[1],
      expanded: node.closest('.tree-node-container')?.querySelector('.tree-children:not([style*="display: none"])') !== null
    }));
  });
}

/**
 * Assert that element has proper responsive constraints
 */
export async function assertResponsiveConstraints(
  page: Page,
  selector: string,
  minWidth?: number,
  maxWidth?: number
) {
  const element = page.locator(selector);
  await expect(element).toBeVisible();

  const box = await element.boundingBox();
  if (!box) throw new Error(`Element ${selector} has no bounding box`);

  if (minWidth !== undefined) {
    expect(box.width).toBeGreaterThanOrEqual(minWidth);
  }

  if (maxWidth !== undefined) {
    expect(box.width).toBeLessThanOrEqual(maxWidth);
  }
}

/**
 * Mock analysis result with SLOC data for testing
 */
export const MOCK_ANALYSIS_RESULT = {
  dependencies: [
    {
      source_file: "src/components/App.tsx",
      target_file: "src/components/TreeView.tsx",
      relationship_type: "import",
      weight: 1
    },
    {
      source_file: "src/components/TreeView.tsx",
      target_file: "src/utils/treeStructure.ts",
      relationship_type: "import",
      weight: 1
    }
  ],
  global_metrics: {
    total_sloc: 10000,
    average_sloc: 250,
    total_files: 40
  },
  node_metrics: {
    "src/components/App.tsx": {
      sloc: 150,
      component_dependency: 5,
      in_degree: 0,
      out_degree: 3,
      instability: 1.0,
      is_orphan: false,
      in_cycle: false
    },
    "src/components/TreeView.tsx": {
      sloc: 467,
      component_dependency: 8,
      in_degree: 1,
      out_degree: 2,
      instability: 0.67,
      is_orphan: false,
      in_cycle: false
    },
    "src/utils/treeStructure.ts": {
      sloc: 89,
      component_dependency: 0,
      in_degree: 3,
      out_degree: 0,
      instability: 0.0,
      is_orphan: false,
      in_cycle: false
    }
  }
};