import { describe, it, expect } from 'vitest'
import { getPeaks, detectSilences, planEdits, snapToSilence } from '../../electron/analyzer.js'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

ffmpeg.setFfmpegPath(ffmpegStatic)
ffmpeg.setFfprobePath(ffprobeStatic.path)

describe('Analyzer Utility', () => {
  const testFile = path.resolve('public/assets/intro.mp3')

  describe('getPeaks', () => {
    it('should return 500 peak values', async () => {
      const peaks = await getPeaks(testFile, 500)
      expect(peaks).toHaveLength(500)
      expect(peaks[0]).toBeGreaterThanOrEqual(0)
      expect(peaks[0]).toBeLessThanOrEqual(1)
    }, 15000)

    it('should return fewer peaks when samples param is lower', async () => {
      const peaks = await getPeaks(testFile, 100)
      expect(peaks).toHaveLength(100)
    }, 15000)
  })

  describe('detectSilences', () => {
    it('should return an array of silence intervals', async () => {
      const silences = await detectSilences(testFile)
      expect(Array.isArray(silences)).toBe(true)
      // May be empty for a short music file — just verify shape of each item
      silences.forEach(s => {
        expect(s).toHaveProperty('start')
        expect(s).toHaveProperty('end')
        expect(s).toHaveProperty('duration')
        expect(s.start).toBeLessThan(s.end)
      })
    }, 15000)
  })

  describe('planEdits (DSP-only mode)', () => {
    it('should return cuts, useIntro, useOutro, suggestedTitle', async () => {
      // Lower threshold so we reliably find at least some silences in a short test file
      const silences = await detectSilences(testFile, { noisedB: -20, minDuration: 0.1 })
      const plan = await planEdits({
        filePath: testFile,
        duration: 3.5, // approx duration of test file
        silences,
        transcript: null,
        settings: {
          aiMode: 'offline',
          defaultIntroOutro: 'on',
          minPauseDuration: 0.6,
          targetPauseSec: 0.35,
        },
      })
      expect(plan).toHaveProperty('cuts')
      expect(plan).toHaveProperty('useIntro')
      expect(plan).toHaveProperty('useOutro')
      expect(plan).toHaveProperty('suggestedTitle')
      expect(Array.isArray(plan.cuts)).toBe(true)
      expect(typeof plan.useIntro).toBe('boolean')
    }, 15000)

    it('should snap cuts to silence boundaries', () => {
      // Synthetic silence data: two distinct silence windows
      const silences = [
        { start: 1.0, end: 1.5, duration: 0.5 },
        { start: 3.0, end: 3.8, duration: 0.8 },
      ]

      // A proposed cut whose boundaries sit within 80 ms of a silence edge.
      // After snapping: start → 1.0, end → 1.5
      const proposedCut = {
        id: 'x',
        start: 1.05,
        end: 1.45,
        reason: 'long_pause',
        confidence: 0.8,
        enabled: true,
      }

      const snapped = snapToSilence(proposedCut, silences, 0.08)
      expect(snapped.start).toBeCloseTo(1.0, 2)
      expect(snapped.end).toBeCloseTo(1.5, 2)
    })
  })
})
