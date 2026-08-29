/* =========================================================
   EDIT THESE FOR YOUR BUSINESS
   ========================================================= */
const STORE_NAME = "FARMTEK09 CENTRE";
const WHATSAPP_NUMBER = "254725528888";   // international format, digits only, no + or spaces
const PAYBILL_BUSINESS = "400200";        // Co-operative Bank Lipa na M-Pesa business number
const PAYBILL_ACCOUNT = "54095";          // account number
const LOCATION_NAME = "Lower Kabete, Nairobi";
const LOCATION_LAT = -1.2379275;
const LOCATION_LNG = 36.7267739;
const LOCATION_HOURS = "Open daily, 9:00 AM – 5:00 PM";
const MPESA_API_BASE = ""; // Empty = same domain. Use your backend URL only if frontend and backend are hosted separately.
/* ========================================================= */

const MAPS_EMBED_URL = `https://www.google.com/maps?q=${LOCATION_LAT},${LOCATION_LNG}&z=15&output=embed`;
const MAPS_DIRECTIONS_URL = `https://www.google.com/maps/search/?api=1&query=${LOCATION_LAT},${LOCATION_LNG}`;

const CATEGORY_ORDER = ["Bananas & Plantains", "Mangoes", "Avocados", "Tangerines", "Apples", "Grapes", "Lemons"];

const CATEGORY_ICONS = {
  "Bananas & Plantains": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3c-1 5 0 12 6 15 5 2 10-1 11-7-3 2-7 2-9 0"/><path d="M17 4c1 2 1 4 0 6"/></svg>`,
  "Mangoes": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4c4 0 7 4 7 8.5S16 21 12 21s-7-4.5-7-8.5S8 4 12 4Z"/><path d="M12 4c0-1.2.8-2 2-2.4"/></svg>`,
  "Avocados": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c4 1 6 6 6 10a6 6 0 0 1-12 0c0-4 2-9 6-10Z"/><circle cx="12" cy="14" r="2.6"/></svg>`,
  "Tangerines": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="13" r="8"/><path d="M12 5c1 0 2-1 2-2M9 4l1.5 1.5"/></svg>`,
  "Apples": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8c-3-3-8-1-8 4 0 5 4 9 8 9s8-4 8-9c0-5-5-7-8-4Z"/><path d="M12 8V4c0-1 1-2 2-2"/></svg>`,
  "Grapes": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="10" r="2.2"/><circle cx="14" cy="10" r="2.2"/><circle cx="6.5" cy="14.5" r="2.2"/><circle cx="11.5" cy="14.5" r="2.2"/><circle cx="16.5" cy="14.5" r="2.2"/><circle cx="9" cy="19" r="2.2"/><circle cx="14" cy="19" r="2.2"/><path d="M11 6V3M11 3c1.5 0 2-1 2-2"/></svg>`,
  "Lemons": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="12" rx="6.5" ry="8.5"/><path d="M5.7 8c1 .2 1.8-.4 2-1.4M18.3 16c-1-.2-1.8.4-2 1.4"/></svg>`,
};

const WHATSAPP_GLYPH = `<svg viewBox="0 0 32 32"><path d="M16.02 3C9.4 3 4 8.4 4 15.02c0 2.35.65 4.55 1.78 6.43L4 29l7.72-1.75a12.9 12.9 0 0 0 4.3.74h.01c6.62 0 12.02-5.4 12.02-12.02C28.05 8.4 22.65 3 16.02 3Zm7.05 17.13c-.3.83-1.7 1.6-2.36 1.7-.6.1-1.37.14-2.2-.14-.5-.16-1.16-.38-1.99-.75-3.5-1.52-5.79-5.05-5.97-5.29-.17-.24-1.43-1.9-1.43-3.63s.9-2.57 1.23-2.93c.32-.35.7-.44.94-.44.23 0 .47 0 .67.01.22.01.5-.08.78.6.3.7.99 2.44 1.08 2.62.09.17.15.38.03.62-.12.24-.18.38-.35.58-.18.2-.37.45-.53.6-.18.17-.36.36-.16.7.21.34.92 1.52 1.98 2.46 1.36 1.21 2.5 1.59 2.85 1.77.35.17.55.14.75-.08.2-.23.87-1 1.1-1.35.23-.35.46-.29.77-.17.32.12 2.02.95 2.37 1.13.35.17.58.26.66.4.09.15.09.85-.22 1.67Z"/></svg>`;

