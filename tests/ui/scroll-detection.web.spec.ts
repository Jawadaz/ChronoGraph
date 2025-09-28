import { test, expect, type Page } from '@playwright/test';

/**
 * Scroll Bar Detection Tests for ChronoGraph UI
 * Tests for the specific issues: inner scroll bars and dynamic area expansion
 */

test.describe('ScrollBar Detection - Web Version', () => {

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

  test('should have only intended scroll bars', async ({ page }) => {
    console.log('🔍 Testing scroll bar detection...');

    // Count all elements with scrollbars
    const scrollableElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter(el => {
          const style = window.getComputedStyle(el);
          return style.overflowY === 'auto' || style.overflowY === 'scroll' ||
                 style.overflowX === 'auto' || style.overflowX === 'scroll';
        })
        .map(el => ({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          overflowY: window.getComputedStyle(el).overflowY,
          overflowX: window.getComputedStyle(el).overflowX,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          hasVerticalScrollbar: el.scrollHeight > el.clientHeight,
          hasHorizontalScrollbar: el.scrollWidth > el.clientWidth
        }));
    });

    console.log('📊 Found scrollable elements:', scrollableElements);

    // We should only have scroll in the tree content area
    const activeScrollbars = scrollableElements.filter(el =>
      el.hasVerticalScrollbar || el.hasHorizontalScrollbar
    );

    console.log('⚠️ Elements with active scrollbars:', activeScrollbars);

    // Specific checks for problematic areas
    const analysisResults = await page.locator('.analysis-results').first();
    const tabContent = await page.locator('.tab-content').first();
    const treeContent = await page.locator('.tree-content').first();

    // Check Analysis Results area properties
    const analysisResultsBox = await analysisResults.boundingBox();
    const analysisResultsOverflow = await analysisResults.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        overflowY: style.overflowY,
        overflowX: style.overflowX,
        height: style.height,
        maxHeight: style.maxHeight
      };
    });

    console.log('📏 Analysis Results properties:', {
      boundingBox: analysisResultsBox,
      overflow: analysisResultsOverflow
    });

    // The analysis results should not have scroll
    expect(analysisResultsOverflow.overflowY).not.toBe('auto');
    expect(analysisResultsOverflow.overflowY).not.toBe('scroll');
  });

  test('should not have expanding areas', async ({ page }) => {
    console.log('🔍 Testing area expansion...');

    // Measure initial sizes
    const initialMeasurements = await page.evaluate(() => {
      const analysisResults = document.querySelector('.analysis-results');
      const tabContent = document.querySelector('.tab-content');

      return {
        analysisResults: analysisResults ? {
          height: analysisResults.getBoundingClientRect().height,
          width: analysisResults.getBoundingClientRect().width
        } : null,
        tabContent: tabContent ? {
          height: tabContent.getBoundingClientRect().height,
          width: tabContent.getBoundingClientRect().width
        } : null,
        viewport: {
          height: window.innerHeight,
          width: window.innerWidth
        }
      };
    });

    console.log('📏 Initial measurements:', initialMeasurements);

    // Interact with the tree to trigger potential expansion
    const expander = page.locator('.tree-expander').first();
    if (await expander.isVisible()) {
      await expander.click();
      await page.waitForTimeout(500);
    }

    const checkbox = page.locator('.tree-checkbox').first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
      await page.waitForTimeout(500);
    }

    // Switch tabs to trigger re-renders
    await page.click('button:has-text("Dependencies")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Graph")');
    await page.waitForTimeout(500);

    // Measure after interactions
    const finalMeasurements = await page.evaluate(() => {
      const analysisResults = document.querySelector('.analysis-results');
      const tabContent = document.querySelector('.tab-content');

      return {
        analysisResults: analysisResults ? {
          height: analysisResults.getBoundingClientRect().height,
          width: analysisResults.getBoundingClientRect().width
        } : null,
        tabContent: tabContent ? {
          height: tabContent.getBoundingClientRect().height,
          width: tabContent.getBoundingClientRect().width
        } : null,
        viewport: {
          height: window.innerHeight,
          width: window.innerWidth
        }
      };
    });

    console.log('📏 Final measurements:', finalMeasurements);

    // Analysis Results should not grow beyond viewport
    if (initialMeasurements.analysisResults && finalMeasurements.analysisResults) {
      const heightDifference = Math.abs(
        finalMeasurements.analysisResults.height - initialMeasurements.analysisResults.height
      );

      console.log('📊 Height difference:', heightDifference);

      // Allow small differences due to content changes, but not major expansion
      expect(heightDifference).toBeLessThan(50);

      // Should not exceed viewport height minus header/status bar space
      expect(finalMeasurements.analysisResults.height).toBeLessThan(
        finalMeasurements.viewport.height - 100
      );
    }
  });

  test('should detect scroll bar count accurately', async ({ page }) => {
    console.log('🔍 Counting visible scroll bars...');

    const scrollBarInfo = await page.evaluate(() => {
      // Function to check if element has visible scrollbar
      const hasVisibleScrollbar = (element: Element) => {
        const style = window.getComputedStyle(element);
        return {
          vertical: element.scrollHeight > element.clientHeight &&
                   (style.overflowY === 'auto' || style.overflowY === 'scroll'),
          horizontal: element.scrollWidth > element.clientWidth &&
                     (style.overflowX === 'auto' || style.overflowX === 'scroll')
        };
      };

      const allElements = Array.from(document.querySelectorAll('*'));
      let verticalScrollBars = 0;
      let horizontalScrollBars = 0;
      const scrollBarElements: any[] = [];

      allElements.forEach(el => {
        const scrollInfo = hasVisibleScrollbar(el);
        if (scrollInfo.vertical || scrollInfo.horizontal) {
          verticalScrollBars += scrollInfo.vertical ? 1 : 0;
          horizontalScrollBars += scrollInfo.horizontal ? 1 : 0;

          scrollBarElements.push({
            element: el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : ''),
            vertical: scrollInfo.vertical,
            horizontal: scrollInfo.horizontal,
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth
          });
        }
      });

      return {
        totalVertical: verticalScrollBars,
        totalHorizontal: horizontalScrollBars,
        elements: scrollBarElements
      };
    });

    console.log('📊 Scroll bar analysis:', scrollBarInfo);

    // Ideally, we should have minimal scroll bars
    // Only the tree content should scroll when needed
    expect(scrollBarInfo.totalVertical).toBeLessThanOrEqual(2);
    expect(scrollBarInfo.totalHorizontal).toBe(0);

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'test-results/scroll-bars-detected.png',
      fullPage: true
    });
  });
});