/* ============================================================
   Jumia-style cart component (vanilla JS, no dependencies)
   ------------------------------------------------------------
   USAGE
   1. Link cart.css and this file (defer) on every page that
      needs a cart.
   2. Configure once, e.g.:

        StoreCart.init({
          businessName: "FARMTEK09 CENTRE",
          whatsappNumber: "254725528888", // country code, no + or spaces
          currency: "KSh",
          paymentInstructions:
            "Pay via Co-op Bank Lipa na M-Pesa – Business No. 400200, " +
            "Account No. 54095 (FARMTEK09 CENTRE), then send the M-Pesa " +
            "confirmation message here."
        });

   3. For every product card, call:

        StoreCart.attachControls(cardElement, {
          id: "sku-123",
          name: "Grafted Avocado Seedling",
          price: 350,
          image: "images/avocado.jpg" // optional
        });

      This injects a qty stepper + "Add to Cart" button into
      cardElement. cardElement should be position:relative or
      static — no special CSS required beyond cart.css.

   4. A floating cart button + slide-in drawer are created
      automatically on init(). Checkout builds a WhatsApp
      message listing the order and opens wa.me with it —
      the customer sends it, you receive it on WhatsApp.
   ============================================================ */

const StoreCart = (() => {
  let config = {
    businessName: "Our Store",
    whatsappNumber: "",
    currency: "KSh",
    paymentInstructions: "",
  };

  let items = {}; // id -> { id, name, price, image, qty }

  const STORAGE_KEY = "storecart_items_v1";

  function formatMoney(amount) {
    return `${config.currency} ${amount.toLocaleString("en-KE")}`;
  }

  function save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      /* storage unavailable — cart still works for this page view */
    }
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) items = JSON.parse(raw);
    } catch (e) {
      items = {};
    }
  }

  function cartCount() {
    return Object.values(items).reduce((sum, it) => sum + it.qty, 0);
  }

  function cartSubtotal() {
    return Object.values(items).reduce((sum, it) => sum + it.qty * it.price, 0);
  }

  function setQty(product, qty) {
    if (qty <= 0) {
      delete items[product.id];
    } else {
      items[product.id] = { ...product, qty };
    }
    save();
    renderDrawer();
    renderBadge();
    syncStepperUI(product.id);
  }

  function getQty(id) {
    return items[id] ? items[id].qty : 0;
  }

  // ---------- DOM: qty stepper + add-to-cart on a product card ----------

  function attachControls(cardEl, product) {
    const wrap = document.createElement("div");
    wrap.dataset.productId = product.id;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "add-to-cart-btn";
    btn.textContent = "Add to Cart";

    const stepper = document.createElement("div");
    stepper.className = "qty-stepper";
    stepper.style.display = "none";
    stepper.innerHTML = `
      <button type="button" data-action="dec" aria-label="Decrease quantity">−</button>
      <span data-role="qty">0</span>
      <button type="button" data-action="inc" aria-label="Increase quantity">+</button>
    `;

    btn.addEventListener("click", () => {
      setQty(product, 1);
    });

    stepper.querySelector('[data-action="inc"]').addEventListener("click", () => {
      setQty(product, getQty(product.id) + 1);
    });

    stepper.querySelector('[data-action="dec"]').addEventListener("click", () => {
      setQty(product, getQty(product.id) - 1);
    });

    wrap.appendChild(btn);
    wrap.appendChild(stepper);
    cardEl.appendChild(wrap);

    // if the product is already in the cart (e.g. page reload), reflect it
    syncStepperUI(product.id);
  }

  function syncStepperUI(id) {
    const wrap = document.querySelector(`[data-product-id="${cssEscape(id)}"]`);
    if (!wrap) return;
    const qty = getQty(id);
    const btn = wrap.querySelector(".add-to-cart-btn");
    const stepper = wrap.querySelector(".qty-stepper");
    const qtyLabel = wrap.querySelector('[data-role="qty"]');
    if (qty > 0) {
      btn.style.display = "none";
      stepper.style.display = "inline-flex";
      qtyLabel.textContent = qty;
    } else {
      btn.style.display = "block";
      stepper.style.display = "none";
    }
  }

  function cssEscape(str) {
    return String(str).replace(/["\\]/g, "\\$&");
  }

  // ---------- DOM: floating button + drawer ----------

  let els = {};

  function buildChrome() {
    const fab = document.createElement("button");
    fab.type = "button";
    fab.className = "cart-fab";
    fab.setAttribute("aria-label", "Open cart");
    fab.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      <span class="cart-fab-badge" style="display:none">0</span>
    `;

    const overlay = document.createElement("div");
    overlay.className = "cart-overlay";

    const drawer = document.createElement("div");
    drawer.className = "cart-drawer";
    drawer.innerHTML = `
      <div class="cart-drawer-header">
        <h2>Your Cart</h2>
        <button type="button" class="cart-drawer-close" aria-label="Close cart">&times;</button>
      </div>
      <div class="cart-drawer-body"></div>
      <div class="cart-drawer-footer">
        <div class="cart-subtotal-row">
          <span>Subtotal</span>
          <strong data-role="subtotal">${formatMoney(0)}</strong>
        </div>
        <button type="button" class="cart-checkout-btn" disabled>Checkout via WhatsApp</button>
        <p class="cart-note">You'll confirm your order on WhatsApp with ${escapeHtml(
          config.businessName
        )}.</p>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.body.appendChild(fab);

    els.fab = fab;
    els.badge = fab.querySelector(".cart-fab-badge");
    els.overlay = overlay;
    els.drawer = drawer;
    els.body = drawer.querySelector(".cart-drawer-body");
    els.subtotal = drawer.querySelector('[data-role="subtotal"]');
    els.checkoutBtn = drawer.querySelector(".cart-checkout-btn");

    fab.addEventListener("click", openDrawer);
    overlay.addEventListener("click", closeDrawer);
    drawer.querySelector(".cart-drawer-close").addEventListener("click", closeDrawer);
    els.checkoutBtn.addEventListener("click", checkout);
  }

  function openDrawer() {
    els.overlay.classList.add("open");
    els.drawer.classList.add("open");
  }

  function closeDrawer() {
    els.overlay.classList.remove("open");
    els.drawer.classList.remove("open");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderBadge() {
    const count = cartCount();
    if (count > 0) {
      els.badge.style.display = "flex";
      els.badge.textContent = count;
    } else {
      els.badge.style.display = "none";
    }
  }

  function renderDrawer() {
    const list = Object.values(items);
    if (list.length === 0) {
      els.body.innerHTML = `<p class="cart-drawer-empty">Your cart is empty.</p>`;
      els.checkoutBtn.disabled = true;
    } else {
      els.body.innerHTML = list
        .map(
          (it) => `
        <div class="cart-item" data-id="${escapeHtml(it.id)}">
          ${
            it.image
              ? `<img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.name)}">`
              : `<div style="width:56px;height:56px;border-radius:4px;background:#f5f5f5;flex-shrink:0"></div>`
          }
          <div class="cart-item-info">
            <p class="cart-item-name">${escapeHtml(it.name)}</p>
            <div class="cart-item-price">${formatMoney(it.price)}</div>
            <div class="cart-item-row">
              <div class="qty-stepper" style="display:inline-flex">
                <button type="button" data-action="dec">−</button>
                <span>${it.qty}</span>
                <button type="button" data-action="inc">+</button>
              </div>
              <button type="button" class="cart-item-remove" data-action="remove">Remove</button>
            </div>
          </div>
        </div>`
        )
        .join("");

      els.body.querySelectorAll(".cart-item").forEach((row) => {
        const id = row.dataset.id;
        const product = items[id];
        row.querySelector('[data-action="inc"]').addEventListener("click", () => {
          setQty(product, getQty(id) + 1);
        });
        row.querySelector('[data-action="dec"]').addEventListener("click", () => {
          setQty(product, getQty(id) - 1);
        });
        row.querySelector('[data-action="remove"]').addEventListener("click", () => {
          setQty(product, 0);
        });
      });

      els.checkoutBtn.disabled = false;
    }
    els.subtotal.textContent = formatMoney(cartSubtotal());
  }

  function checkout() {
    const list = Object.values(items);
    if (list.length === 0) return;

    const lines = list.map(
      (it, i) => `${i + 1}. ${it.name} x${it.qty} — ${formatMoney(it.price * it.qty)}`
    );
    const message = [
      `Order from ${config.businessName}:`,
      "",
      ...lines,
      "",
      `Subtotal: ${formatMoney(cartSubtotal())}`,
      "",
      config.paymentInstructions,
    ]
      .filter(Boolean)
      .join("\n");

    const url = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  // ---------- public API ----------

  function init(userConfig) {
    config = { ...config, ...userConfig };
    load();
    buildChrome();
    renderDrawer();
    renderBadge();
  }

  return { init, attachControls, openDrawer, closeDrawer };
})();
