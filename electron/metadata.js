/**
 * electron/metadata.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Audis — Audio Metadata Editor (ID3 / Vorbis / MP4 / FLAC tags + cover art)
 *
 * Reads and writes common audio metadata fields using `music-metadata`, and
 * embeds/extracts cover art (attached pictures). All cover art is stored as
 * base64 data URIs when crossing the IPC boundary so the renderer can preview
 * it without touching the filesystem.
 *
 * Supported formats: MP3 (ID3v2.3/v2.4), WAV, FLAC, MP4/M4A, AAC, OGG/Opus.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { parseFile, writeFile } from 'music-metadata'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Fields we expose to the renderer UI
const TEXT_FIELDS = ['title', 'artist', 'album', 'date', 'genre', 'comment']

/**
 * Normalise a `music-metadata` tag object into a plain JSON-safe record the
 * renderer can display. Cover art is converted to a data-URI.
 *
 * @param {object} native - the raw `music-metadata` native tag object
 * @returns {{ title?, artist?, album?, date?, genre?, comment?, track?, disk?, coverArt?: string }}
 */
function normaliseTag (native) {
  const out = {}

  for (const field of TEXT_FIELDS) {
    const val = native[field]
    if (val && Array.isArray(val) && val.length) out[field] = val[0]
    else if (val && typeof val === 'string') out[field] = val
  }

  // Track / disc numbers come back as { no, of } or just a number
  const track = native.track
  if (track && typeof track.no === 'number') out.track = track.no
  else if (typeof track === 'number') out.track = track

  const disk = native.disk
  if (disk && typeof disk.no === 'number') out.disk = disk.no
  else if (typeof disk === 'number') out.disk = disk

  // Cover art: pick the first attached picture and convert to data-URI
  const pictures = native.picture || []
  if (pictures.length) {
    const pic = pictures[0]
    const mime = pic.format || 'image/jpeg'
    const data = pic.data
    // music-metadata v12+ returns a Buffer; older versions return an array
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    out.coverArt = `data:${mime};base64,${buf.toString('base64')}`
  }

  return out
}

/**
 * Read all editable metadata from an audio file.
 * @param {string} filePath
 * @returns {Promise<{ title?, artist?, album?, date?, genre?, comment?, track?, disk?, coverArt?: string }>}
 */
export async function readMetadata (filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const metadata = await parseFile(filePath, { native: true })
  const tag = metadata.common

  return normaliseTag(tag)
}

/**
 * Write (overwrite) text metadata fields on an audio file.
 * Only the fields present in `updates` are touched; everything else is left alone.
 *
 * @param {string} filePath
 * @param {Partial<{ title, artist, album, date, genre, comment, track, disk }>} updates
 * @returns {Promise<void>}
 */
export async function writeMetadata (filePath, updates = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const native = {}
  for (const field of TEXT_FIELDS) {
    if (updates[field] !== undefined && updates[field] !== null && updates[field] !== '') {
      native[field] = [String(updates[field])]
    } else if (updates[field] === '') {
      // Explicit empty string → clear the field
      native[field] = []
    }
  }

  if (updates.track !== undefined) {
    native.track = updates.track !== null && updates.track !== ''
      ? { no: Number(updates.track) }
      : { no: 0 }
  }
  if (updates.disk !== undefined) {
    native.disk = updates.disk !== null && updates.disk !== ''
      ? { no: Number(updates.disk) }
      : { no: 0 }
  }

  await writeFile(filePath, native, { native: true })
}

/**
 * Embed cover art into an audio file, replacing any existing picture.
 * Accepts either an absolute image path or a data-URI.
 *
 * @param {string} filePath   - audio file to tag
 * @param {string} imageSource - absolute path to image file, or data-URI
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
    // data:image/png;base64,ABC...
    const match = imageSource.match(/^data:([^;]+);base64,(.+)$/s)
    if (!match) throw new Error('Invalid cover image data-URI')
    mimeType = match[1]
    imageBuffer = Buffer.from(match[2], 'base64')
  } else {
    if (!fs.existsSync(imageSource)) throw new Error(`Image not found: ${imageSource}`)
    mimeType = imageSource.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    imageBuffer = await fs.promises.readFile(imageSource)
  }

  // Guard against absurdly large covers (music-metadata / ID3 can choke)
  const maxBytes = 2 * 1024 * 1024 // 2 MB
  if (imageBuffer.length > maxBytes) {
    throw new Error(`Cover image too large (${Math.round(imageBuffer.length / 1024)} KB). Max 2 MB.`)
  }

  await writeFile(filePath, {
    picture: [{
      data:       imageBuffer,
      format:     mimeType,
      type:       'front-cover',
      description: 'Cover',
    }],
  }, { native: true })
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

  // music-metadata writeFile with an empty picture array clears existing pictures
  await writeFile(filePath, { picture: [] }, { native: true })
}

/**
 * Extract cover art as a base64 data-URI (for renderer preview).
 * @param {string} filePath
 * @returns {Promise<string | null>} data-URI or null if no cover
 */
export async function extractCoverArt (filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null

  try {
    const metadata = await parseFile(filePath, { native: true })
    const pictures = metadata.common?.picture || []
    if (!pictures.length) return null

    const pic = pictures[0]
    const mime = pic.format || 'image/jpeg'
    const data = pic.data
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
