/* FARMTEK09 CART ADD-ON
   Add this file without changing your existing app.js.
   Then add one line before </body>:
   <script src="cart-addon.js"></script>
*/
(() => {
  "use strict";

  const CART_KEY = "farmtek09_cart_v1";
  let cart = loadCart();
  let syncing = false;

  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter(isValidItem) : [];
    } catch {
      return [];
    }
  }

  function isValidItem(item) {
    return item && Number.isFinite(Number(item.id)) && item.name && Number(item.price) >= 0 && Number(item.qty) > 0;
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(value) {
    return `Ksh ${Number(value).toLocaleString()}`;
  }

  function getWhatsAppNumber() {
    const el = document.getElementById("topbarWhatsapp") || document.getElementById("footerWhatsapp");
    if (el?.href) {
      const match = el.href.match(/wa\.me\/(\d+)/);
      if (match) return match[1];
    }
    return "254725528888";
  }

  function getPaybill() {
    const business = document.querySelector(".js-paybill-business")?.textContent?.trim() || "400200";
    const account = document.querySelector(".js-paybill-account")?.textContent?.trim() || "54095";
    const store = document.querySelector(".js-store-name")?.textContent?.trim() || "FARMTEK09 CENTRE";
    return { business, account, store };
  }

  function getTotals() {
    return cart.reduce((acc, item) => {
      acc.items += Number(item.qty);
      acc.total += Number(item.price) * Number(item.qty);
      return acc;
    }, { items: 0, total: 0 });
  }

  function cartQty(id) {
    return cart.find((item) => String(item.id) === String(id))?.qty || 0;
  }

  function addToCart(item, qty = 1) {
    const amount = Math.max(1, Number(qty) || 1);
    const existing = cart.find((x) => String(x.id) === String(item.id));
    if (existing) existing.qty += amount;
    else cart.push({ ...item, qty: amount });
    saveCart();
    renderCart();
    updateCartBadge();
    openCart();
  }

  function setCartQty(id, qty) {
    const value = Math.max(0, Math.floor(Number(qty) || 0));
    const index = cart.findIndex((item) => String(item.id) === String(id));
    if (index < 0) return;
    if (value === 0) cart.splice(index, 1);
    else cart[index].qty = value;
    saveCart();
    renderCart();
    updateCartBadge();
  }

  function removeFromCart(id) {
    cart = cart.filter((item) => String(item.id) !== String(id));
    saveCart();
    renderCart();
    updateCartBadge();
  }

  function createCartUi() {
    if (document.getElementById("ft-cart-button")) return;

    const header = document.querySelector(".topbar-inner") || document.querySelector(".topbar");
    if (header) {
      const button = document.createElement("button");
      button.id = "ft-cart-button";
      button.className = "ft-cart-button";
      button.type = "button";
      button.setAttribute("aria-label", "Open shopping cart");
      button.innerHTML = `
        <span class="ft-cart-icon" aria-hidden="true">🛒</span>
        <span class="ft-cart-label">Cart</span>
        <span id="ft-cart-badge" class="ft-cart-badge">0</span>
      `;
      button.addEventListener("click", openCart);
      header.appendChild(button);
    }

    const shell = document.createElement("div");
    shell.id = "ft-cart-shell";
    shell.innerHTML = `
      <div id="ft-cart-overlay" class="ft-cart-overlay" hidden></div>
      <aside id="ft-cart-drawer" class="ft-cart-drawer" aria-label="Shopping cart" aria-hidden="true">
        <div class="ft-cart-head">
          <div>
            <p class="ft-cart-kicker">YOUR ORDER</p>
            <h2>Shopping Cart</h2>
          </div>
          <button id="ft-cart-close" type="button" class="ft-cart-close" aria-label="Close cart">×</button>
        </div>
        <div id="ft-cart-items" class="ft-cart-items"></div>
        <div class="ft-cart-foot">
          <div class="ft-cart-total-row"><span>Total</span><strong id="ft-cart-total">Ksh 0</strong></div>
          <button id="ft-cart-whatsapp" type="button" class="ft-cart-checkout">Checkout via WhatsApp</button>
          <button id="ft-cart-clear" type="button" class="ft-cart-clear">Clear cart</button>
          <p class="ft-cart-payment-note">WhatsApp checkout includes every item, quantity, line total, grand total and your M-PESA PayBill details.</p>
        </div>
      </aside>
    `;
    document.body.appendChild(shell);

    document.getElementById("ft-cart-close").addEventListener("click", closeCart);
    document.getElementById("ft-cart-overlay").addEventListener("click", closeCart);
    document.getElementById("ft-cart-whatsapp").addEventListener("click", checkoutWhatsApp);
    document.getElementById("ft-cart-clear").addEventListener("click", () => {
      if (!cart.length) return;
      cart = [];
      saveCart();
      renderCart();
      updateCartBadge();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCart();
    });

    document.getElementById("ft-cart-items").addEventListener("click", (event) => {
      const button = event.target.closest("[data-cart-action]");
      if (!button) return;
      const id = button.dataset.id;
      const action = button.dataset.cartAction;
      const item = cart.find((x) => String(x.id) === String(id));
      if (!item) return;
      if (action === "minus") setCartQty(id, item.qty - 1);
      if (action === "plus") setCartQty(id, item.qty + 1);
      if (action === "remove") removeFromCart(id);
    });

    document.getElementById("ft-cart-items").addEventListener("change", (event) => {
      const input = event.target.closest("[data-cart-qty]");
      if (!input) return;
      setCartQty(input.dataset.cartQty, input.value);
    });
  }

  function enhancePricedCards() {
    const cards = document.querySelectorAll(".card[data-product-id]");
    cards.forEach((card) => {
      if (card.dataset.cartEnhanced === "1") return;
      const priceEl = card.querySelector(".card-price:not(.on-request)");
      const nameEl = card.querySelector(".card-name");
      const cta = card.querySelector(".card-cta");
      const payBtn = card.querySelector(".card-pay-cta");
      if (!priceEl || !nameEl || !cta) return;

      const rawPrice = priceEl.textContent.replace(/[^\d.]/g, "");
      const price = Number(rawPrice);
      if (!Number.isFinite(price) || price < 0) return;

      const id = card.dataset.productId;
      const name = nameEl.textContent.trim();
      const category = card.querySelector(".card-category")?.textContent?.trim() || "Seedling";
      const oldWrap = cta.parentElement;

      const controls = document.createElement("div");
      controls.className = "ft-card-cart-controls";
      controls.innerHTML = `
        <div class="ft-stepper" aria-label="Quantity for ${escapeHtml(name)}">
          <button type="button" class="ft-stepper-btn" data-ft-step="minus" aria-label="Decrease quantity">−</button>
          <span class="ft-stepper-value" data-ft-card-qty="${escapeHtml(id)}">1</span>
          <button type="button" class="ft-stepper-btn" data-ft-step="plus" aria-label="Increase quantity">+</button>
        </div>
        <button type="button" class="btn btn-primary ft-add-cart" data-ft-add-id="${escapeHtml(id)}">Add to Cart</button>
      `;

      cta.replaceWith(controls);
      payBtn?.remove();
      card.dataset.cartEnhanced = "1";

      controls.addEventListener("click", (event) => {
        const step = event.target.closest("[data-ft-step]");
        if (step) {
          const valueEl = controls.querySelector("[data-ft-card-qty]");
          let qty = Number(valueEl.textContent) || 1;
          qty = step.dataset.ftStep === "plus" ? qty + 1 : Math.max(1, qty - 1);
          valueEl.textContent = String(qty);
          return;
        }

        const add = event.target.closest(".ft-add-cart");
        if (!add) return;
        const qty = Number(controls.querySelector("[data-ft-card-qty]")?.textContent) || 1;
        addToCart({ id, name, category, price }, qty);
      });
    });
  }

  function renderCart() {
    const itemsEl = document.getElementById("ft-cart-items");
    const totalEl = document.getElementById("ft-cart-total");
    const checkoutBtn = document.getElementById("ft-cart-whatsapp");
    if (!itemsEl) return;

    if (!cart.length) {
      itemsEl.innerHTML = `
        <div class="ft-cart-empty">
          <div class="ft-cart-empty-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Add priced seedlings from the catalogue to build your order.</p>
        </div>
      `;
    } else {
      itemsEl.innerHTML = cart.map((item) => {
        const lineTotal = Number(item.price) * Number(item.qty);
        return `
          <div class="ft-cart-item">
            <div class="ft-cart-item-main">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.category)} · ${money(item.price)} each</span>
            </div>
            <div class="ft-cart-line-row">
              <div class="ft-cart-mini-stepper">
                <button type="button" data-cart-action="minus" data-id="${escapeHtml(item.id)}" aria-label="Decrease ${escapeHtml(item.name)}">−</button>
                <input type="number" min="1" step="1" value="${Number(item.qty)}" data-cart-qty="${escapeHtml(item.id)}" aria-label="Quantity for ${escapeHtml(item.name)}">
                <button type="button" data-cart-action="plus" data-id="${escapeHtml(item.id)}" aria-label="Increase ${escapeHtml(item.name)}">+</button>
              </div>
              <strong>${money(lineTotal)}</strong>
              <button type="button" class="ft-remove" data-cart-action="remove" data-id="${escapeHtml(item.id)}">Remove</button>
            </div>
          </div>
        `;
      }).join("");
    }

    const totals = getTotals();
    if (totalEl) totalEl.textContent = money(totals.total);
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
  }

  function updateCartBadge() {
    const badge = document.getElementById("ft-cart-badge");
    if (!badge) return;
    const count = getTotals().items;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  function openCart() {
    const drawer = document.getElementById("ft-cart-drawer");
    const overlay = document.getElementById("ft-cart-overlay");
    if (!drawer || !overlay) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    overlay.hidden = false;
    document.body.classList.add("ft-cart-open");
  }

  function closeCart() {
    const drawer = document.getElementById("ft-cart-drawer");
    const overlay = document.getElementById("ft-cart-overlay");
    if (!drawer || !overlay) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    document.body.classList.remove("ft-cart-open");
  }

  function checkoutWhatsApp() {
    if (!cart.length) return;
    const { business, account, store } = getPaybill();
    const totals = getTotals();
    const lines = cart.map((item) => `${item.name} × ${item.qty} — ${money(Number(item.price) * Number(item.qty))}`);
    const message = [
      `Hi ${store}! I'd like to place an order:`,
      "",
      ...lines,
      "",
      `Grand Total: ${money(totals.total)}`,
      "",
      `M-PESA PayBill: ${business}`,
      `Account Number: ${account}`,
      `Account Name: ${store}`,
      "",
      "Please confirm availability and delivery/collection details. Thank you."
    ].join("\n");

    const url = `https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function addStyles() {
    if (document.getElementById("ft-cart-styles")) return;
    const style = document.createElement("style");
    style.id = "ft-cart-styles";
    style.textContent = `
      .ft-cart-button{position:relative;display:inline-flex;align-items:center;gap:.45rem;margin-left:.65rem;padding:.62rem .8rem;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(0,0,0,.18);color:inherit;cursor:pointer;font:inherit;font-weight:700}.ft-cart-icon{font-size:1rem;line-height:1}.ft-cart-label{font-size:.86rem}.ft-cart-badge{display:inline-grid;place-items:center;min-width:1.35rem;height:1.35rem;padding:0 .3rem;border-radius:999px;background:#1f9d55;color:#fff;font-size:.72rem}.ft-cart-badge[hidden]{display:none}
      .ft-cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998}.ft-cart-drawer{position:fixed;top:0;right:0;height:100dvh;width:min(430px,94vw);background:#fff;color:#172019;z-index:9999;transform:translateX(102%);transition:transform .28s ease;box-shadow:-18px 0 40px rgba(0,0,0,.2);display:flex;flex-direction:column}.ft-cart-drawer.is-open{transform:translateX(0)}.ft-cart-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;padding:1.15rem 1.15rem .9rem;border-bottom:1px solid #e6e9e6}.ft-cart-head h2{margin:.1rem 0 0;font-size:1.3rem}.ft-cart-kicker{margin:0;color:#2a8b4a;font-size:.7rem;letter-spacing:.12em;font-weight:800}.ft-cart-close{border:0;background:transparent;font-size:2rem;line-height:1;cursor:pointer;color:inherit}.ft-cart-items{flex:1;overflow:auto;padding:1rem}.ft-cart-item{padding:1rem 0;border-bottom:1px solid #edf0ed}.ft-cart-item-main{display:grid;gap:.25rem}.ft-cart-item-main strong{font-size:.97rem}.ft-cart-item-main span{font-size:.8rem;color:#6b756e}.ft-cart-line-row{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.65rem;margin-top:.75rem}.ft-cart-line-row>strong{text-align:right}.ft-cart-mini-stepper{display:inline-grid;grid-template-columns:34px 48px 34px;border:1px solid #d9dedb;border-radius:8px;overflow:hidden}.ft-cart-mini-stepper button,.ft-cart-mini-stepper input{height:34px;border:0;background:#f7f9f7;text-align:center;font:inherit}.ft-cart-mini-stepper button{cursor:pointer;font-weight:800}.ft-cart-mini-stepper input{width:48px;background:#fff;border-left:1px solid #e1e5e2;border-right:1px solid #e1e5e2}.ft-remove{border:0;background:transparent;color:#b42318;font-size:.74rem;cursor:pointer;padding:0}.ft-cart-foot{padding:1rem;border-top:1px solid #e6e9e6;background:#fff}.ft-cart-total-row{display:flex;justify-content:space-between;align-items:center;font-size:1.05rem;margin-bottom:.8rem}.ft-cart-total-row strong{font-size:1.2rem}.ft-cart-checkout{width:100%;padding:.9rem 1rem;border:0;border-radius:10px;background:#1f9d55;color:#fff;font:inherit;font-weight:800;cursor:pointer}.ft-cart-checkout:disabled{opacity:.5;cursor:not-allowed}.ft-cart-clear{width:100%;padding:.65rem 1rem;margin-top:.45rem;border:0;background:transparent;color:#7b2727;font:inherit;cursor:pointer}.ft-cart-payment-note{margin:.55rem 0 0;font-size:.72rem;line-height:1.45;color:#707a73}.ft-cart-empty{text-align:center;padding:3rem 1rem;color:#68736b}.ft-cart-empty-icon{font-size:2.5rem;margin-bottom:.5rem}.ft-cart-empty h3{margin:.2rem 0 .4rem;color:#172019}.ft-cart-empty p{margin:0;font-size:.85rem;line-height:1.5}
      .ft-card-cart-controls{display:grid;grid-template-columns:auto 1fr;gap:.55rem;align-items:center;margin-top:.7rem}.ft-stepper{display:inline-grid;grid-template-columns:34px 38px 34px;border:1px solid #d8ded9;border-radius:8px;overflow:hidden;background:#fff}.ft-stepper-btn{width:34px;height:38px;border:0;background:#f4f7f4;cursor:pointer;font-size:1.05rem;font-weight:800}.ft-stepper-value{display:grid;place-items:center;height:38px;font-weight:700;border-left:1px solid #e0e5e1;border-right:1px solid #e0e5e1}.ft-add-cart{min-height:38px;white-space:nowrap}.ft-cart-open{overflow:hidden}
      @media(max-width:640px){.ft-cart-label{display:none}.ft-cart-button{padding:.58rem .65rem}.ft-card-cart-controls{grid-template-columns:1fr}.ft-stepper{width:100%;grid-template-columns:40px 1fr 40px}.ft-stepper-btn{width:40px}.ft-cart-line-row{grid-template-columns:1fr auto}.ft-cart-line-row>strong{grid-column:2}.ft-remove{grid-column:1/-1;text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function start() {
    if (syncing) return;
    syncing = true;
    createCartUi();
    addStyles();
    enhancePricedCards();
    renderCart();
    updateCartBadge();

    const grid = document.getElementById("productGrid");
    if (grid) {
      const observer = new MutationObserver(() => enhancePricedCards());
      observer.observe(grid, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
