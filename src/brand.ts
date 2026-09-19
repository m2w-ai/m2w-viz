// Everything that identifies whose app this is, in one place. The frames, the
// home menu, the tool headers and the exporters all read from here, so
// rebranding (or white-labelling a deck for a partner) is an edit to this file
// rather than a search across thirty.

export const BRAND = {
  /** Short name, shown beside the logo and in the browser chrome. */
  name: 'M2W',
  /** Legal name, used by the light frame's header and confidentiality line. */
  legalName: 'M2W, Inc',
  /** Display form of the site, e.g. in the slide chrome. */
  domain: 'm2w.ai',
  url: 'https://m2w.ai',
  social: { handle: '@m2w_official', url: 'https://x.com/m2w_official' },
  /** Logo on dark surfaces / light surfaces. Files live in `public/`. */
  logoOnDark: '/icon_white.svg',
  logoColor: '/icon_color.svg',
  /** Footer line on the menus. Empty string hides it. */
  notice: 'Confidential · Do not distribute',
  /** Prefix for exported files: `<prefix>-<deck slug>.pdf`. */
  exportPrefix: 'M2W',
  /** Written into exported PowerPoint metadata. */
  author: 'M2W',
} as const

/** File base name for a deck export, e.g. `M2W-sample-dark`. */
export function exportBaseName(slug: string): string {
  return BRAND.exportPrefix ? `${BRAND.exportPrefix}-${slug}` : slug
}
