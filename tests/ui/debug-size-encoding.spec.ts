import { test, expect } from '@playwright/test';
import { setupAnalysis, MOCK_REPOS } from './ui/test-utils';

test('debug size encoding', async ({ page }) => {
  const consoleLogs: string[] = [];

  // Capture console logs
  page.on('console', msg => {
    consoleLogs.push(msg.text());
    console.log(`CONSOLE: ${msg.text()}`);
  });

  await setupAnalysis(page, MOCK_REPOS.small);

  // Wait for graph to load
  await page.waitForSelector('.cytoscape-graph', { timeout: 10000 });
  await page.waitForTimeout(2000); // Let everything initialize

  // Take screenshot
  await page.screenshot({ path: 'debug-size-encoding.png', fullPage: true });

  // Check if size encoding logs are present
  const sizeEncodingLogs = consoleLogs.filter(log =>
    log.includes('Size encoding check') ||
    log.includes('Size calculation result') ||
    log.includes('TreeBasedCytoscapeGraph RENDERING')
  );

  console.log('=== SIZE ENCODING LOGS ===');
  sizeEncodingLogs.forEach(log => console.log(log));

  // Check node sizes in DOM
  const nodeSizes = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.cytoscape-graph *'));
    return nodes.map(node => {
      const style = window.getComputedStyle(node);
      return {
        tagName: node.tagName,
        width: style.width,
        height: style.height,
        className: node.className
      };
    }).filter(n => n.width !== '0px' && n.height !== '0px');
  });

  console.log('=== NODE SIZES ===');
  console.log(JSON.stringify(nodeSizes, null, 2));

  expect(sizeEncodingLogs.length).toBeGreaterThan(0);
});