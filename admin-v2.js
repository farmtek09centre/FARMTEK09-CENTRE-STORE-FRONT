const API = "";
const TOKEN_KEY = "farmtek09_admin_token";
let token = sessionStorage.getItem(TOKEN_KEY) || "";
let products = [];
let orders = [];
let customers = [];
let pendingImageData = "";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '\"':"&quot;", "'":"&#39;" }[c]));
const money = (n) => Number(n || 0).toLocaleString("en-KE");
const wa = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}/api/admin${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({ message: response.status === 413 ? "The request is too large. Choose a smaller plant photo." : "Invalid response from server." }));
  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    token = "";
    throw new Error("Your admin session expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

function showTab(tab) {
  document.querySelectorAll(".tab-section").forEach((section) => section.classList.toggle("hidden", section.id !== `tab-${tab}`));
  document.querySelectorAll(".nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
}

function showImagePreview(src) {
  const box = $("imagePreview");
  if (!src) {
    box.className = "image-preview empty";
    box.textContent = "No image selected";
    return;
  }
  box.className = "image-preview";
  box.innerHTML = `<img src="${esc(src)}" alt="Plant preview">`;
}

function clearProductForm() {
  ["pid", "name", "category", "price", "stock", "image", "blurb", "badge"].forEach((id) => $(id).value = "");
  $("featured").checked = false;
  $("imageFile").value = "";
  pendingImageData = "";
  $("formTitle").textContent = "Add new plant";
  $("formStatus").textContent = "Ready to add a new plant.";
  $("imageHelp").textContent = "Choose a plant photo from your phone/computer, or paste a direct image URL.";
  showImagePreview("");
}

function productStockBadge(product) {
  if (product.stock == null) return '<span class="badge">Stock not set</span>';
  const n = Number(product.stock);
  if (n <= 0) return '<span class="badge out">Out of stock</span>';
  if (n <= 5) return `<span class="badge low">Low stock: ${n}</span>`;
  return `<span class="badge ok">In stock: ${n}</span>`;
}

function renderProducts() {
  const query = $("filter").value.trim().toLowerCase();
  const filtered = products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(query));
  $("products").innerHTML = filtered.map((p) => `<article class="product" data-product-card="${esc(p.id)}">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : ""}<strong>${esc(p.name)}</strong><div class="muted">${esc(p.category)}</div><div>KES ${p.price == null ? "—" : money(p.price)}</div><div style="margin:7px 0">${productStockBadge(p)} ${p.featured ? '<span class="badge">Featured</span>' : ""}</div><p class="small">${esc(p.blurb || "")}</p><div class="row"><button class="btn" type="button" data-edit-product="${esc(p.id)}">Edit</button><button class="btn danger" type="button" data-remove-product="${esc(p.id)}">Remove</button></div></article>`).join("") || '<div class="empty">No products found.</div>';
}

function renderOrders() {
  const query = $("orderFilter").value.trim().toLowerCase();
  const statusFilter = $("orderStatusFilter").value;
  const filtered = orders.filter((o) => {
    const haystack = `${o.id} ${o.customerName} ${o.phone} ${o.deliveryZone || ""}`.toLowerCase();
    return (!statusFilter || o.status === statusFilter) && haystack.includes(query);
  });
  $("orders").innerHTML = filtered.map((o) => {
    const statuses = ["new","awaiting_payment","paid","preparing","ready","dispatched","completed","cancelled"];
    const statusOptions = statuses.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`).join("");
    const items = (o.items || []).map((i) => `<li>${esc(i.name)} × ${i.quantity} — KES ${money(i.lineTotal)}</li>`).join("");
    const msg = `Hi ${o.customerName}! This is FARMTEK09 CENTRE regarding order ${o.id}. Current status: ${o.status.replace(/_/g, " ")}.`;
    return `<article class="order"><div class="order-head"><div><strong>${esc(o.id)}</strong><div class="small muted">${new Date(o.createdAt).toLocaleString()}</div></div><span class="status-pill status-${esc(o.status)}">${esc(o.status.replace(/_/g, " "))}</span></div><p><strong>${esc(o.customerName)}</strong> · ${esc(o.phone)}${o.email ? ` · ${esc(o.email)}` : ""}</p><p>${o.deliveryMethod === "delivery" ? `Delivery: ${esc(o.deliveryZone)} · ${esc(o.address)}` : "Collection from nursery"}</p><ul class="order-items">${items}</ul><p><strong>Total: KES ${money(o.total)}</strong> · Payment: ${esc(o.paymentStatus)}${o.mpesaReceipt ? ` · Receipt ${esc(o.mpesaReceipt)}` : ""}</p><div class="order-actions"><select data-order-status="${esc(o.id)}">${statusOptions}</select><button class="btn" data-save-order="${esc(o.id)}">Update</button><a class="btn secondary" href="${wa(o.phone, msg)}" target="_blank" rel="noopener">WhatsApp customer</a></div></article>`;
  }).join("") || '<div class="empty">No orders match the current filters.</div>';
}

function renderRecentOrders() {
  $("recentOrders").innerHTML = orders.slice(0, 6).map((o) => `<article class="order"><div class="order-head"><strong>${esc(o.id)}</strong><span class="status-pill status-${esc(o.status)}">${esc(o.status.replace(/_/g, " "))}</span></div><div>${esc(o.customerName)} · KES ${money(o.total)}</div><div class="small muted">${new Date(o.createdAt).toLocaleString()}</div></article>`).join("") || '<div class="empty">No orders yet.</div>';
}

function renderCustomers() {
  $("customers").innerHTML = customers.map((c) => `<article class="customer"><strong>${esc(c.name)}</strong><p>${esc(c.phone)}${c.email ? ` · ${esc(c.email)}` : ""}</p><div><strong>${c.orders}</strong> order${c.orders === 1 ? "" : "s"} · <strong>KES ${money(c.spend)}</strong> paid</div><div class="small muted">Last order: ${new Date(c.lastOrderAt).toLocaleString()}</div></article>`).join("") || '<div class="empty">No customers yet.</div>';
}

function renderStats(stats) {
  $("statProducts").textContent = stats.products;
  $("statOrders").textContent = stats.orders;
  $("statRevenue").textContent = money(stats.revenue);
  $("statCustomers").textContent = stats.customers;
  $("statLow").textContent = stats.lowStock;
  $("statOut").textContent = stats.outOfStock;
  $("statusSummary").innerHTML = Object.entries(stats.byStatus || {}).map(([status, count]) => `<div class="stat"><span class="muted">${esc(status.replace(/_/g, " "))}</span><strong>${count}</strong></div>`).join("") || '<div class="empty">No orders yet.</div>';
}

async function loadEverything() {
  const [productData, orderData, stats, customerData] = await Promise.all([request("/products"), request("/orders"), request("/stats"), request("/customers")]);
  products = productData.products || [];
  orders = orderData.orders || [];
  customers = customerData.customers || [];
  renderProducts(); renderOrders(); renderRecentOrders(); renderCustomers(); renderStats(stats);
}

async function loadPaymentSettings() {
  try {
    const response = await fetch("/api/payment-config");
    const p = await response.json();
    $("paymentSettings").innerHTML = `<div class="panel" style="margin:0"><span class="muted">M-PESA Pay Bill</span><strong>${esc(p.mpesaBusinessNumber || "Not set")}</strong><div>Account: ${esc(p.mpesaAccountNumber || "Not set")}</div></div><div class="panel" style="margin:0"><span class="muted">Delivery</span><strong>${p.delivery?.flatFeeKes == null ? "Quote before dispatch" : `KES ${money(p.delivery.flatFeeKes)}`}</strong><div>${esc(p.delivery?.deliveryNote || "Confirm delivery before dispatch.")}</div></div><div class="panel" style="margin:0"><span class="muted">WhatsApp</span><strong>${esc(p.whatsappNumber || "Not set")}</strong></div>`;
  } catch (_) { $("paymentSettings").innerHTML = '<div class="empty">Payment configuration unavailable.</div>'; }
}

function editProduct(id) {
  const p = products.find((item) => item.id === id);
  if (!p) return;
  $("pid").value = p.id; $("name").value = p.name || ""; $("category").value = p.category || ""; $("price").value = p.price ?? ""; $("stock").value = p.stock ?? ""; $("blurb").value = p.blurb || ""; $("featured").checked = Boolean(p.featured); $("badge").value = p.badge || ""; $("imageFile").value = "";
  if (String(p.image || "").startsWith("data:image/")) { pendingImageData = p.image; $("image").value = ""; $("imageHelp").textContent = "Existing uploaded photo loaded. Choose another photo only if you want to replace it."; showImagePreview(p.image); }
  else { pendingImageData = ""; $("image").value = p.image || ""; $("imageHelp").textContent = "Existing image loaded. Choose another photo to replace it."; showImagePreview(p.image || ""); }
  $("formTitle").textContent = `Edit: ${p.name}`; $("formStatus").textContent = "Editing this plant. Make changes and press Save product."; showTab("productsTab"); window.scrollTo({ top: 0, behavior: "smooth" });
}

async function removeProduct(id) {
  if (!confirm("Remove this plant from the live catalogue?")) return;
  try { await request(`/products/${encodeURIComponent(id)}`, { method: "DELETE" }); $("formStatus").textContent = "Product removed."; await loadEverything(); }
  catch (error) { alert(error.message); }
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("Choose a JPG, PNG or other image file."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("Please choose a photo under 8 MB."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the photo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("This photo format is not supported by your browser. Try JPG or PNG."));
      img.onload = () => {
        const maxDimension = 1000;
        const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d", { alpha: false }); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.78; let data = canvas.toDataURL("image/jpeg", quality);
        while (data.length > 175000 && quality >= 0.34) { quality -= 0.08; data = canvas.toDataURL("image/jpeg", quality); }
        if (data.length > 200000) { quality = 0.52; const smaller = document.createElement("canvas"); const s = Math.min(1, 700 / Math.max(width, height)); smaller.width = Math.max(1, Math.round(width * s)); smaller.height = Math.max(1, Math.round(height * s)); const sc = smaller.getContext("2d", { alpha: false }); sc.fillStyle = "#ffffff"; sc.fillRect(0, 0, smaller.width, smaller.height); sc.drawImage(img, 0, 0, smaller.width, smaller.height); data = smaller.toDataURL("image/jpeg", quality); }
        if (data.length > 205000) return reject(new Error("Photo is still too large. Choose a smaller photo."));
        resolve(data);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleImageFile(file) {
  try { $("formStatus").textContent = "Preparing photo…"; pendingImageData = await resizeImage(file); $("image").value = ""; $("imageHelp").textContent = "Photo ready. Press Save product to add/update the plant."; showImagePreview(pendingImageData); $("formStatus").textContent = "Plant photo ready to save."; }
  catch (error) { pendingImageData = ""; $("imageFile").value = ""; showImagePreview(""); $("formStatus").textContent = error.message; }
}

async function saveProduct() {
  const button = $("saveBtn");
  try {
    button.disabled = true;
    const id = $("pid").value.trim();
    const image = pendingImageData || $("image").value.trim();
    const payload = { id: id || undefined, name: $("name").value.trim(), category: $("category").value.trim(), price: $("price").value === "" ? null : Number($("price").value), stock: $("stock").value === "" ? null : Number($("stock").value), image, blurb: $("blurb").value.trim(), featured: $("featured").checked, badge: $("badge").value.trim() };
    if (!payload.name || !payload.category) throw new Error("Name and category are required.");
    if (payload.price != null && (!Number.isFinite(payload.price) || payload.price < 0)) throw new Error("Enter a valid price or leave it blank.");
    if (payload.stock != null && (!Number.isInteger(payload.stock) || payload.stock < 0)) throw new Error("Stock must be a whole number or blank.");
    if (!image) throw new Error("Choose a plant photo or paste an image URL.");
    if (image.startsWith("data:image/") && image.length > 205000) throw new Error("Photo is too large. Choose another photo.");
    const result = await request(id ? `/products/${encodeURIComponent(id)}` : "/products", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
    if (result?.id) $("pid").value = result.id;
    $("formTitle").textContent = `Edit: ${result?.name || payload.name}`;
    $("formStatus").textContent = id ? "Product updated successfully. It is now in the live catalogue." : "New plant added successfully to the live catalogue.";
    pendingImageData = image.startsWith("data:image/") ? image : "";
    await loadEverything();
  } catch (error) { $("formStatus").textContent = error.message; }
  finally { button.disabled = false; }
}

async function updateOrder(id) {
  const select = document.querySelector(`[data-order-status="${CSS.escape(id)}"]`); if (!select?.value) return;
  try { await request(`/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: select.value }) }); await loadEverything(); }
  catch (error) { alert(error.message); }
}

