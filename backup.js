// Nächtliche Sicherung des kompletten Datenbestands in einen S3-kompatiblen Speicher
// (Cloudflare R2, Backblaze B2, AWS S3 …). Ohne Zugangsdaten bleibt die Funktion still aus.
import { createHash, createHmac } from "node:crypto";
import { gzipSync } from "node:zlib";
import { exportAll, getSetting, setSetting } from "./store.js";

const cfg = {
  endpoint: (process.env.BACKUP_S3_ENDPOINT || "").replace(/\/+$/, ""),
  bucket: process.env.BACKUP_S3_BUCKET || "",
  region: process.env.BACKUP_S3_REGION || "auto",
  keyId: process.env.BACKUP_S3_KEY_ID || "",
  secret: process.env.BACKUP_S3_SECRET || "",
  praefix: (process.env.BACKUP_S3_PREFIX || "personalpool").replace(/^\/+|\/+$/g, ""),
  tage: Number(process.env.BACKUP_RETENTION_DAYS || 30),
};

export const backupKonfiguriert = Boolean(cfg.endpoint && cfg.bucket && cfg.keyId && cfg.secret);

const LETZTE = "letztes_backup";
const INTERVALL_MS = 60 * 60 * 1000;
const ABSTAND_MS = 20 * 60 * 60 * 1000;

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

// AWS Signature Version 4 – reicht für alle S3-kompatiblen Anbieter, spart eine Abhängigkeit.
function signiere({ methode, pfad, query = "", payload }) {
  const url = new URL(`${cfg.endpoint}/${cfg.bucket}${pfad}${query ? `?${query}` : ""}`);
  const jetzt = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const tag = jetzt.slice(0, 8);
  const hash = sha256(payload ?? "");
  const headers = {
    host: url.host,
    "x-amz-content-sha256": hash,
    "x-amz-date": jetzt,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonical = [
    methode,
    url.pathname,
    query,
    ...Object.keys(headers)
      .sort()
      .map((k) => `${k}:${headers[k]}`),
    "",
    signedHeaders,
    hash,
  ].join("\n");
  const scope = `${tag}/${cfg.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", jetzt, scope, sha256(canonical)].join("\n");
  let key = hmac(`AWS4${cfg.secret}`, tag);
  for (const teil of [cfg.region, "s3", "aws4_request"]) key = hmac(key, teil);
  const signatur = createHmac("sha256", key).update(toSign).digest("hex");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.keyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signatur}`;
  return { url: url.toString(), headers };
}

async function anfrage({ methode, pfad, query, payload }) {
  const { url, headers } = signiere({ methode, pfad, query, payload });
  const res = await fetch(url, { method: methode, headers, body: methode === "GET" ? undefined : payload });
  const text = methode === "GET" ? await res.text() : await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Speicher antwortete ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

async function vorhandene() {
  const xml = await anfrage({
    methode: "GET",
    pfad: "/",
    query: `list-type=2&prefix=${encodeURIComponent(`${cfg.praefix}/`)}`,
    payload: "",
  });
  return [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((m) => ({
    key: /<Key>(.*?)<\/Key>/.exec(m[1])?.[1] || "",
    datum: /<LastModified>(.*?)<\/LastModified>/.exec(m[1])?.[1] || "",
  }));
}

async function alteEntfernen() {
  if (!(cfg.tage > 0)) return 0;
  const grenze = Date.now() - cfg.tage * 24 * 60 * 60 * 1000;
  let entfernt = 0;
  for (const eintrag of await vorhandene()) {
    if (!eintrag.key || Date.parse(eintrag.datum) >= grenze) continue;
    await anfrage({ methode: "DELETE", pfad: `/${eintrag.key.split("/").map(encodeURIComponent).join("/")}` });
    entfernt += 1;
  }
  return entfernt;
}

export async function erstelleSicherung() {
  const daten = await exportAll();
  const inhalt = gzipSync(Buffer.from(JSON.stringify(daten)));
  const name = `${cfg.praefix}/personalpool-${daten.erstelltAm.slice(0, 19).replace(/[:T]/g, "-")}.json.gz`;
  await anfrage({ methode: "PUT", pfad: `/${name.split("/").map(encodeURIComponent).join("/")}`, payload: inhalt });
  const entfernt = await alteEntfernen().catch((err) => {
    console.error("Aufräumen alter Sicherungen fehlgeschlagen:", err.message);
    return 0;
  });
  await setSetting(LETZTE, new Date().toISOString());
  return { name, bytes: inhalt.length, entfernt, mitarbeiter: daten.mitarbeiter.length };
}

export async function sicherungsStatus() {
  const letzte = await getSetting(LETZTE);
  return { konfiguriert: backupKonfiguriert, letzte, aufbewahrungTage: cfg.tage, ziel: cfg.bucket };
}

// Der Gratis-Server schläft nachts oft; deshalb wird stündlich geprüft und beim Aufwachen nachgeholt.
async function faelligPruefen() {
  try {
    const letzte = Date.parse(await getSetting(LETZTE));
    if (Number.isFinite(letzte) && Date.now() - letzte < ABSTAND_MS) return;
    const ergebnis = await erstelleSicherung();
    console.log(`Sicherung abgelegt: ${ergebnis.name} (${ergebnis.bytes} Bytes, ${ergebnis.entfernt} alte entfernt)`);
  } catch (err) {
    console.error("Sicherung fehlgeschlagen:", err.message);
  }
}

export function starteSicherungsplan() {
  if (!backupKonfiguriert) {
    console.log("Sicherung nicht konfiguriert (BACKUP_S3_* fehlen) – es werden keine Backups abgelegt.");
    return;
  }
  faelligPruefen();
  setInterval(faelligPruefen, INTERVALL_MS).unref();
}