let allProducts = [];
let activeCategory = "All";
let searchTerm = "";

function waLink(text) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function genericGreeting() {
  return `Hi ${STORE_NAME}! I'd like to know more about your seedlings.`;
}

function orderMessage(p) {
  if (p.price == null) {
    return `Hi! I'd like to enquire about:\n\n${p.name}\n\nCould you let me know the price and availability?`;
  }
  return `Hi! I'd like to order:\n\n${p.name}\nPrice: Ksh ${p.price.toLocaleString()}\n\nI'll pay via M-Pesa Paybill ${PAYBILL_BUSINESS}, Account ${PAYBILL_ACCOUNT} (${STORE_NAME}) — please confirm availability.`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mediaHtml(p) {
  if (p.image) return `<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" width="300" height="300">`;
  return CATEGORY_ICONS[p.category] || CATEGORY_ICONS["Mangoes"];
}

function priceHtml(p) {
  if (p.price == null) return `<span class="card-price on-request">Price on request</span>`;
  return `<span class="card-price">Ksh ${p.price.toLocaleString()}</span>`;
}

function cardHtml(p) {
  const ctaLabel = p.price == null ? "Enquire on WhatsApp" : "Order on WhatsApp";
  return `
    <article class="card" data-product-id="${p.id}">
      <div class="card-media">${mediaHtml(p)}</div>
      <div class="card-body">
        <p class="card-category">${escapeHtml(p.category)}</p>
        <p class="card-name">${escapeHtml(p.name)}</p>
        ${priceHtml(p)}
        <a class="btn btn-order card-cta" href="${waLink(orderMessage(p))}" target="_blank" rel="noopener">
          ${WHATSAPP_GLYPH.replace('viewBox="0 0 32 32"', 'viewBox="0 0 32 32" width="16" height="16"')} ${ctaLabel}
        </a>
        ${p.price != null ? `<button class="btn btn-secondary card-pay-cta" type="button" data-pay-product="${escapeHtml(p.name)}" data-pay-amount="${p.price}">Pay via M-PESA</button>` : ""}
      </div>
    </article>
  `;
}

function render() {
  const grid = document.getElementById("productGrid");
  const empty = document.getElementById("emptyState");
  const countEl = document.getElementById("resultCount");
  const term = searchTerm.trim().toLowerCase();

  const filtered = allProducts.filter((p) => {
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    const matchesSearch = !term || p.name.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  countEl.textContent = `Showing ${filtered.length} of ${allProducts.length} products`;

  if (filtered.length === 0) {
    grid.innerHTML = "";
    grid.hidden = true;
    empty.hidden = false;
    document.getElementById("emptyQuery").textContent = searchTerm || "this category";
  } else {
    empty.hidden = true;
    grid.hidden = false;
    grid.innerHTML = filtered.map(cardHtml).join("");
  }
}

function buildCategoryPills() {
  const counts = {};
  allProducts.forEach((p) => (counts[p.category] = (counts[p.category] || 0) + 1));
  const cats = CATEGORY_ORDER.filter((c) => counts[c]);
  const pillsHtml = [`<button class="pill active" data-cat="All">All (${allProducts.length})</button>`]
    .concat(cats.map((c) => `<button class="pill" data-cat="${escapeHtml(c)}">${escapeHtml(c)} (${counts[c]})</button>`))
    .join("");
  const wrap = document.getElementById("categoryPills");
  wrap.innerHTML = pillsHtml;
  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    wrap.querySelectorAll(".pill").forEach((p) => p.classList.toggle("active", p === btn));
    render();
  });
}

function buildShelf() {
  const withPhotos = allProducts.filter((p) => p.image);
  const pool = (withPhotos.length >= 8 ? withPhotos : allProducts).slice(0, 14);
  const tags = pool.map((p) => `
      <div class="shelf-tag">
        <div class="shelf-tag-media">${mediaHtml(p)}</div>
        <div class="shelf-tag-name">${escapeHtml(p.name)}</div>
        <div class="shelf-tag-price">${p.price == null ? "Ask price" : "Ksh " + p.price.toLocaleString()}</div>
      </div>`).join("");
  document.getElementById("shelfTrack").innerHTML = tags + tags;
}

function wireWhatsappLinks() {
  const generic = waLink(genericGreeting());
  ["topbarWhatsapp", "heroWhatsapp", "footerWhatsapp", "floatingWhatsapp", "locationWhatsapp"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = generic;
  });
}

