/**
 * electron/analyzer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Audis — AI-Powered Audio Analysis Engine
 *
 * Pre-processes queued audio files to generate edit proposals before the user
 * ever interacts with them. Runs entirely in the Electron main process.
 *
 * NOTE: fluent-ffmpeg paths are set globally by main.js before this module is
 * called — do NOT call ffmpeg.setFfmpegPath / setFfprobePath here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs   from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

// ─── Types (JSDoc only) ────────────────────────────────────────────────────
/**
 * @typedef {{ start: number, end: number, duration: number }} SilenceInterval
 *
 * @typedef {{
 *   id:          string,
 *   start:       number,
 *   end:         number,
 *   reason:      string,
 *   confidence:  number,
 *   enabled:     boolean,
 *   postPauseSec?: number
 * }} Cut
 *
 * @typedef {{
 *   cuts:           Cut[],
 *   useIntro:       boolean,
 *   useOutro:       boolean,
 *   suggestedTitle: string,
 * }} EditPlan
 *
 * @typedef {{
 *   duration:       number,
 *   peaks:          number[],
 *   silences:       SilenceInterval[],
 *   cuts:           Cut[],
 *   useIntro:       boolean,
 *   useOutro:       boolean,
 *   suggestedTitle: string,
 * }} QueueItemAnalysis
 */

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Derive a clean title from a filename.
 * e.g. "voice_note_2024_11_26_093012.mp3" → "Voice Note"
 * @param {string} filePath
 * @returns {string}
 */
function deriveTitle(filePath) {
  const base = path.basename(filePath, path.extname(filePath))
  // Remove common timestamp patterns: 8-digit dates, 6-digit times, ISO-ish
  const cleaned = base
    .replace(/[_\-]/g, ' ')                      // underscores/dashes → spaces
    .replace(/\b\d{4}\s\d{2}\s\d{2}\b/g, '')    // YYYY MM DD
    .replace(/\b\d{2}\s\d{2}\s\d{2}\b/g, '')    // HH MM SS
    .replace(/\b\d{6,}\b/g, '')                  // any long pure-number token
    .replace(/\s{2,}/g, ' ')                     // collapse multiple spaces
    .trim()

  if (!cleaned) return 'Untitled'

  // Title-case each word
  return cleaned
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Snap a timestamp to the nearest silence boundary (start or end) within
 * `padding` seconds. Returns the original value if no boundary is close enough.
 * @param {number}            ts       - timestamp to snap (seconds)
 * @param {SilenceInterval[]} silences
 * @param {number}            padding  - snap radius in seconds (default 0.08)
 * @returns {number}
 */
function snapTimestamp(ts, silences, padding = 0.08) {
  let best = ts
  let bestDist = padding

  for (const s of silences) {
    const dStart = Math.abs(ts - s.start)
    const dEnd   = Math.abs(ts - s.end)

    if (dStart < bestDist) { bestDist = dStart; best = s.start }
    if (dEnd   < bestDist) { bestDist = dEnd;   best = s.end   }
  }

  return best
}

/**
 * Snap cut start/end points to the nearest silence boundary ± padding.
 * Accepts either a single Cut object or an array of Cut objects.
 * @param {Cut|Cut[]}         cutsOrCut
 * @param {SilenceInterval[]} silences
 * @param {number}            padding
 * @returns {Cut|Cut[]}
 */
export function snapToSilence(cutsOrCut, silences, padding = 0.08) {
  if (Array.isArray(cutsOrCut)) {
    for (const cut of cutsOrCut) {
      cut.start = snapTimestamp(cut.start, silences, padding)
      cut.end   = snapTimestamp(cut.end,   silences, padding)
    }
    return cutsOrCut
  }
  if (cutsOrCut && typeof cutsOrCut === 'object') {
    return {
      ...cutsOrCut,
      start: snapTimestamp(cutsOrCut.start, silences, padding),
      end:   snapTimestamp(cutsOrCut.end,   silences, padding),
    }
  }
  return cutsOrCut
}

// ─── Exported functions ────────────────────────────────────────────────────

/**
 * Extracts a waveform peak array for WaveSurfer pre-rendering.
 * Pipes audio through FFmpeg as mono 4 kHz signed-8-bit PCM and samples it.
 *
 * @param {string} filePath
 * @param {number} [samples=500] - Number of peak values to return
 * @returns {Promise<number[]>}  - Array of floats in [0, 1]
 */
export function getPeaks(filePath, samples = 500) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (val) => {
      if (!settled) {
        settled = true
        resolve(val)
      }
    }

    const ffProc = ffmpeg(filePath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(4000)
      .format('s8')
      .on('error', err => {
        // fluent-ffmpeg can emit "Output stream closed" on ffProc if stdout closes >20ms before exit
        if (!settled) {
          console.warn('[Audis Analyzer] getPeaks warning:', err.message)
          finish([])
        }
      })

    const ffStream = ffProc.pipe()
    const chunks   = []

    ffStream.on('data',  chunk => chunks.push(chunk))
    ffStream.on('error', err   => {
      console.warn('[Audis Analyzer] getPeaks warning:', err.message)
      finish([])
    })
    ffStream.on('end', () => {
      const fullBuf = Buffer.concat(chunks)
      const peaks   = []

      if (fullBuf.length > 0) {
        const targetCount = Math.max(1, Math.min(samples, fullBuf.length))
        const bucketSize  = fullBuf.length / targetCount

        for (let b = 0; b < targetCount; b++) {
          const start = Math.floor(b * bucketSize)
          const end   = Math.max(start + 1, Math.min(fullBuf.length, Math.floor((b + 1) * bucketSize)))
          let maxAbs  = 0

          for (let i = start; i < end; i++) {
            const absVal = Math.abs(fullBuf.readInt8(i))
            if (absVal > maxAbs) maxAbs = absVal
          }
          peaks.push(Number((maxAbs / 128).toFixed(3)))
        }
      }

      finish(peaks)
    })
  })
}

