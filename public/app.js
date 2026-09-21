const FARBEN = {
  gut: "var(--gut)",
  schlecht: "var(--schlecht)",
  nochmal: "var(--nochmal)",
  finger: "var(--finger)",
  student: "var(--student)",
};
const MOBILITAET = ["eigener PKW", "Führerschein, kein PKW", "ÖPNV", "Fahrrad / fußläufig", "keine Mobilität"];

const FELD_LABEL = {
  name: "Name",
  kategorie: "Kategorie",
  bewertung: "Bewertung",
  sprachen: "Sprache(n)",
  nationalitaet: "Nationalität",
  wohnort: "Wohnort",
  mobilitaet: "Mobilität",
  staplerschein: "Staplerschein",
  schichtbereit: "Schichtbereit",
  wiedereinstellbar: "Wiedereinstellbar",
  vorerfahrung: "Vorerfahrung",
  kontakt: "Kontakt",
  verfuegbar: "Verfügbar ab",
  staplerscheinBis: "Staplerschein gültig bis",
  einsatzEnde: "Einsatzende",
  notiz: "Notiz",
  einsaetze: "Einsätze",
};

let kategorien = [];
let daten = [];
let filterKat = "alle";
let editId = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const katOf = (id) => kategorien.find((k) => k.id === id) || kategorien[0] || { id, label: id };

const getBearbeiter = () => localStorage.getItem("personalpool.bearbeiter") || "";
const setBearbeiter = (name) => localStorage.setItem("personalpool.bearbeiter", String(name || "").trim().slice(0, 60));

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", "X-Bearbeiter": getBearbeiter() },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Fehler ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---------- Login ----------
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginError").textContent = "";
  try {
    setBearbeiter(e.target.bearbeiter.value);
    await api("/api/login", { method: "POST", body: { password: e.target.password.value } });
    await start();
  } catch (err) {
    $("loginError").textContent = err.message;
  }
});

$("btnLogout").onclick = async () => {
  await api("/api/logout", { method: "POST" });
  location.reload();
};

// ---------- Auswahlfelder ----------
function fillSelects() {
  $("selKat").innerHTML = kategorien.map((k) => `<option value="${k.id}">${esc(k.label)}</option>`).join("");
  $("selMobil").innerHTML = `<option value="">–</option>` + MOBILITAET.map((m) => `<option>${m}</option>`).join("");
  $("fMobil").innerHTML = `<option value="">Mobilität: egal</option>` + MOBILITAET.map((m) => `<option>${m}</option>`).join("");
}

// ---------- Einsatz-Zeilen im Formular ----------
function addEinsatzRow(e = {}) {
  const div = document.createElement("div");
  div.className = "einsatz";
  div.innerHTML = `
    <input placeholder="Unternehmen" data-f="unternehmen" />
    <input placeholder="Tätigkeit" data-f="taetigkeit" />
    <input placeholder="Zeitraum" data-f="zeitraum" />
    <input placeholder="Ergebnis" data-f="ergebnis" />
    <button type="button" title="Zeile entfernen">✕</button>`;
  div.querySelectorAll("input").forEach((i) => (i.value = e[i.dataset.f] || ""));
  div.querySelector("button").onclick = () => div.remove();
  $("einsaetze").appendChild(div);
}
$("btnAddEinsatz").onclick = () => addEinsatzRow();

function readEinsaetze() {
  return [...$("einsaetze").querySelectorAll(".einsatz")]
    .map((row) => Object.fromEntries([...row.querySelectorAll("input")].map((i) => [i.dataset.f, i.value.trim()])))
    .filter((e) => e.unternehmen || e.taetigkeit || e.zeitraum || e.ergebnis);
}

// ---------- Darstellung ----------
function renderCats() {
  const items = [{ id: "alle", label: "Alle" }, ...kategorien];
  $("cats").innerHTML = items
    .map((k) => {
      const n = k.id === "alle" ? daten.length : daten.filter((m) => m.kategorie === k.id).length;
      const color = k.id === "alle" ? "var(--accent)" : FARBEN[k.id] || "var(--accent)";
      return `<div class="chip ${filterKat === k.id ? "active" : ""}" data-kat="${k.id}">
        <span class="dot" style="background:${color}"></span>${esc(k.label)} <b>${n}</b></div>`;
    })
    .join("");
  $("cats").querySelectorAll(".chip").forEach((c) => (c.onclick = () => { filterKat = c.dataset.kat; render(); }));
}

