// HTML templates for index page + per-listing detail pages.
// Pure functions: data in, HTML string out.

const SITE_TITLE = 'Apartamentos en Medellín 2026 | Narda Valderrama'
const SITE_DESCRIPTION =
  'Inmuebles seleccionados en Medellín y el Valle de Aburrá. Asesoría personalizada por WhatsApp con Narda Valderrama y su equipo.'

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(SITE_TITLE)}</title>
    <meta name="description" content="${escapeHtml(SITE_DESCRIPTION)}" />
    <meta name="theme-color" content="#0b3f4a" />
    <meta property="og:title" content="${escapeHtml(SITE_TITLE)}" />
    <meta property="og:description" content="${escapeHtml(SITE_DESCRIPTION)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://nardavalderrama.com/" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./styles.css" />
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

    <script src="./app.js" defer></script>
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
    .map(
      (p, i) =>
        `<button class="gallery__thumb${i === 0 ? ' is-active' : ''}" data-idx="${i}" aria-label="Foto ${i + 1}"><img src="${escapeHtml(p)}" alt="" decoding="async"></button>`
    )
    .join('')

  const ogTitle = `${listing.title} | ${price} COP`
  const cover = listing.cover || photos[0] || ''

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(ogTitle)}</title>
    <meta name="description" content="${escapeHtml(
      `${listing.type} en ${formatLocation(listing)}. ${price} COP. ${cardMetaLine(listing)}.`
    )}" />
    <meta name="theme-color" content="#0b3f4a" />
    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(`${listing.type} en ${formatLocation(listing)}`)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://nardavalderrama.com/apartamentos/${escapeHtml(listing.id)}.html" />
    ${cover ? `<meta property="og:image" content="https://nardavalderrama.com${escapeHtml(cover)}" />` : ''}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="../styles.css" />
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
    <script src="../app.js" defer></script>
  </body>
</html>
`
}
