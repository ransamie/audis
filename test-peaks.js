import ffmpeg from 'fluent-ffmpeg'
import ffmpegStaticPath from 'ffmpeg-static'
import ffprobeStaticPath from 'ffprobe-static'
import path from 'path'
import fs from 'fs'

ffmpeg.setFfmpegPath(ffmpegStaticPath)
ffmpeg.setFfprobePath(ffprobeStaticPath.path)

const filePath = process.argv[2] || path.join(process.cwd(), 'public', 'assets', 'intro.mp3')

console.log('Testing file:', filePath)

ffmpeg.ffprobe(filePath, (err, metadata) => {
  if (err) {
    console.error('ffprobe error:', err)
    process.exit(1)
  }
  const duration = metadata?.format?.duration || 0
  console.log('duration:', duration)
  const samples = 500

  const ffProc = ffmpeg(filePath)
    .noVideo()
    .audioChannels(1)
    .audioFrequency(4000)
    .format('s8')

  const ffStream = ffProc.pipe()
  const chunks = []

  ffStream.on('data', (chunk) => chunks.push(chunk))
  ffStream.on('error', (e) => {
    console.warn('[Audis FFmpeg Peaks Warning]', e.message)
    console.log({ duration, peaks: [] })
  })
  ffStream.on('end', () => {
    const fullBuf = Buffer.concat(chunks)
    console.log('Full buffer length:', fullBuf.length)
    const peaks = []
    if (fullBuf.length > 0) {
      const step = Math.max(1, Math.floor(fullBuf.length / samples))
      for (let i = 0; i < fullBuf.length && peaks.length < samples; i += step) {
        const val = Math.abs(fullBuf.readInt8(i)) / 128
        peaks.push(Number(val.toFixed(3)))
      }
    }
    console.log('Peaks generated:', peaks.length)
    console.log('First 5 peaks:', peaks.slice(0, 5))
  })
})
