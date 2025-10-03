import { test, expect } from '@playwright/test';
import {
  setupAnalysis,
  selectNode,
  getDependencyInfo,
  waitForGraphRender,
  MOCK_REPOS,
  MOCK_ANALYSIS_RESULT
} from './test-utils';

/**
 * NodeDetailsPanel Dependency Information Display Tests
 * Verifies that dependency information is properly displayed in the NodeDetailsPanel
 * including incoming/outgoing dependencies, SLOC metrics, and quality indicators
 */

test.describe('NodeDetailsPanel Dependency Display - Web Version', () => {

  test.beforeEach(async ({ page }) => {
    await setupAnalysis(page, MOCK_REPOS.small);
    await waitForGraphRender(page);
  });

  test('should display basic dependency information correctly', async ({ page }) => {
    // Get first available node
    const firstNode = page.locator('[data-node-id]').first();
    await expect(firstNode).toBeVisible();

    const nodeId = await firstNode.getAttribute('data-node-id');
    if (!nodeId) throw new Error('No node ID found');

    // Select the node to open details panel
    await selectNode(page, nodeId);

    // Verify panel is visible
    await expect(page.locator('.node-details-panel')).toBeVisible();

    // Check basic information section
    await expect(page.locator('.panel-content .section:has-text("📊 Basic Information")')).toBeVisible();

    // Verify file type is displayed
    const fileTypeElement = page.locator('.info-item:has(.label:text("Type:")) .value');
    await expect(fileTypeElement).toBeVisible();
    const fileType = await fileTypeElement.textContent();
    expect(fileType).toMatch(/^(File|Folder)$/);

    // Verify full path is displayed
    const pathElement = page.locator('.info-item:has(.label:text("Full Path:")) .value');
    await expect(pathElement).toBeVisible();
    const pathText = await pathElement.textContent();
    expect(pathText).toBe(nodeId);

    // Verify dependency counts are displayed
    const incomingElement = page.locator('.info-item:has(.label:text("Incoming Dependencies:")) .value');
    const outgoingElement = page.locator('.info-item:has(.label:text("Outgoing Dependencies:")) .value');

    await expect(incomingElement).toBeVisible();
    await expect(outgoingElement).toBeVisible();

    const incomingCount = await incomingElement.textContent();
    const outgoingCount = await outgoingElement.textContent();

    expect(incomingCount).toMatch(/^\d+$/);
    expect(outgoingCount).toMatch(/^\d+$/);

    console.log(`✅ Node ${nodeId}: ${incomingCount} incoming, ${outgoingCount} outgoing dependencies`);

    // Close panel
    await page.click('.close-button');
  });

  test('should display enhanced Lakos metrics when available', async ({ page }) => {
    // Wait for potential enhanced metrics
    await page.waitForTimeout(3000);

    const nodeElements = await page.locator('[data-node-id]').all();
    let foundEnhancedMetrics = false;

    // Try several nodes to find one with enhanced metrics
    for (const nodeElement of nodeElements.slice(0, 3)) {
      const nodeId = await nodeElement.getAttribute('data-node-id');
      if (!nodeId) continue;

      await selectNode(page, nodeId);

      // Check if enhanced metrics section exists
      const lakosSection = page.locator('.section:has-text("📈 Lakos Metrics")');

      if (await lakosSection.isVisible()) {
        foundEnhancedMetrics = true;

        // Verify SLOC is displayed
        const slocElement = page.locator('.info-item:has(.label:text("Source Lines of Code (SLOC):")) .value');
        await expect(slocElement).toBeVisible();
        const slocText = await slocElement.textContent();
        expect(slocText).toMatch(/^\d{1,3}(,\d{3})*$/); // Number with comma separators

        // Verify Component Dependency is displayed
        const cdElement = page.locator('.info-item:has(.label:text("Component Dependency (CD):")) .value');
        await expect(cdElement).toBeVisible();

        // Verify In-Degree and Out-Degree are displayed
        const inDegreeElement = page.locator('.info-item:has(.label:text("In-Degree:")) .value');
        const outDegreeElement = page.locator('.info-item:has(.label:text("Out-Degree:")) .value');
        await expect(inDegreeElement).toBeVisible();
        await expect(outDegreeElement).toBeVisible();

        // Verify Instability is displayed
        const instabilityElement = page.locator('.info-item:has(.label:text("Instability:")) .value');
        await expect(instabilityElement).toBeVisible();
        const instabilityText = await instabilityElement.textContent();
        expect(instabilityText).toMatch(/^\d+\.\d+%$/); // Percentage format

        // Check instability coloring
        const instabilityClass = await instabilityElement.getAttribute('class');
        expect(instabilityClass).toMatch(/\b(stable|moderate|unstable)\b/);

        console.log(`✅ Enhanced metrics found for node ${nodeId}`);
        break;
      }

      // Close panel and try next node
      await page.click('.close-button');
    }

    if (!foundEnhancedMetrics) {
      console.log('ℹ️ No enhanced metrics available, testing fallback message');

      // Should show unavailable message
      const messageSection = page.locator('.section:has-text("ℹ️ Enhanced Metrics Unavailable")');
      if (await messageSection.isVisible()) {
        const messageText = await messageSection.textContent();
        expect(messageText).toContain('Enhanced Lakos metrics');
        expect(messageText).toContain('not available');
      }
    }
  });

  test('should display architecture quality indicators', async ({ page }) => {
    await page.waitForTimeout(3000);

    const nodeElements = await page.locator('[data-node-id]').all();

    for (const nodeElement of nodeElements.slice(0, 3)) {
      const nodeId = await nodeElement.getAttribute('data-node-id');
      if (!nodeId) continue;

      await selectNode(page, nodeId);

      // Check for quality section
      const qualitySection = page.locator('.section:has-text("🎯 Architecture Quality")');

      if (await qualitySection.isVisible()) {
        // Check for orphan warning
        const orphanWarning = qualitySection.locator('.info-item.warning:has-text("⚠️ Orphan Node:")');
        if (await orphanWarning.isVisible()) {
          console.log(`⚠️ Node ${nodeId} is an orphan`);
        }

        // Check for cycle warning
        const cycleWarning = qualitySection.locator('.info-item.error:has-text("🔄 In Cycle:")');
        if (await cycleWarning.isVisible()) {
          const cycleText = await cycleWarning.textContent();
          expect(cycleText).toContain('dependency cycle');
          console.log(`🔄 Node ${nodeId} is in a cycle`);
        }

        // Check for quality rating
        const qualityRating = qualitySection.locator('.info-item:has(.label:text("Quality Rating:")) .value');
        if (await qualityRating.isVisible()) {
          const ratingText = await qualityRating.textContent();
          expect(ratingText).toMatch(/^(🟢|🔵|🟡|🔴)\s+(Excellent|Good|Poor|Critical)$/);

          const ratingClass = await qualityRating.getAttribute('class');
          expect(ratingClass).toMatch(/quality-(excellent|good|poor|critical)/);

          console.log(`📊 Node ${nodeId} quality: ${ratingText}`);
        }

        break;
      }

      await page.click('.close-button');
    }
  });

  test('should display visual encoding information', async ({ page }) => {
    await page.waitForTimeout(3000);

    const nodeElements = await page.locator('[data-node-id]').all();

    for (const nodeElement of nodeElements.slice(0, 3)) {
      const nodeId = await nodeElement.getAttribute('data-node-id');
      if (!nodeId) continue;

      await selectNode(page, nodeId);

      // Check for visual encoding section
      const visualSection = page.locator('.section:has-text("🎨 Visual Encoding")');

      if (await visualSection.isVisible()) {
        // Check size factor
        const sizeFactorElement = visualSection.locator('.info-item:has(.label:text("Size Factor:")) .value');
        if (await sizeFactorElement.isVisible()) {
          const sizeText = await sizeFactorElement.textContent();
          expect(sizeText).toMatch(/^\d+\.\d+x$/);
        }

        // Check SLOC vs Average
        const slocComparisonElement = visualSection.locator('.info-item:has(.label:text("SLOC vs Average:")) .value');
        if (await slocComparisonElement.isVisible()) {
          const comparisonText = await slocComparisonElement.textContent();
          expect(comparisonText).toMatch(/^\d+% of average$/);
        }

        // Check color hue with visual indicator
        const colorHueElement = visualSection.locator('.info-item:has(.label:text("Color Hue:")) .value');
        if (await colorHueElement.isVisible()) {
          const colorIndicator = colorHueElement.locator('.color-indicator');
          await expect(colorIndicator).toBeVisible();

          const hueText = await colorHueElement.textContent();
          expect(hueText).toMatch(/\d+°/);

          // Verify color indicator has proper styling
          const backgroundColor = await colorIndicator.evaluate(el => {
            return window.getComputedStyle(el).backgroundColor;
          });
          expect(backgroundColor).toMatch(/rgb\(\d+,\s*\d+,\s*\d+\)/);
        }

        console.log(`🎨 Visual encoding found for node ${nodeId}`);
        break;
      }

      await page.click('.close-button');
    }
  });

  test('should display context metrics and project information', async ({ page }) => {
    await page.waitForTimeout(3000);

    const nodeElements = await page.locator('[data-node-id]').all();

    for (const nodeElement of nodeElements.slice(0, 3)) {
      const nodeId = await nodeElement.getAttribute('data-node-id');
      if (!nodeId) continue;

      await selectNode(page, nodeId);

      // Check for context metrics section
      const contextSection = page.locator('.section:has-text("📊 Context Metrics")');

      if (await contextSection.isVisible()) {
        // Check project total SLOC
        const totalSlocElement = contextSection.locator('.info-item:has(.label:text("Project Total SLOC:")) .value');
        if (await totalSlocElement.isVisible()) {
          const totalText = await totalSlocElement.textContent();
          expect(totalText).toMatch(/^\d{1,3}(,\d{3})*$/);
        }

        // Check project average SLOC
        const avgSlocElement = contextSection.locator('.info-item:has(.label:text("Project Average SLOC:")) .value');
        if (await avgSlocElement.isVisible()) {
          const avgText = await avgSlocElement.textContent();
          expect(avgText).toMatch(/^\d{1,3}(,\d{3})*$/);
        }

        // Check file's share percentage
        const shareElement = contextSection.locator('.info-item:has(.label:text("This File\'s Share:")) .value');
        if (await shareElement.isVisible()) {
          const shareText = await shareElement.textContent();
          expect(shareText).toMatch(/^\d+\.\d+%$/);
        }

        // Check project quality score
        const qualityScoreElement = contextSection.locator('.info-item:has(.label:text("Project Quality Score:")) .value');
        if (await qualityScoreElement.isVisible()) {
          const scoreText = await qualityScoreElement.textContent();
          expect(scoreText).toBeTruthy();

          // Should contain percentage if available
          if (scoreText.includes('(') && scoreText.includes('%)')) {
            expect(scoreText).toMatch(/\(\d+%\)$/);
          }
        }

        console.log(`📊 Context metrics found for node ${nodeId}`);
        break;
      }

      await page.click('.close-button');
    }
  });

  test('should display detailed dependency lists', async ({ page }) => {
    await page.waitForTimeout(2000);

    const nodeElements = await page.locator('[data-node-id]').all();

    for (const nodeElement of nodeElements.slice(0, 5)) {
      const nodeId = await nodeElement.getAttribute('data-node-id');
      if (!nodeId) continue;

      await selectNode(page, nodeId);

      // Check for dependencies section
      const depsSection = page.locator('.section:has-text("🔗 Dependencies")');

      if (await depsSection.isVisible()) {
        // Check incoming dependencies
        const incomingSection = depsSection.locator('.dependency-section:has(h5:text-matches("← Incoming"))');
        if (await incomingSection.isVisible()) {
          const incomingItems = incomingSection.locator('.dependency-item.incoming');
          const incomingCount = await incomingItems.count();

          for (let i = 0; i < Math.min(3, incomingCount); i++) {
            const item = incomingItems.nth(i);

            // Should have source file
            const sourceFile = item.locator('.dependency-file');
            await expect(sourceFile).toBeVisible();
            const sourceText = await sourceFile.textContent();
            expect(sourceText).toBeTruthy();

            // Should have relationship type
            const relType = item.locator('.dependency-type');
            await expect(relType).toBeVisible();
            const typeText = await relType.textContent();
            expect(typeText).toBeTruthy();

            // Should have proper styling
            const hasIncomingClass = await item.evaluate(el => el.classList.contains('incoming'));
            expect(hasIncomingClass).toBe(true);
          }

          console.log(`📥 Found ${incomingCount} incoming dependencies for ${nodeId}`);
        }

        // Check outgoing dependencies
        const outgoingSection = depsSection.locator('.dependency-section:has(h5:text-matches("→ Outgoing"))');
        if (await outgoingSection.isVisible()) {
          const outgoingItems = outgoingSection.locator('.dependency-item.outgoing');
          const outgoingCount = await outgoingItems.count();

          for (let i = 0; i < Math.min(3, outgoingCount); i++) {
            const item = outgoingItems.nth(i);

            // Should have target file
            const targetFile = item.locator('.dependency-file');
            await expect(targetFile).toBeVisible();

            // Should have relationship type
            const relType = item.locator('.dependency-type');
            await expect(relType).toBeVisible();

            // Should have proper styling
            const hasOutgoingClass = await item.evaluate(el => el.classList.contains('outgoing'));
            expect(hasOutgoingClass).toBe(true);
          }

          console.log(`📤 Found ${outgoingCount} outgoing dependencies for ${nodeId}`);
        }

        // Check for "more" indicator if there are many dependencies
        const moreIndicator = depsSection.locator('.more-indicator');
        if (await moreIndicator.isVisible()) {
          const moreText = await moreIndicator.textContent();
          expect(moreText).toMatch(/\.\.\. and \d+ more/);
        }

        break;
      }

      await page.click('.close-button');
    }
  });

  test('should handle panel close and keyboard navigation', async ({ page }) => {
    const firstNode = page.locator('[data-node-id]').first();
    const nodeId = await firstNode.getAttribute('data-node-id');
    if (!nodeId) return;

    // Open panel
    await selectNode(page, nodeId);
    await expect(page.locator('.node-details-panel')).toBeVisible();

    // Test close button
    await page.click('.close-button');
    await expect(page.locator('.node-details-panel')).not.toBeVisible();

    // Open again
    await selectNode(page, nodeId);
    await expect(page.locator('.node-details-panel')).toBeVisible();

    // Test escape key
    await page.keyboard.press('Escape');
    // Note: Escape handling depends on implementation
    // This test may need adjustment based on actual keyboard handling

    // Test panel scrolling if content is long
    const panelContent = page.locator('.panel-content');
    if (await panelContent.isVisible()) {
      const scrollHeight = await panelContent.evaluate(el => el.scrollHeight);
      const clientHeight = await panelContent.evaluate(el => el.clientHeight);

      if (scrollHeight > clientHeight) {
        // Test scrolling
        await panelContent.hover();
        await page.wheel(0, 100);
        await page.waitForTimeout(100);
        console.log('✅ Panel content is scrollable');
      }
    }
  });

  test('should maintain panel position and sizing across different nodes', async ({ page }) => {
    const nodeElements = await page.locator('[data-node-id]').all();
    const panelPositions = [];

    // Test multiple nodes
    for (let i = 0; i < Math.min(3, nodeElements.length); i++) {
      const nodeId = await nodeElements[i].getAttribute('data-node-id');
      if (!nodeId) continue;

      await selectNode(page, nodeId);

      const panel = page.locator('.node-details-panel');
      const panelBox = await panel.boundingBox();

      if (panelBox) {
        panelPositions.push({
          nodeId,
          x: panelBox.x,
          y: panelBox.y,
          width: panelBox.width,
          height: panelBox.height
        });

        console.log(`📍 Panel for ${nodeId}: ${panelBox.width}x${panelBox.height} at (${panelBox.x}, ${panelBox.y})`);
      }

      await page.click('.close-button');
    }

    // Panel should maintain consistent positioning
    if (panelPositions.length >= 2) {
      const firstPos = panelPositions[0];
      const secondPos = panelPositions[1];

      // Position should be similar (allowing for content-based height changes)
      expect(Math.abs(firstPos.x - secondPos.x)).toBeLessThan(10);
      expect(Math.abs(firstPos.y - secondPos.y)).toBeLessThan(50); // Allow for height differences

      // Width should be consistent
      expect(Math.abs(firstPos.width - secondPos.width)).toBeLessThan(20);
    }
  });

});