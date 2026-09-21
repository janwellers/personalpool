// Persistenzschicht für Mitarbeiter.
// Nutzt Postgres, wenn DATABASE_URL gesetzt ist – sonst eine lokale JSON-Datei (Dev).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const FILE = join(DATA_DIR, "employees.json");
const EVENT_FILE = join(DATA_DIR, "events.json");

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
  "notiz",
];

function normalize(input) {
  const out = {};
  for (const f of FIELDS) out[f] = input[f] ?? "";
  out.name = String(out.name).trim();
  out.kategorie = KATEGORIEN.some((k) => k.id === out.kategorie) ? out.kategorie : "nochmal";
  out.bewertung = /^[1-5]$/.test(String(out.bewertung)) ? Number(out.bewertung) : null;
  out.verfuegbar = out.verfuegbar || null;
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
    verfuegbar: r.verfuegbar instanceof Date ? r.verfuegbar.toISOString().slice(0, 10) : r.verfuegbar || "",
    notiz: r.notiz || "",
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
  };
}

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

export async function listEvents({ employeeId = null, limit = 200 } = {}) {
  if (usePg) {
    const { rows } = employeeId
      ? await pool.query(
          "SELECT * FROM employee_events WHERE employee_id = $1 ORDER BY created_at DESC LIMIT $2",
          [employeeId, limit]
        )
      : await pool.query("SELECT * FROM employee_events ORDER BY created_at DESC LIMIT $1", [limit]);
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
  const list = (await readEvents()).filter((e) => !employeeId || e.employeeId === employeeId);
  return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
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
         kontakt, verfuegbar, notiz)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [id, e.name, e.kategorie, e.bewertung, e.sprachen, e.nationalitaet, e.wohnort, e.mobilitaet,
       e.staplerschein, e.schichtbereit, e.wiedereinstellbar, e.vorerfahrung,
       JSON.stringify(e.einsaetze), e.kontakt, e.verfuegbar, e.notiz]
    );
    return angelegt(mapRow(rows[0]));
  }
  const now = new Date().toISOString();
  const record = { id, ...e, verfuegbar: e.verfuegbar || "", createdAt: now, updatedAt: now };
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
         vorerfahrung=$12, einsaetze=$13, kontakt=$14, verfuegbar=$15, notiz=$16, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [id, e.name, e.kategorie, e.bewertung, e.sprachen, e.nationalitaet, e.wohnort, e.mobilitaet,
       e.staplerschein, e.schichtbereit, e.wiedereinstellbar, e.vorerfahrung,
       JSON.stringify(e.einsaetze), e.kontakt, e.verfuegbar, e.notiz]
    );
    return rows[0] ? geaendert(mapRow(rows[0])) : null;
  }
  const list = await readAll();
  const idx = list.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...e, verfuegbar: e.verfuegbar || "", updatedAt: new Date().toISOString() };
  await writeAll(list);
  return geaendert(list[idx]);
}

export async function deleteEmployee(id, akteur) {
  const vorher = await getEmployee(id);
  if (usePg) {
    const { rowCount } = await pool.query("DELETE FROM employees WHERE id = $1", [id]);
    if (!rowCount) return false;
    await logEvent({ employeeId: id, employeeName: vorher?.name || "(gelöscht)", aktion: "gelöscht", akteur });
    return true;
  }
  const list = await readAll();
  const next = list.filter((m) => m.id !== id);
  if (next.length === list.length) return false;
  await writeAll(next);
  await logEvent({ employeeId: id, employeeName: vorher?.name || "(gelöscht)", aktion: "gelöscht", akteur });
  return true;
}
