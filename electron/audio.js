/**
 * audio.js — Audis core audio processing pipeline
 *
 * Supports:
 *   - Optional intro/outro (4-mode filter_complex)
 *   - Multi-segment cuts (complement → keepSegments, spliced with acrossfade)
 *   - Stream normalization before concat (aresample+aformat on every input)
 *   - Safe fade clamping (fadeDuration ≤ segmentDur/2)
 *   - Loudness normalization when no intro/outro (loudnorm=I=-16:TP=-1.5:LRA=11)
 *   - Collision-safe output filenames (padded index + slugified title)
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { copyMetadataToOutput } from './metadata.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the duration of an audio file in seconds using ffprobe.
 * @param {string} filePath
 * @returns {Promise<number>}
 */
export function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const duration = metadata?.format?.duration
      if (typeof duration !== 'number') {
        return reject(new Error(`Could not determine duration of: ${filePath}`))
      }
      resolve(duration)
    })
  })
}

/**
 * Repair/Transcode broken audio files (Failsafe for AAC/M4A/Corrupt containers).
 * @param {string} filePath
 * @returns {Promise<{repairedPath: string, format: string}>}
 */
export async function repairAudioFile(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`))
    }

    const tmpWavPath = path.join(os.tmpdir(), `audis-repaired-${Date.now()}.wav`)

    // Transcode to standard PCM WAV with error resilience to bypass corrupt frames
    ffmpeg(filePath)
      .inputOptions(['-err_detect', 'ignore_err', '-fflags', '+genpts+discardcorrupt'])
      .outputOptions(['-max_error_rate', '1.0'])
      .toFormat('wav')
      .audioCodec('pcm_s16le')
      .save(tmpWavPath)
      .on('end', () => resolve({ repairedPath: tmpWavPath, format: 'audio/wav' }))
      .on('error', (err) => {
        console.warn('[Audis FFmpeg WAV Repair failed, trying MP3]', err.message)
        const tmpMp3Path = path.join(os.tmpdir(), `audis-repaired-${Date.now()}.mp3`)
        ffmpeg(filePath)
          .inputOptions(['-err_detect', 'ignore_err', '-fflags', '+genpts+discardcorrupt'])
          .outputOptions(['-max_error_rate', '1.0'])
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .save(tmpMp3Path)
          .on('end', () => resolve({ repairedPath: tmpMp3Path, format: 'audio/mpeg' }))
          .on('error', (err2) => reject(new Error(`Repair failed: ${err2.message}`)))
      })
  })
}

/**
 * Derive a filesystem-safe slug from a human-readable title.
 * Replaces every run of non-alphanumeric characters with a single underscore
 * and strips leading/trailing underscores.
 * @param {string} title
 * @returns {string}
 */
function slugify(title) {
  return String(title)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'output'
}

/**
 * Build a collision-safe output path honoring batchNamingPattern.
 * Tokens supported: {index}, {title}, {original}, {date}
 * If the file already exists an incrementing suffix (_1, _2, …) is appended.
 *
 * @param {string} outputDir
 * @param {number} index
 * @param {string} slug
 * @param {string} ext
 * @param {string} [pattern='{index}_{title}']
 * @param {string} [originalSlug='audio']
 * @returns {string}
 */
function buildOutputPath(outputDir, index, slug, ext, pattern = '{index}_{title}', originalSlug = 'audio') {
  const prefix = String(index).padStart(2, '0')
  const today  = new Date().toISOString().slice(0, 10)
  const rawName = (pattern || '{index}_{title}')
    .replace(/\{index\}/gi, prefix)
    .replace(/\{title\}/gi, slug)
    .replace(/\{original\}/gi, originalSlug)
    .replace(/\{date\}/gi, today)
  const baseName = slugify(rawName)

  let candidate = path.join(outputDir, `${baseName}.${ext}`)
  let n = 1
  while (fs.existsSync(candidate)) {
    candidate = path.join(outputDir, `${baseName}_${n}.${ext}`)
    n++
  }
  return candidate
}

/**
 * Apply the correct FFmpeg audio codec settings to a fluent-ffmpeg instance.
 * @param {object} ff  — fluent-ffmpeg command
 * @param {string} ext — output format extension
 */
function applyCodec(ff, ext) {
  if (ext === 'mp3') {
    ff.audioCodec('libmp3lame').audioBitrate('320k')
  } else if (ext === 'wav') {
    ff.audioCodec('pcm_s16le')
  } else if (ext === 'aac' || ext === 'm4a') {
    ff.audioCodec('aac').audioBitrate('320k')
  } else if (ext === 'flac') {
    ff.audioCodec('flac')
  } else if (ext === 'ogg') {
    ff.audioCodec('libvorbis').audioQuality(6)
  } else {
    ff.audioCodec('libmp3lame').audioBitrate('320k')
  }
}

// ─── Core pipeline ────────────────────────────────────────────────────────────

/**
 * Core audio processing pipeline.
 *
 * Modes (intro/outro combinations):
 *   A — both     : [intro_norm][main_joined][outro_norm]concat=n=3:v=0:a=1[output]
 *   B — intro only: [intro_norm][main_joined]concat=n=2:v=0:a=1[output]
 *   C — outro only: [main_joined][outro_norm]concat=n=2:v=0:a=1[output]
 *   D — neither  : [main_joined]loudnorm=I=-16:TP=-1.5:LRA=11[output]
 *
 * @param {object}   opts
 * @param {string}   opts.mainPath          — required: path to main audio file
 * @param {number}   [opts.startTime]       — legacy: crop start (seconds)
 * @param {number}   [opts.endTime]         — legacy: crop end (seconds)
 * @param {Array}    [opts.cuts]            — sections to REMOVE: [{start, end, postPauseSec?}]
 * @param {string}   [opts.suggestedTitle]  — used to build the output filename slug
 * @param {number}   [opts.fileIndex=0]     — 2-digit numeric prefix for the output filename
 * @param {string}   [opts.introPath]       — path to intro file (or null)
 * @param {string}   [opts.outroPath]       — path to outro file (or null)
 * @param {boolean}  [opts.useIntro]        — whether to include the intro
 * @param {boolean}  [opts.useOutro]        — whether to include the outro
 * @param {string}   opts.outputDir         — directory to write the output file
 * @param {string}   [opts.exportFormat]    — 'mp3'|'wav'|'aac'|'flac'|'m4a'|'ogg'|'original'
 * @param {number}   [opts.fadeDuration=2]  — crossfade/fade duration in seconds
 * @param {Function} [opts.onProgress]      — progress callback: ({percent, timemark}) => void
 * @returns {Promise<{success: boolean, outputPath: string}>}
 */
export async function processAudio({
  mainPath,
  // Legacy crop (used when cuts is empty/undefined):
  startTime,
  endTime,
  // New multi-segment cuts:
  cuts,
  suggestedTitle,
  fileIndex = 0,
  // Intro/Outro:
  introPath,
  outroPath,
  useIntro,
  useOutro,
  outputDir,
  exportFormat = 'original',
  fadeDuration = 2,
  loudnormEnabled = true,
  batchNamingPattern = '{index}_{title}',
  onProgress = () => {},
}) {

  // ── Validation ────────────────────────────────────────────────────────────

  if (!mainPath || !fs.existsSync(mainPath)) {
    throw new Error(`Main audio file not found: ${mainPath}`)
  }

  // Resolve boolean intent for intro/outro (default to presence of a valid path)
  const wantIntro = typeof useIntro === 'boolean'
    ? useIntro
    : !!(introPath && fs.existsSync(introPath))
  const wantOutro = typeof useOutro === 'boolean'
    ? useOutro
    : !!(outroPath && fs.existsSync(outroPath))

  if (wantIntro) {
    if (!introPath || !fs.existsSync(introPath)) {
      throw new Error(`Intro file not found: ${introPath}`)
    }
  }
  if (wantOutro) {
    if (!outroPath || !fs.existsSync(outroPath)) {
      throw new Error(`Outro file not found: ${outroPath}`)
    }
  }

  // ── Output path setup ─────────────────────────────────────────────────────

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  let ext = exportFormat === 'original'
    ? path.extname(mainPath).toLowerCase().replace('.', '') || 'mp3'
    : exportFormat
  if (!['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'].includes(ext)) ext = 'mp3'

  // Build slug: use suggestedTitle if provided, else a timestamp fallback
  const originalSlug = slugify(path.basename(mainPath, path.extname(mainPath)))
  const slug = suggestedTitle
    ? slugify(suggestedTitle)
    : `output_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`

  const outputPath = buildOutputPath(outputDir, fileIndex, slug, ext, batchNamingPattern, originalSlug)

  // ── Probe main audio ──────────────────────────────────────────────────────

  const mainTotalDuration = await getAudioDuration(mainPath)

  // ── Compute keep segments ─────────────────────────────────────────────────
  //
  // cuts[] describes sections to REMOVE.
  // keepSegments[] = the complement (sections to keep).
  //
  // Legacy support: when cuts is empty/undefined, fall back to [startTime, endTime]
  // as the single keep region.

  let keepSegments // Array of {start, end}

  const enabledCuts = Array.isArray(cuts)
    ? cuts.filter(c => c && c.enabled !== false)
    : []

  if (enabledCuts.length > 0) {
    // Sort cuts by start time, clamp to [0, mainTotalDuration], and honor postPauseSec
    const sorted = enabledCuts
      .map(c => {
        const rawStart = Math.max(0, Number(c.start) || 0)
        const rawEnd   = Math.min(mainTotalDuration, Number(c.end) || 0)
        const pause    = Math.max(0, Number(c.postPauseSec) || 0)
        const rawLen   = rawEnd - rawStart

        // If shortening a pause rather than removing completely, preserve half the
        // target pause at each side so natural room tone bridges the splice.
        if (pause > 0 && rawLen > pause) {
          const keepHalf = pause / 2
          return { start: rawStart + keepHalf, end: rawEnd - keepHalf }
        }
        return { start: rawStart, end: rawEnd }
      })
      .filter(c => c.end > c.start)
      .sort((a, b) => a.start - b.start)

    // Merge overlapping cuts before computing complement
    const mergedCuts = []
    for (const cut of sorted) {
      const prev = mergedCuts[mergedCuts.length - 1]
      if (prev && cut.start <= prev.end + 0.05) {
        prev.end = Math.max(prev.end, cut.end)
      } else {
        mergedCuts.push({ ...cut })
      }
    }

    // Build complement: regions NOT cut (skip micro-fragments < 0.05s that break acrossfade)
    keepSegments = []
    let cursor = 0
    for (const cut of mergedCuts) {
      if (cut.start - cursor >= 0.05) {
        keepSegments.push({ start: cursor, end: cut.start })
      }
      cursor = Math.max(cursor, cut.end)
    }
    if (mainTotalDuration - cursor >= 0.05) {
      keepSegments.push({ start: cursor, end: mainTotalDuration })
    }
  } else {
    // Legacy path: treat startTime/endTime as the single keep region
    const s = typeof startTime === 'number' ? startTime : 0
    const e = typeof endTime   === 'number' ? endTime   : mainTotalDuration
    if (e <= s) {
      throw new Error(`Invalid crop range: start=${s} end=${e}`)
    }
    keepSegments = [{ start: s, end: e }]
  }

  if (keepSegments.length === 0) {
    throw new Error('No audio segments to keep after applying cuts.')
  }

  const FADE = Math.max(0, Number(fadeDuration) || 0)

  // ── Probe intro/outro durations ───────────────────────────────────────────

  let introDuration = 0
  let outroDuration = 0
  if (wantIntro) introDuration = await getAudioDuration(introPath)
  if (wantOutro) outroDuration = await getAudioDuration(outroPath)

  // ── Build filter_complex ──────────────────────────────────────────────────
  //
  // Input index assignments:
  //   0:a  = intro  (only if wantIntro)
  //   N:a  = main   (index = wantIntro ? 1 : 0)
  //   M:a  = outro  (only if wantOutro; index = mainInputIdx + 1)

  const filterParts = []

  const introInputIdx = 0
  const mainInputIdx  = wantIntro ? 1 : 0
  const outroInputIdx = mainInputIdx + 1  // only valid when wantOutro

  // Normalization shorthand used in every stream
  const NORM = `aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo`

  // — Build main segment filter chains —
  //
  // Each kept segment:
  //   [mainInputIdx:a]atrim=start=S:end=E,asetpts=PTS-STARTPTS,<NORM>[segI]
  //
  // Then reduce with acrossfade pairs:
  //   [seg0][seg1]acrossfade=d=0.02:c1=tri:c2=tri[joined01]
  //   [joined01][seg2]acrossfade=d=0.02:c1=tri:c2=tri[joined012]
  //   … → [main_joined]

  if (keepSegments.length === 1) {
    const seg = keepSegments[0]
    filterParts.push(
      `[${mainInputIdx}:a]atrim=start=${seg.start.toFixed(6)}:end=${seg.end.toFixed(6)},` +
      `asetpts=PTS-STARTPTS,${NORM}[main_joined]`
    )
  } else {
    // Emit one atrim chain per segment
    for (let i = 0; i < keepSegments.length; i++) {
      const seg = keepSegments[i]
      filterParts.push(
        `[${mainInputIdx}:a]atrim=start=${seg.start.toFixed(6)}:end=${seg.end.toFixed(6)},` +
        `asetpts=PTS-STARTPTS,${NORM}[seg${i}]`
      )
    }

    // Reduce segments with acrossfade
    // First pair: [seg0][seg1] → [joined01]
    // Subsequent: [joined0..N][segN+1] → [joined0..N+1]
    let prev = `[seg0]`
    for (let i = 1; i < keepSegments.length; i++) {
      const outLabel = i === keepSegments.length - 1
        ? `[main_joined]`
        : `[joined0${i}]`
      filterParts.push(
        `${prev}[seg${i}]acrossfade=d=0.02:c1=tri:c2=tri${outLabel}`
      )
      prev = outLabel
    }
  }

  // — Intro and outro normalization + fade chains —

  if (wantIntro) {
    const introFadeDur = Math.min(FADE, introDuration / 2)
    if (introFadeDur > 0.001) {
      const introFadeStart = Math.max(0, introDuration - introFadeDur).toFixed(6)
      filterParts.push(
        `[${introInputIdx}:a]${NORM},` +
        `afade=t=out:st=${introFadeStart}:d=${introFadeDur.toFixed(6)}[intro_norm]`
      )
    } else {
      filterParts.push(`[${introInputIdx}:a]${NORM}[intro_norm]`)
    }
  }

  if (wantOutro) {
    const outroClamped = Math.min(FADE, outroDuration / 2)
    if (outroClamped > 0.001) {
      filterParts.push(
        `[${outroInputIdx}:a]${NORM},` +
        `afade=t=in:st=0:d=${outroClamped.toFixed(6)}[outro_norm]`
      )
    } else {
      filterParts.push(`[${outroInputIdx}:a]${NORM}[outro_norm]`)
    }
  }

  // — Apply fade-in/fade-out to main_joined (safe clamping) —
  //
  // Subtract 0.02s overlap per acrossfade join when multiple segments are spliced.
  const crossfadeOverlap = Math.max(0, keepSegments.length - 1) * 0.02
  const rawMainDur   = keepSegments.reduce((acc, s) => acc + (s.end - s.start), 0)
  const totalMainDur = Math.max(0.05, rawMainDur - crossfadeOverlap)
  const mainFadeIn   = Math.min(FADE, totalMainDur / 2)
  const mainFadeOut  = Math.min(FADE, totalMainDur / 2)
  const mainFadeOutSt = Math.max(0, totalMainDur - mainFadeOut).toFixed(6)

  if (mainFadeIn > 0.001 && mainFadeOut > 0.001) {
    filterParts.push(
      `[main_joined]afade=t=in:st=0:d=${mainFadeIn.toFixed(6)},` +
      `afade=t=out:st=${mainFadeOutSt}:d=${mainFadeOut.toFixed(6)}[main_faded]`
    )
  } else {
    filterParts.push(`[main_joined]anull[main_faded]`)
  }

  // — Concat stage (choose one of 4 modes) —

  let concatFilter
  if (wantIntro && wantOutro) {
    // Mode A: intro + main + outro
    concatFilter = `[intro_norm][main_faded][outro_norm]concat=n=3:v=0:a=1[output]`
  } else if (wantIntro) {
    // Mode B: intro + main
    concatFilter = `[intro_norm][main_faded]concat=n=2:v=0:a=1[output]`
  } else if (wantOutro) {
    // Mode C: main + outro
    concatFilter = `[main_faded][outro_norm]concat=n=2:v=0:a=1[output]`
  } else {
    // Mode D: main only — apply loudnorm when enabled for consistent voice volume
    concatFilter = loudnormEnabled
      ? `[main_faded]loudnorm=I=-16:TP=-1.5:LRA=11[output]`
      : `[main_faded]anull[output]`
  }

  filterParts.push(concatFilter)

  const filterComplex = filterParts.join(';')

  // ── Build the FFmpeg command ───────────────────────────────────────────────

  return new Promise((resolve, reject) => {
    const ff = ffmpeg()
    const resilientInputOpts = ['-err_detect', 'ignore_err', '-fflags', '+genpts+discardcorrupt']

    // Add inputs in index order, attaching inputOptions after each input
    if (wantIntro) ff.input(introPath).inputOptions(resilientInputOpts)
    ff.input(mainPath).inputOptions(resilientInputOpts)
    if (wantOutro) ff.input(outroPath).inputOptions(resilientInputOpts)

    ff.complexFilter(filterComplex)
      .outputOptions(['-map [output]', '-max_error_rate', '1.0'])

    applyCodec(ff, ext)

    ff.save(outputPath)
      .on('progress', (progress) => {
        const pct = progress.percent ? Math.round(progress.percent) : 0
        onProgress({ percent: pct, timemark: progress.timemark })
      })
      .on('end', async () => {
        await copyMetadataToOutput(mainPath, outputPath, {
          title: suggestedTitle || undefined,
        })
        resolve({ success: true, outputPath })
      })
      .on('error', (err) => reject(new Error(err.message)))
  })
}
