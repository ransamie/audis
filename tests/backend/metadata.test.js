import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import {
  readMetadata,
  writeMetadata,
  embedCoverArt,
  removeCoverArt,
  extractCoverArt,
  copyMetadataToOutput,
} from '../../electron/metadata.js'

ffmpeg.setFfmpegPath(ffmpegStatic)

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('Metadata Utility (music-metadata v13)', () => {
  const sourceMp3 = path.resolve(__dirname, '../../test-assets/main.mp3')
  let tmpDir
  let workMp3
  let outMp3

  beforeEach(() => {
    tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'audis-meta-'))
    workMp3 = path.join(tmpDir, 'track.mp3')
    outMp3  = path.join(tmpDir, 'out.mp3')
    fs.copyFileSync(sourceMp3, workMp3)
    fs.copyFileSync(sourceMp3, outMp3)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes and reads back text, genre, comment, track, and disk tags', async () => {
    await writeMetadata(workMp3, {
      title:   'Sunday Message',
      artist:  'Audis Choir',
      album:   'Live Sessions',
      date:    '2026',
      genre:   'Podcast',
      comment: 'Mastered take',
      track:   '3',
      disk:    '1',
    })

    const meta = await readMetadata(workMp3)
    expect(meta.title).toBe('Sunday Message')
    expect(meta.artist).toBe('Audis Choir')
    expect(meta.album).toBe('Live Sessions')
    expect(meta.date).toBe('2026')
    expect(meta.genre).toBe('Podcast')
    expect(meta.comment).toBe('Mastered take')
    expect(meta.track).toBe(3)
    expect(meta.disk).toBe(1)

    await writeMetadata(workMp3, { comment: '', track: '' })
    const cleared = await readMetadata(workMp3)
    expect(cleared.comment).toBeUndefined()
    expect(cleared.track).toBeUndefined()
  })

  it('embeds, extracts, removes, and copies cover art to output', async () => {
    const dataUri = `data:image/png;base64,${TINY_PNG_BASE64}`
    await writeMetadata(workMp3, { title: 'Tag Preserved', artist: 'RanTech' })
    await embedCoverArt(workMp3, dataUri)

    const extracted = await extractCoverArt(workMp3)
    expect(extracted).toMatch(/^data:image\/png;base64,/)

    await copyMetadataToOutput(workMp3, outMp3, { title: 'Exported Title' })
    const outMeta = await readMetadata(outMp3)
    expect(outMeta.title).toBe('Exported Title')
    expect(outMeta.artist).toBe('RanTech')
    expect(outMeta.coverArt).toMatch(/^data:image\/png;base64,/)

    await removeCoverArt(workMp3)
    expect(await extractCoverArt(workMp3)).toBeNull()
  })

  it('writes and reads tags + cover art on .ogg files', async () => {
    const workOgg = path.join(tmpDir, 'track.ogg')
    await new Promise((resolve, reject) => {
      ffmpeg(sourceMp3)
        .audioFrequency(44100)
        .audioChannels(2)
        .audioCodec('libvorbis')
        .audioQuality(6)
        .save(workOgg)
        .on('end', resolve)
        .on('error', reject)
    })

    await writeMetadata(workOgg, {
      title: 'Ogg Sermon',
      artist: 'Audis Choir',
      genre: 'Podcast',
      comment: 'Vorbis tag',
    })
    await embedCoverArt(workOgg, `data:image/png;base64,${TINY_PNG_BASE64}`)

    const oggMeta = await readMetadata(workOgg)
    expect(oggMeta.title).toBe('Ogg Sermon')
    expect(oggMeta.artist).toBe('Audis Choir')
    expect(oggMeta.genre).toBe('Podcast')
    expect(oggMeta.comment).toBe('Vorbis tag')
    expect(oggMeta.coverArt).toMatch(/^data:image\/png;base64,/)
  }, 15000)
})
