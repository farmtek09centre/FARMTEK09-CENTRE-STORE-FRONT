import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.MPESA_ENV === "production";
const MPESA_BASE_URL = isProduction ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
const SHORTCODE = String(process.env.MPESA_SHORTCODE || "").trim();
const CALLBACK_BASE_URL = (process.env.MPESA_CALLBACK_BASE_URL || "").replace(/\/$/, "");
const CATALOGUE_FILE = path.join(process.cwd(), "data", "catalogue.json");
const ORDERS_FILE = path.join(process.cwd(), "data", "orders.json");
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "").trim();
const STORE_NAME = String(process.env.STORE_NAME || "FARMTEK09 CENTRE").trim();
const WHATSAPP_NUMBER = String(process.env.WHATSAPP_NUMBER || "254725528888").trim();
const PAYBILL_BUSINESS = String(process.env.PAYBILL_BUSINESS || "400200").trim();
const PAYBILL_ACCOUNT = String(process.env.PAYBILL_ACCOUNT || "54095").trim();
const DELIVERY_FLAT_FEE = process.env.DELIVERY_FLAT_FEE_KES === "" || process.env.DELIVERY_FLAT_FEE_KES == null
  ? null
  : Number(process.env.DELIVERY_FLAT_FEE_KES);

const adminSessions = new Map();
const transactions = new Map();

if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET || !process.env.MPESA_PASSKEY || !SHORTCODE) console.warn("M-PESA credentials are missing. Add them to .env before making payments.");
if (!CALLBACK_BASE_URL) console.warn("MPESA_CALLBACK_BASE_URL is missing. Safaricom requires a publicly reachable callback URL.");
if (!ADMIN_PASSWORD) console.warn("ADMIN_PASSWORD is missing. Admin API login will be unavailable.");

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.json({ limit: "250kb" }));

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fs.rename(temp, file);
}

const readCatalogue = () => readJson(CATALOGUE_FILE, []);
const writeCatalogue = (products) => writeJson(CATALOGUE_FILE, products);
const readOrders = () => readJson(ORDERS_FILE, []);
const writeOrders = (orders) => writeJson(ORDERS_FILE, orders);

function adminAuth(req, res, next) {
  const value = String(req.headers.authorization || "");
  const token = value.startsWith("Bearer ") ? value.slice(7) : "";
  const expires = adminSessions.get(token);
  if (!token || !expires || expires < Date.now()) return res.status(401).json({ message: "Admin authentication required." });
  next();
}

function cleanPhone(raw) {
  const rawText = String(raw || "").trim();
  const compact = rawText.replace(/\s/g, "");
  const digits = compact.replace(/\D/g, "");
  if (/^07\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^01\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^\+254[17]\d{8}$/.test(compact)) return digits;
  return null;
}

function normalizeAmount(raw) {
  const amount = Number(raw);
  return Number.isInteger(amount) && amount >= 1 ? amount : null;
}

function makeTimestamp() {
  const n = new Date();
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, "0"), String(n.getDate()).padStart(2, "0"), String(n.getHours()).padStart(2, "0"), String(n.getMinutes()).padStart(2, "0"), String(n.getSeconds()).padStart(2, "0")].join("");
}

function makeOrderId() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `FT09-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function makePublicToken() {
  return crypto.randomBytes(12).toString("hex");
}

function normalizeText(value, max = 200) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

async function getAccessToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  const r = await fetch(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }
  });
  const body = await r.text();
  let data = {};
  try { data = JSON.parse(body); } catch {}
  if (!r.ok || !data.access_token) throw new Error(data.errorMessage || data.error || `OAuth failed (HTTP ${r.status}).`);
  return data.access_token;
}

function stkPassword(timestamp) {
  return Buffer.from(`${SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString("base64");
}

