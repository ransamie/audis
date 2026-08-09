import { describe, it, expect, beforeAll } from 'vitest'
import { processAudio } from '../../electron/audio.js'
import path from 'path'
import os from 'os'
import fs from 'fs'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

// Setup static paths for testing environment
ffmpeg.setFfmpegPath(ffmpegStatic)
ffmpeg.setFfprobePath(ffprobeStatic.path)

describe('Audio Processing Utility', () => {
  const assetsDir = path.resolve(__dirname, '../../test-assets')
  const outputDir = path.join(os.tmpdir(), 'audis-tests')

  beforeAll(() => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
  })

  it('should successfully stitch intro, main, and outro together', async () => {
    const mainPath = path.join(assetsDir, 'main.mp3')
    const introPath = path.join(assetsDir, 'intro.mp3')
    const outroPath = path.join(assetsDir, 'outro.mp3')

    const result = await processAudio({
      mainPath,
      startTime: 0,
      endTime: 1, // small duration for faster test
      introPath,
      outroPath,
      outputDir,
      exportFormat: 'mp3',
      fadeDuration: 0.1, // short fade for short test clip
    })

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.outputPath).toBeDefined()

    // Assert the output file actually exists on disk
    expect(fs.existsSync(result.outputPath)).toBe(true)
    
    // Cleanup the output file after test
    fs.unlinkSync(result.outputPath)
  }, 30000)
})
