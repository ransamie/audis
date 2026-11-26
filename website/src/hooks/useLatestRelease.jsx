import { useState, useEffect } from 'react'

const FALLBACK_VERSION = 'v1.1.1'

// Fallback URLs — used if the GitHub API is unreachable or rate-limited
const FALLBACK_URLS = {
  windows: 'https://github.com/ransamie/audis/releases/download/v1.1.1/Audis-Setup-1.1.1.exe',
  macos:   'https://github.com/ransamie/audis/releases/download/v1.1.1/Audis-1.1.1-arm64.dmg',
  linux:   'https://github.com/ransamie/audis/releases/download/v1.1.1/Audis-1.1.1.AppImage',
}

const CACHE_KEY = 'audis_latest_release_v2'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes per tab session

function getCachedRelease() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_TTL_MS) return null
    if (!data?.urls || !data?.version) return null
    return data
  } catch {
    return null
  }
}

function setCachedRelease(data) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // Ignore storage quota errors
  }
}

export function useLatestRelease() {
  const [urls, setUrls] = useState(FALLBACK_URLS)
  const [version, setVersion] = useState(FALLBACK_VERSION)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchLatestRelease() {
      const cached = getCachedRelease()
      if (cached && !cancelled) {
        setUrls(cached.urls)
        setVersion(cached.version)
        setLoading(false)
        return
      }

      try {
        const res = await fetch(
          'https://api.github.com/repos/ransamie/audis/releases/latest',
          { headers: { Accept: 'application/vnd.github+json' } }
        )
        if (!res.ok) throw new Error(`GitHub API responded ${res.status}`)

        const release = await res.json()
        const assets = Array.isArray(release.assets) ? release.assets : []
        const tagVersion = release.tag_name || FALLBACK_VERSION
        const fallbackPage = release.html_url || 'https://github.com/ransamie/audis/releases/latest'

        const resultUrls = {
          windows: fallbackPage,
          macos: fallbackPage,
          linux: fallbackPage,
        }
        let matchedAnyAsset = false

        for (const asset of assets) {
          const name = String(asset.name || '').toLowerCase()
          const url = asset.browser_download_url
          if (!url) continue

          if (name.endsWith('.exe')) {
            resultUrls.windows = url
            matchedAnyAsset = true
          } else if (name.endsWith('.dmg')) {
            // Prefer arm64 DMG when multiple macOS builds exist
            if (resultUrls.macos === fallbackPage || name.includes('arm64')) {
              resultUrls.macos = url
            }
            matchedAnyAsset = true
          } else if (name.endsWith('.appimage')) {
            resultUrls.linux = url
            matchedAnyAsset = true
          }
        }

        if (!cancelled) {
          setUrls(resultUrls)
          setVersion(tagVersion)
          if (matchedAnyAsset) {
            setCachedRelease({ urls: resultUrls, version: tagVersion })
          }
        }
      } catch (err) {
        console.warn('[useLatestRelease] Failed to fetch latest release, using fallbacks:', err.message)
        if (!cancelled) {
          setUrls(FALLBACK_URLS)
          setVersion(FALLBACK_VERSION)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchLatestRelease()
    return () => { cancelled = true }
  }, [])

  return { urls, version, loading }
}