async function validateAndPriceItems(items) {
  const catalogue = await readCatalogue();
  if (!Array.isArray(items) || !items.length) throw new Error("Your cart is empty.");

  const normalized = [];
  for (const raw of items) {
    const product = catalogue.find((p) => p.id === raw.productId);
    const quantity = Number(raw.quantity);
    if (!product) throw new Error("One of the selected products is no longer available.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error(`Invalid quantity for ${product.name}.`);
    if (product.stock != null && quantity > Number(product.stock)) throw new Error(`${product.name} only has ${product.stock} in stock.`);
    if (product.price == null || !Number.isFinite(Number(product.price))) throw new Error(`${product.name} is enquiry-only. Contact us on WhatsApp for its price.`);
    normalized.push({
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: Number(product.price),
      lineTotal: Number(product.price) * quantity
    });
  }
  const subtotal = normalized.reduce((sum, item) => sum + item.lineTotal, 0);
  return { normalized, subtotal };
}

function publicOrder(order) {
  return {
    id: order.id,
    createdAt: order.createdAt,
    customerName: order.customerName,
    deliveryMethod: order.deliveryMethod,
    deliveryZone: order.deliveryZone,
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    mpesaReceipt: order.mpesaReceipt || null
  };
}

async function applySuccessfulPayment(orderId, transaction) {
  if (!orderId) return;
  const [orders, catalogue] = await Promise.all([readOrders(), readCatalogue()]);
  const order = orders.find((o) => o.id === orderId);
  if (!order || order.paymentStatus === "paid") return;
  order.paymentStatus = "paid";
  order.status = "paid";
  order.paidAt = new Date().toISOString();
  order.paymentReference = transaction.receipt || transaction.checkoutRequestId || null;
  order.mpesaReceipt = transaction.receipt || null;

  if (!order.stockDeducted) {
    for (const item of order.items) {
      const product = catalogue.find((p) => p.id === item.productId);
      if (product && product.stock != null) product.stock = Math.max(0, Number(product.stock) - Number(item.quantity));
    }
    order.stockDeducted = true;
  }
  await writeCatalogue(catalogue);
  await writeOrders(orders);
}

app.get("/api/catalogue", async (_req, res) => {
  try { res.json(await readCatalogue()); }
  catch { res.status(500).json({ message: "Catalogue unavailable." }); }
});

app.get("/api/payment-config", (_req, res) => res.json({
  storeName: STORE_NAME,
  whatsappNumber: WHATSAPP_NUMBER,
  mpesaBusinessNumber: PAYBILL_BUSINESS,
  mpesaAccountNumber: PAYBILL_ACCOUNT,
  delivery: {
    collectionAvailable: true,
    deliveryAvailable: true,
    flatFeeKes: Number.isFinite(DELIVERY_FLAT_FEE) ? DELIVERY_FLAT_FEE : null,
    deliveryNote: Number.isFinite(DELIVERY_FLAT_FEE) ? "Flat delivery fee applies." : "Delivery charge is confirmed with the customer before dispatch."
  }
}));

app.post("/api/orders", async (req, res) => {
  try {
    const customer = req.body?.customer || {};
    const customerName = normalizeText(customer.name, 80);
    const phone = cleanPhone(customer.phone);
    const email = normalizeText(customer.email, 120);
    const deliveryMethod = req.body?.deliveryMethod === "delivery" ? "delivery" : "collection";
    const deliveryZone = normalizeText(req.body?.deliveryZone, 80);
    const address = normalizeText(req.body?.address, 220);
    const notes = normalizeText(req.body?.notes, 500);
    const paymentMethod = req.body?.paymentMethod === "mpesa" ? "mpesa" : "whatsapp";

    if (!customerName) return res.status(400).json({ message: "Customer name is required." });
    if (!phone) return res.status(400).json({ message: "Enter a valid Kenyan phone number." });
    if (deliveryMethod === "delivery" && !deliveryZone) return res.status(400).json({ message: "Choose a delivery area." });
    if (deliveryMethod === "delivery" && !address) return res.status(400).json({ message: "Enter the delivery address or landmark." });

    const { normalized, subtotal } = await validateAndPriceItems(req.body?.items);
    const deliveryFee = deliveryMethod === "collection" ? 0 : (Number.isFinite(DELIVERY_FLAT_FEE) ? DELIVERY_FLAT_FEE : null);
    const total = subtotal + (deliveryFee || 0);
    const now = new Date().toISOString();
    const order = {
      id: makeOrderId(),
      publicToken: makePublicToken(),
      createdAt: now,
      updatedAt: now,
      customerName,
      phone,
      email,
      deliveryMethod,
      deliveryZone,
      address,
      notes,
      items: normalized,
      subtotal,
      deliveryFee,
      total,
      paymentMethod,
      paymentStatus: "unpaid",
      status: "new",
      stockDeducted: false,
      timeline: [{ status: "new", at: now }]
    };

    const orders = await readOrders();
    orders.unshift(order);
    await writeOrders(orders);

    const publicData = publicOrder(order);
    res.status(201).json({ ...publicData, trackingToken: order.publicToken, paymentReady: deliveryFee !== null });
  } catch (error) {
    res.status(400).json({ message: error.message || "Unable to create the order." });
  }
});

app.get("/api/orders/:id", async (req, res) => {
  try {
    const orders = await readOrders();
    const order = orders.find((o) => o.id === req.params.id && o.publicToken === String(req.query.token || ""));
    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json({ ...publicOrder(order), trackingToken: order.publicToken });
  } catch {
    res.status(500).json({ message: "Order tracking is unavailable." });
  }
});

app.post("/api/admin/login", (req, res) => {
  const supplied = Buffer.from(String(req.body?.password || ""));
  const expected = Buffer.from(ADMIN_PASSWORD);
  const valid = Boolean(ADMIN_PASSWORD) && supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  if (!valid) return res.status(401).json({ message: "Invalid admin password." });
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
  res.json({ token, expiresInHours: 8 });
});

app.get("/api/admin/products", adminAuth, async (_req, res) => res.json({ products: await readCatalogue() }));

app.post("/api/admin/products", adminAuth, async (req, res) => {
  try {
    const p = req.body || {};
    const products = await readCatalogue();
    const id = String(p.id || `${Date.now()}-${String(p.name || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`);
    if (!p.name || !p.category) return res.status(400).json({ message: "Name and category are required." });
    if (products.some((x) => x.id === id)) return res.status(409).json({ message: "Product ID already exists." });
    const product = {
      id,
      name: normalizeText(p.name, 140),
      category: normalizeText(p.category, 80),
      price: p.price == null || p.price === "" ? null : Number(p.price),
      stock: p.stock == null || p.stock === "" ? null : Number(p.stock),
      blurb: normalizeText(p.blurb, 300),
      image: normalizeText(p.image, 500),
      featured: Boolean(p.featured),
      badge: normalizeText(p.badge, 40)
    };
    if (product.price != null && (!Number.isFinite(product.price) || product.price < 0)) return res.status(400).json({ message: "Price must be a valid positive number or blank." });
    if (product.stock != null && (!Number.isInteger(product.stock) || product.stock < 0)) return res.status(400).json({ message: "Stock must be a whole number or blank." });
    products.push(product);
    await writeCatalogue(products);
    res.status(201).json(product);
  } catch (error) { res.status(500).json({ message: error.message || "Unable to save product." }); }
});

app.put("/api/admin/products/:id", adminAuth, async (req, res) => {
  try {
    const products = await readCatalogue();
    const i = products.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ message: "Product not found." });
    const p = req.body || {};
    const next = {
      ...products[i],
      name: normalizeText(p.name || products[i].name, 140),
      category: normalizeText(p.category || products[i].category, 80),
      price: p.price == null || p.price === "" ? null : Number(p.price),
      stock: p.stock == null || p.stock === "" ? null : Number(p.stock),
      blurb: normalizeText(p.blurb ?? products[i].blurb ?? "", 300),
      image: normalizeText(p.image ?? products[i].image ?? "", 500),
      featured: p.featured == null ? Boolean(products[i].featured) : Boolean(p.featured),
      badge: normalizeText(p.badge ?? products[i].badge ?? "", 40)
    };
    if (next.price != null && (!Number.isFinite(next.price) || next.price < 0)) return res.status(400).json({ message: "Price must be a valid positive number or blank." });
    if (next.stock != null && (!Number.isInteger(next.stock) || next.stock < 0)) return res.status(400).json({ message: "Stock must be a whole number or blank." });
    products[i] = next;
    await writeCatalogue(products);
    res.json(next);
  } catch (error) { res.status(500).json({ message: error.message || "Unable to update product." }); }
});