/**
 * Detects silent regions in an audio file using FFmpeg's silencedetect filter.
 *
 * @param {string} filePath
 * @param {{ noisedB?: number, minDuration?: number }} [opts]
 * @param {number} [opts.noisedB=-35]      - Noise floor threshold in dB
 * @param {number} [opts.minDuration=0.6]  - Minimum silence duration in seconds
 * @returns {Promise<SilenceInterval[]>}
 */
export function detectSilences(filePath, { noisedB = -35, minDuration = 0.6 } = {}) {
  return new Promise((resolve, reject) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return reject(new Error(`Audio file not found: ${filePath}`))
    }
    const silences  = []
    const stderrBuf = []
    let   current   = null   // partial silence being assembled

    ffmpeg(filePath)
      .noVideo()
      .audioFilters(`silencedetect=noise=${noisedB}dB:d=${minDuration}`)
      .format('null')
      .output('-')
      .on('stderr', line => {
        stderrBuf.push(line)

        // silence_start
        const startMatch = line.match(/silence_start:\s*(-?\d+\.?\d*)/)
        if (startMatch) {
          current = { start: Math.max(0, parseFloat(startMatch[1])), end: null, duration: null }
        }

        // silence_end … | silence_duration …
        const endMatch = line.match(/silence_end:\s*(-?\d+\.?\d*)\s*\|\s*silence_duration:\s*(-?\d+\.?\d*)/)
        if (endMatch && current) {
          current.end      = parseFloat(endMatch[1])
          current.duration = parseFloat(endMatch[2])
          if (current.end > current.start) {
            silences.push({ ...current })
          }
          current = null
        }
      })
      .on('error', err => {
        if (stderrBuf.length === 0 || silences.length === 0) {
          reject(err)
        } else {
          silences.sort((a, b) => a.start - b.start)
          resolve(silences)
        }
      })
      .on('end', () => {
        silences.sort((a, b) => a.start - b.start)
        resolve(silences)
      })
      .run()
  })
}

/**
 * Returns format/stream metadata plus loudness measurements for an audio file.
 *
 * @param {string} filePath
 * @returns {Promise<{ duration: number, meanVolume: number, maxVolume: number, sampleRate: number, channels: number }>}
 */
export function getAudioMetadata(filePath) {
  // Run ffprobe and volumedetect in parallel
  const probePromise = new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const stream = (metadata?.streams || []).find(s => s.codec_type === 'audio') || {}
      resolve({
        duration:   metadata?.format?.duration   ?? 0,
        sampleRate: parseInt(stream.sample_rate  ?? '44100', 10),
        channels:   stream.channels              ?? 1,
      })
    })
  })

  const volumePromise = new Promise((resolve) => {
    let meanVolume = 0
    let maxVolume  = 0

    ffmpeg(filePath)
      .noVideo()
      .audioFilters('volumedetect')
      .format('null')
      .output('-')
      .on('stderr', line => {
        const meanMatch = line.match(/mean_volume:\s*(-?\d+\.?\d*)\s*dB/)
        const maxMatch  = line.match(/max_volume:\s*(-?\d+\.?\d*)\s*dB/)
        if (meanMatch) meanVolume = parseFloat(meanMatch[1])
        if (maxMatch)  maxVolume  = parseFloat(maxMatch[1])
      })
      .on('error',  () => resolve({ meanVolume, maxVolume }))
      .on('end',    () => resolve({ meanVolume, maxVolume }))
      .run()
  })

  return Promise.all([probePromise, volumePromise]).then(([probe, vol]) => ({
    ...probe,
    ...vol,
  }))
}

