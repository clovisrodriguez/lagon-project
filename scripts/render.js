// HTML templates for index page + per-listing detail pages.
// Pure functions: data in, HTML string out.

const SITE_URL = 'https://nardavalderrama.com'
const SITE_TITLE = 'Apartamentos en Medellín 2026 | Narda Valderrama'
const SITE_DESCRIPTION =
  'Inmuebles seleccionados en Medellín y el Valle de Aburrá. Asesoría personalizada por WhatsApp con Narda Valderrama y su equipo.'
const WHATSAPP_E164 = '+15557581468'

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Safely serialize JSON for embedding inside a <script type="application/ld+json"> tag.
// Without this, a "</script>" sequence inside any string would break out of the tag.
function jsonLdSafe(obj) {
  return JSON.stringify(obj).replace(/<\/(script)/gi, '<\\/$1')
}

function formatPriceCop(n) {
  if (!n) return ''
  return '$' + n.toLocaleString('es-CO')
}

function formatLocation(listing) {
  if (listing.neighborhood) return `${listing.neighborhood}, ${listing.city}`
  return listing.city
}

function cardMetaLine(listing) {
  const parts = []
  if (listing.bedrooms != null && listing.bedrooms > 0) parts.push(`${listing.bedrooms} hab`)
  if (listing.baths != null && listing.baths > 0) parts.push(`${listing.baths} baños`)
  if (listing.area_m2) parts.push(`${listing.area_m2} m²`)
  if (listing.estrato) parts.push(`Estrato ${listing.estrato}`)
  return parts.join(' · ')
}

function renderCard(listing) {
  const meta = cardMetaLine(listing)
  const cover = listing.cover || '/assets/listings/placeholder.jpg'
  return `
        <a class="listingCard reveal" href="/apartamentos/${escapeHtml(listing.id)}.html">
          <div class="listingCard__img">
            <img src="${escapeHtml(cover)}" alt="${escapeHtml(listing.title)}" loading="lazy" decoding="async">
          </div>
          <div class="listingCard__body">
            <div class="listingCard__tag">${escapeHtml(listing.type)} · ${escapeHtml(formatLocation(listing))}</div>
            <h3>${escapeHtml(listing.title)}</h3>
            <div class="listingCard__price">${escapeHtml(formatPriceCop(listing.price_cop))} COP</div>
            ${meta ? `<div class="listingCard__meta">${escapeHtml(meta)}</div>` : ''}
            <span class="listingCard__cta">Ver detalle →</span>
          </div>
        </a>`
}

