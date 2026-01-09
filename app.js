// Peace Lagoons landing page (vanilla)
// - Smooth section reveals
// - WhatsApp link wiring (placeholder by default)
// - Plan toggle

const WA_NUMBER_E164 = "15557581468";
const WA_PREFILL_MESSAGE =
  "Hola Narda, quiero información de Peace Lagoons. ¿Me compartes disponibilidad y opciones de unidades (Studio/1BR/2BR) y cómo sería el proceso de compra desde Colombia?";

function buildWhatsAppLink() {
  const base = `https://wa.me/${WA_NUMBER_E164}`;
  const text = encodeURIComponent(WA_PREFILL_MESSAGE);
  return `${base}?text=${text}`;
}

function wireWhatsAppLinks() {
  const waLink = buildWhatsAppLink();
  const links = document.querySelectorAll("[data-wa]");
  links.forEach((a) => {
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

function setupPlanToggle() {
  const btn = document.getElementById("togglePlan");
  const extra = document.getElementById("planExtra");
  if (!btn || !extra) return;

  btn.addEventListener("click", () => {
    const isHidden = extra.hasAttribute("hidden");
    if (isHidden) {
      extra.removeAttribute("hidden");
      btn.textContent = "Ocultar plano adicional";
      extra.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      extra.setAttribute("hidden", "");
      btn.textContent = "Ver plano adicional";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireWhatsAppLinks();
  setupReveals();
  setupPlanToggle();
});



