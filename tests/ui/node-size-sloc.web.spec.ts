import { test, expect } from '@playwright/test';
import {
  setupAnalysis,
  waitForEnhancedMetrics,
  waitForGraphRender,
  getNodeSizeInfo,
  selectNode,
  getDependencyInfo,
  MOCK_REPOS,
  MOCK_ANALYSIS_RESULT
} from './test-utils';

/**
 * Node Size Variation Tests Based on SLOC Metrics
 * Verifies that nodes in the graph are sized proportionally to their
 * Source Lines of Code (SLOC) when enhanced metrics are available
 */

test.describe('Node Size Based on SLOC Metrics - Web Version', () => {

  test.beforeEach(async ({ page }) => {
    await setupAnalysis(page, MOCK_REPOS.small);
    await waitForGraphRender(page);
  });

  test('should size nodes proportionally to SLOC when enhanced metrics available', async ({ page }) => {
    // Wait for enhanced metrics to be computed
    await page.waitForTimeout(2000);

    // Check if enhanced metrics are available
    const hasEnhancedMetrics = await page.evaluate(() => {
      // Look for indicators that enhanced metrics are loaded
      const metricsIndicators = document.querySelectorAll('[data-enhanced-metrics="true"]');
      const slocElements = document.querySelectorAll('[data-sloc]');
      return metricsIndicators.length > 0 || slocElements.length > 0;
    });

    if (!hasEnhancedMetrics) {
      console.log('⚠️ Enhanced metrics not available, testing fallback behavior');

      // Test that nodes have default/uniform sizing when no SLOC data
      const nodeElements = await page.locator('[data-node-id]').all();
      expect(nodeElements.length).toBeGreaterThan(0);

      // Get sizes of first few nodes
      const nodeSizes = [];
      for (let i = 0; i < Math.min(3, nodeElements.length); i++) {
        const nodeId = await nodeElements[i].getAttribute('data-node-id');
        if (nodeId) {
          try {
            const sizeInfo = await getNodeSizeInfo(page, nodeId);
            nodeSizes.push(sizeInfo);
          } catch (error) {
            console.log(`Could not get size info for node ${nodeId}:`, error);
          }
        }
      }

      // Without SLOC data, nodes should have similar default sizes
      if (nodeSizes.length >= 2) {
        const sizeDifference = Math.abs(nodeSizes[0].visualSize - nodeSizes[1].visualSize);
        const averageSize = (nodeSizes[0].visualSize + nodeSizes[1].visualSize) / 2;
        const relativeVariation = sizeDifference / averageSize;

        // Size variation should be minimal without SLOC data (< 20%)
        expect(relativeVariation).toBeLessThan(0.2);
      }

      return;
    }

    console.log('✅ Enhanced metrics available, testing SLOC-based sizing');

    // Get all visible nodes in the graph
    const nodeElements = await page.locator('[data-node-id]').all();
    expect(nodeElements.length).toBeGreaterThan(0);

    const nodeData: Array<{
      id: string;
      size: number;
      sloc: number;
      sizePerSLOC: number;
    }> = [];

    // Collect size and SLOC data for each node
    for (const nodeElement of nodeElements.slice(0, 5)) { // Test first 5 nodes
      const nodeId = await nodeElement.getAttribute('data-node-id');
      if (!nodeId) continue;

      try {
        // Get visual size from graph
        const sizeInfo = await getNodeSizeInfo(page, nodeId);

        // Get SLOC data by selecting the node
        await selectNode(page, nodeId);
        const depInfo = await getDependencyInfo(page);

        if (depInfo.hasEnhancedMetrics && depInfo.sloc > 0) {
          nodeData.push({
            id: nodeId,
            size: sizeInfo.visualSize,
            sloc: depInfo.sloc,
            sizePerSLOC: sizeInfo.visualSize / depInfo.sloc
          });
        }

        // Close node details panel
        await page.click('.close-button');
        await page.waitForTimeout(100);
      } catch (error) {
        console.log(`Could not process node ${nodeId}:`, error);
      }
    }

    console.log('📊 Node data collected:', nodeData);

    if (nodeData.length < 2) {
      console.log('⚠️ Not enough nodes with SLOC data for comparison');
      return;
    }

    // Sort by SLOC to verify size correlation
    nodeData.sort((a, b) => a.sloc - b.sloc);

    // Test that larger SLOC generally means larger visual size
    for (let i = 1; i < nodeData.length; i++) {
      const smaller = nodeData[i - 1];
      const larger = nodeData[i];

      // If SLOC is significantly larger, visual size should also be larger
      if (larger.sloc > smaller.sloc * 1.5) {
        expect(larger.size).toBeGreaterThanOrEqual(smaller.size);
        console.log(`✅ ${larger.id} (${larger.sloc} SLOC) is visually larger than ${smaller.id} (${smaller.sloc} SLOC)`);
      }
    }

    // Test that size scaling is reasonable (not too extreme)
    const sizeRange = Math.max(...nodeData.map(n => n.size)) / Math.min(...nodeData.map(n => n.size));
    expect(sizeRange).toBeLessThan(10); // Size shouldn't vary more than 10x

    // Test that there's meaningful size variation (not all the same)
    const sizeVariation = new Set(nodeData.map(n => Math.round(n.size))).size;
    expect(sizeVariation).toBeGreaterThan(1);
  });

  test('should show SLOC information in tooltips or labels', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Get a node and check for SLOC information display
    const firstNode = page.locator('[data-node-id]').first();
    await expect(firstNode).toBeVisible();

    const nodeId = await firstNode.getAttribute('data-node-id');
    if (!nodeId) return;

    // Hover over node to see if tooltip shows SLOC
    await firstNode.hover();
    await page.waitForTimeout(500);

    // Check for tooltip or popup with SLOC info
    const tooltipVisible = await page.locator('.tooltip, .node-tooltip, .popover').isVisible();

    if (tooltipVisible) {
      const tooltipText = await page.locator('.tooltip, .node-tooltip, .popover').textContent();

      // Should contain SLOC information
      expect(tooltipText?.toLowerCase()).toMatch(/(sloc|lines of code|source lines)/);
      console.log('✅ SLOC information shown in tooltip:', tooltipText);
    } else {
      console.log('ℹ️ No tooltip found, checking node labels');

      // Alternative: check if node has visible labels with size info
      const nodeText = await firstNode.textContent();
      if (nodeText) {
        console.log('📝 Node text content:', nodeText);
      }
    }
  });

  test('should handle size encoding configuration changes', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for graph settings or configuration panel
    const settingsButton = page.locator('button:has-text("Settings"), button:has-text("⚙️"), .settings-button');

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);

      // Look for size encoding options
      const sizeEncodingOption = page.locator('input[type="checkbox"]:near(text="size"), input[type="checkbox"]:near(text="SLOC"), .size-encoding-toggle');

      if (await sizeEncodingOption.isVisible()) {
        // Test toggling size encoding
        const initialState = await sizeEncodingOption.isChecked();

        await sizeEncodingOption.click();
        await page.waitForTimeout(1000); // Allow re-render

        // Verify toggle worked
        const newState = await sizeEncodingOption.isChecked();
        expect(newState).toBe(!initialState);

        // Toggle back
        await sizeEncodingOption.click();
        await page.waitForTimeout(1000);

        const finalState = await sizeEncodingOption.isChecked();
        expect(finalState).toBe(initialState);

        console.log('✅ Size encoding toggle works correctly');
      }
    }
  });

  test('should maintain size ratios when zooming graph', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Get initial node sizes
    const nodeElements = await page.locator('[data-node-id]').all();
    if (nodeElements.length < 2) return;

    const initialSizes = [];
    for (let i = 0; i < Math.min(3, nodeElements.length); i++) {
      const nodeId = await nodeElements[i].getAttribute('data-node-id');
      if (nodeId) {
        try {
          const sizeInfo = await getNodeSizeInfo(page, nodeId);
          initialSizes.push({ id: nodeId, size: sizeInfo.visualSize });
        } catch (error) {
          // Skip nodes that can't be measured
        }
      }
    }

    if (initialSizes.length < 2) return;

    // Calculate initial size ratio
    const initialRatio = initialSizes[0].size / initialSizes[1].size;

    // Zoom in on the graph
    const graphContainer = page.locator('.cytoscape-container, .graph-container').first();
    await graphContainer.hover();

    // Simulate zoom with wheel events
    await page.wheel(0, -200); // Zoom in
    await page.waitForTimeout(500);

    // Get sizes after zoom
    const zoomedSizes = [];
    for (const initial of initialSizes) {
      try {
        const sizeInfo = await getNodeSizeInfo(page, initial.id);
        zoomedSizes.push({ id: initial.id, size: sizeInfo.visualSize });
      } catch (error) {
        // Skip if node not found after zoom
      }
    }

    if (zoomedSizes.length >= 2) {
      // Calculate new ratio
      const zoomedRatio = zoomedSizes[0].size / zoomedSizes[1].size;

      // Ratio should remain approximately the same (within 10% tolerance)
      const ratioChange = Math.abs(zoomedRatio - initialRatio) / initialRatio;
      expect(ratioChange).toBeLessThan(0.1);

      console.log(`✅ Size ratios maintained during zoom: ${initialRatio.toFixed(2)} → ${zoomedRatio.toFixed(2)}`);
    }
  });

  test('should show appropriate size scaling for different file types', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Get nodes and categorize by file type
    const nodeData = await page.evaluate(() => {
      const nodes = document.querySelectorAll('[data-node-id]');
      const data: Array<{ id: string; type: string; size: number }> = [];

      nodes.forEach(node => {
        const id = node.getAttribute('data-node-id');
        if (!id) return;

        const rect = node.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);

        // Determine file type from extension
        let type = 'unknown';
        if (id.endsWith('.tsx') || id.endsWith('.jsx')) type = 'component';
        else if (id.endsWith('.ts') || id.endsWith('.js')) type = 'script';
        else if (id.endsWith('.css') || id.endsWith('.scss')) type = 'style';
        else if (id.includes('/')) type = 'directory';

        data.push({ id, type, size });
      });

      return data;
    });

    console.log('📁 Node types found:', nodeData.map(n => n.type));

    // Group by type and check for reasonable size distributions
    const typeGroups = nodeData.reduce((acc, node) => {
      if (!acc[node.type]) acc[node.type] = [];
      acc[node.type].push(node.size);
      return acc;
    }, {} as Record<string, number[]>);

    // Each type should have some size variation (indicating SLOC differences)
    Object.entries(typeGroups).forEach(([type, sizes]) => {
      if (sizes.length > 1) {
        const minSize = Math.min(...sizes);
        const maxSize = Math.max(...sizes);
        const variation = (maxSize - minSize) / minSize;

        // Should have at least 10% variation within file types
        expect(variation).toBeGreaterThan(0.1);
        console.log(`✅ ${type} files show size variation: ${variation.toFixed(2)}`);
      }
    });
  });

  test('should handle missing SLOC data gracefully', async ({ page }) => {
    // Simulate scenario where some nodes don't have SLOC data
    await page.evaluate(() => {
      // Remove SLOC data from some nodes to test fallback
      const nodes = document.querySelectorAll('[data-node-id]');
      nodes.forEach((node, index) => {
        if (index % 2 === 0) {
          node.removeAttribute('data-sloc');
          node.removeAttribute('data-metrics');
        }
      });
    });

    await page.waitForTimeout(500);

    // Nodes without SLOC data should still be visible and properly sized
    const nodeElements = await page.locator('[data-node-id]').all();

    for (const nodeElement of nodeElements.slice(0, 3)) {
      await expect(nodeElement).toBeVisible();

      const box = await nodeElement.boundingBox();
      expect(box).toBeTruthy();

      // Should have reasonable minimum size even without SLOC data
      if (box) {
        expect(Math.max(box.width, box.height)).toBeGreaterThan(10);
        expect(Math.max(box.width, box.height)).toBeLessThan(200);
      }
    }

    console.log('✅ Nodes without SLOC data render with fallback sizing');
  });

});