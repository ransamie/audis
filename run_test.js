import { processAudio } from './electron/audio.js'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runTest() {
  console.log('Running test...')
  const assetsDir = path.resolve(__dirname, 'test-assets')
  const outputDir = path.join(os.tmpdir(), 'audis-tests-manual')

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const mainPath = path.join(assetsDir, 'main.mp3')
  const introPath = path.join(assetsDir, 'intro.mp3')
  const outroPath = path.join(assetsDir, 'outro.mp3')

  try {
    const result = await processAudio({
      mainPath,
      startTime: 0,
      endTime: 1, // small duration for faster test
      introPath,
      outroPath,
      outputDir,
      exportFormat: 'mp3',
      fadeDuration: 0.1, // short fade for short test clip
      onProgress: (p) => console.log('Progress:', p)
    })

    console.log('Result:', result)

    if (result && result.success && fs.existsSync(result.outputPath)) {
      console.log('TEST PASSED! Output file created at:', result.outputPath)
      fs.unlinkSync(result.outputPath)
    } else {
      console.error('TEST FAILED! Output file not created.')
      process.exit(1)
    }
  } catch (err) {
    console.error('TEST FAILED with error:', err)
    process.exit(1)
  }
}

runTest()
