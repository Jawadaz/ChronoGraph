import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 * Captures screenshots for before/after comparisons
 */

test.describe('Visual Regression - Web Version', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Set consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Trigger analysis to load the tree with mock data
    await page.click('button:has-text("📂 Open Repository")');
    await page.fill('#repo-url', 'https://github.com/flutter/samples');
    await page.click('button:has-text("🚀 Start Analysis")');

    // Wait for analysis to complete and results to appear
    await page.waitForSelector('.analysis-results', { timeout: 10000 });
    await page.waitForSelector('.tree-view', { timeout: 5000 });

    // Wait for graph to load
    await page.waitForTimeout(2000);
  });

  test('baseline - full application screenshot', async ({ page }) => {
    // Take full page screenshot as baseline
    await expect(page).toHaveScreenshot('app-full-baseline.png', {
      fullPage: true,
      threshold: 0.2
    });
  });

  test('baseline - graph tab layout', async ({ page }) => {
    // Ensure we're on the Graph tab
    await page.click('button:has-text("Graph")');
    await page.waitForTimeout(500);

    // Screenshot of just the Analysis Results area
    const analysisResults = page.locator('.analysis-results');
    await expect(analysisResults).toHaveScreenshot('graph-tab-baseline.png', {
      threshold: 0.2
    });
  });

  test('baseline - tree panel layout', async ({ page }) => {
    // Focus on the tree panel
    const treePanel = page.locator('.tree-sidebar');
    await expect(treePanel).toHaveScreenshot('tree-panel-baseline.png', {
      threshold: 0.2
    });
  });

  test('interaction - tree expansion visual changes', async ({ page }) => {
    // Click first tree expander
    await page.click('.tree-expander:first-of-type');
    await page.waitForTimeout(300);

    // Screenshot after expansion
    const treePanel = page.locator('.tree-sidebar');
    await expect(treePanel).toHaveScreenshot('tree-panel-expanded.png', {
      threshold: 0.2
    });
  });

  test('interaction - tab switching layout', async ({ page }) => {
    // Switch to Dependencies tab
    await page.click('button:has-text("Dependencies")');
    await page.waitForTimeout(500);

    const analysisResults = page.locator('.analysis-results');
    await expect(analysisResults).toHaveScreenshot('dependencies-tab.png', {
      threshold: 0.2
    });

    // Switch to Timeline tab
    await page.click('button:has-text("Timeline")');
    await page.waitForTimeout(500);

    await expect(analysisResults).toHaveScreenshot('timeline-tab.png', {
      threshold: 0.2
    });

    // Switch to Statistics tab
    await page.click('button:has-text("Statistics")');
    await page.waitForTimeout(500);

    await expect(analysisResults).toHaveScreenshot('statistics-tab.png', {
      threshold: 0.2
    });

    // Back to Graph tab
    await page.click('button:has-text("Graph")');
    await page.waitForTimeout(500);

    await expect(analysisResults).toHaveScreenshot('graph-tab-after-switching.png', {
      threshold: 0.2
    });
  });

  test('layout - scroll indicators visual check', async ({ page }) => {
    // Add custom CSS to highlight scroll areas for visual debugging
    await page.addStyleTag({
      content: `
        *::-webkit-scrollbar {
          background: red !important;
          width: 10px !important;
        }
        *::-webkit-scrollbar-thumb {
          background: yellow !important;
        }
        /* Highlight elements with overflow */
        *[style*="overflow-y: auto"],
        *[style*="overflow-y: scroll"],
        .overflow-auto,
        .overflow-scroll {
          outline: 3px solid lime !important;
        }
      `
    });

    await page.waitForTimeout(500);

    // Take screenshot with scroll indicators highlighted
    await expect(page).toHaveScreenshot('scroll-indicators-highlighted.png', {
      fullPage: true,
      threshold: 0.3 // Higher threshold due to added visual indicators
    });
  });

  test('responsive - tree panel collapsed', async ({ page }) => {
    // Collapse tree panel
    await page.click('.collapse-button');
    await page.waitForTimeout(500);

    const analysisResults = page.locator('.analysis-results');
    await expect(analysisResults).toHaveScreenshot('tree-panel-collapsed.png', {
      threshold: 0.2
    });

    // Expand tree panel again
    await page.click('.expand-tree-button');
    await page.waitForTimeout(500);

    await expect(analysisResults).toHaveScreenshot('tree-panel-expanded-again.png', {
      threshold: 0.2
    });
  });

  test('edge-case - multiple tree interactions', async ({ page }) => {
    // Perform multiple interactions rapidly
    const expanderButtons = await page.locator('.tree-expander').all();

    // Expand first few tree nodes
    for (let i = 0; i < Math.min(3, expanderButtons.length); i++) {
      await expanderButtons[i].click();
      await page.waitForTimeout(100);
    }

    // Click some checkboxes
    const checkboxes = await page.locator('.tree-checkbox').all();
    for (let i = 0; i < Math.min(5, checkboxes.length); i++) {
      await checkboxes[i].click();
      await page.waitForTimeout(50);
    }

    await page.waitForTimeout(500);

    // Screenshot after multiple interactions
    const treePanel = page.locator('.tree-sidebar');
    await expect(treePanel).toHaveScreenshot('tree-multiple-interactions.png', {
      threshold: 0.3
    });

    // Full page screenshot to check for layout issues
    await expect(page).toHaveScreenshot('app-after-multiple-interactions.png', {
      fullPage: true,
      threshold: 0.3
    });
  });

  test('status-bar - positioning visual check', async ({ page }) => {
    // Scroll to bottom to verify status bar positioning
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Focus on bottom area
    const bottomArea = page.locator('body');
    await expect(bottomArea).toHaveScreenshot('status-bar-positioning.png', {
      threshold: 0.2,
      clip: { x: 0, y: 600, width: 1280, height: 120 }
    });
  });
});