function renderStats() {
  $("stats").innerHTML = `
    <div class="stat">Gesamt: <b>${daten.length}</b></div>
    <div class="stat">Mit Staplerschein: <b>${daten.filter((m) => m.staplerschein).length}</b></div>
    <div class="stat">Wiedereinstellbar: <b>${daten.filter((m) => m.wiedereinstellbar).length}</b></div>
    <div class="stat">Offene Fristen: <b>${fristen().length}</b></div>`;
}

function passt(m) {
  if (filterKat !== "alle" && m.kategorie !== filterKat) return false;
  const s = $("fStapler").value;
  if (s === "ja" && !m.staplerschein) return false;
  if (s === "nein" && m.staplerschein) return false;
  const mo = $("fMobil").value;
  if (mo && m.mobilitaet !== mo) return false;
  const q = $("q").value.trim().toLowerCase();
  return !q || JSON.stringify(m).toLowerCase().includes(q);
}

function zeile(label, wert) {
  return wert ? `<div class="row"><span>${label}</span><span>${esc(wert)}</span></div>` : "";
}

function render() {
  renderCats();
  renderStats();
  const sort = $("fSort").value;
  const liste = daten.filter(passt).sort((a, b) => {
    if (sort === "bewertung") return (Number(b.bewertung) || 0) - (Number(a.bewertung) || 0);
    if (sort === "kategorie") return kategorien.findIndex((k) => k.id === a.kategorie) - kategorien.findIndex((k) => k.id === b.kategorie);
    return (a.name || "").localeCompare(b.name || "");
  });

  $("empty").hidden = liste.length > 0;
  $("empty").textContent = daten.length === 0
    ? "Noch keine Mitarbeiter erfasst. Lege oben rechts den ersten an."
    : "Keine Treffer für diesen Filter.";

  $("grid").innerHTML = liste
    .map((m) => {
      const k = katOf(m.kategorie);
      const color = FARBEN[k.id] || "var(--accent)";
      const tags = [
        m.staplerschein && "Staplerschein",
        m.schichtbereit && "Schichtbereit",
        m.wiedereinstellbar && "Wiedereinstellbar",
      ].filter(Boolean);
      const warnungen = [
        m.staplerscheinBis && tageBis(m.staplerscheinBis) <= WARNTAGE
          ? `Staplerschein ${fristText(tageBis(m.staplerscheinBis))}`
          : "",
        m.einsatzEnde && tageBis(m.einsatzEnde) <= WARNTAGE ? `Einsatzende ${fristText(tageBis(m.einsatzEnde))}` : "",
      ].filter(Boolean);
      const einsaetze = (m.einsaetze || []).map(
        (e) => `<li>${esc([e.unternehmen, e.taetigkeit, e.zeitraum, e.ergebnis].filter(Boolean).join(" | "))}</li>`
      );
      return `<div class="card" style="border-left-color:${color}">
        <h3>${esc(m.name)}</h3>
        <span class="badge" style="background:${color}">${esc(k.label)}${m.bewertung ? " · " + "★".repeat(Number(m.bewertung)) : ""}</span>
        <div style="margin-top:10px">
          ${zeile("Sprache", m.sprachen)}
          ${zeile("Nationalität", m.nationalitaet)}
          ${zeile("Wohnort", m.wohnort)}
          ${zeile("Mobilität", m.mobilitaet)}
          ${zeile("Verfügbar ab", m.verfuegbar ? dtFormat(m.verfuegbar) : "")}
          ${zeile("Kontakt", m.kontakt)}
        </div>
        ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>` : ""}
        ${warnungen.length ? `<div class="tags">${warnungen.map((t) => `<span class="tag warn">⚠ ${esc(t)}</span>`).join("")}</div>` : ""}
        ${m.vorerfahrung ? `<div style="margin-top:8px;font-size:13px"><b>Kann:</b> ${esc(m.vorerfahrung)}</div>` : ""}
        ${einsaetze.length ? `<div style="margin-top:8px;font-size:13px"><b>Einsätze:</b><ul style="margin:6px 0 0 18px;padding:0">${einsaetze.join("")}</ul></div>` : ""}
        ${m.notiz ? `<div style="margin-top:8px;font-size:12px;color:var(--muted)">Notiz: ${esc(m.notiz)}</div>` : ""}
        <div class="actions"><button data-edit="${m.id}">Bearbeiten</button><button data-log="${m.id}">Verlauf</button></div>
      </div>`;
    })
    .join("");

  $("grid").querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openDialog(b.dataset.edit)));
  $("grid").querySelectorAll("[data-log]").forEach((b) => (b.onclick = () => openLog(b.dataset.log)));
}

// ---------- Fristen ----------
const WARNTAGE = 30;
const heute = () => new Date(new Date().toDateString());
const tageBis = (datum) => Math.round((new Date(datum) - heute()) / 86400000);
const dtFormat = (datum) => new Date(datum).toLocaleDateString("de-DE");

function fristen() {
  const items = [];
  for (const m of daten) {
    if (m.staplerscheinBis) items.push({ m, art: "Staplerschein läuft ab", datum: m.staplerscheinBis, tage: tageBis(m.staplerscheinBis) });
    if (m.einsatzEnde) items.push({ m, art: "Einsatz endet", datum: m.einsatzEnde, tage: tageBis(m.einsatzEnde) });
  }
  return items.filter((i) => i.tage <= WARNTAGE).sort((a, b) => a.tage - b.tage);
}

const fristText = (tage) =>
  tage < 0 ? `seit ${Math.abs(tage)} Tag(en) überfällig` : tage === 0 ? "heute" : `in ${tage} Tag(en)`;

function renderFristen() {
  const liste = fristen();
  $("fristenBody").innerHTML = liste.length
    ? liste
        .map(
          (i) => `<div class="logitem">
            <div><b>${esc(i.m.name)}</b> – ${esc(i.art)} <span class="tag ${i.tage < 0 ? "warn" : ""}">${esc(fristText(i.tage))}</span></div>
            <div class="logmeta">${esc(dtFormat(i.datum))}${i.m.kontakt ? ` · ${esc(i.m.kontakt)}` : ""}</div>
          </div>`
        )
        .join("")
    : `<div class='empty'>Keine Fristen in den nächsten ${WARNTAGE} Tagen.</div>`;
}

$("btnFristen").onclick = () => {
  renderFristen();
  $("dlgFristen").showModal();
};
$("btnFristenClose").onclick = () => $("dlgFristen").close();

// ---------- Kundenansicht ----------
function kundenListe() {
  const map = new Map();
  for (const m of daten) {
    for (const e of m.einsaetze || []) {
      const firma = (e.unternehmen || "").trim();
      if (!firma) continue;
      const key = firma.toLowerCase();
      if (!map.has(key)) map.set(key, { firma, eintraege: [] });
      map.get(key).eintraege.push({ mitarbeiter: m, einsatz: e });
    }
  }
  return [...map.values()].sort((a, b) => b.eintraege.length - a.eintraege.length || a.firma.localeCompare(b.firma));
}

function renderKunden() {
  const q = $("kundenSuche").value.trim().toLowerCase();
  const liste = kundenListe().filter((k) => !q || k.firma.toLowerCase().includes(q));
  $("kundenBody").innerHTML = liste.length
    ? liste
        .map((k) => {
          const zeilen = k.eintraege
            .map(({ mitarbeiter: m, einsatz: e }) => {
              const kat = katOf(m.kategorie);
              const color = FARBEN[kat.id] || "var(--accent)";
              const detail = [e.taetigkeit, e.zeitraum, e.ergebnis].filter(Boolean).join(" · ");
              return `<li><b>${esc(m.name)}</b> <span class="tag" style="border-color:${color};color:${color}">${esc(kat.label)}</span>${
                detail ? ` – ${esc(detail)}` : ""
              }</li>`;
            })
            .join("");
          return `<div class="logitem">
            <div class="logmeta"><b style="color:var(--text);font-size:14px">${esc(k.firma)}</b> · ${k.eintraege.length} Einsatz/Einsätze</div>
            <ul>${zeilen}</ul>
          </div>`;
        })
        .join("")
    : "<div class='empty'>Keine Einsätze mit Unternehmen erfasst.</div>";
}

$("btnKunden").onclick = () => {
  $("kundenSuche").value = "";
  renderKunden();
  $("dlgKunden").showModal();
};
$("kundenSuche").addEventListener("input", renderKunden);
$("btnKundenClose").onclick = () => $("dlgKunden").close();

// ---------- Änderungsverlauf ----------
const zeitpunkt = (iso) => new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });

function aenderungText(a) {
  const label = FELD_LABEL[a.feld] || a.feld;
  const wert = (v) => {
    if (v === "") return "–";
    if (v === "true") return "ja";
    if (v === "false") return "nein";
    return a.feld === "kategorie" ? katOf(v).label : v;
  };
  return `<li><b>${esc(label)}:</b> ${esc(wert(a.vorher))} → ${esc(wert(a.nachher))}</li>`;
}

async function openLog(employeeId) {
  const m = daten.find((x) => x.id === employeeId);
  $("logTitle").textContent = m ? `Änderungsverlauf – ${m.name}` : "Änderungsverlauf (alle)";
  $("logBody").innerHTML = "Lädt …";
  $("dlgLog").showModal();
  try {
    const { events } = await api(`/api/events${employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ""}`);
    $("logBody").innerHTML = events.length
      ? events
          .map(
            (ev) => `<div class="logitem">
              <div class="logmeta">${zeitpunkt(ev.createdAt)} · <b>${esc(ev.akteur)}</b> · ${esc(ev.aktion)}${
                employeeId ? "" : ` · ${esc(ev.employeeName)}`
              }</div>
              ${ev.aenderungen?.length ? `<ul>${ev.aenderungen.map(aenderungText).join("")}</ul>` : ""}
            </div>`
          )
          .join("")
      : "<div class='empty'>Noch keine Änderungen aufgezeichnet.</div>";
  } catch (err) {
    $("logBody").textContent = err.message;
  }
}

$("btnLog").onclick = () => openLog(null);
$("btnLogClose").onclick = () => $("dlgLog").close();

// ---------- Dokumente ----------
const dateigroesse = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

async function renderDokumente(employeeId) {
  const { documents } = await api(`/api/employees/${employeeId}/documents`);
  $("dokuListe").innerHTML = documents.length
    ? documents
        .map(
          (d) => `<div class="doku">
            <a href="/api/documents/${d.id}" download>${esc(d.dateiname)}</a>
            <span class="logmeta">${dateigroesse(d.groesse)} · ${esc(d.hochgeladenVon)} · ${zeitpunkt(d.createdAt)}</span>
            <button type="button" data-doc="${d.id}" title="Dokument löschen">✕</button>
          </div>`
        )
        .join("")
    : `<div class="logmeta" style="margin-bottom:8px">Noch keine Dokumente.</div>`;
  $("dokuListe")
    .querySelectorAll("[data-doc]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          if (!confirm("Dokument wirklich löschen?")) return;
          await api(`/api/documents/${b.dataset.doc}`, { method: "DELETE" });
          await renderDokumente(employeeId);
        })
    );
}

$("dokuDatei").addEventListener("change", async (ev) => {
  const datei = ev.target.files?.[0];
  if (!datei || !editId) return;
  $("formError").textContent = "";
  try {
    const inhalt = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
      reader.readAsDataURL(datei);
    });
    await api(`/api/employees/${editId}/documents`, {
      method: "POST",
      body: { dateiname: datei.name, mime: datei.type, inhalt },
    });
    await renderDokumente(editId);
  } catch (err) {
    $("formError").textContent = err.message;
  }
  ev.target.value = "";
});

// ---------- Dialog ----------
const form = $("form");

function openDialog(id) {
  editId = id || null;
  form.reset();
  $("formError").textContent = "";
  $("einsaetze").innerHTML = "";
  const m = daten.find((x) => x.id === id);
  $("dlgTitle").textContent = m ? "Mitarbeiter bearbeiten" : "Mitarbeiter anlegen";
  $("btnDelete").hidden = !m;
  if (m) {
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === "checkbox") el.checked = Boolean(m[el.name]);
      else el.value = m[el.name] ?? "";
    }
    (m.einsaetze || []).forEach(addEinsatzRow);
    $("dokuListe").innerHTML = "Lädt …";
    renderDokumente(m.id).catch((err) => ($("dokuListe").textContent = err.message));
  }
  $("dokuBereich").hidden = !m;
  if (!$("einsaetze").children.length) addEinsatzRow();
  $("dlg").showModal();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(form).entries());
  ["staplerschein", "schichtbereit", "wiedereinstellbar"].forEach((k) => (body[k] = form.elements[k].checked));
  body.einsaetze = readEinsaetze();
  try {
    if (editId) await api(`/api/employees/${editId}`, { method: "PUT", body });
    else {
      try {
        await api("/api/employees", { method: "POST", body });
      } catch (err) {
        if (err.status !== 409) throw err;
        const treffer = (err.data.duplikate || [])
          .map((d) => `• ${d.name}${d.wohnort ? `, ${d.wohnort}` : ""}${d.kontakt ? `, ${d.kontakt}` : ""} (${katOf(d.kategorie).label})`)
          .join("\n");
        if (!confirm(`Möglicher Doppeleintrag:\n\n${treffer}\n\nTrotzdem neu anlegen?`)) {
          $("formError").textContent = "Nicht angelegt – möglicher Doppeleintrag.";
          return;
        }
        await api("/api/employees", { method: "POST", body: { ...body, force: true } });
      }
    }
    await reload();
    $("dlg").close();
  } catch (err) {
    $("formError").textContent = err.message;
  }
});

function renderBearbeiter() {
  $("btnBearbeiter").textContent = getBearbeiter() ? `👤 ${getBearbeiter()}` : "👤 Name setzen";
}

$("btnBearbeiter").onclick = () => {
  const name = prompt("Dein Name (erscheint im Änderungsverlauf):", getBearbeiter());
  if (name === null) return;
  setBearbeiter(name);
  renderBearbeiter();
};

$("btnCancel").onclick = () => $("dlg").close();
$("btnNew").onclick = () => openDialog(null);
$("btnDelete").onclick = async () => {
  if (!confirm("Diesen Mitarbeiter wirklich löschen?")) return;
  try {
    await api(`/api/employees/${editId}`, { method: "DELETE" });
    await reload();
    $("dlg").close();
  } catch (err) {
    $("formError").textContent = err.message;
  }
};

["q", "fStapler", "fMobil", "fSort"].forEach((id) => $(id).addEventListener("input", render));

// ---------- CSV-Export ----------
$("btnExportCsv").onclick = () => {
  const cols = ["name", "kategorie", "bewertung", "sprachen", "nationalitaet", "wohnort", "mobilitaet",
    "staplerschein", "schichtbereit", "wiedereinstellbar", "vorerfahrung", "einsaetze", "kontakt", "verfuegbar",
    "staplerscheinBis", "einsatzEnde", "notiz"];
  const wert = (m, c) => {
    if (c === "kategorie") return katOf(m.kategorie).label;
    if (c === "einsaetze") return (m.einsaetze || []).map((e) => [e.unternehmen, e.taetigkeit, e.zeitraum, e.ergebnis].filter(Boolean).join(" | ")).join(" ; ");
    return m[c];
  };
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\n/g, "; ")}"`;
  const csv = [cols.join(";"), ...daten.map((m) => cols.map((c) => cell(wert(m, c))).join(";"))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv" }));
  a.download = "mitarbeiter.csv";
  a.click();
  URL.revokeObjectURL(a.href);
};

// ---------- Start ----------
async function reload() {
  daten = (await api("/api/employees")).employees;
  render();
}

async function start() {
  const session = await api("/api/session");
  if (!session.authed) {
    $("loginView").hidden = false;
    $("appView").hidden = true;
    $("loginBearbeiter").value = getBearbeiter();
    if (session.usesDevDefault) $("loginError").textContent = 'Entwicklungsmodus – Passwort: "demo"';
    return;
  }
  $("loginView").hidden = true;
  $("appView").hidden = false;
  renderBearbeiter();
  kategorien = (await api("/api/kategorien")).kategorien;
  fillSelects();
  await reload();
}

start();
