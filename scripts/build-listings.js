#!/usr/bin/env node
// Build pipeline: parse 22 wasi.co listing HTMLs → data/listings.json + assets/listings/<id>/*
//
// Usage: node scripts/build-listings.js
//
// Inputs:
//   scripts/source-html/*.html        — gitignored, copies of the wasi exports
//   scripts/local-photos/<folder>/    — optional local photo overrides (not required)
//
// Outputs:
//   data/listings.json
//   assets/listings/<id>/cover.jpg, 01.jpg, 02.jpg, ...

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderIndex, renderDetail } from './render.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(__dirname, 'source-html')
const OUT_JSON = path.join(ROOT, 'data', 'listings.json')
const OUT_ASSETS = path.join(ROOT, 'assets', 'listings')
const LOCAL_PHOTOS_DIR = path.join(__dirname, 'local-photos')
const OUT_INDEX = path.join(ROOT, 'index.html')
const OUT_DETAIL_DIR = path.join(ROOT, 'apartamentos')

// ─── HTML parsers ────────────────────────────────────────────────────────────

function getTitle(html) {
  const m = html.match(/<title>\s*([^<]+?)\s*<\/title>/)
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : null
}

function getOgUrl(html) {
  const m = html.match(/og:url"\s*content="([^"]+)"/)
  return m ? decodeURIComponent(m[1]) : null
}

function getOgImage(html) {
  const m = html.match(/og:image"\s*content="([^"]+)"/)
  return m ? m[1] : null
}

function getPrice(html, title) {
  // wasi.co format
  let m = html.match(/class="pr1">\s*\$\s*([\d.,]+)/)
  if (m) return parseInt(m[1].replace(/\D/g, ''), 10)
  // luzesinmobiliarias format — price appears in title and prominently in body
  // e.g. "APARTAMENTO MODERNO VISTA 180° | RENTA ACTIVA - $799.000.000 COP"
  m = (title || '').match(/\$\s*([\d.]{7,})/)
  if (m) return parseInt(m[1].replace(/\D/g, ''), 10)
  // Fallback: largest $X.XXX.XXX in body
  const all = [...html.matchAll(/\$\s*([\d]{1,3}(?:\.\d{3}){2,})/g)]
  if (all.length) {
    const nums = all.map(m => parseInt(m[1].replace(/\D/g, ''), 10))
    return Math.max(...nums)
  }
  return null
}

function getAgent(html) {
  // wasi.co format: first <span class="num">…</span> after "CONTACTE AL ASESOR"
  const after = html.split(/CONTACTE AL ASESOR/i)[1] || html
  let m = after.match(/<span class="num">\s*([^<]+?)\s*<\/span>/)
  if (m) return titleCase(m[1])
  // luzesinmobiliarias format: <span class="notranslate">NAME</span> in the agent card
  m = html.match(/<span class="notranslate">\s*([A-ZÁÉÍÓÚÑ][^<]{2,40}?)\s*<\/span>/)
  if (m) return titleCase(m[1])
  return null
}

function getSpecs(html) {
  const specs = {}
  // Match any element wrapper: <li|div|p ...><strong>Label:</strong> Value</...>
  const re = /<strong>([^<:]+):\s*<\/strong>\s*([^<]+?)\s*</g
  let m
  while ((m = re.exec(html))) {
    const k = decodeEntities(m[1]).trim()
    const v = decodeEntities(m[2]).replace(/&sup2;/g, '²').trim().replace(/\.$/, '')
    if (!specs[k]) specs[k] = v // first occurrence wins
  }
  // Normalize alias keys to canonical names
  const aliases = {
    'Alcobas': 'Habitaciones',
    'Parqueadero': 'Garaje',
    'Zona / barrio': 'Zona',
    'Zona/barrio': 'Zona',
    'Tipo de inmueble': 'Tipo Inmueble',
    'Tipo de negocio': 'Negocio',
    'Valor Administración': 'Administración',
    'Departamento': 'Provincia',
    'Piso': 'Nivel',
    'Área Terreno': 'Área Construida',
  }
  for (const [from, to] of Object.entries(aliases)) {
    if (specs[from] && !specs[to]) specs[to] = specs[from]
  }
  return specs
}

function getDescription(html) {
  // The block after "Descripción Adicional" header
  const idx = html.search(/Descripci[oó]n Adicional/i)
  if (idx === -1) return ''
  const slice = html.slice(idx, idx + 8000)
  // Take the first <p>…</p> bundle after the header (sometimes wrapped <p><p>…</p></p>)
  const m = slice.match(/<\/h3>[\s\S]*?<p>([\s\S]*?)<\/p>\s*<\/div>/)
  if (!m) return ''
  // Strip ALL HTML tags (some listings embed <div>/<span style=...> for emojis/styling)
  let text = m[1]
    .replace(/<\/?(p|br)\s*\/?>/gi, '\n') // line breaks
    .replace(/<[^>]+>/g, '') // strip all other tags
  text = decodeEntities(text)
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
  text = text.replace(/^Código\.[^.]*\.\s*/i, '')
  return text
}

function buildTransformerUrl(key, width = 1200, height = 900) {
  // fit:cover crops to fill — no white letterbox. Aspect 4:3.
  const spec = {
    bucket: 'staticw',
    key,
    edits: {
      normalise: true,
      rotate: 0,
      resize: { width, height, fit: 'cover' },
    },
  }
  const b64 = Buffer.from(JSON.stringify(spec)).toString('base64')
  return `https://image.wasi.co/${b64}`
}

function reframeAsCover(url) {
  // Take a wasi transformer URL (possibly fit:contain with white background) and
  // rebuild it as fit:cover for the listing display. Pass-through for non-transformer URLs.
  if (!url.startsWith('https://image.wasi.co/')) return url
  const b64 = url.split('/').pop()
  try {
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    if (json?.key) return buildTransformerUrl(json.key)
  } catch {}
  return url
}

function getImageUrls(html) {
  // Three formats:
  //   wasi.co: image.wasi.co/<base64-json> — JSON encodes width + key
  //   luzes/direct: images.wasi.co/inmuebles/<key>.jpe?g — already large
  //   luzes/thumb-only: only 320px transformer URLs; reconstruct large versions from key
  const seenKey = new Set()
  const items = []
  const smallByKey = new Map() // key → original URL (for fallback width upgrade)

  // Collect unique source keys from any URL form, then rebuild as fit:cover.
  // This avoids the white letterbox from fit:contain in the source URLs.

  // 1) image.wasi.co transformer URLs (encode key in base64)
  for (const m of html.matchAll(/https:\/\/image\.wasi\.co\/[A-Za-z0-9+/=_-]+/g)) {
    const url = m[0]
    const b64 = url.split('/').pop()
    try {
      const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
      const key = json?.key
      if (key && !seenKey.has(key)) {
        seenKey.add(key)
        items.push(buildTransformerUrl(key))
      }
    } catch {}
  }

  // 2) images.wasi.co/inmuebles direct URLs (luzes format)
  for (const m of html.matchAll(/https:\/\/images\.wasi\.co\/inmuebles\/[^"'\s)]+\.(?:jpe?g|png|webp)/gi)) {
    const url = m[0]
    const fname = url.split('/').pop()
    const key = `inmuebles/${fname}`
    if (!seenKey.has(key)) {
      seenKey.add(key)
      // Reframe through the transformer for consistent crop
      items.push(buildTransformerUrl(key))
    }
  }

  return items
}

// ─── Derivations ─────────────────────────────────────────────────────────────

function deriveType(specType, ogUrl, title) {
  if (specType) {
    const t = specType.toLowerCase()
    if (t.includes('apartaestudio') || t.includes('aparta-estudio') || t.includes('loft')) return 'Aparta-estudio'
    if (t.includes('lote') || t.includes('terreno')) return 'Lote'
    if (t.includes('casa campestre') || t.includes('campestre')) return 'Casa Campestre'
    if (t.includes('casa')) return 'Casa'
    if (t.includes('apartamento')) return 'Apartamento'
  }
  const u = (ogUrl || '').toLowerCase()
  if (u.includes('apartaestudio') || u.includes('loft')) return 'Aparta-estudio'
  if (u.includes('lote') || u.includes('terreno')) return 'Lote'
  if (u.includes('casa-campestre')) return 'Casa Campestre'
  if (u.includes('casa')) return 'Casa'
  if (u.includes('apartamento')) return 'Apartamento'
  const t = (title || '').toLowerCase()
  if (t.includes('loft')) return 'Aparta-estudio'
  if (t.includes('lote')) return 'Lote'
  if (t.includes('casa')) return 'Casa'
  return 'Apartamento'
}

function deriveLocation(specs, ogUrl) {
  let city = (specs['Ciudad'] || '').replace(/\.$/, '').trim()
  let zone = (specs['Zona'] || '').trim()

  // Fallback: parse from og_url slug like:
  //   .../casa-campestre-venta-escobero-envigado/9497507
  //   .../apartamento-venta-castropol-medellín/9940181
  //   .../apartamento-venta-itagui/9124532
  if ((!city || !zone) && ogUrl) {
    const m = ogUrl.match(/\/([^/]+)\/\d+\/?$/)
    if (m) {
      const slug = m[1].toLowerCase()
      // Drop type prefix + "venta"/"arriendo"
      const parts = slug
        .split('-')
        .filter(p => !['venta', 'arriendo', 'apartamento', 'apartaestudio', 'loft', 'casa', 'campestre', 'lote', 'terreno'].includes(p))
      // Last 1-2 parts are typically neighborhood + city
      if (parts.length >= 2 && !city) city = titleCaseSpanish(parts[parts.length - 1])
      else if (parts.length === 1 && !city) city = titleCaseSpanish(parts[0])
      if (parts.length >= 2 && !zone) {
        zone = titleCaseSpanish(parts.slice(0, -1).join(' '))
      }
    }
  }
  return { city: city || 'Medellín', neighborhood: zone || '' }
}

function deriveDisplayTitle(rawTitle, type, loc) {
  // Prefer structured title "{Type} en {Neighborhood}, {City}" when we have location.
  // Only use the raw title when it contains a property-type keyword (signal that the
  // agent wrote a real description) AND it has more than one informative word.
  const structured = loc.neighborhood
    ? `${type} en ${loc.neighborhood}, ${loc.city}`
    : `${type} en ${loc.city}`

  if (!rawTitle) return structured

  let t = rawTitle
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/\$\s*[\d.,]+\s*(?:COP|USD)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  t = t.split(/\s*[|–]\s*/)[0].trim()
  t = t.replace(/^venta\s+(de\s+)?/i, '').trim()

  const lower = t.toLowerCase()
  const hasTypeKeyword = /(apartamento|aparta-estudio|loft|casa|lote|finca|terreno)/i.test(lower)
  const wordCount = t.split(/\s+/).filter(Boolean).length

  // Keep raw title only when it has a property keyword AND substance beyond filler.
  // Generic phrases like "Loft en Venta" don't help — fall back to structured.
  const fillerWords = new Set(['venta', 'arriendo', 'en', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'para'])
  const meaningfulWordCount = t
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w && !fillerWords.has(w)).length

  if (hasTypeKeyword && meaningfulWordCount >= 3 && t.length >= 12) {
    if (/^[A-ZÁÉÍÓÚÑ\s\d°²]+$/.test(t) && t.length > 30) return structured
    return titleCaseSpanish(t)
  }
  return structured
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Ntilde;/g, 'Ñ')
}

function titleCase(s) {
  return s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
}

function titleCaseSpanish(s) {
  // Lowercase only true connectives, NOT articles — Spanish place names capitalize "El Poblado", "La Estrella"
  const minor = new Set(['de', 'del', 'y', 'en', 'con', 'para', 'a'])
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && minor.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/\s*[-|]+\s*$/, '') // strip trailing punctuation
    .trim()
}

function toInt(v) {
  if (v == null) return null
  const m = String(v).match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

async function downloadFile(url, destPath) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(destPath, buf)
  return buf.length
}

async function exists(p) {
  try { await fs.stat(p); return true } catch { return false }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function processListing(filename) {
  const id = filename.replace(/\.html$/, '')
  const html = await fs.readFile(path.join(SRC_DIR, filename), 'utf8')

  const rawTitle = getTitle(html)
  const ogUrl = getOgUrl(html)
  const ogImage = getOgImage(html)
  const price = getPrice(html, rawTitle)
  const agent = getAgent(html)
  const specs = getSpecs(html)
  const description = getDescription(html)
  const imageUrls = getImageUrls(html)

  const type = deriveType(specs['Tipo Inmueble'], ogUrl, rawTitle)
  const location = deriveLocation(specs, ogUrl)
  const displayTitle = deriveDisplayTitle(rawTitle, type, location)

  return {
    id,
    title: displayTitle,
    raw_title: rawTitle,
    type,
    city: location.city,
    neighborhood: location.neighborhood,
    price_cop: price,
    bedrooms: toInt(specs['Habitaciones']),
    baths: toInt(specs['Baños']),
    garage: toInt(specs['Garaje']),
    area_m2: toInt(specs['Área Construida']),
    estrato: toInt(specs['Estrato']),
    floor: toInt(specs['Nivel']),
    condition: specs['Estado'] || null,
    admin_fee: specs['Administración'] || null,
    description,
    agent,
    wasi_url: ogUrl,
    og_image: ogImage,
    _image_urls: imageUrls, // resolved into local paths below
  }
}

async function downloadImages(listing) {
  const dir = path.join(OUT_ASSETS, listing.id)
  await fs.mkdir(dir, { recursive: true })

  // Check for local photo override first
  const localDir = path.join(LOCAL_PHOTOS_DIR, listing.id)
  if (await exists(localDir)) {
    const files = (await fs.readdir(localDir)).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort()
    const photos = []
    for (let i = 0; i < files.length; i++) {
      const dest = path.join(dir, `${String(i + 1).padStart(2, '0')}.jpg`)
      await fs.copyFile(path.join(localDir, files[i]), dest)
      photos.push(`/assets/listings/${listing.id}/${path.basename(dest)}`)
    }
    const cover = photos[0]
    await fs.copyFile(path.join(dir, path.basename(cover)), path.join(dir, 'cover.jpg'))
    console.log(`  ${listing.id}: ${files.length} local photos`)
    return { cover: `/assets/listings/${listing.id}/cover.jpg`, photos }
  }

  // Download from wasi.co (use og_image first for cover, then unique large URLs)
  const urls = []
  if (listing.og_image && !listing._image_urls.includes(listing.og_image)) {
    urls.push(listing.og_image)
  }
  urls.push(...listing._image_urls)

  const photos = []
  for (let i = 0; i < urls.length; i++) {
    const slot = String(photos.length + 1).padStart(2, '0')
    const dest = path.join(dir, `${slot}.jpg`)
    try {
      const bytes = await downloadFile(urls[i], dest)
      // Filter tiny/error responses (wasi sometimes returns ~600 byte placeholders)
      if (bytes < 8000) {
        await fs.unlink(dest)
        continue
      }
      photos.push(`/assets/listings/${listing.id}/${path.basename(dest)}`)
    } catch (e) {
      console.warn(`  ${listing.id}: image ${i + 1} failed:`, e.message)
      try { await fs.unlink(dest) } catch {}
    }
  }

  if (photos.length === 0) {
    console.warn(`  ${listing.id}: NO IMAGES`)
    return { cover: null, photos: [] }
  }

  const cover = photos[0]
  await fs.copyFile(path.join(ROOT, cover.slice(1)), path.join(dir, 'cover.jpg'))
  console.log(`  ${listing.id}: ${photos.length} photos downloaded`)
  return { cover: `/assets/listings/${listing.id}/cover.jpg`, photos }
}

async function main() {
  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true })
  await fs.mkdir(OUT_ASSETS, { recursive: true })

  const files = (await fs.readdir(SRC_DIR)).filter(f => f.endsWith('.html')).sort()
  console.log(`Parsing ${files.length} listings…`)

  const listings = []
  for (const f of files) {
    try {
      const listing = await processListing(f)
      console.log(`✓ ${listing.id}: ${listing.title} — $${listing.price_cop?.toLocaleString('es-CO')} (${listing.agent})`)
      listings.push(listing)
    } catch (e) {
      console.error(`✗ ${f}:`, e.message)
    }
  }

  console.log(`\nDownloading images for ${listings.length} listings…`)
  for (const listing of listings) {
    const { cover, photos } = await downloadImages(listing)
    listing.cover = cover
    listing.photos = photos
    delete listing._image_urls
    delete listing.og_image
  }

  // Sort: by city then price desc
  listings.sort((a, b) => {
    if (a.city !== b.city) return a.city.localeCompare(b.city)
    return (b.price_cop || 0) - (a.price_cop || 0)
  })

  await fs.writeFile(OUT_JSON, JSON.stringify(listings, null, 2))
  console.log(`\nWrote ${OUT_JSON}`)

  // Generate index.html
  await fs.writeFile(OUT_INDEX, renderIndex(listings))
  console.log(`Wrote ${OUT_INDEX}`)

  // Generate detail pages
  await fs.mkdir(OUT_DETAIL_DIR, { recursive: true })
  for (const listing of listings) {
    const p = path.join(OUT_DETAIL_DIR, `${listing.id}.html`)
    await fs.writeFile(p, renderDetail(listing))
  }
  console.log(`Wrote ${listings.length} detail pages in ${OUT_DETAIL_DIR}/`)

  // Generate sitemap.xml
  const today = new Date().toISOString().slice(0, 10)
  const urls = [
    { loc: 'https://nardavalderrama.com/', priority: '1.0', changefreq: 'weekly' },
    ...listings.map(l => ({
      loc: `https://nardavalderrama.com/apartamentos/${l.id}.html`,
      priority: '0.8',
      changefreq: 'monthly',
    })),
  ]
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`
  await fs.writeFile(path.join(ROOT, 'sitemap.xml'), sitemapXml)
  console.log(`Wrote sitemap.xml (${urls.length} URLs)`)

  // robots.txt — explicit allow for search + AI bots, declare sitemap
  const robotsTxt = `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://nardavalderrama.com/sitemap.xml
`
  await fs.writeFile(path.join(ROOT, 'robots.txt'), robotsTxt)
  console.log(`Wrote robots.txt`)

  console.log(`\nTotal: ${listings.length} listings`)
}

main().catch(e => { console.error(e); process.exit(1) })
