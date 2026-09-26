// Persistenzschicht für Mitarbeiter.
// Nutzt Postgres, wenn DATABASE_URL gesetzt ist – sonst eine lokale JSON-Datei (Dev).
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const FILE = join(DATA_DIR, "employees.json");
const EVENT_FILE = join(DATA_DIR, "events.json");
const DOC_FILE = join(DATA_DIR, "documents.json");
const DOC_DIR = join(DATA_DIR, "docs");
const USER_FILE = join(DATA_DIR, "users.json");
const SECRET_FILE = join(DATA_DIR, "session-secret");

const usePg = Boolean(process.env.DATABASE_URL);
export const storageBackend = usePg ? "postgres" : "file";

let pool = null;

export const KATEGORIEN = [
  { id: "gut", label: "Gute Mitarbeiter" },
  { id: "schlecht", label: "Schlechte Mitarbeiter" },
  { id: "nochmal", label: "Kann man nochmal gebrauchen" },
  { id: "finger", label: "Finger von lassen!" },
  { id: "student", label: "Studenten" },
];

const FIELDS = [
  "name",
  "kategorie",
  "bewertung",
  "sprachen",
  "nationalitaet",
  "wohnort",
  "mobilitaet",
  "staplerschein",
  "schichtbereit",
  "wiedereinstellbar",
  "vorerfahrung",
  "kontakt",
  "verfuegbar",
  "staplerscheinBis",
  "einsatzEnde",
  "notiz",
];

const DATE_FIELDS = ["verfuegbar", "staplerscheinBis", "einsatzEnde"];

function normalize(input) {
  const out = {};
  for (const f of FIELDS) out[f] = input[f] ?? "";
  out.name = String(out.name).trim();
  out.kategorie = KATEGORIEN.some((k) => k.id === out.kategorie) ? out.kategorie : "nochmal";
  out.bewertung = /^[1-5]$/.test(String(out.bewertung)) ? Number(out.bewertung) : null;
  for (const f of DATE_FIELDS) out[f] = out[f] || null;
  for (const f of ["staplerschein", "schichtbereit", "wiedereinstellbar"]) out[f] = Boolean(input[f]);
  out.einsaetze = Array.isArray(input.einsaetze)
    ? input.einsaetze
        .map((e) => ({
          unternehmen: String(e.unternehmen || "").trim(),
          taetigkeit: String(e.taetigkeit || "").trim(),
          zeitraum: String(e.zeitraum || "").trim(),
          ergebnis: String(e.ergebnis || "").trim(),
        }))
        .filter((e) => e.unternehmen || e.taetigkeit || e.zeitraum || e.ergebnis)
    : [];
  return out;
}

const asDate = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v || "");

function mapRow(r) {
  return {
    id: r.id,
    name: r.name,
    kategorie: r.kategorie,
    bewertung: r.bewertung,
    sprachen: r.sprachen || "",
    nationalitaet: r.nationalitaet || "",
    wohnort: r.wohnort || "",
    mobilitaet: r.mobilitaet || "",
    staplerschein: Boolean(r.staplerschein),
    schichtbereit: Boolean(r.schichtbereit),
    wiedereinstellbar: Boolean(r.wiedereinstellbar),
    vorerfahrung: r.vorerfahrung || "",
    einsaetze: Array.isArray(r.einsaetze) ? r.einsaetze : [],
    kontakt: r.kontakt || "",
    verfuegbar: asDate(r.verfuegbar),
    staplerscheinBis: asDate(r.staplerschein_bis),
    einsatzEnde: asDate(r.einsatz_ende),
    notiz: r.notiz || "",
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
  };
}