export function renderIndex(listings) {
  const cards = listings.map(renderCard).join('')
  // Pick the most expensive listing's cover for og:image — most attractive social preview
  const heroListing = [...listings].sort((a, b) => (b.price_cop || 0) - (a.price_cop || 0))[0]
  const ogImage = heroListing && heroListing.cover ? `${SITE_URL}${heroListing.cover}` : `${SITE_URL}/assets/logo.jpeg`

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: 'Narda Valderrama',
      url: SITE_URL,
      image: `${SITE_URL}/assets/logo.jpeg`,
      logo: `${SITE_URL}/assets/logo.jpeg`,
      telephone: WHATSAPP_E164,
      description: SITE_DESCRIPTION,
      areaServed: [
        { '@type': 'City', name: 'Medellín' },
        { '@type': 'City', name: 'Envigado' },
        { '@type': 'City', name: 'Sabaneta' },
        { '@type': 'City', name: 'Itagüí' },
      ],
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Medellín',
        addressRegion: 'Antioquia',
        addressCountry: 'CO',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_TITLE,
      url: SITE_URL,
      inLanguage: 'es-CO',
      description: SITE_DESCRIPTION,
    },
  ]

  return `<!DOCTYPE html>
<html lang="es-CO">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(SITE_TITLE)}</title>
    <meta name="description" content="${escapeHtml(SITE_DESCRIPTION)}" />
    <meta name="theme-color" content="#0b3f4a" />
    <link rel="canonical" href="${SITE_URL}/" />
    <meta property="og:title" content="${escapeHtml(SITE_TITLE)}" />
    <meta property="og:description" content="${escapeHtml(SITE_DESCRIPTION)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${SITE_URL}/" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:locale" content="es_CO" />
    <meta property="og:site_name" content="Narda Valderrama" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(SITE_TITLE)}" />
    <meta name="twitter:description" content="${escapeHtml(SITE_DESCRIPTION)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./styles.css?v=2026051102" />
    <script type="application/ld+json">${jsonLdSafe(jsonLd)}</script>
  </head>
  <body>
    <a class="skip" href="#listings">Saltar al contenido</a>

    <header class="topbar" id="inicio">
      <div class="container topbar__inner">
        <div class="topbar__left">
          <a class="brand" href="/" aria-label="Narda Valderrama">
            <img src="./assets/logo.jpeg" alt="Narda Valderrama" decoding="async" />
          </a>
          <div class="topbar__meta">
            <span class="pill">Atención en español</span>
            <span class="sep">•</span>
            <span class="muted">Apartamentos en Medellín</span>
          </div>
        </div>
        <div class="topbar__right">
          <span class="topbar__agent muted">Agente: Narda Valderrama</span>
          <a class="btn btn--primary" data-wa href="#" rel="noopener">Hablar por WhatsApp</a>
        </div>
      </div>
    </header>

    <main>
      <section class="hero hero--listings">
        <div class="container hero__content reveal">
          <div class="hero__card hero__card--listings">
            <p class="eyebrow">Inmuebles seleccionados · Medellín 2026</p>
            <h1>Apartamentos y casas en Medellín, con asesoría 1:1</h1>
            <p class="lead">
              Una selección curada de inmuebles en El Poblado, Envigado, Sabaneta e Itagüí.
              Te acompaño en cada paso del proceso, en español y sin compromiso.
            </p>
            <div class="hero__cta">
              <a class="btn btn--primary btn--lg" href="#listings">Ver inmuebles</a>
              <a class="btn btn--ghost btn--lg" data-wa href="#" rel="noopener">Hablar por WhatsApp</a>
            </div>
          </div>
        </div>
      </section>

      <section class="section section--tight" id="listings">
        <div class="container">
          <div class="section__head reveal">
            <h2>${listings.length} inmuebles disponibles</h2>
            <p class="muted">Todos los precios en pesos colombianos (COP). La información puede cambiar sin previo aviso.</p>
          </div>
          <div class="listingGrid">${cards}
          </div>
        </div>
      </section>

      <section class="finalCta">
        <div class="container finalCta__inner reveal">
          <div>
            <h2>¿Te interesa alguno? Hablemos por WhatsApp</h2>
            <p>Te comparto detalles, fotos adicionales, agendamos visita y resolvemos dudas.</p>
            <p class="micro">Respuesta rápida · Atención en español</p>
          </div>
          <div class="finalCta__actions">
            <a class="btn btn--primary btn--lg" data-wa href="#" rel="noopener">Escribir por WhatsApp</a>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="container footer__inner">
        <p class="muted">
          Imágenes referenciales. La información puede cambiar sin previo aviso.
          Esta página no constituye oferta contractual.
        </p>
      </div>
    </footer>

    <a class="waFab" data-wa href="#" aria-label="Hablar por WhatsApp" rel="noopener">
      <span class="waFab__dot" aria-hidden="true"></span>
      WhatsApp
    </a>

    <script src="./app.js?v=2026051102" defer></script>
  </body>
</html>
`
}

