const API = "";
let token = "";
let products = [];
let orders = [];
let customers = [];
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => Number(n || 0).toLocaleString("en-KE");
const wa = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}/api/admin${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({ message: "Invalid response" }));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

function resetProductForm() {
  ["pid", "name", "category", "price", "stock", "image", "blurb", "badge"].forEach((id) => $(id).value = "");
  $("featured").checked = false;
  $("formTitle").textContent = "Add product";
  $("formStatus").textContent = "";
}

function productStockBadge(product) {
  if (product.stock == null) return '<span class="badge">Stock not set</span>';
  const n = Number(product.stock);
  if (n <= 0) return '<span class="badge out">Out of stock</span>';
  if (n <= 5) return `<span class="badge low">Low stock: ${n}</span>`;
  return `<span class="badge ok">In stock: ${n}</span>`;
}

function renderProducts() {
  const query = $("filter").value.toLowerCase();
  const filtered = products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(query));
  $("products").innerHTML = filtered.map((p) => `<article class="product">${p.image ? `<img src="${esc(p.image)}" alt="">` : ""}<strong>${esc(p.name)}</strong><div class="muted">${esc(p.category)}</div><div>KES ${p.price == null ? "—" : money(p.price)}</div><div style="margin:7px 0">${productStockBadge(p)} ${p.featured ? '<span class="badge">Featured</span>' : ""}</div><p class="small">${esc(p.blurb || "")}</p><div class="row"><button class="btn" onclick="editProduct('${esc(p.id)}')">Edit</button><button class="btn danger" onclick="removeProduct('${esc(p.id)}')">Remove</button></div></article>`).join("") || '<div class="empty">No products found.</div>';
}

function renderOrders() {
  const query = $("orderFilter").value.toLowerCase();
  const statusFilter = $("orderStatusFilter").value;
  const filtered = orders.filter((o) => {
    const matchesStatus = !statusFilter || o.status === statusFilter;
    const haystack = `${o.id} ${o.customerName} ${o.phone} ${o.deliveryZone || ""}`.toLowerCase();
    return matchesStatus && haystack.includes(query);
  });
  $("orders").innerHTML = filtered.map((o) => {
    const statusOptions = ["new", "awaiting_payment", "paid", "preparing", "ready", "dispatched", "completed", "cancelled"].map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`).join("");
    const lines = (o.items || []).map((i) => `<li>${esc(i.name)} × ${i.quantity} — KES ${money(i.lineTotal)}</li>`).join("");
    const message = `Hi ${o.customerName}! This is FARMTEK09 CENTRE regarding order ${o.id}. Current status: ${o.status.replace(/_/g, " ")}.`;
    return `<article class="order"><div class="order-head"><div><strong>${esc(o.id)}</strong><div class="small muted">${new Date(o.createdAt).toLocaleString()}</div></div><span class="status-pill status-${esc(o.status)}">${esc(o.status.replace(/_/g, " "))}</span></div><p><strong>${esc(o.customerName)}</strong> · ${esc(o.phone)}${o.email ? ` · ${esc(o.email)}` : ""}</p><p>${o.deliveryMethod === "delivery" ? `Delivery: ${esc(o.deliveryZone)} · ${esc(o.address)}` : "Collection from nursery"}</p><ul class="order-items">${lines}</ul><p><strong>Total: KES ${money(o.total)}</strong> · Payment: ${esc(o.paymentStatus)}${o.mpesaReceipt ? ` · Receipt ${esc(o.mpesaReceipt)}` : ""}</p><div class="order-actions"><select data-order-status="${esc(o.id)}">${statusOptions}</select><button class="btn" data-save-order="${esc(o.id)}">Update</button><a class="btn secondary" href="${wa(o.phone, message)}" target="_blank" rel="noopener">WhatsApp customer</a></div></article>`;
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
  products = productData.products;
  orders = orderData.orders;
  customers = customerData.customers;
  renderProducts();
  renderOrders();
  renderRecentOrders();
  renderCustomers();
  renderStats(stats);
}

async function loadPaymentSettings() {
  try {
    const r = await fetch("/api/payment-config");
    const p = await r.json();
    $("paymentSettings").innerHTML = `<div class="panel" style="margin:0"><span class="muted">M-PESA Pay Bill</span><strong>${esc(p.mpesaBusinessNumber || "Not set")}</strong><div>Account: ${esc(p.mpesaAccountNumber || "Not set")}</div></div><div class="panel" style="margin:0"><span class="muted">Delivery</span><strong>${p.delivery?.flatFeeKes == null ? "Quote before dispatch" : `KES ${money(p.delivery.flatFeeKes)}`}</strong><div>${esc(p.delivery?.deliveryNote || "Confirm delivery before dispatch.")}</div></div><div class="panel" style="margin:0"><span class="muted">WhatsApp</span><strong>${esc(p.whatsappNumber || "Not set")}</strong><div>Used for customer order confirmation and updates.</div></div>`;
  } catch (_) { $("paymentSettings").innerHTML = '<div class="empty">Payment configuration unavailable.</div>'; }
}

window.editProduct = (id) => {
  const product = products.find((p) => p.id === id); if (!product) return;
  $("pid").value = product.id; $("name").value = product.name || ""; $("category").value = product.category || ""; $("price").value = product.price ?? ""; $("stock").value = product.stock ?? ""; $("image").value = product.image || ""; $("blurb").value = product.blurb || ""; $("featured").checked = Boolean(product.featured); $("badge").value = product.badge || "";
  $("formTitle").textContent = `Edit: ${product.name}`;
  showTab("productsTab"); window.scrollTo({ top: 0, behavior: "smooth" });
};

window.removeProduct = async (id) => {
  if (!confirm("Remove this product from the live catalogue?")) return;
  try { await request(`/products/${encodeURIComponent(id)}`, { method: "DELETE" }); await loadEverything(); } catch (error) { alert(error.message); }
};

async function saveProduct() {
  try {
    const id = $("pid").value.trim();
    const payload = { id: id || undefined, name: $("name").value.trim(), category: $("category").value.trim(), price: $("price").value === "" ? null : Number($("price").value), stock: $("stock").value === "" ? null : Number($("stock").value), image: $("image").value.trim(), blurb: $("blurb").value.trim(), featured: $("featured").checked, badge: $("badge").value.trim() };
    if (!payload.name || !payload.category) throw new Error("Name and category are required.");
    await request(id ? `/products/${encodeURIComponent(id)}` : "/products", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
    $("formStatus").textContent = "Saved."; resetProductForm(); await loadEverything();
  } catch (error) { $("formStatus").textContent = error.message; }
}

async function updateOrder(id) {
  const select = document.querySelector(`[data-order-status="${CSS.escape(id)}"]`);
  const status = select?.value;
  if (!status) return;
  try { await request(`/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }); await loadEverything(); } catch (error) { alert(error.message); }
}