async function readDocs() {
  try {
    const parsed = JSON.parse(await readFile(DOC_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDocs(list) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DOC_FILE, JSON.stringify(list, null, 2));
}

const docMeta = (d) => ({
  id: d.id,
  employeeId: d.employeeId ?? d.employee_id,
  dateiname: d.dateiname,
  mime: d.mime,
  groesse: Number(d.groesse),
  hochgeladenVon: d.hochgeladenVon ?? d.hochgeladen_von,
  createdAt: d.createdAt ?? (d.created_at instanceof Date ? d.created_at.toISOString() : d.created_at),
});

export async function listDocuments(employeeId) {
  if (usePg) {
    const { rows } = await pool.query(
      "SELECT id, employee_id, dateiname, mime, groesse, hochgeladen_von, created_at FROM employee_documents WHERE employee_id = $1 ORDER BY created_at DESC",
      [employeeId]
    );
    return rows.map(docMeta);
  }
  return (await readDocs())
    .filter((d) => d.employeeId === employeeId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(docMeta);
}

// Dokumente zählen als Bearbeitung, damit die DSGVO-Aufbewahrungsansicht stimmt.
async function touchEmployee(employeeId) {
  const zeitpunkt = new Date().toISOString();
  if (usePg) {
    await pool.query("UPDATE employees SET updated_at = $2 WHERE id = $1", [employeeId, zeitpunkt]);
    return;
  }
  const list = await readAll();
  const eintrag = list.find((e) => e.id === employeeId);
  if (!eintrag) return;
  eintrag.updatedAt = zeitpunkt;
  await writeAll(list);
}

export async function addDocument({ employeeId, dateiname, mime, buffer, akteur }) {
  const id = randomUUID();
  const meta = {
    id,
    employeeId,
    dateiname,
    mime,
    groesse: buffer.length,
    hochgeladenVon: String(akteur || "").trim() || "unbekannt",
    createdAt: new Date().toISOString(),
  };
  if (usePg) {
    await pool.query(
      `INSERT INTO employee_documents (id, employee_id, dateiname, mime, groesse, daten, hochgeladen_von, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, employeeId, dateiname, mime, buffer.length, buffer, meta.hochgeladenVon, meta.createdAt]
    );
  } else {
    await mkdir(DOC_DIR, { recursive: true });
    await writeFile(join(DOC_DIR, id), buffer);
    const list = await readDocs();
    list.push(meta);
    await writeDocs(list);
  }
  await touchEmployee(employeeId);
  const employee = await getEmployee(employeeId);
  await logEvent({
    employeeId,
    employeeName: employee?.name || "",
    aktion: "Dokument hinzugefügt",
    akteur,
    aenderungen: [{ feld: "dokument", vorher: "", nachher: dateiname }],
  });
  return meta;
}

export async function getDocument(id) {
  if (usePg) {
    const { rows } = await pool.query("SELECT * FROM employee_documents WHERE id = $1", [id]);
    return rows[0] ? { ...docMeta(rows[0]), buffer: rows[0].daten } : null;
  }
  const meta = (await readDocs()).find((d) => d.id === id);
  if (!meta) return null;
  return { ...docMeta(meta), buffer: await readFile(join(DOC_DIR, id)) };
}

export async function deleteDocument(id, akteur) {
  const doc = await getDocument(id).catch(() => null);
  if (!doc) return false;
  if (usePg) {
    await pool.query("DELETE FROM employee_documents WHERE id = $1", [id]);
  } else {
    await writeDocs((await readDocs()).filter((d) => d.id !== id));
    await rm(join(DOC_DIR, id), { force: true });
  }
  await touchEmployee(doc.employeeId);
  const employee = await getEmployee(doc.employeeId);
  await logEvent({
    employeeId: doc.employeeId,
    employeeName: employee?.name || "",
    aktion: "Dokument gelöscht",
    akteur,
    aenderungen: [{ feld: "dokument", vorher: doc.dateiname, nachher: "" }],
  });
  return true;
}

// ---------- Benutzerkonten ----------
const hashPasswort = (pw) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
};

const passwortStimmt = (pw, gespeichert) => {
  const [salt, hash] = String(gespeichert || "").split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
};

const benutzerKey = (s) => String(s || "").trim().toLowerCase();

const userPublic = (u) => ({
  id: u.id,
  benutzername: u.benutzername,
  name: u.name,
  rolle: u.rolle,
  createdAt: u.createdAt ?? (u.created_at instanceof Date ? u.created_at.toISOString() : u.created_at),
});

async function readUsers() {
  try {
    const parsed = JSON.parse(await readFile(USER_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeUsers(list) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(USER_FILE, JSON.stringify(list, null, 2));
}

async function allUsers() {
  if (usePg) return (await pool.query("SELECT * FROM app_users ORDER BY name")).rows;
  return (await readUsers()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listUsers() {
  return (await allUsers()).map(userPublic);
}

export async function countUsers() {
  return (await allUsers()).length;
}

export async function createUser({ benutzername, name, rolle, passwort }) {
  const login = benutzerKey(benutzername);
  const erstesKonto = (await allUsers()).length === 0;
  if (!login || !passwort) throw Object.assign(new Error("Benutzername und Passwort sind nötig."), { status: 400 });
  if (String(passwort).length < 8) throw Object.assign(new Error("Passwort braucht mindestens 8 Zeichen."), { status: 400 });
  if ((await allUsers()).some((u) => benutzerKey(u.benutzername) === login)) {
    throw Object.assign(new Error("Benutzername ist schon vergeben."), { status: 409 });
  }
  const user = {
    id: randomUUID(),
    benutzername: login,
    name: String(name || "").trim() || login,
    // Das erste Konto muss Benutzer verwalten dürfen, sonst sperrt sich die App aus.
    rolle: erstesKonto || rolle === "admin" ? "admin" : "user",
    passwort: hashPasswort(String(passwort)),
    createdAt: new Date().toISOString(),
  };
  if (usePg) {
    await pool.query(
      "INSERT INTO app_users (id, benutzername, name, rolle, passwort, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [user.id, user.benutzername, user.name, user.rolle, user.passwort, user.createdAt]
    );
  } else {
    const list = await readUsers();
    list.push(user);
    await writeUsers(list);
  }
  return userPublic(user);
}

export async function setUserPassword(id, passwort) {
  if (String(passwort || "").length < 8) throw Object.assign(new Error("Passwort braucht mindestens 8 Zeichen."), { status: 400 });
  const hash = hashPasswort(String(passwort));
  if (usePg) {
    const { rowCount } = await pool.query("UPDATE app_users SET passwort = $2 WHERE id = $1", [id, hash]);
    return Boolean(rowCount);
  }
  const list = await readUsers();
  const u = list.find((x) => x.id === id);
  if (!u) return false;
  u.passwort = hash;
  await writeUsers(list);
  return true;
}

export async function deleteUser(id) {
  if (usePg) {
    const { rowCount } = await pool.query("DELETE FROM app_users WHERE id = $1", [id]);
    return Boolean(rowCount);
  }
  const list = await readUsers();
  const next = list.filter((u) => u.id !== id);
  if (next.length === list.length) return false;
  await writeUsers(next);
  return true;
}

// Signaturschlüssel für Sitzungscookies; wird einmal erzeugt und bleibt über Neustarts erhalten.
export async function ensureSessionSecret() {
  if (usePg) {
    await pool.query("CREATE TABLE IF NOT EXISTS app_settings (schluessel TEXT PRIMARY KEY, wert TEXT NOT NULL)");
    await pool.query("INSERT INTO app_settings (schluessel, wert) VALUES ('session_secret', $1) ON CONFLICT (schluessel) DO NOTHING", [
      randomBytes(32).toString("hex"),
    ]);
    const { rows } = await pool.query("SELECT wert FROM app_settings WHERE schluessel = 'session_secret'");
    return rows[0].wert;
  }
  try {
    const vorhanden = (await readFile(SECRET_FILE, "utf8")).trim();
    if (vorhanden) return vorhanden;
  } catch {}
  const secret = randomBytes(32).toString("hex");
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SECRET_FILE, secret);
  return secret;
}

export async function getUser(id) {
  const user = (await allUsers()).find((u) => u.id === id);
  return user ? userPublic(user) : null;
}

export async function authenticateUser(benutzername, passwort) {
  const login = benutzerKey(benutzername);
  const user = (await allUsers()).find((u) => benutzerKey(u.benutzername) === login);
  if (!user || !passwortStimmt(String(passwort || ""), user.passwort)) return null;
  return userPublic(user);
}

const leereDaten = (e) => Object.fromEntries(DATE_FIELDS.map((f) => [f, e[f] || ""]));

async function readAll() {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(list) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(list, null, 2));
}

async function readEvents() {
  try {
    const parsed = JSON.parse(await readFile(EVENT_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeEvents(list) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(EVENT_FILE, JSON.stringify(list, null, 2));
}

const einsatzText = (list) =>
  (list || [])
    .map((e) => [e.unternehmen, e.taetigkeit, e.zeitraum, e.ergebnis].filter(Boolean).join(" | "))
    .join(" ; ");

function vergleiche(vorher, nachher) {
  const felder = [...FIELDS, "einsaetze"];
  const changes = [];
  for (const f of felder) {
    const a = f === "einsaetze" ? einsatzText(vorher?.[f]) : String(vorher?.[f] ?? "");
    const b = f === "einsaetze" ? einsatzText(nachher?.[f]) : String(nachher?.[f] ?? "");
    if (a !== b) changes.push({ feld: f, vorher: a, nachher: b });
  }
  return changes;
}

async function logEvent({ employeeId, employeeName, aktion, akteur, aenderungen = [] }) {
  const eintrag = {
    id: randomUUID(),
    employeeId,
    employeeName,
    aktion,
    akteur: String(akteur || "").trim() || "unbekannt",
    aenderungen,
    createdAt: new Date().toISOString(),
  };
  if (usePg) {
    await pool.query(
      `INSERT INTO employee_events (id, employee_id, employee_name, aktion, akteur, aenderungen, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [eintrag.id, employeeId, employeeName, aktion, eintrag.akteur, JSON.stringify(aenderungen), eintrag.createdAt]
    );
    return eintrag;
  }
  const list = await readEvents();
  list.push(eintrag);
  await writeEvents(list);
  return eintrag;
}

export async function deleteEvents(employeeId) {
  if (usePg) {
    await pool.query("DELETE FROM employee_events WHERE employee_id = $1", [employeeId]);
    return;
  }
  await writeEvents((await readEvents()).filter((e) => e.employeeId !== employeeId));
}

// limit = null liefert alle Ereignisse (für die DSGVO-Auskunft).
export async function listEvents({ employeeId = null, limit = 200 } = {}) {
  if (usePg) {
    const grenze = limit === null ? "ALL" : String(Number.isFinite(Number(limit)) ? Number(limit) : 200);
    const { rows } = employeeId
      ? await pool.query(
          `SELECT * FROM employee_events WHERE employee_id = $1 ORDER BY created_at DESC LIMIT ${grenze}`,
          [employeeId]
        )
      : await pool.query(`SELECT * FROM employee_events ORDER BY created_at DESC LIMIT ${grenze}`);
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      aktion: r.aktion,
      akteur: r.akteur,
      aenderungen: Array.isArray(r.aenderungen) ? r.aenderungen : [],
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    }));
  }
  const list = (await readEvents())
    .filter((e) => !employeeId || e.employeeId === employeeId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return limit === null ? list : list.slice(0, limit);
}

export async function initStore() {
  if (!usePg) {
    await mkdir(DATA_DIR, { recursive: true });
    return;
  }
  const { default: pg } = await import("pg");
  const ssl = process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false };
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kategorie TEXT NOT NULL,
      bewertung SMALLINT,
      sprachen TEXT,
      nationalitaet TEXT,
      wohnort TEXT,
      mobilitaet TEXT,
      staplerschein BOOLEAN NOT NULL DEFAULT false,
      schichtbereit BOOLEAN NOT NULL DEFAULT false,
      wiedereinstellbar BOOLEAN NOT NULL DEFAULT false,
      vorerfahrung TEXT,
      einsaetze JSONB NOT NULL DEFAULT '[]'::jsonb,
      kontakt TEXT,
      verfuegbar DATE,
      notiz TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_events (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      employee_name TEXT NOT NULL,
      aktion TEXT NOT NULL,
      akteur TEXT NOT NULL,
      aenderungen JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS staplerschein_bis DATE");
  await pool.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS einsatz_ende DATE");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_documents (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      dateiname TEXT NOT NULL,
      mime TEXT NOT NULL,
      groesse INTEGER NOT NULL,
      daten BYTEA NOT NULL,
      hochgeladen_von TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      benutzername TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      rolle TEXT NOT NULL DEFAULT 'user',
      passwort TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS employee_documents_employee_idx ON employee_documents (employee_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS employee_events_employee_idx ON employee_events (employee_id, created_at DESC)");
}

const schluessel = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export async function findDuplicates(name, kontakt, exceptId = null) {
  const nameKey = schluessel(name);
  const nameSorted = nameKey.split(" ").sort().join(" ");
  const kontaktKey = schluessel(kontakt).replace(/\s+/g, "");
  if (!nameKey) return [];
  const alle = await listEmployees();
  return alle.filter((m) => {
    if (m.id === exceptId) return false;
    const k = schluessel(m.name);
    if (k === nameKey || k.split(" ").sort().join(" ") === nameSorted) return true;
    const mk = schluessel(m.kontakt).replace(/\s+/g, "");
    return Boolean(kontaktKey) && kontaktKey.length >= 5 && mk === kontaktKey;
  });
}

export async function getEmployee(id) {
  if (usePg) {
    const { rows } = await pool.query("SELECT * FROM employees WHERE id = $1", [id]);
    return rows[0] ? mapRow(rows[0]) : null;
  }
  return (await readAll()).find((m) => m.id === id) || null;
}

export async function listEmployees() {
  if (usePg) {
    const { rows } = await pool.query("SELECT * FROM employees ORDER BY name ASC");
    return rows.map(mapRow);
  }
  return (await readAll()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function createEmployee(input, akteur) {
  const e = normalize(input);
  const id = randomUUID();
  const angelegt = async (record) => {
    await logEvent({ employeeId: id, employeeName: record.name, aktion: "angelegt", akteur });
    return record;
  };
  if (usePg) {
    const { rows } = await pool.query(
      `INSERT INTO employees (id, name, kategorie, bewertung, sprachen, nationalitaet, wohnort,
         mobilitaet, staplerschein, schichtbereit, wiedereinstellbar, vorerfahrung, einsaetze,
         kontakt, verfuegbar, staplerschein_bis, einsatz_ende, notiz)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [id, e.name, e.kategorie, e.bewertung, e.sprachen, e.nationalitaet, e.wohnort, e.mobilitaet,
       e.staplerschein, e.schichtbereit, e.wiedereinstellbar, e.vorerfahrung,
       JSON.stringify(e.einsaetze), e.kontakt, e.verfuegbar, e.staplerscheinBis, e.einsatzEnde, e.notiz]
    );
    return angelegt(mapRow(rows[0]));
  }
  const now = new Date().toISOString();
  const record = { id, ...e, ...leereDaten(e), createdAt: now, updatedAt: now };
  const list = await readAll();
  list.push(record);
  await writeAll(list);
  return angelegt(record);
}

export async function updateEmployee(id, input, akteur) {
  const e = normalize(input);
  const vorher = await getEmployee(id);
  const geaendert = async (record) => {
    const aenderungen = vergleiche(vorher, record);
    if (aenderungen.length) {
      await logEvent({ employeeId: id, employeeName: record.name, aktion: "geändert", akteur, aenderungen });
    }
    return record;
  };
  if (usePg) {
    const { rows } = await pool.query(
      `UPDATE employees SET name=$2, kategorie=$3, bewertung=$4, sprachen=$5, nationalitaet=$6,
         wohnort=$7, mobilitaet=$8, staplerschein=$9, schichtbereit=$10, wiedereinstellbar=$11,
         vorerfahrung=$12, einsaetze=$13, kontakt=$14, verfuegbar=$15, staplerschein_bis=$16,
         einsatz_ende=$17, notiz=$18, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [id, e.name, e.kategorie, e.bewertung, e.sprachen, e.nationalitaet, e.wohnort, e.mobilitaet,
       e.staplerschein, e.schichtbereit, e.wiedereinstellbar, e.vorerfahrung,
       JSON.stringify(e.einsaetze), e.kontakt, e.verfuegbar, e.staplerscheinBis, e.einsatzEnde, e.notiz]
    );
    return rows[0] ? geaendert(mapRow(rows[0])) : null;
  }
  const list = await readAll();
  const idx = list.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...e, ...leereDaten(e), updatedAt: new Date().toISOString() };
  await writeAll(list);
  return geaendert(list[idx]);
}

export async function deleteEmployee(id, akteur) {
  const vorher = await getEmployee(id);
  if (usePg) {
    const { rowCount } = await pool.query("DELETE FROM employees WHERE id = $1", [id]);
    if (!rowCount) return false;
    await deleteEvents(id);
    await logEvent({ employeeId: null, employeeName: "(gelöschter Datensatz)", aktion: "gelöscht", akteur });
    return true;
  }
  const list = await readAll();
  const next = list.filter((m) => m.id !== id);
  if (next.length === list.length) return false;
  await writeAll(next);
  const docs = await readDocs();
  for (const d of docs.filter((d) => d.employeeId === id)) await rm(join(DOC_DIR, d.id), { force: true });
  await writeDocs(docs.filter((d) => d.employeeId !== id));
  await deleteEvents(id);
  await logEvent({ employeeId: null, employeeName: "(gelöschter Datensatz)", aktion: "gelöscht", akteur });
  return true;
}
