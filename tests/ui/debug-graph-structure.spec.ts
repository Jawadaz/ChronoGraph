import { test, expect } from '@playwright/test';

test('Debug graph structure', async ({ page }) => {
  // Navigate to the application
  await page.goto('http://localhost:1429');

  // Wait for the application to load
  await page.waitForTimeout(3000);

  // Check if any analysis results are visible
  const analysisResults = await page.locator('[data-testid="analysis-results"], .analysis-results').first();
  await analysisResults.waitFor({ timeout: 10000 });

  // Capture console logs
  page.on('console', msg => console.log(`CONSOLE: ${msg.text()}`));

  // Take a screenshot
  await page.screenshot({ path: 'debug-current-state.png', fullPage: true });

  // Check what graph-related elements exist
  const graphElements = await page.$$eval('*', (elements) => {
    return elements
      .filter(el => el.className && typeof el.className === 'string' &&
        (el.className.includes('graph') || el.className.includes('cytoscape') || el.className.includes('tree')))
      .map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        textContent: el.textContent?.substring(0, 50),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
      }));
  });

  console.log('Found graph-related elements:');
  console.log(JSON.stringify(graphElements, null, 2));

  // Check for size encoding debug logs
  await page.evaluate(() => {
    console.log('🔍 Checking for size encoding debug...');
    // Trigger some interactions to see debug logs
    if (window.__size_debug_logged !== undefined) {
      console.log('Size debug already logged:', window.__size_debug_logged);
    }
  });

  await page.waitForTimeout(2000);
});