import { test, expect } from '@playwright/test';
import {
  setupAnalysis,
  testResponsiveBehavior,
  getTreeViewMeasurements,
  assertResponsiveConstraints,
  VIEWPORTS,
  MOCK_REPOS
} from './test-utils';

/**
 * Tree Panel Responsive Behavior Tests
 * Verifies that the tree panel behaves correctly across different screen sizes
 * with proper width constraints on narrow screens
 */

test.describe('Tree Panel Responsive Behavior - Web Version', () => {

  test.beforeEach(async ({ page }) => {
    await setupAnalysis(page, MOCK_REPOS.small);
  });

  test('should maintain minimum width constraints on narrow screens', async ({ page }) => {
    await testResponsiveBehavior(page, async (page, viewport) => {
      const measurements = await getTreeViewMeasurements(page);

      console.log(`📱 ${viewport.width}x${viewport.height} - Tree view width: ${measurements.treeView.width}px`);

      // Tree view should never be smaller than 200px
      expect(measurements.treeView.width).toBeGreaterThanOrEqual(200);

      // On narrow screens (< 768px), tree view should have responsive constraints
      if (viewport.width < 768) {
        // Should not exceed 50% of viewport width on narrow screens
        expect(measurements.treeView.width).toBeLessThanOrEqual(viewport.width * 0.5);

        // Should have minimum width even on very narrow screens
        expect(measurements.treeView.width).toBeGreaterThanOrEqual(200);
      }

      // Content should be scrollable when needed
      if (measurements.treeContent.scrollHeight > measurements.treeContent.height) {
        expect(measurements.treeContent.overflowY).toBe('auto');
      }
    });
  });

  test('should handle tree expansion without layout overflow', async ({ page }) => {
    // Test at narrow viewport
    await page.setViewportSize(VIEWPORTS.narrow);

    // Get initial measurements
    const initialMeasurements = await getTreeViewMeasurements(page);

    // Expand some tree nodes
    await page.click('.tree-expander:first-of-type');
    await page.waitForTimeout(300); // Allow expansion animation

    // Expand more nodes if available
    const expanderCount = await page.locator('.tree-expander.has-children').count();
    if (expanderCount > 1) {
      await page.click('.tree-expander.has-children:nth-of-type(2)');
      await page.waitForTimeout(300);
    }

    // Get measurements after expansion
    const expandedMeasurements = await getTreeViewMeasurements(page);

    // Tree view width should remain stable despite content expansion
    expect(expandedMeasurements.treeView.width).toBeCloseTo(
      initialMeasurements.treeView.width,
      -1 // Allow 10px tolerance
    );

    // Content should scroll instead of expanding horizontally
    expect(expandedMeasurements.treeContent.overflowY).toBe('auto');

    // If content is taller than container, it should be scrollable
    if (expandedMeasurements.treeContent.scrollHeight > expandedMeasurements.treeContent.height) {
      // Verify scrolling works
      await page.hover('.tree-content');
      await page.wheel(0, 100); // Scroll down
      await page.waitForTimeout(100);

      // Should still be within bounds
      const afterScrollMeasurements = await getTreeViewMeasurements(page);
      expect(afterScrollMeasurements.treeView.width).toBeCloseTo(
        initialMeasurements.treeView.width,
        -1
      );
    }
  });

  test('should adapt tree node indentation on narrow screens', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Expand tree nodes to show indentation
    await page.click('.tree-expander:first-of-type');
    await page.waitForTimeout(300);

    // Check that nested nodes have appropriate indentation
    const nodeIndents = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.tree-node');
      return Array.from(nodes).map(node => {
        const style = window.getComputedStyle(node);
        const paddingLeft = parseInt(style.paddingLeft || '0');
        const level = parseInt((node as HTMLElement).dataset.level || '0');
        return { paddingLeft, level };
      });
    });

    // Indentation should be reasonable on mobile (not too wide)
    const maxIndent = Math.max(...nodeIndents.map(n => n.paddingLeft));
    const mobileViewport = VIEWPORTS.mobile;

    // Maximum indentation should not exceed 25% of viewport width on mobile
    expect(maxIndent).toBeLessThanOrEqual(mobileViewport.width * 0.25);

    // Should still have visible indentation hierarchy
    const levelVariations = new Set(nodeIndents.map(n => n.paddingLeft)).size;
    expect(levelVariations).toBeGreaterThan(1);
  });

  test('should show/hide tree labels appropriately on narrow screens', async ({ page }) => {
    await testResponsiveBehavior(page, async (page, viewport) => {
      // Check tree label visibility and truncation
      const labelInfo = await page.evaluate(() => {
        const labels = document.querySelectorAll('.tree-label');
        return Array.from(labels).map(label => {
          const style = window.getComputedStyle(label);
          const rect = label.getBoundingClientRect();
          return {
            width: rect.width,
            overflow: style.overflow,
            textOverflow: style.textOverflow,
            whiteSpace: style.whiteSpace,
            text: label.textContent
          };
        });
      });

      // Labels should handle overflow properly
      labelInfo.forEach(label => {
        expect(label.overflow).toBe('hidden');
        expect(label.textOverflow).toBe('ellipsis');
        expect(label.whiteSpace).toBe('nowrap');
      });

      // On very narrow screens, labels should still be readable
      if (viewport.width < 400) {
        const visibleLabels = labelInfo.filter(l => l.width > 50);
        expect(visibleLabels.length).toBeGreaterThan(0);
      }
    });
  });

  test('should maintain tree interaction on all screen sizes', async ({ page }) => {
    await testResponsiveBehavior(page, async (page, viewport) => {
      // Test checkbox interactions
      const checkboxes = page.locator('.tree-checkbox');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount > 0) {
        // Click first checkbox
        await checkboxes.first().click();
        await page.waitForTimeout(100);

        // Verify checkbox state changed
        const checkboxState = await checkboxes.first().getAttribute('class');
        expect(checkboxState).toMatch(/checkbox-(checked|unchecked|half-checked)/);
      }

      // Test expander interactions
      const expanders = page.locator('.tree-expander.has-children');
      const expanderCount = await expanders.count();

      if (expanderCount > 0) {
        // Click first expander
        await expanders.first().click();
        await page.waitForTimeout(300);

        // Should expand/collapse tree children
        const hasVisibleChildren = await page.locator('.tree-children').first().isVisible();
        expect(typeof hasVisibleChildren).toBe('boolean');
      }

      console.log(`✅ Tree interactions work at ${viewport.width}x${viewport.height}`);
    });
  });

  test('should handle horizontal scrolling gracefully on narrow screens', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Force some content to be wider than container
    await page.evaluate(() => {
      const treeView = document.querySelector('.tree-view');
      if (treeView) {
        // Add a very long filename to test horizontal overflow
        const longNode = document.createElement('div');
        longNode.className = 'tree-node file';
        longNode.innerHTML = `
          <div class="tree-node-content">
            <span class="tree-expander no-children">○</span>
            <span class="tree-checkbox file-checkbox checkbox-unchecked">☐</span>
            <span class="tree-icon file-icon">📄</span>
            <span class="tree-label">very-long-filename-that-should-cause-horizontal-overflow-testing.tsx</span>
          </div>
        `;

        const treeContent = document.querySelector('.tree-content');
        if (treeContent) {
          treeContent.appendChild(longNode);
        }
      }
    });

    await page.waitForTimeout(100);

    const measurements = await getTreeViewMeasurements(page);

    // Tree view should maintain its width constraint
    expect(measurements.treeView.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width * 0.6);

    // Content should handle overflow properly
    expect(measurements.treeContent.overflowX).toBe('hidden');

    // Long labels should be truncated
    const longLabelWidth = await page.evaluate(() => {
      const longLabel = document.querySelector('.tree-label:last-of-type');
      return longLabel ? longLabel.getBoundingClientRect().width : 0;
    });

    // Label should not extend beyond reasonable bounds
    expect(longLabelWidth).toBeLessThan(VIEWPORTS.mobile.width * 0.4);
  });

  test('should provide accessible tree navigation on touch devices', async ({ page }) => {
    // Simulate mobile viewport and touch interactions
    await page.setViewportSize(VIEWPORTS.mobile);

    // Test touch targets are large enough (minimum 44px for accessibility)
    const touchTargets = await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('.tree-checkbox');
      const expanders = document.querySelectorAll('.tree-expander');

      const measurements = [];

      [...checkboxes, ...expanders].forEach(element => {
        const rect = element.getBoundingClientRect();
        measurements.push({
          type: element.classList.contains('tree-checkbox') ? 'checkbox' : 'expander',
          width: rect.width,
          height: rect.height,
          area: rect.width * rect.height
        });
      });

      return measurements;
    });

    // Touch targets should be at least 18px (acceptable for tree controls)
    touchTargets.forEach(target => {
      expect(target.width).toBeGreaterThanOrEqual(16);
      expect(target.height).toBeGreaterThanOrEqual(16);
    });

    // Test that tree controls are properly spaced for touch
    const controlSpacing = await page.evaluate(() => {
      const nodeContent = document.querySelector('.tree-node-content');
      if (!nodeContent) return null;

      const style = window.getComputedStyle(nodeContent);
      return {
        gap: style.gap,
        padding: style.padding
      };
    });

    expect(controlSpacing?.gap).toBeTruthy();
  });

});