/**
 * Transcribes an audio file using a Whisper-compatible API endpoint,
 * returning word-level timestamps.
 *
 * Returns `null` on any error — never throws.
 *
 * @param {string} filePath
 * @param {{ apiKey?: string, apiProvider?: string }} opts
 * @returns {Promise<{ words: Array<{ word: string, start: number, end: number }> } | null>}
 */
export async function transcribeAudio(filePath, { apiKey, apiProvider } = {}) {
  if (!apiProvider || apiProvider === 'local') {
    // Placeholder for future whisper.cpp integration
    return null
  }

  if (!apiKey) {
    console.warn('[Audis Analyzer] transcribeAudio: no API key provided')
    return null
  }

  try {
    const provider   = apiProvider === 'groq' ? 'groq' : 'openai'
    const baseUrl    = provider === 'groq'
      ? 'https://api.groq.com/openai/v1'
      : 'https://api.openai.com/v1'

    const fileBuffer = await fs.promises.readFile(filePath)
    const fileName  = path.basename(filePath)
    const mimeByExt = {
      '.wav':  'audio/wav',
      '.flac': 'audio/flac',
      '.ogg':  'audio/ogg',
      '.m4a':  'audio/mp4',
      '.mp4':  'audio/mp4',
      '.aac':  'audio/aac',
    }
    const mimeType  = mimeByExt[path.extname(fileName).toLowerCase()] || 'audio/mpeg'

    // Build multipart/form-data body using native FormData (Node 18+ / Electron)
    const formData = new FormData()
    formData.append('file',             new Blob([fileBuffer], { type: mimeType }), fileName)
    formData.append('model',            provider === 'groq' ? 'whisper-large-v3' : 'whisper-1')
    formData.append('response_format',  'verbose_json')
    formData.append('timestamp_granularities[]', 'word')

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body:    formData,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.warn(`[Audis Analyzer] Whisper API error ${response.status}:`, errText)
      return null
    }

    const data = await response.json()

    // Normalise word array across OpenAI and Groq response shapes
    const words = (data.words ?? data?.segments?.flatMap(s => s.words ?? []) ?? [])
      .map(w => ({
        word:  w.word  ?? w.text ?? '',
        start: w.start ?? 0,
        end:   w.end   ?? 0,
      }))

    return { words }
  } catch (err) {
    console.warn('[Audis Analyzer] transcribeAudio error:', err.message)
    return null
  }
}

/**
 * Plans edit cuts from metadata, silences, and an optional transcript.
 * In offline mode: purely DSP-based heuristics.
 * In cloud mode:  LLM-assisted with DSP snap fallback.
 *
 * Never throws — returns DSP fallback on any cloud error.
 *
 * @param {{ filePath: string, duration: number, silences: SilenceInterval[], transcript: { words: Array<{ word: string, start: number, end: number }> } | null, settings: object }} params
 * @returns {Promise<EditPlan>}
 */
