import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

test.describe('Audis E2E Tests', () => {
  let electronApp
  let window

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'development' },
    })
    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    const ssDir = path.resolve(__dirname, 'screenshots')
    if (!fs.existsSync(ssDir)) {
      fs.mkdirSync(ssDir, { recursive: true })
    }
  })

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close()
    }
  })

  test('should complete the DAW batch analyze and export flow', async () => {
    const mainPath  = path.resolve(__dirname, '../../test-assets/main.mp3')
    const introPath = path.resolve(__dirname, '../../test-assets/intro.mp3')
    const outroPath = path.resolve(__dirname, '../../test-assets/outro.mp3')
    const outputDir = path.resolve(__dirname, '../../test-assets')

    // 1. Load main.mp3 into the batch dropzone
    await window.setInputFiles('input[type="file"]', mainPath)
    await expect(window.locator('text=Waveform Editor')).toBeVisible({ timeout: 10000 })

    // 2. Open Settings (<dialog>) and configure paths
    await window.click('button:has-text("Settings")')
    const settingsDialog = window.locator('dialog[open]')
    await expect(settingsDialog).toBeVisible()

    await settingsDialog.locator('input[name="introPath"]').fill(introPath)
    await settingsDialog.locator('input[name="outroPath"]').fill(outroPath)
    await settingsDialog.locator('input[name="outputDir"]').fill(outputDir)

    await settingsDialog.locator('button:has-text("Save Settings")').click()
    await expect(settingsDialog).toBeHidden({ timeout: 5000 })

    // 3. Wait for background analysis to finish so Approve & Next becomes enabled
    const approveBtn = window.locator('button:has-text("Approve & Next")')
    await expect(approveBtn).toBeEnabled({ timeout: 15000 })
    await approveBtn.click()

    // 4. Wait for export to finish (Done badge in Files Bin)
    await expect(window.locator('text=1/1 Exported')).toBeVisible({ timeout: 30000 })
  })
})