function exportOrdersCsv() {
  const headers = ["Order","Date","Customer","Phone","Email","Delivery","Zone","Total","Payment","Payment status","Order status","M-PESA receipt"];
  const rows = orders.map((o) => [o.id, o.createdAt, o.customerName, o.phone, o.email || "", o.deliveryMethod, o.deliveryZone || "", o.total, o.paymentMethod, o.paymentStatus, o.status, o.mpesaReceipt || ""]);
  const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `farmtek09-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

function showTab(tab) {
  document.querySelectorAll(".tab-section").forEach((section) => section.classList.toggle("hidden", section.id !== `tab-${tab}`));
  document.querySelectorAll(".nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
}

$("loginBtn").onclick = async () => {
  try {
    const data = await request("/login", { method: "POST", body: JSON.stringify({ password: $("password").value }) });
    token = data.token; $("login").classList.add("hidden"); $("dashboard").classList.remove("hidden"); $("logoutBtn").classList.remove("hidden");
    await Promise.all([loadEverything(), loadPaymentSettings()]);
  } catch (error) { $("loginStatus").textContent = error.message; }
};

$("password").addEventListener("keydown", (event) => { if (event.key === "Enter") $("loginBtn").click(); });
$("saveBtn").onclick = saveProduct;
$("cancelBtn").onclick = resetProductForm;
$("refreshProducts").onclick = loadEverything;
$("filter").oninput = renderProducts;
$("orderFilter").oninput = renderOrders;
$("orderStatusFilter").onchange = renderOrders;
$("refreshOrders").onclick = loadEverything;
$("refreshAll").onclick = loadEverything;
$("exportOrders").onclick = exportOrdersCsv;
$("logoutBtn").onclick = () => { token = ""; location.reload(); };
document.querySelectorAll(".nav button").forEach((button) => button.addEventListener("click", () => showTab(button.dataset.tab)));
$("orders").addEventListener("click", (event) => { const button = event.target.closest("[data-save-order]"); if (button) updateOrder(button.dataset.saveOrder); });
