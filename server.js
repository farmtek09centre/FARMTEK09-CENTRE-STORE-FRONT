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
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "").trim();
const adminSessions = new Map();
const transactions = new Map();
if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET || !process.env.MPESA_PASSKEY || !SHORTCODE) console.warn("M-PESA credentials are missing. Add them to .env before making payments.");
if (!CALLBACK_BASE_URL) console.warn("MPESA_CALLBACK_BASE_URL is missing. Safaricom requires a publicly reachable callback URL.");
if (!ADMIN_PASSWORD) console.warn("ADMIN_PASSWORD is missing. Admin API login will be unavailable.");
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.json({ limit: "200kb" }));
async function readCatalogue(){return JSON.parse(await fs.readFile(CATALOGUE_FILE,"utf8"));}
async function writeCatalogue(products){await fs.mkdir(path.dirname(CATALOGUE_FILE),{recursive:true});await fs.writeFile(CATALOGUE_FILE,JSON.stringify(products,null,2)+"\n","utf8");}
function adminAuth(req,res,next){const value=String(req.headers.authorization||"");const token=value.startsWith("Bearer ")?value.slice(7):"";const expires=adminSessions.get(token);if(!token||!expires||expires<Date.now())return res.status(401).json({message:"Admin authentication required."});next();}
function cleanPhone(raw){const digits=String(raw||"").replace(/\D/g,"");if(/^07\d{8}$/.test(digits))return `254${digits.slice(1)}`;if(/^01\d{8}$/.test(digits))return `254${digits.slice(1)}`;if(/^254[17]\d{8}$/.test(digits))return digits;return null;}
function normalizeAmount(raw){const amount=Number(raw);return Number.isInteger(amount)&&amount>=1?amount:null;}
function makeTimestamp(){const n=new Date();return [n.getFullYear(),String(n.getMonth()+1).padStart(2,"0"),String(n.getDate()).padStart(2,"0"),String(n.getHours()).padStart(2,"0"),String(n.getMinutes()).padStart(2,"0"),String(n.getSeconds()).padStart(2,"0")].join("");}
async function getAccessToken(){const auth=Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");const r=await fetch(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,{headers:{Authorization:`Basic ${auth}`,Accept:"application/json"}});const body=await r.text();const data=JSON.parse(body);if(!r.ok||!data.access_token)throw new Error(data.errorMessage||data.error||`OAuth failed (HTTP ${r.status}).`);return data.access_token;}
function stkPassword(timestamp){return Buffer.from(`${SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString("base64");}
app.get("/api/catalogue",async(_req,res)=>{try{res.json(await readCatalogue())}catch{res.status(500).json({message:"Catalogue unavailable."})}});
app.post("/api/admin/login",(req,res)=>{const supplied=Buffer.from(String(req.body?.password||""));const expected=Buffer.from(ADMIN_PASSWORD);const valid=Boolean(ADMIN_PASSWORD)&&supplied.length===expected.length&&crypto.timingSafeEqual(supplied,expected);if(!valid)return res.status(401).json({message:"Invalid admin password."});const token=crypto.randomBytes(32).toString("hex");adminSessions.set(token,Date.now()+8*60*60*1000);res.json({token});});
app.get("/api/admin/products",adminAuth,async(_req,res)=>res.json({products:await readCatalogue()}));
app.post("/api/admin/products",adminAuth,async(req,res)=>{const p=req.body||{};const products=await readCatalogue();const id=String(p.id||`${Date.now()}-${String(p.name||'product').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`);if(!p.name||!p.category)return res.status(400).json({message:"Name and category are required."});if(products.some(x=>x.id===id))return res.status(409).json({message:"Product ID already exists."});const product={id,name:String(p.name),category:String(p.category),price:p.price==null?null:Number(p.price),stock:p.stock==null?null:Number(p.stock),blurb:String(p.blurb||""),image:String(p.image||"")};products.push(product);await writeCatalogue(products);res.status(201).json(product);});
app.put("/api/admin/products/:id",adminAuth,async(req,res)=>{const products=await readCatalogue();const i=products.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({message:"Product not found."});const p=req.body||{};products[i]={...products[i],name:String(p.name||products[i].name),category:String(p.category||products[i].category),price:p.price==null?null:Number(p.price),stock:p.stock==null?null:Number(p.stock),blurb:String(p.blurb??products[i].blurb??""),image:String(p.image??products[i].image??"")};await writeCatalogue(products);res.json(products[i]);});
app.delete("/api/admin/products/:id",adminAuth,async(req,res)=>{const products=await readCatalogue();const next=products.filter(x=>x.id!==req.params.id);if(next.length===products.length)return res.status(404).json({message:"Product not found."});await writeCatalogue(next);res.json({ok:true});});
app.get("/api/health",(_req,res)=>res.json({ok:true,service:"farmtek09-mpesa",environment:isProduction?"production":"sandbox"}));
app.post("/api/mpesa/stk-push",async(req,res)=>{try{const phone=cleanPhone(req.body?.phone),amount=normalizeAmount(req.body?.amount),accountReference=String(req.body?.accountReference||"FARMTEK09").trim().slice(0,12),transactionDesc=String(req.body?.transactionDesc||"FARMTEK09 payment").trim().slice(0,13);if(!phone)return res.status(400).json({ok:false,message:"Enter a valid Kenyan M-PESA number."});if(!amount)return res.status(400).json({ok:false,message:"Enter a valid whole-number amount."});if(!SHORTCODE)return res.status(500).json({ok:false,message:"M-PESA shortcode is not configured."});if(!CALLBACK_BASE_URL.startsWith("https://"))return res.status(500).json({ok:false,message:"M-PESA callback URL is not configured as HTTPS."});const token=await getAccessToken(),timestamp=makeTimestamp();const payload={BusinessShortCode:SHORTCODE,Password:stkPassword(timestamp),Timestamp:timestamp,TransactionType:"CustomerPayBillOnline",Amount:amount,PartyA:phone,PartyB:SHORTCODE,PhoneNumber:phone,CallBackURL:`${CALLBACK_BASE_URL}/api/mpesa/callback`,AccountReference:accountReference,TransactionDesc:transactionDesc};const r=await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok||data.ResponseCode!=="0")return res.status(502).json({ok:false,message:data.errorMessage||data.ResponseDescription||"Safaricom did not accept the payment request."});transactions.set(data.CheckoutRequestID,{status:"pending",phone,amount,accountReference,createdAt:Date.now()});res.json({ok:true,message:data.CustomerMessage||"STK prompt sent.",checkoutRequestId:data.CheckoutRequestID});}catch(error){console.error(error);res.status(500).json({ok:false,message:error.message||"Unable to start M-PESA payment."})}});
app.post("/api/mpesa/callback",(req,res)=>{const callback=req.body?.Body?.stkCallback;if(!callback)return res.status(400).json({ResultCode:1,ResultDesc:"Invalid callback payload"});const tx=transactions.get(callback.CheckoutRequestID);if(tx){tx.status=Number(callback.ResultCode)===0?"success":"failed";tx.resultCode=Number(callback.ResultCode);tx.resultDesc=callback.ResultDesc||"";tx.completedAt=Date.now();transactions.set(callback.CheckoutRequestID,tx);}res.json({ResultCode:0,ResultDesc:"Accepted"});});
app.get("/api/mpesa/status/:checkoutRequestId",(req,res)=>{const tx=transactions.get(req.params.checkoutRequestId);if(!tx)return res.status(404).json({ok:false,message:"Transaction not found or expired."});res.json({ok:true,...tx});});
app.use(express.static("public"));
app.listen(PORT,()=>console.log(`FARMTEK09 M-PESA server running on port ${PORT}`));