export function renderDetail(listing) {
  const price = formatPriceCop(listing.price_cop)
  const photos = listing.photos || []
  const description = listing.description || ''

  const specItems = []
  if (listing.bedrooms != null && listing.bedrooms > 0)
    specItems.push({ k: 'Habitaciones', v: listing.bedrooms })
  if (listing.baths != null && listing.baths > 0) specItems.push({ k: 'Baños', v: listing.baths })
  if (listing.area_m2) specItems.push({ k: 'Área', v: `${listing.area_m2} m²` })
  if (listing.estrato) specItems.push({ k: 'Estrato', v: listing.estrato })
  if (listing.garage != null && listing.garage > 0)
    specItems.push({ k: 'Parqueaderos', v: listing.garage })
  if (listing.floor != null && listing.floor > 0) specItems.push({ k: 'Piso', v: listing.floor })

  const specsHtml = specItems
    .map(s => `<div class="specs__item"><dt>${escapeHtml(s.k)}</dt><dd>${escapeHtml(s.v)}</dd></div>`)
    .join('')

  const galleryThumbs = photos
    .map((p, i) => {
      // Eager-load first 5 thumbs, lazy-load the rest — improves LCP on long galleries
      const loadAttr = i < 5 ? '' : 'loading="lazy" '
      return `<button class="gallery__thumb${i === 0 ? ' is-active' : ''}" data-idx="${i}" aria-label="Foto ${i + 1}"><img src="${escapeHtml(p)}" alt="" ${loadAttr}decoding="async"></button>`
    })
    .join('')

  const ogTitle = `${listing.title} | ${price} COP`
  const cover = listing.cover || photos[0] || ''
  const canonicalUrl = `${SITE_URL}/apartamentos/${listing.id}.html`
  const absoluteImages = photos.slice(0, 8).map(p => `${SITE_URL}${p}`)

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description || `${listing.type} en ${formatLocation(listing)}. ${cardMetaLine(listing)}.`,
    image: absoluteImages,
    sku: listing.id,
    brand: { '@type': 'Brand', name: 'Narda Valderrama' },
    offers: listing.price_cop
      ? {
          '@type': 'Offer',
          price: String(listing.price_cop),
          priceCurrency: 'COP',
          availability: 'https://schema.org/InStock',
          url: canonicalUrl,
          seller: { '@type': 'RealEstateAgent', name: 'Narda Valderrama', url: SITE_URL },
        }
      : undefined,
    additionalProperty: [
      listing.type && { '@type': 'PropertyValue', name: 'Tipo de inmueble', value: listing.type },
      listing.bedrooms != null && listing.bedrooms > 0 && { '@type': 'PropertyValue', name: 'Habitaciones', value: String(listing.bedrooms) },
      listing.baths != null && listing.baths > 0 && { '@type': 'PropertyValue', name: 'Baños', value: String(listing.baths) },
      listing.area_m2 && { '@type': 'PropertyValue', name: 'Área construida', value: `${listing.area_m2} m²`, unitText: 'MTK' },
      listing.estrato && { '@type': 'PropertyValue', name: 'Estrato', value: String(listing.estrato) },
      listing.garage != null && listing.garage > 0 && { '@type': 'PropertyValue', name: 'Parqueaderos', value: String(listing.garage) },
      listing.floor != null && listing.floor > 0 && { '@type': 'PropertyValue', name: 'Piso', value: String(listing.floor) },
      listing.neighborhood && { '@type': 'PropertyValue', name: 'Zona', value: listing.neighborhood },
      listing.city && { '@type': 'PropertyValue', name: 'Ciudad', value: listing.city },
    ].filter(Boolean),
  }
  if (!productJsonLd.offers) delete productJsonLd.offers

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inmuebles', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: listing.title, item: canonicalUrl },
    ],
  }

  const detailDesc = `${listing.type} en ${formatLocation(listing)}. ${price} COP. ${cardMetaLine(listing)}.`.replace(/\s+/g, ' ').trim()
  const absoluteCover = cover ? `${SITE_URL}${cover}` : `${SITE_URL}/assets/logo.jpeg`

  return `<!DOCTYPE html>
<html lang="es-CO">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(ogTitle)}</title>
    <meta name="description" content="${escapeHtml(detailDesc)}" />
    <meta name="theme-color" content="#0b3f4a" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(detailDesc)}" />
    <meta property="og:type" content="product" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${escapeHtml(absoluteCover)}" />
    <meta property="og:locale" content="es_CO" />
    <meta property="og:site_name" content="Narda Valderrama" />
    <meta property="product:price:amount" content="${listing.price_cop || ''}" />
    <meta property="product:price:currency" content="COP" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(detailDesc)}" />
    <meta name="twitter:image" content="${escapeHtml(absoluteCover)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="../styles.css?v=2026051102" />
    <script type="application/ld+json">${jsonLdSafe(productJsonLd)}</script>
    <script type="application/ld+json">${jsonLdSafe(breadcrumbJsonLd)}</script>
  </head>
  <body>
    <a class="skip" href="#detail">Saltar al contenido</a>

    <header class="topbar" id="inicio">
      <div class="container topbar__inner">
        <div class="topbar__left">
          <a class="brand" href="/" aria-label="Narda Valderrama">
            <img src="../assets/logo.jpeg" alt="Narda Valderrama" decoding="async" />
          </a>
          <div class="topbar__meta">
            <a class="pill pill--link" href="/">← Ver todos los inmuebles</a>
          </div>
        </div>
        <div class="topbar__right">
          <a class="btn btn--primary" data-wa href="#" rel="noopener">Hablar por WhatsApp</a>
        </div>
      </div>
    </header>

    <main id="detail" class="detail">
      <div class="container">
        <nav class="breadcrumb"><a href="/">Inmuebles</a> <span>›</span> <span>${escapeHtml(listing.title)}</span></nav>

        <header class="detail__header reveal">
          <div class="detail__tag">${escapeHtml(listing.type)} · ${escapeHtml(formatLocation(listing))}${listing.agent ? ` · ${escapeHtml(listing.agent)}` : ''}</div>
          <h1>${escapeHtml(listing.title)}</h1>
          <div class="detail__price">${escapeHtml(price)} <span class="detail__priceCcy">COP</span></div>
        </header>

        ${photos.length ? `<section class="gallery reveal">
          <div class="gallery__main">
            <img id="galleryMain" src="${escapeHtml(photos[0])}" alt="${escapeHtml(listing.title)}" decoding="async" />
            ${photos.length > 1 ? `<button class="gallery__nav gallery__nav--prev" aria-label="Foto anterior">‹</button>
            <button class="gallery__nav gallery__nav--next" aria-label="Foto siguiente">›</button>` : ''}
          </div>
          ${photos.length > 1 ? `<div class="gallery__thumbs">${galleryThumbs}</div>` : ''}
        </section>` : ''}

        ${specsHtml ? `<section class="specs reveal"><dl class="specs__grid">${specsHtml}</dl></section>` : ''}

        ${description ? `<section class="desc reveal">
          <h2>Sobre este inmueble</h2>
          <p>${escapeHtml(description)}</p>
        </section>` : ''}

        <section class="ctaCard reveal">
          <div>
            <h2>¿Te interesa? Hablemos por WhatsApp</h2>
            <p>Te paso disponibilidad, fotos adicionales y agendamos visita.</p>
          </div>
          <a class="btn btn--primary btn--lg" data-wa href="#" rel="noopener">Hablar por WhatsApp</a>
        </section>
      </div>
    </main>

    <footer class="footer">
      <div class="container footer__inner">
        <p class="muted">
          Imágenes y especificaciones referenciales. La información puede cambiar sin previo aviso.
          Esta página no constituye oferta contractual.
        </p>
      </div>
    </footer>

    <a class="waFab" data-wa href="#" aria-label="Hablar por WhatsApp" rel="noopener">
      <span class="waFab__dot" aria-hidden="true"></span>
      WhatsApp
    </a>

    <script>
      window.__LISTING__ = ${JSON.stringify({
        id: listing.id,
        title: listing.title,
        url: `/apartamentos/${listing.id}.html`,
      })};
      window.__GALLERY__ = ${JSON.stringify(photos)};
    </script>
    <script src="../app.js?v=2026051102" defer></script>
  </body>
</html>
`
}
