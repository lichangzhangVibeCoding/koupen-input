import catalog from './releases.json'

export type ReleaseDownloads = {
  macArm64?: string
  macX64?: string
  winX64?: string
}

export type ReleaseItem = {
  version: string
  date: string
  title: string
  titleEn?: string
  highlights: string[]
  highlightsEn?: string[]
  downloads?: ReleaseDownloads
}

export type ReleasesCatalog = {
  product: string
  productEn?: string
  repo: string
  releasesUrl: string
  latestUrl: string
  siteUrl: string
  releases: ReleaseItem[]
}

export function getReleasesCatalog(): ReleasesCatalog {
  return catalog as ReleasesCatalog
}

/** 正数 = a 更新 */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((x) => Number(x) || 0)
  const pb = b.replace(/^v/i, '').split('.').map((x) => Number(x) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

export function downloadReleaseUrl(repo: string, version: string, filename: string): string {
  return `${repo.replace(/\/+$/, '')}/releases/download/v${version}/${encodeURIComponent(filename)}`
}

export function localizedReleaseTitle(item: ReleaseItem, locale: string): string {
  if (locale.startsWith('en')) return item.titleEn || item.title
  return item.title
}

export function localizedReleaseHighlights(item: ReleaseItem, locale: string): string[] {
  if (locale.startsWith('en') && item.highlightsEn?.length) return item.highlightsEn
  return item.highlights || []
}
