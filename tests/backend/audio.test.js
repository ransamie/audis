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

  // Shared asset paths used across multiple tests
  let mainPath, introPath, outroPath

  beforeAll(() => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    mainPath  = path.join(assetsDir, 'main.mp3')
    introPath = path.join(assetsDir, 'intro.mp3')
    outroPath = path.join(assetsDir, 'outro.mp3')
  })

  // ── Original test ────────────────────────────────────────────────────────────
  it('should successfully stitch intro, main, and outro together', async () => {
    const result = await processAudio({
      mainPath,
      startTime: 0,
      endTime: 1, // small duration for faster test
      introPath,
      outroPath,
      useIntro: true,
      useOutro: true,
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

  // ── New tests ─────────────────────────────────────────────────────────────────

  // 1. Intro-only stitching
  it('should stitch intro + main (no outro)', async () => {
    const result = await processAudio({
      mainPath, startTime: 0, endTime: 1,
      introPath, outroPath: null,
      useIntro: true, useOutro: false,
      outputDir, exportFormat: 'mp3', fadeDuration: 0.1,
    })
    expect(result.success).toBe(true)
    expect(fs.existsSync(result.outputPath)).toBe(true)
    fs.unlinkSync(result.outputPath)
  }, 30000)

  // 2. Outro-only stitching
  it('should stitch main + outro (no intro)', async () => {
    const result = await processAudio({
      mainPath, startTime: 0, endTime: 1,
      introPath: null, outroPath,
      useIntro: false, useOutro: true,
      outputDir, exportFormat: 'mp3', fadeDuration: 0.1,
    })
    expect(result.success).toBe(true)
    expect(fs.existsSync(result.outputPath)).toBe(true)
    fs.unlinkSync(result.outputPath)
  }, 30000)

  // 3. Voice message only (no intro, no outro) — loudnorm applied
  it('should export voice note only (no intro, no outro) with loudnorm', async () => {
    const result = await processAudio({
      mainPath, startTime: 0, endTime: 1,
      introPath: null, outroPath: null,
      useIntro: false, useOutro: false,
      outputDir, exportFormat: 'mp3', fadeDuration: 0.1,
    })
    expect(result.success).toBe(true)
    expect(fs.existsSync(result.outputPath)).toBe(true)
    // No FFmpeg error means result.error is falsy
    expect(result.error).toBeFalsy()
    fs.unlinkSync(result.outputPath)
  }, 30000)

  // 4. Multi-cut splicing — removes a section from the middle
  it('should splice out a cut from the middle of main audio', async () => {
    // Cut from 0.3s to 0.6s (remove middle 0.3s of a 1s clip)
    const result = await processAudio({
      mainPath,
      cuts: [{ id: 'cut-1', start: 0.3, end: 0.6, postPauseSec: 0 }],
      useIntro: false, useOutro: false,
      outputDir, exportFormat: 'mp3', fadeDuration: 0.05,
    })
    expect(result.success).toBe(true)
    expect(fs.existsSync(result.outputPath)).toBe(true)
    // Verify the output is shorter than the original 1s clip
    await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(result.outputPath, (err, metadata) => {
        if (err) return reject(err)
        const duration = metadata.format.duration
        // Original 1s minus ~0.3s cut → should be less than 0.9s
        expect(duration).toBeLessThan(0.9)
        resolve()
      })
    })
    fs.unlinkSync(result.outputPath)
  }, 30000)

  // 5. Collision-safe filename with fileIndex + suggestedTitle
  it('should use suggestedTitle and fileIndex in output filename', async () => {
    const result = await processAudio({
      mainPath, startTime: 0, endTime: 1,
      introPath, outroPath, useIntro: true, useOutro: true,
      outputDir, exportFormat: 'mp3', fadeDuration: 0.1,
      fileIndex: 7, suggestedTitle: 'Sunday Sermon',
    })
    expect(result.success).toBe(true)
    // Filename should contain zero-padded index and slugified title
    expect(result.outputPath).toMatch(/07_Sunday_Sermon/)
    if (fs.existsSync(result.outputPath)) fs.unlinkSync(result.outputPath)
  }, 30000)

  // 6. OGG (Ogg Vorbis) export and input round-trip
  it('should export OGG Vorbis and accept .ogg input with original format', async () => {
    const oggRes = await processAudio({
      mainPath, startTime: 0, endTime: 1,
      useIntro: false, useOutro: false,
      outputDir, exportFormat: 'ogg', fadeDuration: 0.1,
      suggestedTitle: 'Ogg Export',
    })
    expect(oggRes.success).toBe(true)
    expect(oggRes.outputPath.endsWith('.ogg')).toBe(true)
    expect(fs.existsSync(oggRes.outputPath)).toBe(true)

    const origRes = await processAudio({
      mainPath: oggRes.outputPath,
      useIntro: false, useOutro: false,
      outputDir, exportFormat: 'original', fadeDuration: 0.05,
      suggestedTitle: 'Ogg Roundtrip',
    })
    expect(origRes.success).toBe(true)
    expect(origRes.outputPath.endsWith('.ogg')).toBe(true)

    if (fs.existsSync(oggRes.outputPath)) fs.unlinkSync(oggRes.outputPath)
    if (fs.existsSync(origRes.outputPath)) fs.unlinkSync(origRes.outputPath)
  }, 30000)
})
