const API = "";
let token = sessionStorage.getItem("farmtek09_admin_token") || "";
let products = [];
let orders = [];
let customers = [];
let pendingImageData = "";
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => Number(n || 0).toLocaleString("en-KE");
const wa = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}/api/admin${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({ message: "Invalid response" }));
  if (response.status === 401) {
    sessionStorage.removeItem("farmtek09_admin_token");
    token = "";
  }
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

function showImagePreview(src) {
  const preview = $("imagePreview");
  if (!src) {
    preview.className = "image-preview empty";
    preview.textContent = "No image selected";
    return;
  }
  preview.className = "image-preview";
  preview.innerHTML = `<img src="${esc(src)}" alt="Plant preview">`;
}

function resetProductForm() {
  ["pid", "name", "category", "price", "stock", "image", "blurb", "badge"].forEach((id) => $(id).value = "");
  $("imageFile").value = "";
  $("featured").checked = false;
  pendingImageData = "";
  showImagePreview("");
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
  $("products").innerHTML = filtered.map((p) => `<article class="product" data-product-card="${esc(p.id)}">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : ""}<strong>${esc(p.name)}</strong><div class="muted">${esc(p.category)}</div><div>KES ${p.price == null ? "—" : money(p.price)}</div><div style="margin:7px 0">${productStockBadge(p)} ${p.featured ? '<span class="badge">Featured</span>' : ""}</div><p class="small">${esc(p.blurb || "")}</p><div class="row"><button class="btn" type="button" data-edit-product="${esc(p.id)}">Edit</button><button class="btn danger" type="button" data-remove-product="${esc(p.id)}">Remove</button></div></article>`).join("") || '<div class="empty">No products found.</div>';
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

function editProduct(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;
  $("pid").value = product.id;
  $("name").value = product.name || "";
  $("category").value = product.category || "";
  $("price").value = product.price ?? "";
  $("stock").value = product.stock ?? "";
  $("blurb").value = product.blurb || "";
  $("featured").checked = Boolean(product.featured);
  $("badge").value = product.badge || "";
  $("imageFile").value = "";
  if (String(product.image || "").startsWith("data:image/")) {
    pendingImageData = product.image;
    $("image").value = "";
    $("imageHelp").textContent = "This product already has an uploaded photo. Choose another photo to replace it, or leave it unchanged.";
    showImagePreview(product.image);
  } else {
    pendingImageData = "";
    $("image").value = product.image || "";
    $("imageHelp").textContent = "Choose a plant photo from your phone/computer, or paste a direct image URL.";
    showImagePreview(product.image || "");
  }
  $("formTitle").textContent = `Edit: ${product.name}`;
  $("formStatus").textContent = "Editing this product. Change the fields and press Save product.";
  showTab("productsTab");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function removeProduct(id) {
  if (!confirm("Remove this product from the live catalogue?")) return;
  try {
    await request(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadEverything();
  } catch (error) { alert(error.message); }
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("Choose an image file."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not open the image."));
      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        const maxDimension = 1100;
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { alpha: false });
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.82;
        let data = canvas.toDataURL("image/jpeg", quality);
        while (data.length > 190000 && quality > 0.28) {
          quality -= 0.1;
          data = canvas.toDataURL("image/jpeg", quality);
        }
        if (data.length > 190000) {
          const smaller = document.createElement("canvas");
          const smallScale = 700 / Math.max(width, height);
          smaller.width = Math.max(1, Math.round(width * Math.min(1, smallScale)));
          smaller.height = Math.max(1, Math.round(height * Math.min(1, smallScale)));
          const smallCtx = smaller.getContext("2d", { alpha: false });
          smallCtx.fillStyle = "#ffffff";
          smallCtx.fillRect(0, 0, smaller.width, smaller.height);
          smallCtx.drawImage(img, 0, 0, smaller.width, smaller.height);
          data = smaller.toDataURL("image/jpeg", 0.62);
        }
        if (data.length > 210000) return reject(new Error("That photo is too large. Please choose a smaller photo."));
        resolve(data);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleImageFile(file) {
  try {
    $("formStatus").textContent = "Preparing photo…";
    pendingImageData = await resizeImage(file);
    $("image").value = "";
    $("imageHelp").textContent = "Photo ready. It will be saved with this product when you press Save product.";
    showImagePreview(pendingImageData);
    $("formStatus").textContent = "Plant photo ready to save.";
  } catch (error) {
    pendingImageData = "";
    $("imageFile").value = "";
    showImagePreview("");
    $("formStatus").textContent = error.message;
  }
}

async function saveProduct() {
  const button = $("saveBtn");
  try {
    button.disabled = true;
    const id = $("pid").value.trim();
    const typedImage = $("image").value.trim();
    const image = pendingImageData || typedImage;
    const payload = {
      id: id || undefined,
      name: $("name").value.trim(),
      category: $("category").value.trim(),
      price: $("price").value === "" ? null : Number($("price").value),
      stock: $("stock").value === "" ? null : Number($("stock").value),
      image,
      blurb: $("blurb").value.trim(),
      featured: $("featured").checked,
      badge: $("badge").value.trim()
    };
    if (!payload.name || !payload.category) throw new Error("Name and category are required.");
    if (payload.price != null && !Number.isFinite(payload.price)) throw new Error("Enter a valid price or leave it blank.");
    if (payload.stock != null && (!Number.isInteger(payload.stock) || payload.stock < 0)) throw new Error("Stock must be a whole number or blank.");
    if (image.startsWith("data:image/") && image.length > 210000) throw new Error("Photo is too large. Choose another photo.");
    await request(id ? `/products/${encodeURIComponent(id)}` : "/products", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
    $("formStatus").textContent = "Saved successfully.";
    resetProductForm();
    await loadEverything();
  } catch (error) {
    $("formStatus").textContent = error.message;
  } finally {
    button.disabled = false;
  }
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

async function login() {
  try {
    const data = await request("/login", { method: "POST", body: JSON.stringify({ password: $("password").value }) });
    token = data.token;
    sessionStorage.setItem("farmtek09_admin_token", token);
    $("login").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");
    await Promise.all([loadEverything(), loadPaymentSettings()]);
  } catch (error) {
    $("loginStatus").textContent = error.message;
  }
}

function logout() {
  sessionStorage.removeItem("farmtek09_admin_token");
  token = "";
  location.reload();
}

$("loginBtn").onclick = login;
$("password").addEventListener("keydown", (event) => { if (event.key === "Enter") login(); });
$("saveBtn").onclick = saveProduct;
$("cancelBtn").onclick = resetProductForm;
$("refreshProducts").onclick = loadEverything;
$("filter").oninput = renderProducts;
$("orderFilter").oninput = renderOrders;
$("orderStatusFilter").onchange = renderOrders;
$("refreshOrders").onclick = loadEverything;
$("refreshAll").onclick = loadEverything;
$("exportOrders").onclick = exportOrdersCsv;
$("logoutBtn").onclick = logout;
$("imageFile").addEventListener("change", (event) => handleImageFile(event.target.files?.[0]));
$("image").addEventListener("input", () => {
  pendingImageData = "";
  showImagePreview($("image").value.trim());
});
$("products").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-product]");
  if (edit) return editProduct(edit.dataset.editProduct);
  const remove = event.target.closest("[data-remove-product]");
  if (remove) return removeProduct(remove.dataset.removeProduct);
});
$("orders").addEventListener("click", (event) => { const button = event.target.closest("[data-save-order]"); if (button) updateOrder(button.dataset.saveOrder); });
document.querySelectorAll(".nav button").forEach((button) => button.addEventListener("click", () => showTab(button.dataset.tab)));

if (token) {
  (async () => {
    try {
      $("login").classList.add("hidden");
      $("dashboard").classList.remove("hidden");
      $("logoutBtn").classList.remove("hidden");
      await Promise.all([loadEverything(), loadPaymentSettings()]);
    } catch (error) {
      $("login").classList.remove("hidden");
      $("dashboard").classList.add("hidden");
      $("loginStatus").textContent = error.message;
      sessionStorage.removeItem("farmtek09_admin_token");
      token = "";
    }
  })();
}