app.delete("/api/admin/products/:id", adminAuth, async (req, res) => {
  const products = await readCatalogue();
  const next = products.filter((x) => x.id !== req.params.id);
  if (next.length === products.length) return res.status(404).json({ message: "Product not found." });
  await writeCatalogue(next);
  res.json({ ok: true });
});

app.get("/api/admin/orders", adminAuth, async (req, res) => {
  const orders = await readOrders();
  const status = normalizeText(req.query.status, 30);
  res.json({ orders: status ? orders.filter((o) => o.status === status) : orders });
});

app.patch("/api/admin/orders/:id", adminAuth, async (req, res) => {
  const orders = await readOrders();
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found." });
  const allowed = ["new", "awaiting_payment", "paid", "preparing", "ready", "dispatched", "completed", "cancelled"];
  const nextStatus = normalizeText(req.body?.status, 30);
  if (!allowed.includes(nextStatus)) return res.status(400).json({ message: "Invalid order status." });
  const at = new Date().toISOString();
  order.status = nextStatus;
  order.updatedAt = at;
  order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
  order.timeline.push({ status: nextStatus, at, note: normalizeText(req.body?.note, 200) });
  if (nextStatus === "cancelled" && order.stockDeducted) {
    const catalogue = await readCatalogue();
    for (const item of order.items) {
      const product = catalogue.find((p) => p.id === item.productId);
      if (product && product.stock != null) product.stock = Number(product.stock) + Number(item.quantity);
    }
    order.stockDeducted = false;
    await writeCatalogue(catalogue);
  }
  await writeOrders(orders);
  res.json(publicOrder(order));
});

