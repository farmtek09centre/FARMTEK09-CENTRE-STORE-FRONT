const STORE = {
  name: "FARMTEK09 CENTRE",
  whatsapp: "254725528888",
  paybill: "400200",
  account: "54095",
  location: "Lower Kabete, Nairobi",
  lat: -1.2379275,
  lng: 36.7267739,
  hours: "Open daily, 9:00 AM – 5:00 PM"
};

const ICONS = {
  default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c4 1 7 5 7 9.5a7 7 0 0 1-14 0C5 8 8 4 12 3Z"/><path d="M12 3v18"/></svg>`,
  "Bananas & Plantains": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3c-1 5 0 12 6 15 5 2 10-1 11-7-3 2-7 2-9 0"/><path d="M17 4c1 2 1 4 0 6"/></svg>`,
  "Mangoes": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4c4 0 7 4 7 8.5S16 21 12 21s-7-4.5-7-8.5S8 4 12 4Z"/><path d="M12 4c0-1.2.8-2 2-2.4"/></svg>`,
  "Avocados": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c4 1 6 6 6 10a6 6 0 0 1-12 0c0-4 2-9 6-10Z"/><circle cx="12" cy="14" r="2.6"/></svg>`,
  "Tangerines": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="13" r="8"/><path d="M12 5c1 0 2-1 2-2M9 4l1.5 1.5"/></svg>`,
  "Apples": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8c-3-3-8-1-8 4 0 5 4 9 8 9s8-4 8-9c0-5-5-7-8-4Z"/><path d="M12 8V4c0-1 1-2 2-2"/></svg>`,
  "Grapes": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="10" r="2.2"/><circle cx="14" cy="10" r="2.2"/><circle cx="6.5" cy="14.5" r="2.2"/><circle cx="11.5" cy="14.5" r="2.2"/><circle cx="16.5" cy="14.5" r="2.2"/><circle cx="9" cy="19" r="2.2"/><circle cx="14" cy="19" r="2.2"/><path d="M11 6V3M11 3c1.5 0 2-1 2-2"/></svg>`
};

let products = [];
let activeCategory = "All";
let searchTerm = "";
let sortMode = "featured";
let catalogueVersion = "";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (value) => Number(value).toLocaleString("en-KE");
const whatsapp = (text) => `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(text)}`;

function mediaHtml(product, cls = "") {
  if (product.image) return `<img class="${cls}" src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" width="500" height="500">`;
  return `<div class="fallback-icon ${cls}">${ICONS[product.category] || ICONS.default}</div>`;
}

function stockState(product) {
  if (product.stock == null) return { label: "Availability to confirm", className: "stock-unknown", disabled: false };
  const count = Number(product.stock);
  if (count <= 0) return { label: "Out of stock", className: "stock-out", disabled: true };
  if (count <= 5) return { label: `Low stock · ${count}`, className: "stock-low", disabled: false };
  return { label: `${count} in stock`, className: "stock-ok", disabled: false };
}

function productOrderMessage(product) {
  if (product.price == null) return `Hi ${STORE.name}! I'd like to enquire about ${product.name}. Please share the current price and availability.`;
  return `Hi ${STORE.name}! I'd like to order ${product.name} at KES ${money(product.price)}. Please confirm availability.`;
}

function sortedProducts(list) {
  const copy = [...list];
  if (sortMode === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sortMode === "price-low") return copy.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  if (sortMode === "price-high") return copy.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
  return copy.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name));
}

function currentMatches() {
  const query = searchTerm.trim().toLowerCase();
  return sortedProducts(products.filter((product) => {
    const categoryMatch = activeCategory === "All" || product.category === activeCategory;
    const searchable = `${product.name} ${product.category} ${product.blurb || ""}`.toLowerCase();
    return categoryMatch && (!query || searchable.includes(query));
  }));
}

function cardHtml(product) {
  const stock = stockState(product);
  const badge = product.badge || (product.featured ? "Featured" : "");
  const price = product.price == null ? `<span class="card-price on-request">Price on request</span>` : `<span class="card-price">KES ${money(product.price)}</span>`;
  const addButton = product.price != null ? `<button class="btn btn-primary add-to-cart" type="button" data-add-id="${esc(product.id)}" ${stock.disabled ? "disabled" : ""}>Add to cart</button>` : `<a class="btn btn-secondary" href="${whatsapp(productOrderMessage(product))}" target="_blank" rel="noopener">Enquire on WhatsApp</a>`;
  return `<article class="card" data-product-id="${esc(product.id)}">
    <div class="card-media">${mediaHtml(product)}${badge ? `<span class="product-badge">${esc(badge)}</span>` : ""}</div>
    <div class="card-body">
      <p class="card-category">${esc(product.category)}</p>
      <button class="card-name card-name-button" type="button" data-details-id="${esc(product.id)}">${esc(product.name)}</button>
      <p class="card-blurb">${esc(product.blurb || "Planting material and nursery stock.")}</p>
      <div class="card-meta"><div>${price}</div><span class="stock-badge ${stock.className}">${esc(stock.label)}</span></div>
      <div class="card-actions">${addButton}<button class="btn btn-secondary card-details" type="button" data-details-id="${esc(product.id)}">Details</button></div>
      <a class="card-whatsapp" href="${whatsapp(productOrderMessage(product))}" target="_blank" rel="noopener">Order / enquire on WhatsApp</a>
    </div>
  </article>`;
}

