// Persistenzschicht für Mitarbeiter.
// Nutzt Postgres, wenn DATABASE_URL gesetzt ist – sonst eine lokale JSON-Datei (Dev).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const FILE = join(DATA_DIR, "employees.json");

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
}

export async function listEmployees() {
  if (usePg) {
    const { rows } = await pool.query("SELECT * FROM employees ORDER BY name ASC");
    return rows.map(mapRow);
  }
  return (await readAll()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function createEmployee(input) {
  const e = normalize(input);
  const id = randomUUID();
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
    return mapRow(rows[0]);
  }
  const now = new Date().toISOString();
  const record = { id, ...e, verfuegbar: e.verfuegbar || "", createdAt: now, updatedAt: now };
  const list = await readAll();
  list.push(record);
  await writeAll(list);
  return record;
}

export async function updateEmployee(id, input) {
  const e = normalize(input);
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
    return rows[0] ? mapRow(rows[0]) : null;
  }
  const list = await readAll();
  const idx = list.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...e, verfuegbar: e.verfuegbar || "", updatedAt: new Date().toISOString() };
  await writeAll(list);
  return list[idx];
}

export async function deleteEmployee(id) {
  if (usePg) {
    const { rowCount } = await pool.query("DELETE FROM employees WHERE id = $1", [id]);
    return rowCount > 0;
  }
  const list = await readAll();
  const next = list.filter((m) => m.id !== id);
  if (next.length === list.length) return false;
  await writeAll(next);
  return true;
}
