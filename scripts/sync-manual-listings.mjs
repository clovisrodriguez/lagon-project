#!/usr/bin/env node
// Merge manually-authored listings (data/manual-listings.json) into the site
// WITHOUT re-downloading the wasi.co images (unlike build-listings.js).
//
// Idempotent: existing entries with the same id are replaced. Re-renders
// data/listings.json, index.html, apartamentos/<id>.html, and sitemap.xml.
//
// Photos for a manual listing must already live in assets/listings/<id>/
// (cover.jpg + NN.jpg), referenced by the entry's cover/photos fields.
//
// Usage: node scripts/sync-manual-listings.mjs

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderIndex, renderDetail } from './render.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LISTINGS_JSON = path.join(ROOT, 'data', 'listings.json')
const MANUAL_JSON = path.join(ROOT, 'data', 'manual-listings.json')
const OUT_INDEX = path.join(ROOT, 'index.html')
const OUT_DETAIL_DIR = path.join(ROOT, 'apartamentos')

const listings = JSON.parse(await fs.readFile(LISTINGS_JSON, 'utf8'))
const manual = JSON.parse(await fs.readFile(MANUAL_JSON, 'utf8'))
const manualIds = new Set(manual.map(m => m.id))

// Replace any existing manual entries, then append fresh copies.
const merged = listings.filter(l => !manualIds.has(l.id)).concat(manual)

// Same ordering as build-listings.js: city asc, then price desc.
merged.sort((a, b) => {
  if (a.city !== b.city) return a.city.localeCompare(b.city)
  return (b.price_cop || 0) - (a.price_cop || 0)
})

await fs.writeFile(LISTINGS_JSON, JSON.stringify(merged, null, 2))
console.log(`Wrote ${LISTINGS_JSON} (${merged.length} listings; ${manual.length} manual)`)

await fs.writeFile(OUT_INDEX, renderIndex(merged))
console.log(`Wrote ${OUT_INDEX}`)

await fs.mkdir(OUT_DETAIL_DIR, { recursive: true })
for (const listing of merged) {
  await fs.writeFile(path.join(OUT_DETAIL_DIR, `${listing.id}.html`), renderDetail(listing))
}
console.log(`Wrote ${merged.length} detail pages`)

// sitemap.xml — mirror build-listings.js output.
const today = new Date().toISOString().slice(0, 10)
const urls = [
  { loc: 'https://nardavalderrama.com/', priority: '1.0', changefreq: 'weekly' },
  ...merged.map(l => ({
    loc: `https://nardavalderrama.com/apartamentos/${l.id}.html`,
    priority: '0.8',
    changefreq: 'monthly',
  })),
]
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`)
  .join('\n')}
</urlset>
`
await fs.writeFile(path.join(ROOT, 'sitemap.xml'), sitemapXml)
console.log(`Wrote sitemap.xml (${urls.length} URLs)`)
