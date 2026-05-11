// Narda Valderrama — Apartments landing
// - Per-listing WhatsApp prefill (via window.__LISTING__ if set)
// - Smooth section reveals
// - Detail-page gallery (main + thumbs + arrows + keyboard)

const WA_NUMBER_E164 = "15557581468";

function buildWhatsAppLink() {
  const base = `https://wa.me/${WA_NUMBER_E164}`;
  const listing = window.__LISTING__;
  let text;
  if (listing && listing.id) {
    text = `Hola Narda, me interesa "${listing.title}" (id ${listing.id}). ¿Está disponible? ¿Me compartes más información?`;
  } else {
    text = "Hola Narda, me interesa uno de los inmuebles del catálogo. ¿Me compartes más información?";
  }
  return `${base}?text=${encodeURIComponent(text)}`;
}

function wireWhatsAppLinks() {
  const waLink = buildWhatsAppLink();
  document.querySelectorAll("[data-wa]").forEach((a) => {
    a.setAttribute("href", waLink);
    a.setAttribute("target", "_blank");
  });
}

function setupReveals() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}

function setupGallery() {
  const main = document.getElementById("galleryMain");
  const photos = window.__GALLERY__;
  if (!main || !photos || photos.length <= 1) return;

  const thumbs = document.querySelectorAll(".gallery__thumb");
  let idx = 0;

  function show(i) {
    idx = (i + photos.length) % photos.length;
    main.src = photos[idx];
    thumbs.forEach((t, j) => t.classList.toggle("is-active", j === idx));
    const active = thumbs[idx];
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  thumbs.forEach((t) => t.addEventListener("click", () => show(parseInt(t.dataset.idx, 10))));
  document.querySelector(".gallery__nav--prev")?.addEventListener("click", () => show(idx - 1));
  document.querySelector(".gallery__nav--next")?.addEventListener("click", () => show(idx + 1));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(idx - 1);
    else if (e.key === "ArrowRight") show(idx + 1);
  });

  main.style.cursor = "zoom-in";
  main.addEventListener("click", () => {
    window.open(photos[idx], "_blank", "noopener");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireWhatsAppLinks();
  setupReveals();
  setupGallery();
});
