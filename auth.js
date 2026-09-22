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

export const TEAM_USER = { id: "team", name: "Team-Zugang", rolle: "admin", team: true };

function makeToken(user) {
  const payload = Buffer.from(
    JSON.stringify({ id: user.id, name: user.name, rolle: user.rolle, exp: Date.now() + MAX_AGE_MS })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.id || Number(data.exp) < Date.now()) return null;
    return { id: data.id, name: data.name, rolle: data.rolle, team: data.id === "team" };
  } catch {
    return null;
  }
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

export function currentUser(req) {
  return readToken(parseCookies(req)[COOKIE]);
}

export function isAuthed(req) {
  return Boolean(currentUser(req));
}

export function setAuthCookie(res, user) {
  res.cookie(COOKIE, makeToken(user), {
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
  const user = currentUser(req);
  if (!user) return res.status(401).json({ ok: false, error: "Nicht angemeldet." });
  req.user = user;
  return next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.rolle !== "admin") return res.status(403).json({ ok: false, error: "Nur für Administratoren." });
  return next();
}