app.get("/api/admin/stats", adminAuth, async (_req, res) => {
  const [orders, products] = await Promise.all([readOrders(), readCatalogue()]);
  const paid = orders.filter((o) => o.paymentStatus === "paid");
  const revenue = paid.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const customers = new Set(orders.map((o) => o.phone).filter(Boolean));
  const lowStock = products.filter((p) => p.stock != null && Number(p.stock) > 0 && Number(p.stock) <= 5).length;
  const outOfStock = products.filter((p) => p.stock != null && Number(p.stock) <= 0).length;
  const byStatus = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
  res.json({ products: products.length, orders: orders.length, paidOrders: paid.length, revenue, customers: customers.size, lowStock, outOfStock, byStatus });
});

app.get("/api/admin/customers", adminAuth, async (_req, res) => {
  const orders = await readOrders();
  const grouped = new Map();
  for (const order of orders) {
    const key = order.phone || order.email || order.customerName;
    if (!grouped.has(key)) grouped.set(key, { name: order.customerName, phone: order.phone, email: order.email, orders: 0, spend: 0, lastOrderAt: order.createdAt });
    const c = grouped.get(key);
    c.orders += 1;
    if (order.paymentStatus === "paid") c.spend += Number(order.total || 0);
    if (order.createdAt > c.lastOrderAt) c.lastOrderAt = order.createdAt;
  }
  res.json({ customers: [...grouped.values()].sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt)) });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "farmtek09-centre", environment: isProduction ? "production" : "sandbox" }));

app.post("/api/mpesa/stk-push", async (req, res) => {
  try {
    const orderId = normalizeText(req.body?.orderId, 60);
    const orders = orderId ? await readOrders() : [];
    const order = orderId ? orders.find((o) => o.id === orderId) : null;
    const phone = cleanPhone(req.body?.phone || order?.phone);
    const amount = normalizeAmount(req.body?.amount || order?.total);
    const accountReference = String(order?.id || req.body?.accountReference || "FARMTEK09").replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "FARMTEK09";
    const transactionDesc = "FARMTEK09 order";

    if (!phone) return res.status(400).json({ ok: false, message: "Enter a valid Kenyan M-PESA number." });
    if (!amount) return res.status(400).json({ ok: false, message: "Enter a valid whole-number amount." });
    if (order && (!order.total || amount !== Number(order.total))) return res.status(400).json({ ok: false, message: "Payment amount does not match the order total." });
    if (order && order.deliveryFee === null) return res.status(400).json({ ok: false, message: "Delivery charge must be confirmed before online payment." });
    if (!SHORTCODE) return res.status(500).json({ ok: false, message: "M-PESA shortcode is not configured." });
    if (!CALLBACK_BASE_URL.startsWith("https://")) return res.status(500).json({ ok: false, message: "M-PESA callback URL is not configured as HTTPS." });

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
    const r = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.ResponseCode !== "0") return res.status(502).json({ ok: false, message: data.errorMessage || data.ResponseDescription || "Safaricom did not accept the payment request." });

    transactions.set(data.CheckoutRequestID, {
      status: "pending",
      phone,
      amount,
      accountReference,
      orderId: order?.id || null,
      merchantRequestId: data.MerchantRequestID,
      createdAt: Date.now()
    });

    if (order) {
      order.paymentMethod = "mpesa";
      order.paymentStatus = "pending";
      order.status = "awaiting_payment";
      order.updatedAt = new Date().toISOString();
      order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
      order.timeline.push({ status: "awaiting_payment", at: order.updatedAt });
      await writeOrders(orders);
    }

    res.json({ ok: true, message: data.CustomerMessage || "STK prompt sent.", checkoutRequestId: data.CheckoutRequestID, orderId: order?.id || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: error.message || "Unable to start M-PESA payment." });
  }
});

app.post("/api/mpesa/callback", async (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.status(400).json({ ResultCode: 1, ResultDesc: "Invalid callback payload" });
    const tx = transactions.get(callback.CheckoutRequestID);
    if (tx) {
      tx.status = Number(callback.ResultCode) === 0 ? "success" : "failed";
      tx.resultCode = Number(callback.ResultCode);
      tx.resultDesc = callback.ResultDesc || "";
      tx.receipt = callback.CallbackMetadata?.Item?.find((item) => item.Name === "MpesaReceiptNumber")?.Value || null;
      tx.completedAt = Date.now();
      transactions.set(callback.CheckoutRequestID, tx);
      if (tx.status === "success") await applySuccessfulPayment(tx.orderId, tx);
    }
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Callback error:", error);
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

app.get("/api/mpesa/status/:checkoutRequestId", (req, res) => {
  const tx = transactions.get(req.params.checkoutRequestId);
  if (!tx) return res.status(404).json({ ok: false, message: "Transaction not found or expired." });
  res.json({ ok: true, ...tx });
});

app.use(express.static("public"));
app.use(express.static("."));
app.listen(PORT, () => console.log(`FARMTEK09 CENTRE server running on port ${PORT}`));
