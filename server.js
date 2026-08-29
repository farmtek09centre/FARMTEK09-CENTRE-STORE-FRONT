import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load secrets from .env. Never put these values in app.js or index.html.
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const isProduction = process.env.MPESA_ENV === "production";
const MPESA_BASE_URL = isProduction
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

const SHORTCODE = String(process.env.MPESA_SHORTCODE || "").trim();
const CALLBACK_BASE_URL = (process.env.MPESA_CALLBACK_BASE_URL || "").replace(/\/$/, "");

if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET || !process.env.MPESA_PASSKEY || !SHORTCODE) {
  console.warn("M-PESA credentials are missing. Add them to .env before making payments.");
}

if (!SHORTCODE) {
  console.warn("MPESA_SHORTCODE is missing. Set the shortcode assigned to your Daraja app.");
}

if (!CALLBACK_BASE_URL) {
  console.warn("MPESA_CALLBACK_BASE_URL is missing. Safaricom requires a publicly reachable callback URL.");
}

const allowedOrigin = process.env.FRONTEND_ORIGIN || true;
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "100kb" }));

// Demo transaction store. For production, replace this with a database.
const transactions = new Map();

function cleanPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (/^07\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^01\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^\+254[17]\d{8}$/.test(String(raw || "").replace(/\s/g, ""))) return digits;
  return null;
}

function normalizeAmount(raw) {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 1) return null;
  return amount;
}

function makeTimestamp() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ];
  return parts.join("");
}

async function getAccessToken() {
  const auth = Buffer
    .from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`)
    .toString("base64");

  const response = await fetch(
    `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json"
      }
    }
  );

  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Safaricom OAuth returned a non-JSON response (HTTP ${response.status}).`);
  }

  if (!response.ok || !data.access_token) {
    throw new Error(data.errorMessage || data.error || `OAuth failed (HTTP ${response.status}).`);
  }

  return data.access_token;
}

function stkPassword(timestamp) {
  return Buffer
    .from(`${SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`)
    .toString("base64");
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "farmtek09-mpesa", environment: isProduction ? "production" : "sandbox" });
});

app.post("/api/mpesa/stk-push", async (req, res) => {
  try {
    const phone = cleanPhone(req.body?.phone);
    const amount = normalizeAmount(req.body?.amount);
    const accountReference = String(req.body?.accountReference || "FARMTEK09").trim().slice(0, 12);
    const transactionDesc = String(req.body?.transactionDesc || "FARMTEK09 payment").trim().slice(0, 13);

    if (!phone) return res.status(400).json({ ok: false, message: "Enter a valid Kenyan M-PESA number, e.g. 0712345678." });
    if (!amount) return res.status(400).json({ ok: false, message: "Enter a valid whole-number amount of at least KES 1." });
    if (!/^[A-Za-z0-9 ._-]{1,12}$/.test(accountReference)) {
      return res.status(400).json({ ok: false, message: "Account reference may contain letters, numbers, spaces, dots, underscores or hyphens only." });
    }

    if (!SHORTCODE) {
      return res.status(500).json({ ok: false, message: "M-PESA shortcode is not configured on the server." });
    }

    if (!CALLBACK_BASE_URL.startsWith("https://")) {
      return res.status(500).json({ ok: false, message: "M-PESA callback URL is not configured as a public HTTPS URL." });
    }

    const token = await getAccessToken();
    const timestamp = makeTimestamp();
    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: stkPassword(timestamp),
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: `${CALLBACK_BASE_URL}/api/mpesa/callback`,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc
    };

    const response = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      data = { errorMessage: `Safaricom returned a non-JSON response (HTTP ${response.status}).` };
    }

    if (!response.ok || data.ResponseCode !== "0") {
      return res.status(502).json({
        ok: false,
        message: data.errorMessage || data.ResponseDescription || "Safaricom did not accept the payment request.",
        details: isProduction ? undefined : data
      });
    }

    const checkoutRequestId = data.CheckoutRequestID;
    transactions.set(checkoutRequestId, {
      status: "pending",
      phone,
      amount,
      accountReference,
      merchantRequestId: data.MerchantRequestID,
      createdAt: Date.now()
    });

    return res.json({
      ok: true,
      message: data.CustomerMessage || "STK prompt sent. Check your phone and enter your M-PESA PIN.",
      checkoutRequestId
    });
  } catch (error) {
    console.error("STK push error:", error);
    return res.status(500).json({ ok: false, message: error.message || "Unable to start M-PESA payment." });
  }
});

app.post("/api/mpesa/callback", (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.status(400).json({ ResultCode: 1, ResultDesc: "Invalid callback payload" });

    const id = callback.CheckoutRequestID;
    const tx = transactions.get(id);
    const resultCode = Number(callback.ResultCode);

    if (tx) {
      tx.status = resultCode === 0 ? "success" : "failed";
      tx.resultCode = resultCode;
      tx.resultDesc = callback.ResultDesc || "";
      tx.receipt = callback.CallbackMetadata?.Item?.find((item) => item.Name === "MpesaReceiptNumber")?.Value || null;
      tx.completedAt = Date.now();
      transactions.set(id, tx);
    }

    // Safaricom expects an acknowledgment response.
    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Callback error:", error);
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

app.get("/api/mpesa/status/:checkoutRequestId", (req, res) => {
  const tx = transactions.get(req.params.checkoutRequestId);
  if (!tx) return res.status(404).json({ ok: false, message: "Transaction not found or expired." });
  res.json({ ok: true, ...tx });
});

// Serve the storefront from /public when deployed as one Node app.
app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`FARMTEK09 M-PESA server running on port ${PORT}`);
  console.log(`Mode: ${isProduction ? "production" : "sandbox"}`);
});
