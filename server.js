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
  listUsers,
  countUsers,
  createUser,
  setUserPassword,
  deleteUser,
  getUser,
  ensureSessionSecret,
  authenticateUser,
  storageBackend,
  KATEGORIEN,
} from "./store.js";
import {
  checkPassword,
  setAuthCookie,
  clearAuthCookie,
  currentUser,
  requireAdmin,
  setSessionSecret,
  loginEnabled,
  usesDevDefault,
  TEAM_USER,
} from "./auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const MAX_DOC_BYTES = 8 * 1024 * 1024;
const MAX_LOGIN_VERSUCHE = 10;
const LOGIN_FENSTER_MS = 5 * 60 * 1000;

// Einfache Bremse gegen Passwortraten: je Absender wenige Fehlversuche pro Zeitfenster.
const versuche = new Map();

function loginGesperrt(ip) {
  const eintrag = versuche.get(ip);
  if (!eintrag || Date.now() - eintrag.seit > LOGIN_FENSTER_MS) {
    versuche.delete(ip);
    return false;
  }
  return eintrag.anzahl >= MAX_LOGIN_VERSUCHE;
}

function loginFehlversuch(ip) {
  const eintrag = versuche.get(ip);
  if (!eintrag || Date.now() - eintrag.seit > LOGIN_FENSTER_MS) versuche.set(ip, { anzahl: 1, seit: Date.now() });
  else eintrag.anzahl += 1;
}

// Rolle und Existenz kommen aus dem Speicher, damit gelöschte Konten sofort gesperrt sind.
async function aktuellerBenutzer(req) {
  const aus_cookie = currentUser(req);
  if (!aus_cookie) return null;
  if (aus_cookie.team) return (await countUsers()) > 0 ? null : aus_cookie;
  const user = await getUser(aus_cookie.id);
  return user ? { ...user, team: false } : null;
}

async function requireUser(req, res, next) {
  try {
    const user = await aktuellerBenutzer(req);
    if (!user) return res.status(401).json({ ok: false, error: "Nicht angemeldet." });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

app.use(express.json({ limit: "12mb" }));
app.use(express.static(join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, storage: storageBackend, loginEnabled });
});

app.get("/api/session", async (req, res, next) => {
  try {
    const user = await aktuellerBenutzer(req);
    res.json({
      ok: true,
      authed: Boolean(user),
      user,
      benutzerkonten: (await countUsers()) > 0,
      loginEnabled,
      usesDevDefault,
    });
  } catch (err) {
    next(err);
  }
});

// Persönlicher Login; das gemeinsame Passwort greift nur, solange es keine Benutzerkonten gibt.
app.post("/api/login", async (req, res, next) => {
  try {
    const benutzer = String(req.body?.benutzer || "").trim();
    const passwort = String(req.body?.password || "");
    const ip = req.ip || req.socket.remoteAddress || "unbekannt";
    if (loginGesperrt(ip)) {
      return res.status(429).json({ ok: false, error: "Zu viele Versuche. Bitte in ein paar Minuten erneut probieren." });
    }
    if (benutzer) {
      const user = await authenticateUser(benutzer, passwort);
      if (!user) {
        loginFehlversuch(ip);
        return res.status(401).json({ ok: false, error: "Benutzername oder Passwort stimmt nicht." });
      }
      versuche.delete(ip);
      setAuthCookie(res, user);
      return res.json({ ok: true, user });
    }
    if ((await countUsers()) > 0) {
      return res.status(401).json({ ok: false, error: "Bitte mit deinem persönlichen Benutzernamen anmelden." });
    }
    if (!loginEnabled) return res.status(503).json({ ok: false, error: "Kein Passwort konfiguriert (APP_PASSWORD)." });
    if (!checkPassword(passwort)) {
      loginFehlversuch(ip);
      return res.status(401).json({ ok: false, error: "Falsches Passwort." });
    }
    versuche.delete(ip);
    setAuthCookie(res, TEAM_USER);
    res.json({ ok: true, user: TEAM_USER });
  } catch (err) {
    next(err);
  }
});

