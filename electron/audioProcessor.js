import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'

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
 * @param {Object} options
 * @param {string} options.mainPath
 * @param {string} options.introPath
 * @param {string} options.outroPath
 * @param {number} options.startTime
 * @param {number} options.endTime
 * @param {number} options.fadeDuration
 * @param {string} options.outputPath
 * @param {string} options.ext
 * @param {function} options.onProgress
 * @returns {Promise<{success: boolean, outputPath: string}>}
 */
export async function processAudio({
  mainPath,
  introPath,
  outroPath,
  startTime,
  endTime,
  fadeDuration,
  outputPath,
  ext,
  onProgress
}) {
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

  const FADE = fadeDuration || 2

  const introDuration = await getAudioDuration(introPath)
  const outroDuration = await getAudioDuration(outroPath)
  const mainDuration  = endTime - startTime

  const mainTrimStart  = startTime.toFixed(6)
  const mainTrimEnd    = endTime.toFixed(6)
  const introFadeStart = (introDuration - FADE).toFixed(6)
  const mainFadeOutSt  = (mainDuration  - FADE).toFixed(6)

  const filterComplex = [
    `[1:a]atrim=start=${mainTrimStart}:end=${mainTrimEnd},asetpts=PTS-STARTPTS[main_trimmed]`,
    `[0:a]afade=t=out:st=${introFadeStart}:d=${FADE}[intro_faded]`,
    `[main_trimmed]afade=t=in:st=0:d=${FADE},afade=t=out:st=${mainFadeOutSt}:d=${FADE}[main_faded]`,
    `[2:a]afade=t=in:st=0:d=${FADE}[outro_faded]`,
    `[intro_faded][main_faded][outro_faded]concat=n=3:v=0:a=1[output]`
  ].join(';')

  return new Promise((resolve, reject) => {
    const ff = ffmpeg()
      .input(introPath)
      .input(mainPath)
      .input(outroPath)
      .complexFilter(filterComplex)
      .outputOptions(['-map [output]'])

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
        if (onProgress) {
          const pct = progress.percent ? Math.round(progress.percent) : 0
          onProgress({ percent: pct, timemark: progress.timemark })
        }
      })
      .on('end', () => resolve({ success: true, outputPath }))
      .on('error', (err) => reject(new Error(err.message)))
  })
}
