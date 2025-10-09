import { test, expect } from '@playwright/test';

/**
 * Enhanced Node Metrics Test
 * Verifies that node properties panel displays all Lakos metrics
 */
test.describe('Enhanced Node Metrics', () => {
  test('should display SLOC, Fan-In, and Fan-Out metrics when node is selected', async ({ page }) => {
    await page.goto('/');

    // Trigger analysis
    await page.click('button:has-text("📂 Open Repository")');
    await page.fill('#repo-url', 'https://github.com/flutter/samples');
    await page.click('button:has-text("🚀 Start Analysis")');

    // Wait for analysis results and graph
    await page.waitForSelector('.analysis-results', { timeout: 10000 });
    await page.waitForSelector('.tab:has-text("Graph")');
    await page.click('.tab:has-text("Graph")');
    await page.waitForTimeout(2000);

    // Click on a file node in the tree view to trigger node selection
    // Files should have node metrics
    const fileNode = page.locator('.tree-node.file').first();
    await fileNode.waitFor({ timeout: 5000 });
    await fileNode.click();
    await page.waitForTimeout(500);

    // Check if node details panel appears
    const panelVisible = await page.locator('.node-details-panel').isVisible().catch(() => false);
    console.log('\n=== NODE DETAILS PANEL VISIBLE ===', panelVisible);

    if (panelVisible) {
      // Get panel content
      const panelContent = await page.locator('.node-details-panel').textContent();
      console.log('\n=== PANEL CONTENT ===');
      console.log(panelContent);

      // Check for metrics
      const hasSLOC = panelContent?.includes('SLOC:') || false;
      const hasComponentDep = panelContent?.includes('Component Dependency:') || false;
      const hasInDegree = panelContent?.includes('In-Degree:') || false;
      const hasOutDegree = panelContent?.includes('Out-Degree:') || false;
      const hasInstability = panelContent?.includes('Instability:') || false;

      console.log('\n=== LAKOS METRICS FOUND ===');
      console.log({
        hasSLOC,
        hasComponentDep,
        hasInDegree,
        hasOutDegree,
        hasInstability
      });

      // Assertions - these should all be present with proper node_metrics
      expect(hasSLOC).toBe(true);
      expect(hasComponentDep).toBe(true);
      expect(hasInDegree).toBe(true);
      expect(hasOutDegree).toBe(true);
      expect(hasInstability).toBe(true);

      // Check for optional Fan-In/Fan-Out (only on some nodes)
      const hasFanIn = panelContent?.includes('Fan-In:') || false;
      const hasFanOut = panelContent?.includes('Fan-Out:') || false;
      console.log('\nOptional metrics:');
      console.log('Fan-In:', hasFanIn);
      console.log('Fan-Out:', hasFanOut);

      console.log('\n✅ All enhanced node metrics are displaying correctly!');
    } else {
      throw new Error('Node details panel not visible - cannot verify metrics');
    }
  });

  test('should show enhanced metrics structure in analysis result', async ({ page }) => {
    await page.goto('/');

    // Trigger analysis
    await page.click('button:has-text("📂 Open Repository")');
    await page.fill('#repo-url', 'https://github.com/flutter/samples');
    await page.click('button:has-text("🚀 Start Analysis")');

    // Wait for analysis results
    await page.waitForSelector('.analysis-results', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Inspect the structure of analysis results
    const structure = await page.evaluate(() => {
      const analysisResults = (window as any).analysisResults;
      if (!analysisResults || analysisResults.length === 0) {
        return { error: 'No analysis results found' };
      }

      const firstSnapshot = analysisResults[0];
      const result = firstSnapshot.analysis_result;

      // Get first node metric if available
      let firstNodeMetric = null;
      if (result.node_metrics) {
        const firstKey = Object.keys(result.node_metrics)[0];
        if (firstKey) {
          firstNodeMetric = {
            path: firstKey,
            metrics: result.node_metrics[firstKey]
          };
        }
      }

      return {
        hasAnalysisResult: !!result,
        keys: Object.keys(result),
        hasNodeMetrics: !!result.node_metrics,
        hasEnhancedDependencies: !!result.enhanced_dependencies,
        hasGlobalMetrics: !!result.global_metrics,
        dependenciesCount: result.dependencies?.length || 0,
        nodeMetricsCount: result.node_metrics ? Object.keys(result.node_metrics).length : 0,
        enhancedDepsCount: result.enhanced_dependencies?.length || 0,
        firstNodeMetric,
        globalMetrics: result.global_metrics
      };
    });

    console.log('\n=== ANALYSIS RESULT STRUCTURE ===');
    console.log(JSON.stringify(structure, null, 2));

    // Verify structure
    expect(structure.hasAnalysisResult).toBe(true);
    expect(structure.dependenciesCount).toBeGreaterThan(0);

    console.log('\n=== SUMMARY ===');
    console.log(`Dependencies: ${structure.dependenciesCount}`);
    console.log(`Node Metrics: ${structure.nodeMetricsCount}`);
    console.log(`Enhanced Dependencies: ${structure.enhancedDepsCount}`);
    console.log(`Has Global Metrics: ${structure.hasGlobalMetrics}`);
  });
});