function exportOrdersCsv() {
  const headers = ["Order","Date","Customer","Phone","Email","Delivery","Zone","Total","Payment","Payment status","Order status","M-PESA receipt"];
  const rows = orders.map((o) => [o.id,o.createdAt,o.customerName,o.phone,o.email || "",o.deliveryMethod,o.deliveryZone || "",o.total,o.paymentMethod,o.paymentStatus,o.status,o.mpesaReceipt || ""]);
  const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `farmtek09-orders-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

async function login() {
  try { const data = await request("/login", { method: "POST", body: JSON.stringify({ password: $("password").value }) }); token = data.token; sessionStorage.setItem(TOKEN_KEY, token); $("login").classList.add("hidden"); $("dashboard").classList.remove("hidden"); $("logoutBtn").classList.remove("hidden"); $("loginStatus").textContent = ""; await Promise.all([loadEverything(), loadPaymentSettings()]); }
  catch (error) { $("loginStatus").textContent = error.message; }
}
function logout() { sessionStorage.removeItem(TOKEN_KEY); token = ""; location.reload(); }

$("loginBtn").onclick = login;
$("password").addEventListener("keydown", (event) => { if (event.key === "Enter") login(); });
$("saveBtn").onclick = saveProduct;
$("cancelBtn").onclick = clearProductForm;
$("refreshProducts").onclick = loadEverything;
$("filter").oninput = renderProducts;
$("orderFilter").oninput = renderOrders;
$("orderStatusFilter").onchange = renderOrders;
$("refreshOrders").onclick = loadEverything;
$("refreshAll").onclick = loadEverything;
$("exportOrders").onclick = exportOrdersCsv;
$("logoutBtn").onclick = logout;
$("imageFile").addEventListener("change", (event) => handleImageFile(event.target.files?.[0]));
$("image").addEventListener("input", () => { pendingImageData = ""; showImagePreview($("image").value.trim()); });
$("products").addEventListener("click", (event) => { const edit = event.target.closest("[data-edit-product]"); if (edit) return editProduct(edit.dataset.editProduct); const remove = event.target.closest("[data-remove-product]"); if (remove) return removeProduct(remove.dataset.removeProduct); });
$("orders").addEventListener("click", (event) => { const button = event.target.closest("[data-save-order]"); if (button) updateOrder(button.dataset.saveOrder); });
document.querySelectorAll(".nav button").forEach((button) => button.addEventListener("click", () => showTab(button.dataset.tab)));

if (token) { (async () => { try { $("login").classList.add("hidden"); $("dashboard").classList.remove("hidden"); $("logoutBtn").classList.remove("hidden"); await Promise.all([loadEverything(), loadPaymentSettings()]); } catch (error) { sessionStorage.removeItem(TOKEN_KEY); token = ""; $("login").classList.remove("hidden"); $("dashboard").classList.add("hidden"); $("loginStatus").textContent = error.message; } })(); }
