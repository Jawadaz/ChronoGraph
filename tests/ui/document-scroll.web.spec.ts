import { test, expect, type Page } from '@playwright/test';

/**
 * Document-Level Scroll Detection Tests
 * Detects scroll bars at the document/body level (outer scroll)
 */

test.describe('Document Scroll Detection - Web Version', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Trigger analysis to load the tree with mock data
    await page.click('button:has-text("📂 Open Repository")');
    await page.fill('#repo-url', 'https://github.com/flutter/samples');
    await page.click('button:has-text("🚀 Start Analysis")');

    // Wait for analysis to complete and results to appear
    await page.waitForSelector('.analysis-results', { timeout: 10000 });
    await page.waitForSelector('.tree-view', { timeout: 5000 });
  });

  test('should not have document-level scroll bars', async ({ page }) => {
    console.log('🔍 Testing document-level scroll bars...');

    // Check document scroll properties
    const documentScrollInfo = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;

      return {
        bodyScrollHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        bodyOffsetHeight: body.offsetHeight,
        htmlScrollHeight: html.scrollHeight,
        htmlClientHeight: html.clientHeight,
        htmlOffsetHeight: html.offsetHeight,
        windowInnerHeight: window.innerHeight,
        windowOuterHeight: window.outerHeight,
        hasBodyVerticalScroll: body.scrollHeight > body.clientHeight,
        hasHtmlVerticalScroll: html.scrollHeight > html.clientHeight,
        bodyOverflow: window.getComputedStyle(body).overflow,
        htmlOverflow: window.getComputedStyle(html).overflow,
        bodyOverflowY: window.getComputedStyle(body).overflowY,
        htmlOverflowY: window.getComputedStyle(html).overflowY,
      };
    });

    console.log('📊 Document scroll analysis:', documentScrollInfo);

    // Check if page content exceeds viewport
    expect(documentScrollInfo.bodyScrollHeight <= documentScrollInfo.windowInnerHeight + 5,
      `Body content should not exceed viewport height. Body scroll height: ${documentScrollInfo.bodyScrollHeight}, Window height: ${documentScrollInfo.windowInnerHeight}`
    ).toBe(true);

    expect(documentScrollInfo.htmlScrollHeight <= documentScrollInfo.windowInnerHeight + 5,
      `HTML content should not exceed viewport height. HTML scroll height: ${documentScrollInfo.htmlScrollHeight}, Window height: ${documentScrollInfo.windowInnerHeight}`
    ).toBe(true);

    // Check for visible scroll bars
    expect(documentScrollInfo.hasBodyVerticalScroll,
      'Body should not have vertical scroll bar'
    ).toBe(false);

    expect(documentScrollInfo.hasHtmlVerticalScroll,
      'HTML should not have vertical scroll bar'
    ).toBe(false);
  });

  test('should measure content vs viewport precisely', async ({ page }) => {
    console.log('🔍 Measuring content vs viewport...');

    const measurements = await page.evaluate(() => {
      const app = document.querySelector('.app') as HTMLElement;
      const appMain = document.querySelector('.app-main') as HTMLElement;
      const header = document.querySelector('.app-header') as HTMLElement;
      const statusBar = document.querySelector('.status-bar') as HTMLElement;

      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        app: app ? {
          height: app.offsetHeight,
          boundingHeight: app.getBoundingClientRect().height,
          computedHeight: window.getComputedStyle(app).height
        } : null,
        appMain: appMain ? {
          height: appMain.offsetHeight,
          boundingHeight: appMain.getBoundingClientRect().height,
          computedHeight: window.getComputedStyle(appMain).height
        } : null,
        header: header ? {
          height: header.offsetHeight,
          boundingHeight: header.getBoundingClientRect().height
        } : null,
        statusBar: statusBar ? {
          height: statusBar.offsetHeight,
          boundingHeight: statusBar.getBoundingClientRect().height
        } : null,
        totalCalculatedHeight: 0
      };
    });

    // Calculate total height
    const totalHeight = (measurements.header?.height || 0) +
                       (measurements.appMain?.height || 0) +
                       (measurements.statusBar?.height || 0);

    console.log('📏 Detailed measurements:', measurements);
    console.log('📊 Total calculated height:', totalHeight);
    console.log('📊 Viewport height:', measurements.viewport.height);

    // Total content should not exceed viewport
    expect(totalHeight <= measurements.viewport.height + 10,
      `Total content height (${totalHeight}) should not exceed viewport height (${measurements.viewport.height})`
    ).toBe(true);
  });

  test('should have properly constrained app height', async ({ page }) => {
    console.log('🔍 Testing app height constraints...');

    const appHeightInfo = await page.evaluate(() => {
      const app = document.querySelector('.app') as HTMLElement;
      if (!app) return null;

      const rect = app.getBoundingClientRect();
      const computed = window.getComputedStyle(app);

      return {
        offsetHeight: app.offsetHeight,
        clientHeight: app.clientHeight,
        scrollHeight: app.scrollHeight,
        boundingHeight: rect.height,
        computedHeight: computed.height,
        computedMaxHeight: computed.maxHeight,
        computedMinHeight: computed.minHeight,
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
        exceedsViewport: rect.bottom > window.innerHeight
      };
    });

    console.log('📊 App height analysis:', appHeightInfo);

    if (appHeightInfo) {
      // App should exactly fill viewport height
      expect(appHeightInfo.boundingHeight).toBeCloseTo(appHeightInfo.viewportHeight, 0);

      // App should not exceed viewport
      expect(appHeightInfo.exceedsViewport,
        'App should not extend beyond viewport bottom'
      ).toBe(false);
    }
  });
});