function applyBranding() {
  document.title = `${STORE_NAME} — Order on WhatsApp`;
  document.querySelectorAll(".js-store-name").forEach((el) => (el.textContent = STORE_NAME));
  document.querySelectorAll(".js-location-name").forEach((el) => (el.textContent = LOCATION_NAME));
  document.querySelectorAll(".js-hours").forEach((el) => (el.textContent = LOCATION_HOURS));
  document.querySelectorAll(".js-paybill-business").forEach((el) => (el.textContent = PAYBILL_BUSINESS));
  document.querySelectorAll(".js-paybill-account").forEach((el) => (el.textContent = PAYBILL_ACCOUNT));
  const mapFrame = document.getElementById("mapFrame");
  if (mapFrame) mapFrame.src = MAPS_EMBED_URL;
  const directionsLink = document.getElementById("directionsLink");
  if (directionsLink) directionsLink.href = MAPS_DIRECTIONS_URL;
}

function wireCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    const defaultLabel = btn.textContent;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = defaultLabel;
          btn.classList.remove("copied");
        }, 1800);
      } catch (err) {
        // Clipboard API unavailable — the number is already visible on the page.
      }
    });
  });
}

function showMpesaPanel(productName = "", amount = "") {
  const panel = document.getElementById("mpesaPaymentPanel");
  const amountInput = document.getElementById("mpesaAmount");
  const referenceInput = document.getElementById("mpesaReference");
  if (!panel) return;
  panel.hidden = false;
  if (amountInput && amount) amountInput.value = amount;
  if (referenceInput) {
    const cleaned = String(productName || "FARMTEK09")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12) || "FARMTEK09";
    referenceInput.value = cleaned;
  }
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("mpesaPhone")?.focus();
}

function setMpesaStatus(message, state = "") {
  const el = document.getElementById("mpesaStatus");
  if (!el) return;
  el.textContent = message;
  el.dataset.state = state;
}

