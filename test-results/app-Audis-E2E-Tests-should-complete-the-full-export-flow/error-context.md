# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.js >> Audis E2E Tests >> should complete the full export flow
- Location: tests\e2e\app.spec.js:35:3

# Error details

```
Error: electron.launch: Electron failed to install correctly, please delete node_modules/electron and try installing again
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { _electron as electron } from 'playwright';
  3  | import path from 'path';
  4  | import { fileURLToPath } from 'url';
  5  | 
  6  | const __filename = fileURLToPath(import.meta.url);
  7  | const __dirname = path.dirname(__filename);
  8  | 
  9  | test.describe('Audis E2E Tests', () => {
  10 |   let electronApp;
  11 |   let window;
  12 | 
  13 |   test.beforeAll(async () => {
  14 |     // Launch Electron app
> 15 |     electronApp = await electron.launch({
     |                   ^ Error: electron.launch: Electron failed to install correctly, please delete node_modules/electron and try installing again
  16 |       args: ['.'],
  17 |       env: { ...process.env, NODE_ENV: 'development' }
  18 |     });
  19 |     window = await electronApp.firstWindow();
  20 |     await window.waitForLoadState('domcontentloaded');
  21 |     
  22 |     // Create screenshot dir if it doesn't exist
  23 |     const fs = require('fs');
  24 |     if (!fs.existsSync(path.resolve(__dirname, 'screenshots'))) {
  25 |       fs.mkdirSync(path.resolve(__dirname, 'screenshots'));
  26 |     }
  27 |   });
  28 | 
  29 |   test.afterAll(async () => {
  30 |     if (electronApp) {
  31 |       await electronApp.close();
  32 |     }
  33 |   });
  34 | 
  35 |   test('should complete the full export flow', async () => {
  36 |     // 1. Drop/Set the main.mp3 file
  37 |     const mainPath = path.resolve(__dirname, '../../test-assets/main.mp3');
  38 |     await window.setInputFiles('input[type="file"]', mainPath);
  39 |     
  40 |     // Check if Waveform loaded
  41 |     await expect(window.locator('text=Interactive Region')).toBeVisible({ timeout: 10000 });
  42 |     await window.screenshot({ path: path.resolve(__dirname, 'screenshots/1-waveform-loaded.png') });
  43 |     
  44 |     // 2. Open Settings
  45 |     await window.click('button:has-text("Settings")');
  46 |     await expect(window.locator('form')).toBeVisible();
  47 |     await window.screenshot({ path: path.resolve(__dirname, 'screenshots/2-settings-modal.png') });
  48 | 
  49 |     // 3. Set intro.mp3 and outro.mp3 paths
  50 |     const introPath = path.resolve(__dirname, '../../test-assets/intro.mp3');
  51 |     const outroPath = path.resolve(__dirname, '../../test-assets/outro.mp3');
  52 |     const outputDir = path.resolve(__dirname, '../../test-assets');
  53 | 
  54 |     // Fill the paths
  55 |     await window.fill('input[placeholder*="Theme.wav"]', introPath);
  56 |     await window.fill('input[placeholder*="EndingJingle"]', outroPath);
  57 |     await window.fill('input[placeholder="Select export folder"]', outputDir);
  58 | 
  59 |     // 4. Save settings
  60 |     await window.click('button:has-text("Save Settings")');
  61 |     await expect(window.locator('text=Saved!')).toBeVisible();
  62 |     
  63 |     // Close Settings
  64 |     await window.click('button:has-text("Cancel")');
  65 |     await expect(window.locator('form')).toBeHidden();
  66 | 
  67 |     // 5. Verify the Export button is enabled
  68 |     const exportButton = window.locator('button:has-text("Export Final Audio")');
  69 |     await expect(exportButton).toBeEnabled();
  70 |     await window.screenshot({ path: path.resolve(__dirname, 'screenshots/3-ready-to-export.png') });
  71 | 
  72 |     // 6. Click Export
  73 |     await exportButton.click();
  74 | 
  75 |     // 7. Wait for success state
  76 |     await expect(window.locator('text=Export Complete!')).toBeVisible({ timeout: 30000 });
  77 |     await window.screenshot({ path: path.resolve(__dirname, 'screenshots/4-export-complete.png') });
  78 |   });
  79 | });
  80 | 
```