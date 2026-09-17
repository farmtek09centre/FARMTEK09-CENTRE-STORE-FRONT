(() => {
  const KEY = "farmtek09-cart-v2";
  const state = { cart: [], config: null, products: [] };
  const $ = (id) => document.getElementById(id);
  const money = (n) => Number(n).toLocaleString("en-KE");
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const wa = (text) => `https://wa.me/${state.config?.whatsappNumber || "254725528888"}?text=${encodeURIComponent(text)}`;

  function loadCart() {
    try { state.cart = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) { state.cart = []; }
  }
  function saveCart() { localStorage.setItem(KEY, JSON.stringify(state.cart)); renderCart(); }
  function cartItems() { return state.cart.map((item) => ({ ...item, product: state.products.find((p) => p.id === item.productId) })).filter((item) => item.product); }
  function subtotal() { return cartItems().reduce((sum, item) => sum + (Number(item.product.price) * Number(item.quantity)), 0); }
  function totalQty() { return cartItems().reduce((sum, item) => sum + Number(item.quantity), 0); }

  function ensureDrawer() {
    if ($("cartDrawer")) return;
    const drawer = document.createElement("aside");
    drawer.id = "cartDrawer";
    drawer.className = "cart-drawer";
    drawer.hidden = true;
    drawer.innerHTML = `<div class="cart-backdrop" data-close-cart></div><div class="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cartTitle"><div class="cart-head"><div><p class="eyebrow">Your order</p><h2 id="cartTitle">Shopping cart</h2></div><button class="modal-close" id="cartClose" type="button" aria-label="Close cart">×</button></div><div id="cartBody" class="cart-body"></div></div>`;
    document.body.appendChild(drawer);
    $("cartClose").addEventListener("click", closeCart);
    drawer.addEventListener("click", (event) => { if (event.target.matches("[data-close-cart]")) closeCart(); });
    $("cartBody").addEventListener("click", (event) => {
      const add = event.target.closest("[data-cart-plus]");
      const minus = event.target.closest("[data-cart-minus]");
      const remove = event.target.closest("[data-cart-remove]");
      const bulk = event.target.closest("[data-bulk-order]");
      const id = (add || minus || remove)?.dataset.cartId;
      if (id) { if (add) changeQty(id, 1); if (minus) changeQty(id, -1); if (remove) removeItem(id); }
      if (bulk) window.open(wa(`Hi FARMTEK09 CENTRE! I have a bulk order enquiry (10+ plants/items).\n\n${cartItems().map((i) => `• ${i.product.name} × ${i.quantity}`).join("\n")}\n\nPlease advise bulk availability and pricing.`), "_blank", "noopener");
    });
    $("cartBody").addEventListener("change", (event) => { if (event.target.id === "deliveryMethod") updateDeliveryFields(); });
    $("cartBody").addEventListener("submit", submitOrder);
  }

  function renderCart() {
    ensureDrawer();
    const items = cartItems();
    const count = totalQty();
    $("cartCount").textContent = String(count);
    if (!items.length) {
      $("cartBody").innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛒</div><h3>Your cart is empty</h3><p>Add priced items from the catalogue. Items marked “Price on request” can still be ordered or discussed directly on WhatsApp.</p><button class="btn btn-primary" type="button" data-close-cart>Browse catalogue</button></div>`;
      return;
    }
    const config = state.config || {};
    const deliveryFee = config.delivery?.flatFeeKes;
    const itemRows = items.map((item) => `<div class="cart-item"><div class="cart-item-media">${item.product.image ? `<img src="${esc(item.product.image)}" alt="">` : "🌱"}</div><div class="cart-item-main"><strong>${esc(item.product.name)}</strong><span>KES ${money(item.product.price)} each</span><div class="cart-qty"><button type="button" data-cart-minus data-cart-id="${esc(item.productId)}">−</button><strong>${item.quantity}</strong><button type="button" data-cart-plus data-cart-id="${esc(item.productId)}">+</button><button type="button" data-cart-remove data-cart-id="${esc(item.productId)}" class="cart-remove">Remove</button></div></div><strong>KES ${money(item.product.price * item.quantity)}</strong></div>`).join("");
    $("cartBody").innerHTML = `<div class="cart-items">${itemRows}</div><div class="cart-summary"><div><span>Subtotal</span><strong>KES ${money(subtotal())}</strong></div><div><span>Delivery</span><strong class="cart-delivery-preview">Choose method</strong></div><div class="cart-total"><span>Order total</span><strong>KES ${money(subtotal())}</strong></div></div>${count >= 10 ? `<button class="btn btn-secondary bulk-btn" type="button" data-bulk-order>Bulk order / 10+ items → WhatsApp</button>` : ""}<form id="orderForm" class="checkout-form"><div class="form-section"><h3>Customer details</h3><div class="form-grid"><label>Name<input name="name" required maxlength="80" autocomplete="name"></label><label>Phone / WhatsApp<input name="phone" required maxlength="20" autocomplete="tel" inputmode="tel" placeholder="0712 345 678"></label><label>Email (optional)<input name="email" type="email" maxlength="120" autocomplete="email"></label></div></div><div class="form-section"><h3>Fulfilment</h3><label>Method<select name="deliveryMethod" id="deliveryMethod"><option value="collection">Collect from nursery</option><option value="delivery">Delivery</option></select></label><div id="deliveryFields" class="form-grid delivery-fields" hidden><label>Area / zone<input name="deliveryZone" maxlength="80" placeholder="e.g. Nairobi CBD, Ruaka, Kiambu"></label><label>Address / landmark<input name="address" maxlength="220" placeholder="Estate, road, landmark"></label></div></div><div class="form-section"><h3>Payment &amp; order notes</h3><fieldset class="payment-choice"><legend>How would you like to complete the order?</legend><label><input type="radio" name="paymentMethod" value="whatsapp" checked> WhatsApp order — confirm availability and payment with us</label><label><input type="radio" name="paymentMethod" value="mpesa"> M-PESA prompt — collection or configured delivery</label></fieldset><label>Notes / special instructions<textarea name="notes" rows="3" maxlength="500" placeholder="Seedling size, planting date, preferred collection time, etc."></textarea></label></div><div class="checkout-note"><strong>Delivery:</strong> ${esc(config.delivery?.deliveryNote || "Delivery is confirmed before dispatch.")}</div><button class="btn btn-primary checkout-submit" type="submit">Place order</button><p id="checkoutStatus" class="checkout-status" role="status" aria-live="polite"></p></form><div id="orderResult" class="order-result" hidden></div>`;
    updateDeliveryFields();
  }

  function openCart() { ensureDrawer(); $("cartDrawer").hidden = false; document.body.classList.add("cart-open"); renderCart(); }
  function closeCart() { if ($("cartDrawer")) { $("cartDrawer").hidden = true; document.body.classList.remove("cart-open"); } }
  function changeQty(id, delta) {
    const item = state.cart.find((x) => x.productId === id);
    const product = state.products.find((p) => p.id === id);
    if (!item || !product) return;
    const next = item.quantity + delta;
    if (next <= 0) return removeItem(id);
    if (product.stock != null && next > Number(product.stock)) return setCheckoutStatus(`Only ${product.stock} of ${product.name} are currently available.`, "error");
    item.quantity = next; saveCart();
  }
  function removeItem(id) { state.cart = state.cart.filter((x) => x.productId !== id); saveCart(); }
  function addToCart(product) {
    if (!product || product.price == null || Number(product.stock) === 0) return;
    const existing = state.cart.find((x) => x.productId === product.id);
    if (existing) {
      if (product.stock != null && existing.quantity >= Number(product.stock)) return setCheckoutStatus(`Only ${product.stock} of ${product.name} are currently available.`, "error");
      existing.quantity += 1;
    } else state.cart.push({ productId: product.id, quantity: 1 });
    saveCart(); openCart();
  }

  function setCheckoutStatus(message, stateName = "") { const el = $("checkoutStatus"); if (el) { el.textContent = message; el.dataset.state = stateName; } }
  async function loadConfig() {
    try { const r = await fetch("/api/payment-config"); state.config = r.ok ? await r.json() : null; }
    catch (_) { state.config = { whatsappNumber: "254725528888", delivery: { flatFeeKes: null, deliveryNote: "Delivery is confirmed before dispatch." } }; }
    if (!state.config) state.config = { whatsappNumber: "254725528888", delivery: { flatFeeKes: null, deliveryNote: "Delivery is confirmed before dispatch." } };
  }

  function updateDeliveryFields() {
    const method = $("deliveryMethod")?.value;
    const fields = $("deliveryFields"); if (fields) fields.hidden = method !== "delivery";
    const fee = state.config?.delivery?.flatFeeKes;
    const preview = document.querySelector(".cart-delivery-preview");
    if (preview) preview.textContent = method === "delivery" ? (fee == null ? "Confirmed before dispatch" : `KES ${money(fee)}`) : "Free collection";
    const totalEl = document.querySelector(".cart-total strong");
    if (totalEl) totalEl.textContent = `KES ${money(subtotal() + (method === "delivery" && fee != null ? fee : 0))}`;
  }

  function buildWhatsAppMessage(order) {
    const lines = order.items.map((item) => `• ${item.name} × ${item.quantity} = KES ${money(item.lineTotal)}`).join("\n");
    const delivery = order.deliveryMethod === "delivery" ? `Delivery: ${order.deliveryZone}\nAddress: ${order.address}` : "Collection: FARMTEK09 CENTRE nursery";
    const trackingUrl = new URL("track.html", window.location.href); trackingUrl.searchParams.set("id", order.id); trackingUrl.searchParams.set("token", order.trackingToken);
    return `Hi FARMTEK09 CENTRE! My order is ${order.id}.\n\n${lines}\n\nSubtotal: KES ${money(order.subtotal)}\nTotal: KES ${money(order.total)}\n${delivery}\nCustomer: ${order.customerName}\nPhone: ${order.phone}\n\nTrack order: ${trackingUrl.href}`;
  }

  async function startMpesa(order, phone, statusEl) {
    if (!order.paymentReady) throw new Error("M-PESA checkout is not available until the delivery charge is confirmed.");
    const start = await fetch("/api/mpesa/stk-push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, phone, amount: order.total }) });
    const data = await start.json().catch(() => ({}));
    if (!start.ok || !data.ok) throw new Error(data.message || "Unable to start the M-PESA prompt.");
    statusEl.textContent = "M-PESA prompt sent. Check your phone and enter your PIN…";
    for (let attempt = 0; attempt < 18; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const r = await fetch(`/api/mpesa/status/${encodeURIComponent(data.checkoutRequestId)}`);
      if (!r.ok) continue;
      const tx = await r.json();
      if (tx.status === "success") { statusEl.textContent = `Payment received. M-PESA receipt: ${tx.receipt || "confirmed"}.`; return tx; }
      if (tx.status === "failed") throw new Error(tx.resultDesc || "M-PESA payment was not completed.");
    }
    statusEl.textContent = "The prompt is still pending. Keep your M-PESA confirmation message while the callback completes the order.";
    return null;
  }

  async function submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector(".checkout-submit");
    const data = new FormData(form);
    const payment = data.get("paymentMethod");
    const payload = { customer: { name: data.get("name"), phone: data.get("phone"), email: data.get("email") }, items: state.cart, deliveryMethod: data.get("deliveryMethod"), deliveryZone: data.get("deliveryZone"), address: data.get("address"), notes: data.get("notes"), paymentMethod: payment };
    submit.disabled = true;
    setCheckoutStatus("Creating your order…", "pending");
    let blankWindow = null;
    try {
      if (payment === "whatsapp") blankWindow = window.open("about:blank", "_blank");
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const order = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(order.message || "Unable to create your order.");
      const result = $("orderResult");
      const trackingUrl = new URL("track.html", window.location.href); trackingUrl.searchParams.set("id", order.id); trackingUrl.searchParams.set("token", order.trackingToken);
      result.hidden = false;
      result.innerHTML = `<div class="order-success"><p class="eyebrow">Order created</p><h3>${esc(order.id)}</h3><p>Your order has been saved. ${order.deliveryMethod === "delivery" && order.deliveryFee == null ? "We will confirm the delivery charge before dispatch." : ""}</p><div class="order-result-actions"><a class="btn btn-secondary" href="${esc(trackingUrl.href)}" target="_blank" rel="noopener">Track order</a><button class="btn btn-whatsapp" id="orderWhatsapp" type="button">Open WhatsApp</button></div></div>`;
      $("orderWhatsapp").onclick = () => window.open(wa(buildWhatsAppMessage(order)), "_blank", "noopener");
      if (payment === "whatsapp") {
        const url = wa(buildWhatsAppMessage(order));
        if (blankWindow && !blankWindow.closed) blankWindow.location.href = url; else window.open(url, "_blank", "noopener");
        setCheckoutStatus(`Order ${order.id} is ready. WhatsApp has been opened for confirmation.`, "success");
        state.cart = []; saveCart();
      } else {
        await startMpesa(order, data.get("phone"), $("checkoutStatus"));
        setCheckoutStatus(`Order ${order.id} is awaiting payment verification.`, "success");
        state.cart = []; saveCart();
      }
    } catch (error) {
      blankWindow?.close();
      setCheckoutStatus(error.message || "Unable to complete checkout.", "error");
    } finally {
      submit.disabled = false;
      $("orderWhatsapp")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  document.addEventListener("catalogue:ready", async (event) => { state.products = event.detail; loadCart(); await loadConfig(); renderCart(); });
  document.addEventListener("store:add-to-cart", (event) => addToCart(event.detail));
  document.addEventListener("store:open-cart", openCart);
  document.addEventListener("DOMContentLoaded", () => { ensureDrawer(); loadCart(); renderCart(); });
  document.addEventListener("change", (event) => { if (event.target?.id === "deliveryMethod") updateDeliveryFields(); });
})();