app.get("/api/users", requireUser, requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, users: await listUsers() });
  } catch (err) {
    next(err);
  }
});

app.post("/api/users", requireUser, requireAdmin, async (req, res, next) => {
  try {
    res.status(201).json({ ok: true, user: await createUser(req.body || {}) });
  } catch (err) {
    next(err);
  }
});

app.put("/api/users/:id/passwort", requireUser, async (req, res, next) => {
  try {
    if (req.user.rolle !== "admin" && req.user.id !== req.params.id) {
      return res.status(403).json({ ok: false, error: "Nur das eigene Passwort ist änderbar." });
    }
    const ok = await setUserPassword(req.params.id, req.body?.passwort);
    if (!ok) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/users/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ ok: false, error: "Das eigene Konto kann nicht gelöscht werden." });
    }
    // Ohne verbleibendes Konto würde der gemeinsame Zugang wieder gelten.
    if ((await countUsers()) <= 1) {
      return res.status(409).json({ ok: false, error: "Das letzte Konto kann nicht gelöscht werden." });
    }
    const ok = await deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post("/api/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Beim persönlichen Login kommt der Name aus der Sitzung, beim Team-Zugang aus dem Kopffeld.
const akteurOf = (req) =>
  req.user && !req.user.team
    ? req.user.name
    : String(req.get("X-Bearbeiter") || "").trim().slice(0, 60) || "Team-Zugang";

app.get("/api/kategorien", (req, res) => res.json({ ok: true, kategorien: KATEGORIEN }));

app.get("/api/employees", requireUser, async (req, res, next) => {
  try {
    res.json({ ok: true, employees: await listEmployees() });
  } catch (err) {
    next(err);
  }
});

app.post("/api/employees", requireUser, async (req, res, next) => {
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

app.put("/api/employees/:id", requireUser, async (req, res, next) => {
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

// Endgültiges Löschen ist eine DSGVO-Aktion und bleibt Administratoren vorbehalten.
app.delete("/api/employees/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const removed = await deleteEmployee(req.params.id, akteurOf(req));
    if (!removed) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get("/api/employees/:id/documents", requireUser, async (req, res, next) => {
  try {
    res.json({ ok: true, documents: await listDocuments(req.params.id) });
  } catch (err) {
    next(err);
  }
});

app.post("/api/employees/:id/documents", requireUser, async (req, res, next) => {
  try {
    if (!(await getEmployee(req.params.id))) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
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

app.get("/api/documents/:id", requireUser, async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    // Immer als Download ausliefern, damit hochgeladene Dateien nicht in der App-Domain gerendert werden.
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(doc.dateiname)}`);
    res.send(doc.buffer);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/documents/:id", requireUser, async (req, res, next) => {
  try {
    const removed = await deleteDocument(req.params.id, akteurOf(req));
    if (!removed) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DSGVO-Auskunft: alle gespeicherten Daten einer Person als Datei.
app.get("/api/employees/:id/auskunft", requireUser, async (req, res, next) => {
  try {
    const employee = await getEmployee(req.params.id);
    if (!employee) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    const auskunft = {
      erstelltAm: new Date().toISOString(),
      hinweis:
        "Auskunft nach Art. 15 DSGVO: alle zu dieser Person gespeicherten Daten, inkl. Änderungsverlauf und Dokumentenliste.",
      stammdaten: employee,
      aenderungsverlauf: await listEvents({ employeeId: employee.id, limit: null }),
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

app.get("/api/events", requireUser, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const events = await listEvents({ employeeId: req.query.employeeId || null, limit });
    res.json({ ok: true, events });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  if (err?.status) return res.status(err.status).json({ ok: false, error: err.message });
  console.error(err);
  res.status(500).json({ ok: false, error: "Serverfehler." });
});

initStore()
  .then(async () => {
    setSessionSecret(await ensureSessionSecret());
  })
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
