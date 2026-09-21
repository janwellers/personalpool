import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initStore,
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listEvents,
  findDuplicates,
  getEmployee,
  listDocuments,
  addDocument,
  getDocument,
  deleteDocument,
  storageBackend,
  KATEGORIEN,
} from "./store.js";
import {
  checkPassword,
  setAuthCookie,
  clearAuthCookie,
  isAuthed,
  requireAuth,
  loginEnabled,
  usesDevDefault,
} from "./auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const MAX_DOC_BYTES = 8 * 1024 * 1024;

app.use(express.json({ limit: "12mb" }));
app.use(express.static(join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, storage: storageBackend, loginEnabled });
});

app.get("/api/session", (req, res) => {
  res.json({ ok: true, authed: isAuthed(req), loginEnabled, usesDevDefault });
});

app.post("/api/login", (req, res) => {
  if (!loginEnabled) return res.status(503).json({ ok: false, error: "Kein Passwort konfiguriert (APP_PASSWORD)." });
  if (!checkPassword(req.body?.password || "")) {
    return res.status(401).json({ ok: false, error: "Falsches Passwort." });
  }
  setAuthCookie(res);
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

const akteurOf = (req) => String(req.get("X-Bearbeiter") || "").trim().slice(0, 60);

app.get("/api/kategorien", (req, res) => res.json({ ok: true, kategorien: KATEGORIEN }));

app.get("/api/employees", requireAuth, async (req, res, next) => {
  try {
    res.json({ ok: true, employees: await listEmployees() });
  } catch (err) {
    next(err);
  }
});

app.post("/api/employees", requireAuth, async (req, res, next) => {
  try {
    if (!String(req.body?.name || "").trim()) {
      return res.status(400).json({ ok: false, error: "Name fehlt." });
    }
    if (!req.body?.force) {
      const duplikate = await findDuplicates(req.body.name, req.body.kontakt);
      if (duplikate.length) {
        return res.status(409).json({
          ok: false,
          error: "Möglicherweise schon vorhanden.",
          duplikate: duplikate.map((m) => ({ id: m.id, name: m.name, kategorie: m.kategorie, wohnort: m.wohnort, kontakt: m.kontakt })),
        });
      }
    }
    res.status(201).json({ ok: true, employee: await createEmployee(req.body, akteurOf(req)) });
  } catch (err) {
    next(err);
  }
});

app.put("/api/employees/:id", requireAuth, async (req, res, next) => {
  try {
    if (!String(req.body?.name || "").trim()) {
      return res.status(400).json({ ok: false, error: "Name fehlt." });
    }
    const employee = await updateEmployee(req.params.id, req.body, akteurOf(req));
    if (!employee) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.json({ ok: true, employee });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/employees/:id", requireAuth, async (req, res, next) => {
  try {
    const removed = await deleteEmployee(req.params.id, akteurOf(req));
    if (!removed) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get("/api/employees/:id/documents", requireAuth, async (req, res, next) => {
  try {
    res.json({ ok: true, documents: await listDocuments(req.params.id) });
  } catch (err) {
    next(err);
  }
});

app.post("/api/employees/:id/documents", requireAuth, async (req, res, next) => {
  try {
    const dateiname = String(req.body?.dateiname || "").trim().slice(0, 200);
    const base64 = String(req.body?.inhalt || "");
    if (!dateiname || !base64) return res.status(400).json({ ok: false, error: "Datei fehlt." });
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) return res.status(400).json({ ok: false, error: "Datei ist leer." });
    if (buffer.length > MAX_DOC_BYTES) return res.status(413).json({ ok: false, error: "Datei ist zu groß (max. 8 MB)." });
    const document = await addDocument({
      employeeId: req.params.id,
      dateiname,
      mime: String(req.body?.mime || "application/octet-stream").slice(0, 100),
      buffer,
      akteur: akteurOf(req),
    });
    res.status(201).json({ ok: true, document });
  } catch (err) {
    next(err);
  }
});

app.get("/api/documents/:id", requireAuth, async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.setHeader("Content-Type", doc.mime);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(doc.dateiname)}`);
    res.send(doc.buffer);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/documents/:id", requireAuth, async (req, res, next) => {
  try {
    const removed = await deleteDocument(req.params.id, akteurOf(req));
    if (!removed) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DSGVO-Auskunft: alle gespeicherten Daten einer Person als Datei.
app.get("/api/employees/:id/auskunft", requireAuth, async (req, res, next) => {
  try {
    const employee = await getEmployee(req.params.id);
    if (!employee) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    const auskunft = {
      erstelltAm: new Date().toISOString(),
      hinweis:
        "Auskunft nach Art. 15 DSGVO: alle zu dieser Person gespeicherten Daten, inkl. Änderungsverlauf und Dokumentenliste.",
      stammdaten: employee,
      aenderungsverlauf: await listEvents({ employeeId: employee.id, limit: 500 }),
      dokumente: await listDocuments(employee.id),
    };
    const datei = `auskunft-${employee.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "mitarbeiter"}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(datei)}`);
    res.send(JSON.stringify(auskunft, null, 2));
  } catch (err) {
    next(err);
  }
});

app.get("/api/events", requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const events = await listEvents({ employeeId: req.query.employeeId || null, limit });
    res.json({ ok: true, events });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Serverfehler." });
});

initStore()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Personalpool läuft auf http://localhost:${PORT} (Speicher: ${storageBackend})`);
      if (usesDevDefault) console.log('Dev-Login aktiv – Passwort: "demo"');
    });
  })
  .catch((err) => {
    console.error("Start fehlgeschlagen:", err);
    process.exit(1);
  });