async function startMpesaPayment() {
  const phoneEl = document.getElementById("mpesaPhone");
  const amountEl = document.getElementById("mpesaAmount");
  const referenceEl = document.getElementById("mpesaReference");
  const submitBtn = document.getElementById("mpesaSubmit");
  if (!phoneEl || !amountEl || !referenceEl || !submitBtn) return;

  const phone = phoneEl.value.trim();
  const amount = Number(amountEl.value);
  const accountReference = referenceEl.value.trim().toUpperCase();

  if (!/^((07|01)\d{8}|254[17]\d{8}|\+254[17]\d{8})$/.test(phone.replace(/\s/g, ""))) {
    setMpesaStatus("Enter a valid Kenyan M-PESA number, e.g. 0712345678.", "error");
    phoneEl.focus();
    return;
  }
  if (!Number.isInteger(amount) || amount < 1) {
    setMpesaStatus("Enter a valid whole-number amount of at least KES 1.", "error");
    amountEl.focus();
    return;
  }
  if (!/^[A-Z0-9._ -]{1,12}$/.test(accountReference)) {
    setMpesaStatus("Use up to 12 letters, numbers, spaces, dots, underscores or hyphens for the reference.", "error");
    referenceEl.focus();
    return;
  }

  submitBtn.disabled = true;
  setMpesaStatus("Connecting to M-PESA…", "pending");

  try {
    const response = await fetch(`${MPESA_API_BASE}/api/mpesa/stk-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        amount,
        accountReference,
        transactionDesc: "FARMTEK09 payment"
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Unable to start the M-PESA payment.");
    }

    setMpesaStatus("STK prompt sent. Check your phone and enter your M-PESA PIN.", "pending");
    await pollMpesaStatus(data.checkoutRequestId);
  } catch (error) {
    console.error("M-PESA payment error:", error);
    setMpesaStatus(error.message || "Payment could not be started.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

async function pollMpesaStatus(checkoutRequestId) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const response = await fetch(`${MPESA_API_BASE}/api/mpesa/status/${encodeURIComponent(checkoutRequestId)}`);
    if (!response.ok) continue;
    const data = await response.json();
    if (data.status === "success") {
      setMpesaStatus(`Payment received. M-PESA receipt: ${data.receipt || "confirmed"}.`, "success");
      return;
    }
    if (data.status === "failed") {
      setMpesaStatus(`Payment was not completed: ${data.resultDesc || "transaction cancelled or failed"}.`, "error");
      return;
    }
  }
  setMpesaStatus("The prompt is still pending. Check your M-PESA messages; your payment will be confirmed after the Safaricom callback.", "pending");
}

function wireMpesa() {
  document.getElementById("payNowButton")?.addEventListener("click", () => showMpesaPanel());
  document.getElementById("mpesaSubmit")?.addEventListener("click", startMpesaPayment);
  document.getElementById("mpesaPaymentPanel")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("input")) startMpesaPayment();
  });
  document.getElementById("productGrid")?.addEventListener("click", (event) => {
    const btn = event.target.closest(".card-pay-cta");
    if (!btn) return;
    showMpesaPanel(btn.dataset.payProduct, btn.dataset.payAmount);
  });
}

function wireControls() {
  document.getElementById("searchInput").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    render();
  });
  document.getElementById("clearFilters").addEventListener("click", () => {
    searchTerm = "";
    activeCategory = "All";
    document.getElementById("searchInput").value = "";
    document.querySelectorAll(".pill").forEach((p) => p.classList.toggle("active", p.dataset.cat === "All"));
    render();
  });
}

async function init() {
  applyBranding();
  wireWhatsappLinks();
  wireCopyButtons();
  wireControls();
  wireMpesa();

  const floatingWhatsapp = document.getElementById("floatingWhatsapp");
  if (floatingWhatsapp) floatingWhatsapp.innerHTML = WHATSAPP_GLYPH;

  const topbarWhatsapp = document.getElementById("topbarWhatsapp");
  if (topbarWhatsapp) {
    topbarWhatsapp.innerHTML = `${WHATSAPP_GLYPH.replace('viewBox="0 0 32 32"', 'viewBox="0 0 32 32" width="16" height="16"')} 0725 528 888`;
  }

  try {
    const res = await fetch("products.json");
    if (!res.ok) throw new Error(`Could not load products.json (${res.status})`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("products.json must contain a JSON array");

    allProducts = data;
    buildCategoryPills();
    buildShelf();
    render();
  } catch (error) {
    console.error("Storefront failed to load:", error);
    const grid = document.getElementById("productGrid");
    const resultCount = document.getElementById("resultCount");
    if (grid) {
      grid.hidden = false;
      grid.innerHTML = '<p class="load-error">Products could not be loaded. Please refresh the page or contact us on WhatsApp.</p>';
    }
    if (resultCount) resultCount.textContent = "Catalogue unavailable";
  }
}

init();
