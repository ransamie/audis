/**
 * electron/metadata.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Audis — Audio Metadata Editor (ID3 / Vorbis / MP4 / FLAC tags + cover art)
 *
 * Reads and writes common audio metadata fields using `music-metadata` v13
 * (`parseFile` + `updateFile`), and embeds/extracts cover art (attached
 * pictures). Cover art crosses the IPC boundary as base64 data URIs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { parseFile, updateFile } from 'music-metadata'
import fs from 'fs'

const SIMPLE_TEXT_FIELDS = ['title', 'artist', 'album', 'date']

/**
 * Normalise a `music-metadata` v13 `common` tag object into a plain JSON-safe
 * record for the renderer UI.
 *
 * @param {import('music-metadata').ICommonTagsResult} common
 * @returns {{ title?: string, artist?: string, album?: string, date?: string, genre?: string, comment?: string, track?: number, disk?: number, coverArt?: string }}
 */
function normaliseTag (common = {}) {
  const out = {}

  for (const field of SIMPLE_TEXT_FIELDS) {
    const val = common[field]
    if (typeof val === 'string' && val.length > 0) out[field] = val
  }
  if (!out.date && typeof common.year === 'number') {
    out.date = String(common.year)
  }

  // music-metadata v13 exposes plural `genres: string[]` and `comments: IComment[]`
  if (Array.isArray(common.genres) && common.genres.length > 0) {
    out.genre = common.genres[0]
  }
  if (Array.isArray(common.comments) && common.comments.length > 0) {
    const first = common.comments[0]
    if (typeof first === 'string') out.comment = first
    else if (first && typeof first.text === 'string') out.comment = first.text
  }

  // music-metadata v13 exposes `trackNumber` / `discNumber` (with legacy `track`/`disk` fallback)
  if (typeof common.trackNumber === 'number') out.track = common.trackNumber
  else if (typeof common.track?.no === 'number') out.track = common.track.no

  if (typeof common.discNumber === 'number') out.disk = common.discNumber
  else if (typeof common.disk?.no === 'number') out.disk = common.disk.no

  // Cover art: pick the first attached picture and convert to data-URI
  const pictures = common.picture || []
  if (pictures.length > 0) {
    const pic  = pictures[0]
    const mime = pic.format || 'image/jpeg'
    const buf  = Buffer.isBuffer(pic.data) ? pic.data : Buffer.from(pic.data)
    out.coverArt = `data:${mime};base64,${buf.toString('base64')}`
  }

  return out
}

/**
 * Read all editable metadata from an audio file.
 * @param {string} filePath
 */
export async function readMetadata (filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  const metadata = await parseFile(filePath)
  return normaliseTag(metadata.common)
}

/**
 * Write (patch) text metadata fields on an audio file using `updateFile`.
 * Only fields present in `updates` are modified; passing `''` clears the tag.
 *
 * @param {string} filePath
 * @param {Partial<{ title, artist, album, date, genre, comment, track, disk }>} updates
 * @returns {Promise<void>}
 */
export async function writeMetadata (filePath, updates = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const patch = {}

  for (const field of SIMPLE_TEXT_FIELDS) {
    if (updates[field] === '') {
      patch[field] = null
    } else if (updates[field] !== undefined && updates[field] !== null) {
      patch[field] = String(updates[field])
    }
  }

  if (updates.genre === '') {
    patch.genres = null
  } else if (updates.genre !== undefined && updates.genre !== null) {
    patch.genres = [String(updates.genre)]
  }

  if (updates.comment === '') {
    patch.comments = null
  } else if (updates.comment !== undefined && updates.comment !== null) {
    patch.comments = [{ text: String(updates.comment) }]
  }

  if (updates.track === '' || updates.track === null) {
    patch.track = null
  } else if (updates.track !== undefined) {
    const no = Number(updates.track)
    if (Number.isFinite(no) && no > 0) patch.track = { no }
  }

  if (updates.disk === '' || updates.disk === null) {
    patch.disk = null
  } else if (updates.disk !== undefined) {
    const no = Number(updates.disk)
    if (Number.isFinite(no) && no > 0) patch.disk = { no }
  }

  if (Object.keys(patch).length > 0) {
    await updateFile(filePath, patch, { atomic: true })
  }
}

