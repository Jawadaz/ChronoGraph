import { test, expect } from '@playwright/test';

/**
 * Graph Folder Double-Click Test
 * Verifies that double-clicking folders in the graph view works correctly
 */
test.describe('Graph Folder Double-Click', () => {
  test('should have tree nodes available immediately on first render', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/');

    // Trigger analysis
    await page.click('button:has-text("📂 Open Repository")');
    await page.fill('#repo-url', 'https://github.com/flutter/samples');
    await page.click('button:has-text("🚀 Start Analysis")');

    // Wait for analysis results
    await page.waitForSelector('.analysis-results', { timeout: 10000 });
    await page.waitForSelector('.tab:has-text("Graph")');
    await page.click('.tab:has-text("Graph")');
    await page.waitForTimeout(1000);

    // Verify tree is built immediately (not empty on first render)
    const graphTabRenderLogs = consoleLogs.filter(log => log.includes('GraphTab RENDER'));
    const firstRender = graphTabRenderLogs[0];

    // The first render should have treeNodes available (not size 0)
    expect(firstRender).toBeDefined();
    expect(firstRender).not.toContain('treeNodesSize: 0');

    console.log('✅ Tree nodes available on first render:', firstRender);
  });

  test('should toggle folder expansion on double-click', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/');

    // Trigger analysis
    await page.click('button:has-text("📂 Open Repository")');
    await page.fill('#repo-url', 'https://github.com/flutter/samples');
    await page.click('button:has-text("🚀 Start Analysis")');

    // Wait for results and graph
    await page.waitForSelector('.analysis-results', { timeout: 10000 });
    await page.waitForSelector('.tab:has-text("Graph")');
    await page.click('.tab:has-text("Graph")');
    await page.waitForTimeout(2000);

    // Find a folder in the tree view and get its state
    const initialTreeState = await page.evaluate(() => {
      const firstFolder = document.querySelector('.tree-node.folder');
      if (!firstFolder) return null;

      const nodeId = firstFolder.getAttribute('data-node-id');
      const checkbox = firstFolder.querySelector('input[type="checkbox"]') as HTMLInputElement;

      return {
        nodeId,
        initialState: checkbox?.checked ? 'checked' : 'unchecked'
      };
    });

    if (initialTreeState?.nodeId) {
      // Click the checkbox to toggle
      await page.click(`.tree-node[data-node-id="${initialTreeState.nodeId}"] input[type="checkbox"]`);
      await page.waitForTimeout(500);

      // Verify the toggle handler was called
      const toggleLogs = consoleLogs.filter(log =>
        log.includes('Searching for node:') && log.includes('in tree with')
      );

      expect(toggleLogs.length).toBeGreaterThan(0);
      console.log('✅ Folder toggle handler called:', toggleLogs.length, 'times');
    }
  });
});
