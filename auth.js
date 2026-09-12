// Passwort-Login über ein signiertes Cookie – ohne zusätzliche Abhängigkeiten.
import crypto from "node:crypto";

const isProd = process.env.NODE_ENV === "production";
const APP_PASSWORD = process.env.APP_PASSWORD || (isProd ? "" : "demo");
const SECRET = process.env.APP_SECRET || APP_PASSWORD || "personalpool-dev-secret";

const COOKIE = "pp_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const loginEnabled = Boolean(APP_PASSWORD);
export const usesDevDefault = !process.env.APP_PASSWORD && !isProd;

function sign(value) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function makeToken() {
  const exp = String(Date.now() + MAX_AGE_MS);
  return `${exp}.${sign(exp)}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return false;
  const [exp, sig] = token.split(".");
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

export function checkPassword(pw) {
  if (!APP_PASSWORD) return false;
  return safeEqual(pw, APP_PASSWORD);
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function isAuthed(req) {
  return verifyToken(parseCookies(req)[COOKIE]);
}

export function setAuthCookie(res) {
  res.cookie(COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { path: "/" });
}

export function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  return res.status(401).json({ ok: false, error: "Nicht angemeldet." });
}
