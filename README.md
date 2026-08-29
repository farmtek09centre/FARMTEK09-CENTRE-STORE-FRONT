# FARMTEK09 CENTRE — WhatsApp + Lipa na M-PESA (Daraja STK Push)

This version has **no shopping cart**. Customers can order through WhatsApp and, where a price is known, start a **Lipa na M-PESA PayBill STK Push** directly from the website.

## Daraja endpoint integrated

The supplied Safaricom Postman collection confirms the sandbox STK Push request as:

```text
POST https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
```

It uses Bearer authentication and the fields `BusinessShortCode`, `Password`, `Timestamp`, `TransactionType`, `Amount`, `PartyA`, `PartyB`, `PhoneNumber`, `CallBackURL`, `AccountReference`, and `TransactionDesc`. The supplied collection uses `CustomerPayBillOnline` as the transaction type example and `174379` as the sandbox shortcode example. fileciteturn0file0L1696-L1724

## What is included

- M-PESA payment form in the Pay via M-Pesa section.
- Product-level **Pay via M-PESA** buttons for priced products.
- Kenyan phone-number validation.
- Daraja OAuth access-token generation.
- Daraja sandbox STK Push integration.
- Safaricom callback endpoint.
- Payment-status polling for the customer.
- M-PESA credentials kept on the server, not browser JavaScript.
- No shopping cart.

## Important: sandbox shortcode vs business PayBill

Your storefront currently displays **400200 / 54095** as the manual PayBill details. That does not automatically mean the Daraja sandbox STK Push should use 400200. The Daraja collection supplied with this project uses **174379** as its example sandbox STK shortcode. Configure `MPESA_SHORTCODE` to the shortcode assigned to your own Daraja app.

The website can continue displaying your normal customer-facing PayBill details while the backend uses the correct shortcode for the Daraja environment. Before production, confirm the shortcode and settlement setup with Safaricom/the acquiring institution.

## 1. Configure Daraja

Create/select your Daraja application and obtain:

- Consumer Key
- Consumer Secret
- Lipa na M-PESA Online Passkey

The official Safaricom Daraja portal provides the API platform and app onboarding. citeturn134817search0turn134817search3

## 2. Configure `.env`

Copy `.env.example` to `.env` and fill the values:

```env
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_PASSKEY=your_passkey
MPESA_ENV=sandbox
MPESA_SHORTCODE=174379
MPESA_CALLBACK_BASE_URL=https://your-public-https-backend.example.com
FRONTEND_ORIGIN=http://localhost:3000
PORT=3000
```

Do **not** commit `.env` to GitHub.

## 3. Run

Requires Node.js 20+.

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## 4. Callback requirement

The callback is:

```text
POST https://YOUR-PUBLIC-HTTPS-BACKEND.example.com/api/mpesa/callback
```

Safaricom needs to reach this URL over the public internet. A localhost URL will not receive the callback.

## 5. Frontend/backend on separate hosts

If your website is hosted separately from the Node backend, set this in `app.js`:

```js
const MPESA_API_BASE = "https://api.yourdomain.co.ke";
```

Then set `FRONTEND_ORIGIN` in the backend `.env` to the actual website origin.

## 6. Payment flow

1. Customer clicks **Pay via M-PESA**.
2. Customer enters their M-PESA number and amount.
3. Browser sends the details to `/api/mpesa/stk-push`.
4. Backend gets an OAuth token from Daraja.
5. Backend POSTs the STK request to the Safaricom sandbox endpoint.
6. Customer receives the STK prompt and enters their PIN.
7. Safaricom calls `/api/mpesa/callback`.
8. Website polls the transaction status endpoint and displays success/failure.

## Production

Use production Daraja credentials and the production endpoint only after your Daraja application is approved/go-live. Replace the in-memory transaction store with a database before relying on it for real order records.