export async function planEdits({ filePath, duration, silences, transcript, settings = {} }) {
  const {
    aiMode             = 'offline',
    minPauseDuration   = 0.7,
    targetPauseSec     = 0.35,
    defaultIntroOutro  = 'on',
  } = settings

  const useIntroOutro = defaultIntroOutro !== 'off'

  // ── DSP-only plan ─────────────────────────────────────────────────────────
  const buildDspPlan = () => {
    const cuts = []
    let   cutId = 0

    for (const silence of silences) {
      const id = `cut_${cutId++}`

      // Leading silence
      if (silence.start < 0.3) {
        cuts.push({
          id,
          start:      silence.start,
          end:        silence.end,
          reason:     'leading_silence',
          confidence: 1.0,
          enabled:    true,
        })
        continue
      }

      // Trailing silence
      if (silence.end > duration - 0.3) {
        cuts.push({
          id,
          start:      silence.start,
          end:        silence.end,
          reason:     'trailing_silence',
          confidence: 1.0,
          enabled:    true,
        })
        continue
      }

      // Long pause (exceeds minPauseDuration and longer than targetPauseSec) → trim but leave a stub
      if (silence.duration >= minPauseDuration && silence.duration > targetPauseSec + 0.05) {
        cuts.push({
          id,
          start:        silence.start,
          end:          silence.end,
          reason:       'long_pause',
          confidence:   0.85,
          enabled:      true,
          postPauseSec: targetPauseSec,
        })
        continue
      }

      // Short natural pause → keep as-is (skip)
    }

    return {
      cuts,
      useIntro:       useIntroOutro,
      useOutro:       useIntroOutro,
      suggestedTitle: deriveTitle(filePath),
    }
  }

  if (aiMode === 'offline') {
    return buildDspPlan()
  }

  // ── Cloud LLM plan ────────────────────────────────────────────────────────
  try {
    const { apiKey, apiProvider } = settings
    if (!apiKey) throw new Error('No API key provided for cloud mode')

    const fileName = path.basename(filePath)
    const provider = apiProvider === 'groq' ? 'groq' : 'openai'
    const baseUrl  = provider === 'groq'
      ? 'https://api.groq.com/openai/v1'
      : 'https://api.openai.com/v1'
    const model    = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'

    const systemPrompt = `You are an expert podcast/audio editor assistant.
You receive metadata about a recorded audio file and return a structured JSON edit plan.

RULES:
1. Distinguish true long pauses (>1.2s) from dramatic, intentional pauses (<1.2s). Only cut long pauses.
2. Flag retakes and false starts (cut from their beginning to the last restart) even when the gap is not fully silent.
3. Snap every proposed cut boundary to the nearest provided silence interval ±80ms — do NOT invent boundaries.
4. Set useIntro=true and useOutro=true for formal episodes, sermons, or broadcasts; set both false for casual short voice notes.
5. Generate a clean descriptive title from the transcript content (max 5 words, title-case).
6. Return ONLY valid JSON — no markdown, no explanation.

RESPONSE SCHEMA:
{
  "cuts": [
    { "id": "cut_0", "start": <number>, "end": <number>, "reason": <string>, "confidence": <0-1>, "enabled": <boolean>, "postPauseSec": <number|undefined> }
  ],
  "useIntro": <boolean>,
  "useOutro": <boolean>,
  "suggestedTitle": <string>
}`

    const userContent = JSON.stringify({
      fileName,
      duration,
      silences,
      transcript: transcript?.words ?? null,
      minPauseDuration,
      targetPauseSec,
    })

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature:     0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent  },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`LLM API error ${response.status}: ${errText}`)
    }

    const data     = await response.json()
    const rawJson  = data.choices?.[0]?.message?.content ?? '{}'
    const plan     = JSON.parse(rawJson)

    // Validate minimal shape
    if (!Array.isArray(plan.cuts)) throw new Error('LLM returned invalid plan shape')

    // Always snap cut boundaries to detected silences
    snapToSilence(plan.cuts, silences, 0.08)

    const resolveIO = (aiChoice) =>
      defaultIntroOutro === 'ai'
        ? (typeof aiChoice === 'boolean' ? aiChoice : useIntroOutro)
        : useIntroOutro

    return {
      cuts:           plan.cuts           ?? [],
      useIntro:       resolveIO(plan.useIntro),
      useOutro:       resolveIO(plan.useOutro),
      suggestedTitle: plan.suggestedTitle ?? deriveTitle(filePath),
    }
  } catch (err) {
    console.warn('[Audis Analyzer] planEdits cloud error, falling back to DSP:', err.message)
    return buildDspPlan()
  }
}

/**
 * Top-level orchestrator: runs the full analysis pipeline for a single file.
 *
 * Steps:
 *  1. getAudioMetadata  → duration, sampleRate, …
 *  2. getPeaks + detectSilences  (parallel)
 *  3. transcribeAudio  (if cloud mode)
 *  4. planEdits
 *
 * @param {string} filePath   - Absolute path to the audio file
 * @param {object} [settings] - App settings object (aiMode, apiKey, noisedB, …)
 * @returns {Promise<QueueItemAnalysis>}
 */
export async function analyzeFile(filePath, settings = {}) {
  const {
    aiMode          = 'offline',
    noisedB         = -35,
    minPauseDuration = 0.6,
  } = settings

  // Step 1 — Metadata (must know duration before planning)
  const { duration, sampleRate, channels, meanVolume, maxVolume } =
    await getAudioMetadata(filePath)

  // Step 2 — Dense 2,000-point bucketed peaks + silences in parallel
  const [peaks, silences] = await Promise.all([
    getPeaks(filePath, 2000),
    detectSilences(filePath, { noisedB, minDuration: minPauseDuration }),
  ])

  // Step 3 — Transcript (cloud mode only, non-throwing)
  let transcript = null
  if (aiMode !== 'offline') {
    transcript = await transcribeAudio(filePath, settings)
  }

  // Step 4 — Edit plan
  const { cuts, useIntro, useOutro, suggestedTitle } = await planEdits({
    filePath,
    duration,
    silences,
    transcript,
    settings,
  })

  return {
    duration,
    sampleRate,
    channels,
    meanVolume,
    maxVolume,
    peaks,
    silences,
    cuts,
    useIntro,
    useOutro,
    suggestedTitle,
  }
}
