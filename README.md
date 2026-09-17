# FARMTEK09 CENTRE Store

FARMTEK09 CENTRE is a lightweight nursery and farm-supplies storefront with a customer catalogue, shopping cart, order workflow, M-PESA checkout, order tracking, and private operations dashboard.

## Current storefront

The customer site includes:

- Full FARMTEK09 catalogue plus nursery/farm-supply items
- FARMTEK09 catalogue entries take priority over duplicated source entries
- Search, category filters, sorting, stock badges and featured products
- Product detail modal with direct WhatsApp enquiry
- Cart with quantity controls and browser persistence
- Collection or delivery fulfilment
- Bulk-order WhatsApp flow for 10+ items
- Customer order creation and secure order tracking
- WhatsApp order confirmation
- M-PESA STK Push linked to the order record

## Admin dashboard

Open `admin.html` after the backend is running. The private dashboard provides:

- Product add/edit/remove
- Price and stock management
- Product photos, descriptions, badges and featured flags
- Order search and status management
- Customer summary records from orders
- Revenue and inventory metrics
- Low-stock and out-of-stock visibility
- CSV export of orders
- Read-only visibility of current checkout configuration

## Backend

The Node/Express backend is `server.js`.

```bash
npm ci
cp env.example .env
npm start
```

For local development:

```bash
npm run dev
```

Run the automated checks with:

```bash
npm run check
```

The backend writes orders to `data/orders.json` and maintains the catalogue in `data/catalogue.json`.

## M-PESA

M-PESA credentials are environment variables only. The STK callback must point to a public HTTPS backend URL. Do not commit consumer keys, passkeys, admin passwords or other secrets.

## Delivery

Set `DELIVERY_FLAT_FEE_KES` when you want a fixed delivery charge. Leave it blank to quote delivery during checkout before dispatch.

## Deferred final phase: bank transfer and eTIMS

Bank-transfer checkout is intentionally not active in the current build. The environment template contains the configuration placeholders so bank details can be added later without changing the customer UI.

eTIMS is also intentionally deferred to the final integration phase. The order model and admin workflow are already structured so an eTIMS invoice reference can be attached to a completed order without faking an eTIMS receipt.

## Deployment notes

The public storefront is plain HTML/CSS/JS, while orders, admin functions and M-PESA require the Node backend. A production deployment therefore needs both the frontend and a persistent backend/data strategy. Do not use GitHub Pages alone for the order/API portion.

The repository includes a GitHub Actions verification workflow that checks JavaScript syntax and store data on pushes and pull requests.
