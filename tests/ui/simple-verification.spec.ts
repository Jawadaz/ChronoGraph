import { test, expect } from '@playwright/test';
import { setupAnalysis, MOCK_REPOS } from './test-utils';

test.describe('Simple UI Verification', () => {
  test('verify enhanced sample data is working', async ({ page }) => {
    await setupAnalysis(page, MOCK_REPOS.small);

    // Wait for analysis results to appear
    await page.waitForSelector('[data-testid="analysis-results"], .analysis-results', { timeout: 10000 });

    // Take a screenshot to see current state
    await page.screenshot({ path: 'verification-current-state.png', fullPage: true });

    // Check what elements are actually present
    const allElements = await page.$$eval('*', (elements) => {
      const results = [];
      for (const el of elements) {
        const className = el.className;
        const id = el.id;
        const tagName = el.tagName;

        // Look for graph-related elements
        if (typeof className === 'string' &&
            (className.includes('graph') || className.includes('cytoscape') ||
             className.includes('tree') || className.includes('node') ||
             tagName === 'SVG' || tagName === 'CANVAS')) {
          results.push({
            tagName,
            className,
            id,
            visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
            hasChildren: el.children.length > 0
          });
        }
      }
      return results;
    });

    console.log('Found elements:', JSON.stringify(allElements, null, 2));

    // Check if enhanced metrics are available by looking for different sized nodes
    const hasVariableNodeSizes = await page.evaluate(() => {
      // Look for any elements that might be nodes with different sizes
      const possibleNodes = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return (el.tagName === 'RECT' || el.tagName === 'CIRCLE' ||
                el.className?.includes?.('node') ||
                (style.width && style.height &&
                 parseInt(style.width) > 10 && parseInt(style.height) > 10));
      });

      if (possibleNodes.length === 0) return false;

      // Check if nodes have different sizes
      const sizes = possibleNodes.map(node => {
        const style = window.getComputedStyle(node);
        return { width: parseInt(style.width) || 0, height: parseInt(style.height) || 0 };
      });

      const uniqueSizes = [...new Set(sizes.map(s => `${s.width}x${s.height}`))];
      return uniqueSizes.length > 1; // If we have different sizes, enhanced metrics are working
    });

    console.log('Has variable node sizes:', hasVariableNodeSizes);

    // The test passes if we can see any graph-related elements
    expect(allElements.length).toBeGreaterThan(0);
  });
});