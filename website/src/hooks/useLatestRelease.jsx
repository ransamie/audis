import { useState, useEffect } from 'react'

// Fallback URLs — used if the GitHub API is unreachable or rate-limited
const FALLBACK_URLS = {
  windows: 'https://github.com/ransamie/audis/releases/download/v1.1.0/Audis-Setup-1.1.0.exe',
  macos:   'https://github.com/ransamie/audis/releases/download/v1.1.0/Audis-1.1.0-arm64.dmg',
  linux:   'https://github.com/ransamie/audis/releases/download/v1.1.0/Audis-1.1.0.AppImage',
}

const CACHE_KEY = 'audis_latest_release'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getCachedRelease() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_TTL_MS) return null
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchLatestRelease() {
      // Use cached data if available
      const cached = getCachedRelease()
      if (cached && !cancelled) {
        setUrls(cached)
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
        const assets = release.assets || []

        const result = { ...FALLBACK_URLS }

        assets.forEach((asset) => {
          const name = asset.name.toLowerCase()
          const url = asset.browser_download_url
          if (name.endsWith('.exe')) result.windows = url
          else if (name.endsWith('.dmg')) result.macos = url
          else if (name.endsWith('.appimage')) result.linux = url
        })

        if (!cancelled) {
          setUrls(result)
          setCachedRelease(result)
        }
      } catch (err) {
        console.warn('[useLatestRelease] Failed to fetch latest release, using fallbacks:', err.message)
        if (!cancelled) {
          setUrls(FALLBACK_URLS)
          setCachedRelease(FALLBACK_URLS)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchLatestRelease()
    return () => { cancelled = true }
  }, [])

  return { urls, loading }
}