/**
 * Embed cover art into an audio file, replacing any existing picture.
 * Accepts either an absolute image path or a data-URI.
 *
 * @param {string} filePath
 * @param {string} imageSource
 * @returns {Promise<void>}
 */
export async function embedCoverArt (filePath, imageSource) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  if (!imageSource) throw new Error('No cover image provided')

  let imageBuffer
  let mimeType

  if (imageSource.startsWith('data:')) {
    const match = imageSource.match(/^data:([^;]+);base64,(.+)$/s)
    if (!match) throw new Error('Invalid cover image data-URI')
    mimeType    = match[1]
    imageBuffer = Buffer.from(match[2], 'base64')
  } else {
    if (!fs.existsSync(imageSource)) throw new Error(`Image not found: ${imageSource}`)
    mimeType    = imageSource.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    imageBuffer = await fs.promises.readFile(imageSource)
  }

  const maxBytes = 2 * 1024 * 1024 // 2 MB
  if (imageBuffer.length > maxBytes) {
    throw new Error(`Cover image too large (${Math.round(imageBuffer.length / 1024)} KB). Max 2 MB.`)
  }

  await updateFile(filePath, {
    picture: [{
      data:        imageBuffer,
      format:      mimeType,
      type:        'Cover (front)',
      description: 'Cover',
    }],
  }, { atomic: true })
}

/**
 * Remove all embedded cover art from an audio file.
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function removeCoverArt (filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  await updateFile(filePath, { picture: null }, { atomic: true })
}

/**
 * Extract cover art as a base64 data-URI (for renderer preview).
 * @param {string} filePath
 * @returns {Promise<string | null>}
 */
export async function extractCoverArt (filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null

  try {
    const metadata = await parseFile(filePath)
    const pictures = metadata.common?.picture || []
    if (!pictures.length) return null

    const pic  = pictures[0]
    const mime = pic.format || 'image/jpeg'
    const buf  = Buffer.isBuffer(pic.data) ? pic.data : Buffer.from(pic.data)
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Copy editable metadata & embedded cover art from a source audio file onto a
 * newly rendered output file (since FFmpeg filter_complex strips tags/pictures).
 * Non-fatal: warns if the target container does not support a tag patch.
 *
 * @param {string} sourcePath
 * @param {string} outputPath
 * @param {{ title?: string }} [overrides]
 */
export async function copyMetadataToOutput (sourcePath, outputPath, overrides = {}) {
  try {
    if (!sourcePath || !outputPath || !fs.existsSync(sourcePath) || !fs.existsSync(outputPath)) {
      return
    }
    const meta   = await parseFile(sourcePath)
    const common = meta.common || {}
    const patch  = {}

    const resolvedTitle = overrides.title || common.title
    if (resolvedTitle) patch.title = resolvedTitle
    if (common.artist) patch.artist = common.artist
    if (common.album)  patch.album  = common.album
    if (common.date)   patch.date   = common.date
    else if (typeof common.year === 'number') patch.date = String(common.year)
    if (Array.isArray(common.genres) && common.genres.length) patch.genres = common.genres
    if (Array.isArray(common.comments) && common.comments.length) patch.comments = common.comments
    if (typeof common.trackNumber === 'number') patch.track = { no: common.trackNumber, of: common.trackTotal ?? null }
    if (typeof common.discNumber === 'number')  patch.disk  = { no: common.discNumber,  of: common.discTotal  ?? null }
    if (Array.isArray(common.picture) && common.picture.length > 0) {
      patch.picture = common.picture.map(p => ({
        data:        Buffer.isBuffer(p.data) ? p.data : Buffer.from(p.data),
        format:      p.format || 'image/jpeg',
        type:        p.type || 'Cover (front)',
        description: p.description || 'Cover',
      }))
    }

    if (Object.keys(patch).length > 0) {
      await updateFile(outputPath, patch, { atomic: true })
    }
  } catch (err) {
    console.warn('[Audis Metadata] Could not copy metadata to output:', err.message)
  }
}
