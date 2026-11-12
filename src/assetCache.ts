import xtrarunBgUrl from './assets/xtrarun-bg.webp'
import saveduitBgUrl from './assets/saveduit-bg.webp'
import titleXtrarunUrl from './assets/title-xtrarun.webp'
import logoBankJatengUrl from './assets/logo-bank-jateng.webp'
import spinWheelXtrarunUrl from './assets/spin-wheel-xtrarun.webp'
import spinWheelSaveduitUrl from './assets/spin-wheel-saveduit.webp'
import pointerImgUrl from './assets/pointer.webp'
import spinButtonCircleSvgUrl from './assets/spin-button-circle.svg'
import nomorUndianCircleSvgUrl from './assets/nomor-undian-circle.svg'
import motifRedImgUrl from './assets/motif-red.webp'
import motifYellowImgUrl from './assets/motif-yellow.webp'

export interface CachedAssets {
  xtrarunBg: string
  saveduitBg: string
  titleXtrarun: string
  logoBankJateng: string
  spinWheelXtrarun: string
  spinWheelSaveduit: string
  pointerImg: string
  spinButtonCircleSvg: string
  nomorUndianCircleSvg: string
  motifRedImg: string
  motifYellowImg: string
}

const DEFAULT_ASSETS: CachedAssets = {
  xtrarunBg: xtrarunBgUrl,
  saveduitBg: saveduitBgUrl,
  titleXtrarun: titleXtrarunUrl,
  logoBankJateng: logoBankJatengUrl,
  spinWheelXtrarun: spinWheelXtrarunUrl,
  spinWheelSaveduit: spinWheelSaveduitUrl,
  pointerImg: pointerImgUrl,
  spinButtonCircleSvg: spinButtonCircleSvgUrl,
  nomorUndianCircleSvg: nomorUndianCircleSvgUrl,
  motifRedImg: motifRedImgUrl,
  motifYellowImg: motifYellowImgUrl,
}

const CACHE_NAME = 'bank-jateng-spin-assets-v1'

// Keep decoded HTMLImageElement instances pinned in memory so browser never evicts bitmaps
const pinnedImages: HTMLImageElement[] = []

let resolvedAssets: CachedAssets = { ...DEFAULT_ASSETS }
let preloadPromise: Promise<CachedAssets> | null = null
let preloadCompleted = false

async function fetchAndCacheBlobUrl(url: string): Promise<string> {
  try {
    let response: Response | undefined

    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_NAME)
        response = await cache.match(url)
        if (!response) {
          const networkResponse = await fetch(url, { cache: 'force-cache' })
          if (networkResponse.ok) {
            await cache.put(url, networkResponse.clone())
            response = networkResponse
          }
        }
      } catch {
        // Fallback to standard fetch if CacheStorage is unavailable
      }
    }

    if (!response) {
      response = await fetch(url, { cache: 'force-cache' })
    }

    if (response.ok) {
      const blob = await response.blob()
      return URL.createObjectURL(blob)
    }
  } catch {
    // Fallback to original URL if offline and not in CacheStorage
  }

  return url
}

async function decodeAndPinImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'sync'
    img.loading = 'eager'
    img.src = src

    const finish = () => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .catch(() => {})
          .finally(() => {
            pinnedImages.push(img)
            resolve()
          })
      } else {
        pinnedImages.push(img)
        resolve()
      }
    }

    if (img.complete) {
      finish()
    } else {
      img.onload = finish
      img.onerror = () => resolve()
    }
  })
}

export function getCachedAssets(): CachedAssets {
  return resolvedAssets
}

export function isAssetsPreloaded(): boolean {
  return preloadCompleted
}

export function preloadAllAssets(
  onProgress?: (loaded: number, total: number) => void,
): Promise<CachedAssets> {
  if (preloadPromise) {
    return preloadPromise
  }

  const entries = Object.entries(DEFAULT_ASSETS) as [
    keyof CachedAssets,
    string,
  ][]
  const total = entries.length
  let loaded = 0

  preloadPromise = (async () => {
    const nextAssets: CachedAssets = { ...DEFAULT_ASSETS }

    await Promise.all(
      entries.map(async ([key, originalUrl]) => {
        const blobOrUrl = await fetchAndCacheBlobUrl(originalUrl)
        nextAssets[key] = blobOrUrl
        await decodeAndPinImage(blobOrUrl)
        loaded += 1
        onProgress?.(loaded, total)
      }),
    )

    resolvedAssets = nextAssets
    preloadCompleted = true
    return resolvedAssets
  })()

  return preloadPromise
}

// Start preloading immediately when module is imported
if (typeof window !== 'undefined') {
  void preloadAllAssets()
}

