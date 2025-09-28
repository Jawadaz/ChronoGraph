import { test, expect, type Page } from '@playwright/test';

/**
 * Dynamic Area Expansion Tests
 * Detects and prevents unwanted expanding of UI areas
 */

test.describe('Area Expansion Detection - Web Version', () => {

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

  test('should maintain consistent layout bounds', async ({ page }) => {
    console.log('🔍 Testing layout bounds consistency...');

    // Get viewport dimensions
    const viewport = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));

    console.log('📱 Viewport:', viewport);

    // Measure key container elements
    const measureElements = async (label: string) => {
      const measurements = await page.evaluate(() => {
        const elements = {
          app: document.querySelector('.app'),
          appMain: document.querySelector('.app-main'),
          analysisResults: document.querySelector('.analysis-results'),
          tabContent: document.querySelector('.tab-content'),
          treeView: document.querySelector('.tree-view'),
          treeBasedGraphContainer: document.querySelector('.tree-based-graph-container')
        };

        const measurements: any = {};

        Object.entries(elements).forEach(([key, el]) => {
          if (el) {
            const rect = el.getBoundingClientRect();
            const computed = window.getComputedStyle(el);
            measurements[key] = {
              width: rect.width,
              height: rect.height,
              top: rect.top,
              left: rect.left,
              bottom: rect.bottom,
              right: rect.right,
              computedHeight: computed.height,
              computedMaxHeight: computed.maxHeight,
              computedOverflowY: computed.overflowY,
              computedOverflowX: computed.overflowX,
              scrollHeight: (el as HTMLElement).scrollHeight,
              clientHeight: (el as HTMLElement).clientHeight
            };
          }
        });

        return measurements;
      });

      console.log(`📏 ${label} measurements:`, measurements);
      return measurements;
    };

    // Initial measurements
    const initial = await measureElements('Initial');

    // Perform various interactions that might trigger expansion
    await page.click('.tree-expander:first-of-type');
    await page.waitForTimeout(300);

    const afterExpand = await measureElements('After tree expand');

    // Click multiple checkboxes
    const checkboxes = await page.locator('.tree-checkbox').all();
    for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
      await checkboxes[i].click();
      await page.waitForTimeout(100);
    }

    const afterCheckboxes = await measureElements('After checkbox changes');

    // Switch between tabs
    await page.click('button:has-text("Timeline")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Statistics")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Dependencies")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Graph")');
    await page.waitForTimeout(300);

    const afterTabSwitching = await measureElements('After tab switching');

    // Analyze height changes
    const analyzeHeightChanges = (initial: any, final: any, elementKey: string) => {
      if (!initial[elementKey] || !final[elementKey]) return null;

      const heightChange = Math.abs(final[elementKey].height - initial[elementKey].height);
      const heightIncrease = final[elementKey].height - initial[elementKey].height;

      return {
        elementKey,
        initialHeight: initial[elementKey].height,
        finalHeight: final[elementKey].height,
        heightChange,
        heightIncrease,
        exceedsViewport: final[elementKey].height > viewport.height - 50 // Account for browser chrome
      };
    };

    const criticalElements = ['appMain', 'analysisResults', 'tabContent'];
    const heightAnalysis = criticalElements.map(elementKey =>
      analyzeHeightChanges(initial, afterTabSwitching, elementKey)
    ).filter(Boolean);

    console.log('📊 Height analysis:', heightAnalysis);

    // Assertions
    heightAnalysis.forEach(analysis => {
      if (analysis) {
        // No element should grow significantly (more than 100px)
        expect(analysis.heightIncrease,
          `${analysis.elementKey} should not grow significantly`
        ).toBeLessThan(100);

        // No element should exceed viewport bounds
        expect(analysis.exceedsViewport,
          `${analysis.elementKey} should not exceed viewport`
        ).toBe(false);

        // Main containers should have reasonable maximum heights
        if (analysis.elementKey === 'analysisResults') {
          expect(analysis.finalHeight,
            'Analysis results should not exceed 90% of viewport'
          ).toBeLessThan(viewport.height * 0.9);
        }
      }
    });
  });

  test('should prevent scroll area accumulation', async ({ page }) => {
    console.log('🔍 Testing scroll area accumulation...');

    const getScrollAreas = async () => {
      return await page.evaluate(() => {
        const scrollableElements = Array.from(document.querySelectorAll('*'))
          .filter(el => {
            const computed = window.getComputedStyle(el);
            const hasScroll = (computed.overflowY === 'auto' || computed.overflowY === 'scroll') ||
                             (computed.overflowX === 'auto' || computed.overflowX === 'scroll');
            const actuallyScrolls = (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight ||
                                   (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth;
            return hasScroll && actuallyScrolls;
          })
          .map(el => ({
            tag: el.tagName,
            className: el.className,
            id: el.id,
            overflowY: window.getComputedStyle(el).overflowY,
            overflowX: window.getComputedStyle(el).overflowX,
            rect: el.getBoundingClientRect()
          }));

        return {
          count: scrollableElements.length,
          elements: scrollableElements
        };
      });
    };

    const initialScrollAreas = await getScrollAreas();
    console.log('📊 Initial scroll areas:', initialScrollAreas);

    // Perform interactions
    await page.click('.tree-expander:first-of-type');
    await page.waitForTimeout(500);

    const afterInteraction = await getScrollAreas();
    console.log('📊 Scroll areas after interaction:', afterInteraction);

    // The number of scroll areas should not increase significantly
    expect(afterInteraction.count - initialScrollAreas.count,
      'Scroll areas should not accumulate'
    ).toBeLessThanOrEqual(1);

    // Specific problematic patterns
    const problemPatterns = afterInteraction.elements.filter(el =>
      el.className.includes('analysis-results') ||
      el.className.includes('tab-content')
    );

    console.log('⚠️ Potentially problematic scroll areas:', problemPatterns);

    // Analysis results and tab content should not have nested scrollbars
    expect(problemPatterns.length,
      'Analysis results should not have multiple scroll areas'
    ).toBeLessThanOrEqual(1);
  });

  test('should maintain proper height calculations', async ({ page }) => {
    console.log('🔍 Testing height calculations...');

    const heightAnalysis = await page.evaluate(() => {
      const app = document.querySelector('.app');
      const appMain = document.querySelector('.app-main');
      const analysisResults = document.querySelector('.analysis-results');
      const statusBar = document.querySelector('.status-bar');

      const viewport = {
        height: window.innerHeight,
        width: window.innerWidth
      };

      const calculations = {
        viewport,
        app: app ? {
          height: app.getBoundingClientRect().height,
          computedHeight: window.getComputedStyle(app).height
        } : null,
        appMain: appMain ? {
          height: appMain.getBoundingClientRect().height,
          computedHeight: window.getComputedStyle(appMain).height
        } : null,
        analysisResults: analysisResults ? {
          height: analysisResults.getBoundingClientRect().height,
          computedHeight: window.getComputedStyle(analysisResults).height
        } : null,
        statusBar: statusBar ? {
          height: statusBar.getBoundingClientRect().height,
          position: window.getComputedStyle(statusBar).position
        } : null
      };

      return calculations;
    });

    console.log('📏 Height analysis:', heightAnalysis);

    // App should fill viewport
    if (heightAnalysis.app) {
      expect(heightAnalysis.app.height).toBeCloseTo(heightAnalysis.viewport.height, 0);
    }

    // Main content area should account for header and status bar
    if (heightAnalysis.appMain) {
      // Should be less than full viewport to account for header
      expect(heightAnalysis.appMain.height).toBeLessThan(heightAnalysis.viewport.height);
      // But should be substantial (more than 60% of viewport)
      expect(heightAnalysis.appMain.height).toBeGreaterThan(heightAnalysis.viewport.height * 0.6);
    }

    // Status bar should be positioned fixed at bottom
    if (heightAnalysis.statusBar) {
      expect(heightAnalysis.statusBar.position).toBe('fixed');
    }

    // Take screenshot for manual verification
    await page.screenshot({
      path: 'test-results/height-calculations.png',
      fullPage: true
    });
  });
});