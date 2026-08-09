import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Audis E2E Tests', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'development' }
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    
    // Create screenshot dir if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(path.resolve(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.resolve(__dirname, 'screenshots'));
    }
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should complete the full export flow', async () => {
    // 1. Drop/Set the main.mp3 file
    const mainPath = path.resolve(__dirname, '../../test-assets/main.mp3');
    await window.setInputFiles('input[type="file"]', mainPath);
    
    // Check if Waveform loaded
    await expect(window.locator('text=Interactive Region')).toBeVisible({ timeout: 10000 });
    await window.screenshot({ path: path.resolve(__dirname, 'screenshots/1-waveform-loaded.png') });
    
    // 2. Open Settings
    await window.click('button:has-text("Settings")');
    await expect(window.locator('form')).toBeVisible();
    await window.screenshot({ path: path.resolve(__dirname, 'screenshots/2-settings-modal.png') });

    // 3. Set intro.mp3 and outro.mp3 paths
    const introPath = path.resolve(__dirname, '../../test-assets/intro.mp3');
    const outroPath = path.resolve(__dirname, '../../test-assets/outro.mp3');
    const outputDir = path.resolve(__dirname, '../../test-assets');

    // Fill the paths
    await window.fill('input[placeholder*="Theme.wav"]', introPath);
    await window.fill('input[placeholder*="EndingJingle"]', outroPath);
    await window.fill('input[placeholder="Select export folder"]', outputDir);

    // 4. Save settings
    await window.click('button:has-text("Save Settings")');
    await expect(window.locator('text=Saved!')).toBeVisible();
    
    // Close Settings
    await window.click('button:has-text("Cancel")');
    await expect(window.locator('form')).toBeHidden();

    // 5. Verify the Export button is enabled
    const exportButton = window.locator('button:has-text("Export Final Audio")');
    await expect(exportButton).toBeEnabled();
    await window.screenshot({ path: path.resolve(__dirname, 'screenshots/3-ready-to-export.png') });

    // 6. Click Export
    await exportButton.click();

    // 7. Wait for success state
    await expect(window.locator('text=Export Complete!')).toBeVisible({ timeout: 30000 });
    await window.screenshot({ path: path.resolve(__dirname, 'screenshots/4-export-complete.png') });
  });
});
