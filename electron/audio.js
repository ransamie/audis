import fs from 'fs'
import os from 'os'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

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
 * Repair/Transcode broken audio files (Failsafe for AAC/M4A/Corrupt containers)
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
 * Core audio processing pipeline
 */
export async function processAudio({
  mainPath,
  startTime,
  endTime,
  introPath,
  outroPath,
  outputDir,
  exportFormat = 'original',
  fadeDuration = 2,
  onProgress = () => {}
}) {
  // Validation
  if (!mainPath || !fs.existsSync(mainPath)) {
    throw new Error(`Main audio file not found: ${mainPath}`)
  }
  if (!fs.existsSync(introPath)) {
    throw new Error(`Intro file not found: ${introPath}`)
  }
  if (!fs.existsSync(outroPath)) {
    throw new Error(`Outro file not found: ${outroPath}`)
  }
  if (typeof startTime !== 'number' || typeof endTime !== 'number' || endTime <= startTime) {
    throw new Error(`Invalid crop range: start=${startTime} end=${endTime}`)
  }

  // Output path setup
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  let ext = exportFormat === 'original' 
    ? path.extname(mainPath).toLowerCase().replace('.', '') || 'mp3'
    : exportFormat
  if (!['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) ext = 'mp3'

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outputPath = path.join(outputDir, `Final_Output_${timestamp}.${ext}`)

  const FADE = fadeDuration

  const introDuration = await getAudioDuration(introPath)
  const outroDuration = await getAudioDuration(outroPath)
  const mainDuration = endTime - startTime

  const mainTrimStart = startTime.toFixed(6)
  const mainTrimEnd = endTime.toFixed(6)
  const introFadeStart = (introDuration - FADE).toFixed(6)
  const mainFadeOutSt = (mainDuration - FADE).toFixed(6)

  const filterComplex = [
    `[1:a]atrim=start=${mainTrimStart}:end=${mainTrimEnd},asetpts=PTS-STARTPTS[main_trimmed]`,
    `[0:a]afade=t=out:st=${introFadeStart}:d=${FADE}[intro_faded]`,
    `[main_trimmed]afade=t=in:st=0:d=${FADE},afade=t=out:st=${mainFadeOutSt}:d=${FADE}[main_faded]`,
    `[2:a]afade=t=in:st=0:d=${FADE}[outro_faded]`,
    `[intro_faded][main_faded][outro_faded]concat=n=3:v=0:a=1[output]`
  ].join(';')

  return new Promise((resolve, reject) => {
    const ff = ffmpeg()
      .inputOptions(['-err_detect', 'ignore_err', '-fflags', '+genpts+discardcorrupt'])
      .input(introPath)
      .input(mainPath)
      .input(outroPath)
      .complexFilter(filterComplex)
      .outputOptions(['-map [output]', '-max_error_rate', '1.0'])

    if (ext === 'mp3') {
      ff.audioCodec('libmp3lame').audioBitrate('320k')
    } else if (ext === 'wav') {
      ff.audioCodec('pcm_s16le')
    } else if (ext === 'aac' || ext === 'm4a') {
      ff.audioCodec('aac').audioBitrate('320k')
    } else if (ext === 'flac') {
      ff.audioCodec('flac')
    } else {
      ff.audioCodec('libmp3lame').audioBitrate('320k')
    }

    ff.save(outputPath)
      .on('progress', (progress) => {
        const pct = progress.percent ? Math.round(progress.percent) : 0
        onProgress({ percent: pct, timemark: progress.timemark })
      })
      .on('end', () => resolve({ success: true, outputPath }))
      .on('error', (err) => reject(new Error(err.message)))
  })
}
