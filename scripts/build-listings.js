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
  // Strip the duplicate inner <p> and "Código..." sentence
  let text = m[1].replace(/<\/?p>/g, '\n').replace(/\s+/g, ' ').trim()
  text = text.replace(/^Código\.[^.]*\.\s*/i, '')
  return decodeEntities(text)
}

function buildTransformerUrl(key, width = 979, height = 743) {
  const spec = {
    bucket: 'staticw',
    key,
    edits: {
      normalise: true,
      rotate: 0,
      resize: { width, height, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } },
    },
  }
  const b64 = Buffer.from(JSON.stringify(spec)).toString('base64')
  return `https://image.wasi.co/${b64}`
}

function getImageUrls(html) {
  // Three formats:
  //   wasi.co: image.wasi.co/<base64-json> — JSON encodes width + key
  //   luzes/direct: images.wasi.co/inmuebles/<key>.jpe?g — already large
  //   luzes/thumb-only: only 320px transformer URLs; reconstruct large versions from key
  const seenKey = new Set()
  const items = []
  const smallByKey = new Map() // key → original URL (for fallback width upgrade)

  // 1) image.wasi.co transformer URLs
  for (const m of html.matchAll(/https:\/\/image\.wasi\.co\/[A-Za-z0-9+/=_-]+/g)) {
    const url = m[0]
    const b64 = url.split('/').pop()
    try {
      const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
      const w = json?.edits?.resize?.width || 0
      const key = json?.key
      if (!key) continue
      if (w >= 600) {
        if (!seenKey.has(key)) {
          seenKey.add(key)
          items.push(url)
        }
      } else if (!smallByKey.has(key)) {
        smallByKey.set(key, url)
      }
    } catch {
      // ignore malformed
    }
  }

  // 1b) Promote remaining small-only keys to a freshly-built large URL
  for (const [key] of smallByKey) {
    if (seenKey.has(key)) continue
    seenKey.add(key)
    items.push(buildTransformerUrl(key))
  }

  // 2) images.wasi.co/inmuebles direct URLs (luzes format) — by file name
  for (const m of html.matchAll(/https:\/\/images\.wasi\.co\/inmuebles\/[^"'\s)]+\.(?:jpe?g|png|webp)/gi)) {
    const url = m[0]
    const name = url.split('/').pop()
    const key = `inmuebles/${name}`
    if (!seenKey.has(key)) {
      seenKey.add(key)
      items.push(url)
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

function deriveLocation(specs) {
  const city = (specs['Ciudad'] || '').replace(/\.$/, '').trim()
  const zone = (specs['Zona'] || '').trim()
  return { city: city || 'Medellín', neighborhood: zone || '' }
}

function deriveDisplayTitle(rawTitle, type, loc) {
  // Strip emojis, variation selectors, price, then split on pipes/dashes
  let t = (rawTitle || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/\$\s*[\d.,]+\s*(?:COP|USD)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  t = t.split(/\s*[|–]\s*/)[0].trim() // first segment before pipes
  // Strip leading verbs that don't help ("VENTA DE", "Venta")
  t = t.replace(/^venta\s+(de\s+)?/i, '').trim()
  // If still spammy or empty, fallback to "{type} en {neighborhood}, {city}"
  if (!t || t.length < 6) {
    if (loc.neighborhood) return `${type} en ${loc.neighborhood}, ${loc.city}`
    return `${type} en ${loc.city}`
  }
  // All-caps spammy titles → also use fallback unless they have decent structure
  if (/^[A-ZÁÉÍÓÚÑ\s\d°²]+$/.test(t) && t.length > 30) {
    if (loc.neighborhood) return `${type} en ${loc.neighborhood}, ${loc.city}`
    return `${type} en ${loc.city}`
  }
  return titleCaseSpanish(t)
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
  const location = deriveLocation(specs)
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
    const dest = path.join(dir, `${String(i + 1).padStart(2, '0')}.jpg`)
    if (await exists(dest)) {
      photos.push(`/assets/listings/${listing.id}/${path.basename(dest)}`)
      continue
    }
    try {
      const bytes = await downloadFile(urls[i], dest)
      if (bytes < 1000) {
        await fs.unlink(dest)
        continue
      }
      photos.push(`/assets/listings/${listing.id}/${path.basename(dest)}`)
    } catch (e) {
      console.warn(`  ${listing.id}: image ${i + 1} failed:`, e.message)
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

  console.log(`\nTotal: ${listings.length} listings`)
}

main().catch(e => { console.error(e); process.exit(1) })
