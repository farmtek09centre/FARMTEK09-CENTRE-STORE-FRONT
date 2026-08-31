# Jumia-style Cart Component

Two files, no dependencies, no build step: `cart.css` + `cart.js`.
Gives you the pattern from jumia.co.ke — a qty stepper on each product
card, a floating cart button with a count badge, a slide-in cart
drawer with subtotal, and a "Checkout via WhatsApp" button that opens
a prefilled order message.

This is original code written to match that UX pattern — not copied
from Jumia's site.

## 1. Link the files

```html
<link rel="stylesheet" href="cart.css">
...
<script src="cart.js" defer></script>
```

## 2. Initialize once per page (bottom of `<body>` or in your own script)

### FARMTEK09 CENTRE

```html
<script>
  document.addEventListener("DOMContentLoaded", () => {
    StoreCart.init({
      businessName: "FARMTEK09 CENTRE",
      whatsappNumber: "254725528888",
      currency: "KSh",
      paymentInstructions:
        "Pay via Co-op Bank Lipa na M-Pesa – Business No. 400200, " +
        "Account No. 54095 (FARMTEK09 CENTRE), then send the M-Pesa " +
        "confirmation message here."
    });
  });
</script>
```

### TIFFAS BEAUTY AND COSMETICS

```html
<script>
  document.addEventListener("DOMContentLoaded", () => {
    StoreCart.init({
      businessName: "TIFFAS BEAUTY AND COSMETICS",
      whatsappNumber: "254725679016",
      currency: "KSh",
      paymentInstructions:
        "Pay via M-Pesa Till Number 8049446, then send the M-Pesa " +
        "confirmation message here."
    });
  });
  // Override the accent color to purple for this store:
  document.documentElement.style.setProperty("--cart-accent", "#7b2ff7");
  document.documentElement.style.setProperty("--cart-accent-dark", "#611fc2");
</script>
```

## 3. Wire up each product card

For every product on the page, call `attachControls` once its card
element exists in the DOM:

```html
<div class="product-card" id="card-avocado">
  <img src="images/avocado.jpg" alt="Grafted Avocado Seedling">
  <h3>Grafted Avocado Seedling</h3>
  <p>KSh 350</p>
  <!-- StoreCart injects the Add to Cart button / qty stepper here -->
</div>

<script>
  StoreCart.attachControls(document.getElementById("card-avocado"), {
    id: "avocado-seedling",       // unique per product
    name: "Grafted Avocado Seedling",
    price: 350,
    image: "images/avocado.jpg"   // optional
  });
</script>
```

If your products come from a JS array (e.g. loaded from JSON), loop
over it after rendering the cards:

```js
products.forEach(p => {
  const card = document.getElementById(`card-${p.id}`);
  StoreCart.attachControls(card, p);
});
```

## What happens at checkout

The customer taps the floating cart icon → reviews items in the
drawer → taps "Checkout via WhatsApp". This opens WhatsApp with a
message like:

```
Order from FARMTEK09 CENTRE:

1. Grafted Avocado Seedling x2 — KSh 700
2. Passion Fruit Seedling x1 — KSh 150

Subtotal: KSh 850

Pay via Co-op Bank Lipa na M-Pesa – Business No. 400200, Account No.
54095 (FARMTEK09 CENTRE), then send the M-Pesa confirmation message
here.
```

The customer sends it to your WhatsApp number, and you take it from
there — same manual flow you already have, just with a proper cart
in front of it.

## Notes

- Cart contents persist for the tab (sessionStorage) so a reload
  mid-browse doesn't lose the cart, but it clears when the tab
  closes.
- Colors are CSS variables (`--cart-accent`, `--cart-accent-dark`)
  on `:root` — override per store as shown above instead of editing
  `cart.css`.
- No framework, no npm install — works as-is inside a plain
  GitHub Pages HTML/CSS/JS site.