function featuredHtml(product) {
  const stock = stockState(product);
  return `<button class="featured-card" type="button" data-details-id="${esc(product.id)}"><div class="featured-media">${mediaHtml(product)}</div><div class="featured-copy"><span>${esc(product.badge || "Featured")}</span><strong>${esc(product.name)}</strong><em>${product.price == null ? "Price on request" : `KES ${money(product.price)}`}</em><small>${esc(stock.label)}</small></div></button>`;
}

function renderCategories() {
  const counts = products.reduce((acc, product) => { acc[product.category] = (acc[product.category] || 0) + 1; return acc; }, {});
  const categories = Object.keys(counts).sort((a, b) => a.localeCompare(b));
  $("categoryPills").innerHTML = [`<button class="pill ${activeCategory === "All" ? "active" : ""}" data-category="All">All (${products.length})</button>`, ...categories.map((category) => `<button class="pill ${activeCategory === category ? "active" : ""}" data-category="${esc(category)}">${esc(category)} (${counts[category]})</button>`)].join("");
}

function renderFeatured() {
  const chosen = products.filter((p) => p.featured).slice(0, 6);
  const fallback = chosen.length ? chosen : products.filter((p) => p.price != null).slice(0, 6);
  $("featuredSection").hidden = fallback.length === 0;
  $("featuredGrid").innerHTML = fallback.map(featuredHtml).join("");
}

function renderShelf() {
  const pool = products.filter((p) => p.image).slice(0, 12);
  const source = pool.length >= 6 ? pool : products.slice(0, 12);
  const html = source.map((p) => `<div class="shelf-tag"><div class="shelf-tag-media">${mediaHtml(p)}</div><div class="shelf-tag-name">${esc(p.name)}</div><div class="shelf-tag-price">${p.price == null ? "Ask price" : `KES ${money(p.price)}`}</div></div>`).join("");
  $("shelfTrack").innerHTML = html + html;
}

function renderProducts() {
  const filtered = currentMatches();
  $("resultCount").textContent = `Showing ${filtered.length} of ${products.length} products`;
  if (!filtered.length) {
    $("productGrid").innerHTML = "";
    $("productGrid").hidden = true;
    $("emptyState").hidden = false;
    $("emptyQuery").textContent = searchTerm || activeCategory;
    return;
  }
  $("emptyState").hidden = true;
  $("productGrid").hidden = false;
  $("productGrid").innerHTML = filtered.map(cardHtml).join("");
}

function openDetails(product) {
  if (!product) return;
  const stock = stockState(product);
  const price = product.price == null ? "Price on request" : `KES ${money(product.price)}`;
  $("modalProductContent").innerHTML = `<div class="modal-product-grid"><div class="modal-product-media">${mediaHtml(product)}</div><div class="modal-product-copy"><p class="eyebrow">${esc(product.category)}</p><h2 id="modalProductName">${esc(product.name)}</h2><p>${esc(product.blurb || "Planting material and nursery stock.")}</p><div class="modal-price">${price}</div><span class="stock-badge ${stock.className}">${esc(stock.label)}</span><div class="modal-actions">${product.price != null && !stock.disabled ? `<button class="btn btn-primary" id="modalAddButton" type="button">Add to cart</button>` : ""}<a class="btn btn-whatsapp" href="${whatsapp(productOrderMessage(product))}" target="_blank" rel="noopener">WhatsApp</a></div></div></div>`;
  $("productModal").hidden = false;
  $("modalAddButton")?.addEventListener("click", () => document.dispatchEvent(new CustomEvent("store:add-to-cart", { detail: product })));
}

