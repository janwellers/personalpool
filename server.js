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

app.use(express.json({ limit: "1mb" }));
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
