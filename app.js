// Peace Lagoons landing page (vanilla)
// - Smooth section reveals
// - WhatsApp link wiring (placeholder by default)
// - Plan toggle

const DEFAULT_WA_LINK = "#"; // TODO: replace with final https://wa.me/<E164>?text=<encoded>

function wireWhatsAppLinks() {
  const links = document.querySelectorAll("[data-wa]");
  links.forEach((a) => {
    a.setAttribute("href", DEFAULT_WA_LINK);
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