function applyBranding() {
  document.title = `${STORE.name} — Nursery & Farm Shop`;
  document.querySelectorAll(".js-store-name").forEach((el) => el.textContent = STORE.name);
  document.querySelectorAll(".js-location-name").forEach((el) => el.textContent = STORE.location);
  document.querySelectorAll(".js-hours").forEach((el) => el.textContent = STORE.hours);
  document.querySelectorAll(".js-paybill-business").forEach((el) => el.textContent = STORE.paybill);
  document.querySelectorAll(".js-paybill-account").forEach((el) => el.textContent = STORE.account);
  const map = $("mapFrame");
  if (map) map.src = `https://www.google.com/maps?q=${STORE.lat},${STORE.lng}&z=15&output=embed`;
  $("directionsLink").href = `https://www.google.com/maps/search/?api=1&query=${STORE.lat},${STORE.lng}`;
  const generic = whatsapp(`Hi ${STORE.name}! I'd like to know more about your nursery stock.`);
  ["topbarWhatsapp", "heroWhatsapp", "footerWhatsapp", "floatingWhatsapp", "locationWhatsapp"].forEach((id) => { const el = $(id); if (el) el.href = generic; });
  $("topbarWhatsapp").textContent = "WhatsApp";
  $("floatingWhatsapp").innerHTML = "WhatsApp";
}

async function loadCatalogue() {
  const cacheBust = Date.now();
  try {
    const apiResponse = await fetch(`/api/catalogue?ts=${cacheBust}`, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (apiResponse.ok) return await apiResponse.json();
  } catch (_) {}
  const fallback = await fetch(`data/catalogue.json?ts=${cacheBust}`, { cache: "no-store" });
  return fallback.json();
}

async function readCatalogueVersion() {
  const response = await fetch(`/api/catalogue-version?ts=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("Catalogue version unavailable.");
  const data = await response.json();
  return String(data.version || "");
}

async function syncCatalogue() {
  if (document.hidden) return;
  try {
    const nextVersion = await readCatalogueVersion();
    if (!catalogueVersion) {
      catalogueVersion = nextVersion;
      return;
    }
    if (!nextVersion || nextVersion === catalogueVersion) return;

    const latest = await loadCatalogue();
    if (!Array.isArray(latest)) return;
    products = latest;
    catalogueVersion = nextVersion;
    window.__FARMTEK09_PRODUCTS__ = products;
    renderCategories();
    renderFeatured();
    renderShelf();
    renderProducts();
    document.dispatchEvent(new CustomEvent("catalogue:updated", { detail: products }));
  } catch (error) {
    console.debug("Catalogue sync check failed.", error);
  }
}

function wireStaticControls() {
  $("searchInput").addEventListener("input", (event) => { searchTerm = event.target.value; renderProducts(); });
  $("sortSelect").addEventListener("change", (event) => { sortMode = event.target.value; renderProducts(); });
  $("categoryPills").addEventListener("click", (event) => { const button = event.target.closest("[data-category]"); if (!button) return; activeCategory = button.dataset.category; renderCategories(); renderProducts(); });
  $("clearFilters").addEventListener("click", () => { searchTerm = ""; activeCategory = "All"; $("searchInput").value = ""; renderCategories(); renderProducts(); });
  $("featuredBrowseButton").addEventListener("click", () => $("catalogue").scrollIntoView({ behavior: "smooth" }));
  $("productGrid").addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-id]");
    if (add) { const product = products.find((p) => p.id === add.dataset.addId); if (product) document.dispatchEvent(new CustomEvent("store:add-to-cart", { detail: product })); return; }
    const details = event.target.closest("[data-details-id]");
    if (details) openDetails(products.find((p) => p.id === details.dataset.detailsId));
  });
  $("featuredGrid").addEventListener("click", (event) => { const button = event.target.closest("[data-details-id]"); if (button) openDetails(products.find((p) => p.id === button.dataset.detailsId)); });
  $("modalClose").addEventListener("click", () => { $("productModal").hidden = true; });
  $("productModal").addEventListener("click", (event) => { if (event.target.matches("[data-close-modal]")) $("productModal").hidden = true; });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") $("productModal").hidden = true; });
  document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => { try { await navigator.clipboard.writeText(button.dataset.copy); const label = button.textContent; button.textContent = "Copied!"; setTimeout(() => button.textContent = label, 1500); } catch (_) {} }));
  $("openCartFromPayment").addEventListener("click", () => document.dispatchEvent(new Event("store:open-cart")));
  $("cartOpenButton").addEventListener("click", () => document.dispatchEvent(new Event("store:open-cart")));
}

async function init() {
  applyBranding();
  wireStaticControls();
  try {
    products = await loadCatalogue();
    if (!Array.isArray(products)) throw new Error("Catalogue response is invalid.");
    window.__FARMTEK09_PRODUCTS__ = products;
    renderCategories();
    renderFeatured();
    renderShelf();
    renderProducts();
    document.dispatchEvent(new CustomEvent("catalogue:ready", { detail: products }));
  } catch (error) {
    console.error(error);
    $("productGrid").innerHTML = `<div class="load-error"><strong>Catalogue temporarily unavailable.</strong><br>Refresh the page or contact FARMTEK09 CENTRE on WhatsApp.</div>`;
    $("resultCount").textContent = "Catalogue unavailable";
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) syncCatalogue();
});
setInterval(syncCatalogue, 30000);

document.addEventListener("DOMContentLoaded", init);
