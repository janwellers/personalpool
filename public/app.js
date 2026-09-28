// Alle sichtbaren Texte sind über die Einstellungen überschreibbar; hier stehen nur die Auslieferungswerte.
const STANDARD_TEXTE = {
  "feld.name": "Name",
  "feld.kategorie": "Kategorie",
  "feld.bewertung": "Bewertung",
  "feld.sprachen": "Sprache(n)",
  "feld.nationalitaet": "Nationalität",
  "feld.wohnort": "Wohnort",
  "feld.mobilitaet": "Mobilität",
  "feld.staplerschein": "Staplerschein",
  "feld.schichtbereit": "Schichtbereit",
  "feld.wiedereinstellbar": "Wiedereinstellbar",
  "feld.vorerfahrung.kurz": "Kann",
  "feld.einsaetze": "Einsätze",
  "feld.kontakt": "Kontakt",
  "feld.verfuegbar": "Verfügbar ab",
  "feld.einsatzEnde": "Einsatzende",
  "feld.notiz.kurz": "Notiz",
  "liste.alle": "Alle",
  "liste.hinweise": "Hinweise",
  "liste.leer": "Noch keine Mitarbeiter erfasst. Lege oben rechts den ersten an.",
  "liste.keinTreffer": "Keine Treffer für diesen Filter.",
  "zahl.gesamt": "Gesamt",
  "zahl.verfuegbar": "Sofort verfügbar",
  "zahl.staplerschein": "Mit Staplerschein",
  "zahl.wiedereinstellbar": "Wiedereinstellbar",
  "zahl.fristen": "Offene Fristen",
  "filter.staplerEgal": "Staplerschein: egal",
  "filter.staplerJa": "mit Staplerschein",
  "filter.staplerNein": "ohne Staplerschein",
  "filter.mobilEgal": "Mobilität: egal",
  "filter.sortName": "Sortieren: Name",
  "filter.sortKategorie": "Sortieren: Kategorie",
  "filter.sortBewertung": "Sortieren: Bewertung",
  "filter.ansichtKarten": "Ansicht: Kacheln",
  "filter.ansichtTabelle": "Ansicht: Tabelle",
  "titel.anlegen": "Mitarbeiter anlegen",
  "titel.bearbeiten": "Mitarbeiter bearbeiten",
  "titel.verlauf": "Änderungsverlauf",
  "fristen.art": "Einsatz endet",
};

const VERLAUF_FELDER = {
  name: "feld.name",
  kategorie: "feld.kategorie",
  bewertung: "feld.bewertung",
  sprachen: "feld.sprachen",
  nationalitaet: "feld.nationalitaet",
  wohnort: "feld.wohnort",
  mobilitaet: "feld.mobilitaet",
  staplerschein: "feld.staplerschein",
  schichtbereit: "feld.schichtbereit",
  wiedereinstellbar: "feld.wiedereinstellbar",
  vorerfahrung: "feld.vorerfahrung.kurz",
  kontakt: "feld.kontakt",
  verfuegbar: "feld.verfuegbar",
  einsatzEnde: "feld.einsatzEnde",
  notiz: "feld.notiz.kurz",
  einsaetze: "feld.einsaetze",
};

let konfig = { kategorien: [], mobilitaet: [], texte: {} };
const t = (key) => konfig.texte?.[key] || STANDARD_TEXTE[key] || key;
const farbeOf = (kat) => kat?.farbe || "var(--accent)";

let kategorien = [];
let daten = [];
let filterKat = "alle";
let editId = null;
let ich = null;
const istAdmin = () => ich?.rolle === "admin";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const katOf = (id) => kategorien.find((k) => k.id === id) || kategorien[0] || { id, label: id };

// Auslieferungstexte aus dem Markup einsammeln, damit sie nur an einer Stelle stehen.
for (const el of document.querySelectorAll("[data-t]")) STANDARD_TEXTE[el.dataset.t] ??= el.textContent.trim();
for (const el of document.querySelectorAll("[data-tp]")) STANDARD_TEXTE[el.dataset.tp] ??= el.placeholder;

function wendeTexteAn() {
  document.title = t("kopf.titel");
  for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
  for (const el of document.querySelectorAll("[data-tp]")) el.placeholder = t(el.dataset.tp);
  $("katFarben").textContent = kategorien
    .map((k) => {
      const dunkel = lesbarAufHell(k.farbe) ? "#08121d" : "#fff";
      return `.badge.kat-${k.id}{background:${k.farbe};color:${dunkel}}
.card.kat-${k.id}{border-left-color:${k.farbe}}
.tabelle tbody tr.kat-${k.id}{border-left-color:${k.farbe}}${
        k.hervorheben ? `\n.card.kat-${k.id}{background:${k.farbe}1f;border-color:${k.farbe}66}\n.tabelle tbody tr.kat-${k.id}{background:${k.farbe}1a}` : ""
      }`;
    })
    .join("\n");
}

// Helle Kategoriefarben brauchen dunkle Schrift, dunkle helle.
function lesbarAufHell(farbe) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(farbe).slice(i, i + 2), 16) || 0);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

const getBearbeiter = () => localStorage.getItem("personalpool.bearbeiter") || "";
const setBearbeiter = (name) => localStorage.setItem("personalpool.bearbeiter", String(name || "").trim().slice(0, 60));

// Zurück zum Login, wenn der Zugang serverseitig nicht mehr gilt (z. B. Konto gelöscht).
function sitzungBeendet(nachricht) {
  sessionStorage.setItem("personalpool.hinweis", nachricht);
  location.reload();
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", "X-Bearbeiter": getBearbeiter() },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/login") && !$("appView").hidden) {
    sitzungBeendet(data.error || "Sitzung abgelaufen. Bitte neu anmelden.");
  }
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
    await api("/api/login", {
      method: "POST",
      body: { benutzer: e.target.benutzer.value, password: e.target.password.value },
    });
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
  const merken = { kat: $("selKat").value, mobil: $("fMobil").value, sort: $("fSort").value, stapler: $("fStapler").value };
  const optionen = (liste) => liste.map(([wert, text]) => `<option value="${esc(wert)}">${esc(text)}</option>`).join("");
  const mobil = konfig.mobilitaet.map((m) => [m, m]);

  $("selKat").innerHTML = optionen(kategorien.map((k) => [k.id, k.label]));
  $("selMobil").innerHTML = optionen([["", "–"], ...mobil]);
  $("fMobil").innerHTML = optionen([["", t("filter.mobilEgal")], ...mobil]);
  $("fStapler").innerHTML = optionen([
    ["", t("filter.staplerEgal")],
    ["ja", t("filter.staplerJa")],
    ["nein", t("filter.staplerNein")],
  ]);
  $("fSort").innerHTML = optionen([
    ["name", t("filter.sortName")],
    ["kategorie", t("filter.sortKategorie")],
    ["bewertung", t("filter.sortBewertung")],
  ]);
  $("fAnsicht").innerHTML = optionen([
    ["karten", t("filter.ansichtKarten")],
    ["tabelle", t("filter.ansichtTabelle")],
  ]);

  $("selKat").value = merken.kat || kategorien[0]?.id || "";
  $("fMobil").value = konfig.mobilitaet.includes(merken.mobil) ? merken.mobil : "";
  $("fSort").value = merken.sort || "name";
  $("fStapler").value = merken.stapler || "";
  $("fAnsicht").value = localStorage.getItem("personalpool.ansicht") || "karten";
}

// ---------- Einsatz-Zeilen im Formular ----------
const monatText = (wert) => {
  const treffer = /^(\d{4})-(\d{2})$/.exec(wert || "");
  return treffer ? `${treffer[2]}/${treffer[1]}` : "";
};

function zeitraumText(e) {
  const von = monatText(e.von);
  const bis = monatText(e.bis);
  if (von && bis) return von === bis ? von : `${von} – ${bis}`;
  if (von) return `seit ${von}`;
  if (bis) return `bis ${bis}`;
  return e.zeitraum || "";
}

function addEinsatzRow(e = {}) {
  const div = document.createElement("div");
  div.className = "einsatz";
  div.dataset.zeitraum = e.von || e.bis ? "" : e.zeitraum || "";
  div.innerHTML = `
    <input placeholder="Unternehmen" data-f="unternehmen" />
    <input placeholder="Tätigkeit" data-f="taetigkeit" />
    <input type="month" title="Einsatz von (Monat/Jahr)" data-f="von" />
    <input type="month" title="Einsatz bis (Monat/Jahr)" data-f="bis" />
    <input placeholder="Ergebnis" data-f="ergebnis" />
    <button type="button" title="Zeile entfernen">✕</button>`;
  div.querySelectorAll("input").forEach((i) => (i.value = e[i.dataset.f] || ""));
  if (div.dataset.zeitraum) div.title = `Früherer Zeitraum: ${div.dataset.zeitraum}`;
  div.querySelector("button").onclick = () => div.remove();
  $("einsaetze").appendChild(div);
}
$("btnAddEinsatz").onclick = () => addEinsatzRow();

function readEinsaetze() {
  return [...$("einsaetze").querySelectorAll(".einsatz")]
    .map((row) => {
      const e = Object.fromEntries([...row.querySelectorAll("input")].map((i) => [i.dataset.f, i.value.trim()]));
      if (!e.von && !e.bis && row.dataset.zeitraum) e.zeitraum = row.dataset.zeitraum;
      return e;
    })
    .filter((e) => e.unternehmen || e.taetigkeit || e.von || e.bis || e.zeitraum || e.ergebnis);
}

// ---------- Darstellung ----------
function renderCats() {
  const items = [{ id: "alle", label: t("liste.alle") }, ...kategorien];
  $("cats").innerHTML = items
    .map((k) => {
      const n = k.id === "alle" ? daten.length : daten.filter((m) => m.kategorie === k.id).length;
      const color = k.id === "alle" ? "var(--accent)" : farbeOf(k);
      return `<div class="chip ${filterKat === k.id ? "active" : ""}" data-kat="${k.id}">
        <span class="dot" style="background:${color}"></span>${esc(k.label)} <b>${n}</b></div>`;
    })
    .join("");
  $("cats").querySelectorAll(".chip").forEach((c) => (c.onclick = () => { filterKat = c.dataset.kat; render(); }));
}

const sofortVerfuegbar = (m) => !m.verfuegbar || tageBis(m.verfuegbar) <= 0;

function renderStats() {
  const offen = fristen().length;
  $("stats").innerHTML = `
    <div class="stat">${esc(t("zahl.gesamt"))}: <b>${daten.length}</b></div>
    <div class="stat">${esc(t("zahl.verfuegbar"))}: <b>${daten.filter(sofortVerfuegbar).length}</b></div>
    <div class="stat">${esc(t("zahl.staplerschein"))}: <b>${daten.filter((m) => m.staplerschein).length}</b></div>
    <div class="stat">${esc(t("zahl.wiedereinstellbar"))}: <b>${daten.filter((m) => m.wiedereinstellbar).length}</b></div>
    <div class="stat klickbar ${offen ? "warn" : ""}" id="statFristen">${esc(t("zahl.fristen"))}: <b>${offen}</b></div>`;
  $("statFristen").onclick = () => $("btnFristen").click();
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
  return wert ? `<div class="row"><span>${esc(label)}</span><span>${esc(wert)}</span></div>` : "";
}

function bewertungHtml(m) {
  return m.bewertung ? `<span class="sterne">${"★".repeat(Number(m.bewertung))}<span class="leer">${"★".repeat(5 - Number(m.bewertung))}</span></span>` : "";
}

function renderTabelle(liste) {
  $("tabelle").innerHTML = `<table>
    <thead><tr>${["feld.name", "feld.kategorie", "feld.bewertung", "feld.wohnort", "feld.mobilitaet", "feld.sprachen", "liste.hinweise"]
      .map((k) => `<th>${esc(t(k))}</th>`)
      .join("")}<th></th></tr></thead>
    <tbody>${liste
      .map((m) => {
        const k = katOf(m.kategorie);
        const hinweise = [
          m.staplerschein && t("feld.staplerschein"),
          m.schichtbereit && t("feld.schichtbereit"),
          m.wiedereinstellbar && t("feld.wiedereinstellbar"),
          m.einsatzEnde && tageBis(m.einsatzEnde) <= WARNTAGE ? `⚠ ${t("feld.einsatzEnde")}` : "",
        ].filter(Boolean);
        return `<tr class="kat-${k.id}">
          <td><b>${esc(m.name)}</b></td>
          <td><span class="badge kat-${k.id}">${esc(k.label)}</span></td>
          <td>${bewertungHtml(m)}</td>
          <td>${esc(m.wohnort)}</td>
          <td>${esc(m.mobilitaet)}</td>
          <td>${esc(m.sprachen)}</td>
          <td>${hinweise.map((h) => `<span class="tag${h.startsWith("⚠") ? " warn" : ""}">${esc(h)}</span>`).join(" ")}</td>
          <td class="nowrap"><button data-edit="${m.id}">Bearbeiten</button><button data-log="${m.id}">Verlauf</button></td>
        </tr>`;
      })
      .join("")}</tbody></table>`;
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
  $("empty").textContent = daten.length === 0 ? t("liste.leer") : t("liste.keinTreffer");

  $("grid").innerHTML = liste
    .map((m) => {
      const k = katOf(m.kategorie);
      const color = farbeOf(k);
      const tags = [
        m.staplerschein && t("feld.staplerschein"),
        m.schichtbereit && t("feld.schichtbereit"),
        m.wiedereinstellbar && t("feld.wiedereinstellbar"),
      ].filter(Boolean);
      const warnungen = [
        m.einsatzEnde && tageBis(m.einsatzEnde) <= WARNTAGE
          ? `${t("feld.einsatzEnde")} ${fristText(tageBis(m.einsatzEnde))}`
          : "",
      ].filter(Boolean);
      const einsaetze = (m.einsaetze || []).map(
        (e) => `<li>${esc([e.unternehmen, e.taetigkeit, zeitraumText(e), e.ergebnis].filter(Boolean).join(" | "))}</li>`
      );
      return `<div class="card kat-${k.id}" style="border-left-color:${color}">
        <h3>${esc(m.name)}</h3>
        <span class="badge kat-${k.id}">${esc(k.label)}</span> ${bewertungHtml(m)}
        <div style="margin-top:10px">
          ${zeile(t("feld.sprachen"), m.sprachen)}
          ${zeile(t("feld.nationalitaet"), m.nationalitaet)}
          ${zeile(t("feld.wohnort"), m.wohnort)}
          ${zeile(t("feld.mobilitaet"), m.mobilitaet)}
          ${zeile(t("feld.verfuegbar"), m.verfuegbar ? dtFormat(m.verfuegbar) : "")}
          ${zeile(t("feld.kontakt"), m.kontakt)}
        </div>
        ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>` : ""}
        ${warnungen.length ? `<div class="tags">${warnungen.map((t) => `<span class="tag warn">⚠ ${esc(t)}</span>`).join("")}</div>` : ""}
        ${m.vorerfahrung ? `<div style="margin-top:8px;font-size:13px"><b>${esc(t("feld.vorerfahrung.kurz"))}:</b> ${esc(m.vorerfahrung)}</div>` : ""}
        ${einsaetze.length ? `<div style="margin-top:8px;font-size:13px"><b>${esc(t("feld.einsaetze"))}:</b><ul style="margin:6px 0 0 18px;padding:0">${einsaetze.join("")}</ul></div>` : ""}
        ${m.notiz ? `<div style="margin-top:8px;font-size:12px;color:var(--muted)">${esc(t("feld.notiz.kurz"))}: ${esc(m.notiz)}</div>` : ""}
        <div class="actions"><button data-edit="${m.id}">Bearbeiten</button><button data-log="${m.id}">Verlauf</button></div>
      </div>`;
    })
    .join("");

  const tabelle = $("fAnsicht").value === "tabelle";
  if (tabelle) renderTabelle(liste);
  $("tabelle").hidden = !tabelle || liste.length === 0;
  $("grid").hidden = tabelle;

  const bereich = tabelle ? $("tabelle") : $("grid");
  bereich.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openDialog(b.dataset.edit)));
  bereich.querySelectorAll("[data-log]").forEach((b) => (b.onclick = () => openLog(b.dataset.log)));
}

// ---------- Fristen ----------
const WARNTAGE = 30;
const heute = () => new Date(new Date().toDateString());
// Reine Datumsangaben sind Kalendertage, keine UTC-Zeitpunkte.
const alsDatum = (datum) => {
  const teile = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum));
  return teile ? new Date(Number(teile[1]), Number(teile[2]) - 1, Number(teile[3])) : new Date(datum);
};
const tageBis = (datum) => Math.round((alsDatum(datum) - heute()) / 86400000);
const dtFormat = (datum) => alsDatum(datum).toLocaleDateString("de-DE");

function fristen() {
  const items = [];
  for (const m of daten) {
    if (m.einsatzEnde) items.push({ m, art: t("fristen.art"), datum: m.einsatzEnde, tage: tageBis(m.einsatzEnde) });
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
              const color = farbeOf(kat);
              const detail = [e.taetigkeit, zeitraumText(e), e.ergebnis].filter(Boolean).join(" · ");
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
  const label = VERLAUF_FELDER[a.feld] ? t(VERLAUF_FELDER[a.feld]) : a.feld;
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
  $("logTitle").textContent = m ? `${t("titel.verlauf")} – ${m.name}` : `${t("titel.verlauf")} (alle)`;
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

// ---------- DSGVO ----------
const monateSeit = (iso) => (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.44);

function renderDsgvo() {
  const frist = Number($("dsgvoFrist").value);
  const alt = daten
    .filter((m) => monateSeit(m.updatedAt || m.createdAt) >= frist)
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
  $("dsgvoBody").innerHTML = alt.length
    ? alt
        .map(
          (m) => `<div class="logitem">
            <b>${esc(m.name)}</b> <span class="tag">${esc(katOf(m.kategorie).label)}</span>
            <div class="logmeta">Zuletzt bearbeitet: ${zeitpunkt(m.updatedAt || m.createdAt)} · seit ${Math.floor(monateSeit(m.updatedAt || m.createdAt))} Monaten unverändert</div>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
              <a href="/api/employees/${m.id}/auskunft" download>Auskunft herunterladen</a>
              ${istAdmin() ? `<button type="button" class="danger" data-del="${m.id}">Löschen</button>` : ""}
            </div>
          </div>`
        )
        .join("")
    : `<div class="empty">Kein Eintrag älter als ${frist} Monate.</div>`;
  $("dsgvoBody")
    .querySelectorAll("[data-del]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const m = daten.find((x) => x.id === b.dataset.del);
          if (!confirm(`"${m?.name}" endgültig löschen? Dokumente und Verlaufseinträge des Datensatzes gehen mit verloren.`)) return;
          await api(`/api/employees/${b.dataset.del}`, { method: "DELETE" });
          await reload();
          renderDsgvo();
        })
    );
}

$("btnDsgvo").onclick = () => {
  renderDsgvo();
  $("dlgDsgvo").showModal();
};
$("dsgvoFrist").onchange = renderDsgvo;
$("btnDsgvoClose").onclick = () => $("dlgDsgvo").close();
$("btnAuskunft").onclick = () => {
  if (editId) window.location.assign(`/api/employees/${editId}/auskunft`);
};

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
  $("dlgTitle").textContent = m ? t("titel.bearbeiten") : t("titel.anlegen");
  $("btnDelete").hidden = !m || !istAdmin();
  $("btnAuskunft").hidden = !m;
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
  if (ich && !ich.team) {
    $("btnBearbeiter").textContent = `👤 ${ich.name}`;
    $("btnBearbeiter").disabled = true;
    return;
  }
  $("btnBearbeiter").textContent = getBearbeiter() ? `👤 ${getBearbeiter()}` : "👤 Name setzen";
}

// ---------- Benutzerkonten ----------
async function renderUsers() {
  const { users } = await api("/api/users");
  $("userListe").innerHTML = users.length
    ? users
        .map(
          (u) => `<div class="doku">
            <b>${esc(u.name)}</b> <span class="logmeta">${esc(u.benutzername)}${u.rolle === "admin" ? " · Administrator" : ""}</span>
            <button type="button" data-pw="${u.id}">Passwort</button>
            <button type="button" class="danger" data-user="${u.id}">Löschen</button>
          </div>`
        )
        .join("")
    : "<div class='logmeta'>Noch keine persönlichen Zugänge – es gilt das gemeinsame Passwort.</div>";
  $("userListe")
    .querySelectorAll("[data-pw]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const pw = prompt("Neues Passwort (mind. 8 Zeichen):");
          if (!pw) return;
          try {
            await api(`/api/users/${b.dataset.pw}/passwort`, { method: "PUT", body: { passwort: pw } });
            $("userError").textContent = "";
            alert("Passwort geändert.");
          } catch (err) {
            $("userError").textContent = err.message;
          }
        })
    );
  $("userListe")
    .querySelectorAll("[data-user]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          if (!confirm("Zugang wirklich löschen?")) return;
          try {
            await api(`/api/users/${b.dataset.user}`, { method: "DELETE" });
            await renderUsers();
          } catch (err) {
            $("userError").textContent = err.message;
          }
        })
    );
}

$("btnBenutzer").onclick = async () => {
  $("userError").textContent = "";
  $("userListe").innerHTML = "Lädt …";
  $("dlgBenutzer").showModal();
  try {
    await renderUsers();
  } catch (err) {
    $("userListe").textContent = err.message;
  }
};
$("btnBenutzerClose").onclick = () => $("dlgBenutzer").close();

$("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("userError").textContent = "";
  const f = e.target;
  try {
    await api("/api/users", {
      method: "POST",
      body: {
        benutzername: f.benutzername.value,
        name: f.name.value,
        passwort: f.passwort.value,
        rolle: f.admin.checked ? "admin" : "user",
      },
    });
    f.reset();
    if (ich?.team) {
      // Das erste Konto beendet den gemeinsamen Zugang; danach ist nur der persönliche Login gültig.
      sitzungBeendet("Konto angelegt. Bitte jetzt mit dem persönlichen Benutzernamen anmelden.");
      return;
    }
    await renderUsers();
  } catch (err) {
    $("userError").textContent = err.message;
  }
});

async function renderBackup() {
  const s = await api("/api/backup/status");
  const letzte = s.letzte ? new Date(s.letzte).toLocaleString("de-DE") : "";
  $("btnBackupJetzt").hidden = !s.konfiguriert;
  $("backupStatus").innerHTML = s.konfiguriert
    ? `Automatische Sicherung aktiv, Aufbewahrung ${s.aufbewahrungTage} Tage.<br />Letzte Sicherung: ${
        letzte ? esc(letzte) : "noch keine"
      }`
    : "Noch kein Speicherziel hinterlegt – es laufen keine automatischen Sicherungen. Solange hilft nur der Download.";
}

$("btnBackup").onclick = async () => {
  $("backupError").textContent = "";
  $("backupStatus").textContent = "Lädt …";
  $("dlgBackup").showModal();
  try {
    await renderBackup();
  } catch (err) {
    $("backupStatus").textContent = err.message;
  }
};
$("btnBackupClose").onclick = () => $("dlgBackup").close();
$("btnBackupDownload").onclick = () => {
  location.href = "/api/backup/download";
};
$("btnBackupJetzt").onclick = async () => {
  $("backupError").textContent = "";
  $("btnBackupJetzt").disabled = true;
  try {
    const { ergebnis } = await api("/api/backup/jetzt", { method: "POST" });
    await renderBackup();
    $("backupStatus").innerHTML += `<br />Gesichert: ${ergebnis.mitarbeiter} Mitarbeiter, ${Math.round(
      ergebnis.bytes / 1024
    )} KB.`;
  } catch (err) {
    $("backupError").textContent = err.message;
  } finally {
    $("btnBackupJetzt").disabled = false;
  }
};

// ---------- Einstellungen ----------
// Gruppiert nach dem Schlüsselpräfix, damit die Liste ohne zweite Pflegestelle lesbar bleibt.
const TEXT_GRUPPEN = [
  ["kopf", "Seitenkopf"],
  ["login", "Anmeldung"],
  ["btn", "Schaltflächen"],
  ["feld", "Felder im Mitarbeiterformular"],
  ["filter", "Filter und Sortierung"],
  ["zahl", "Kennzahlen"],
  ["liste", "Liste"],
  ["titel", "Fenstertitel"],
  ["fristen", "Fristen"],
];

function katZeile(k = { id: "", label: "", farbe: "#4da3ff", hervorheben: false }) {
  const div = document.createElement("div");
  div.className = "katzeile";
  div.dataset.id = k.id;
  div.innerHTML = `
    <input data-f="label" placeholder="Bezeichnung der Kategorie" />
    <input data-f="farbe" type="color" title="Farbe" />
    <label title="Karten dieser Kategorie farbig hinterlegen"><input type="checkbox" data-f="hervorheben" /> auffällig</label>
    <button type="button" title="Kategorie entfernen">✕</button>`;
  div.querySelector('[data-f="label"]').value = k.label;
  div.querySelector('[data-f="farbe"]').value = k.farbe || "#4da3ff";
  div.querySelector('[data-f="hervorheben"]').checked = Boolean(k.hervorheben);
  div.querySelector("button").onclick = () => div.remove();
  $("katEditor").appendChild(div);
}

function renderEinstellungen() {
  $("einstellungenError").textContent = "";
  $("katEditor").innerHTML = "";
  kategorien.forEach(katZeile);
  $("mobilEditor").value = konfig.mobilitaet.join("\n");
  const gruppe = (key) => key.split(".")[0];
  const keys = Object.keys(STANDARD_TEXTE).sort();
  $("texteEditor").innerHTML = TEXT_GRUPPEN.map(([praefix, titel]) => {
    const zeilen = keys
      .filter((k) => gruppe(k) === praefix)
      .map(
        (k) => `<div class="textzeile">
          <span class="logmeta">${esc(STANDARD_TEXTE[k])}</span>
          <input data-text="${esc(k)}" value="${esc(konfig.texte?.[k] || "")}" placeholder="${esc(STANDARD_TEXTE[k])}" />
        </div>`
      )
      .join("");
    return zeilen ? `<div class="logitem"><div class="logmeta" style="margin-bottom:6px"><b>${esc(titel)}</b></div>${zeilen}</div>` : "";
  }).join("");
}

function leseEinstellungen() {
  const neueKategorien = [...$("katEditor").querySelectorAll(".katzeile")]
    .map((row) => ({
      id: row.dataset.id || undefined,
      label: row.querySelector('[data-f="label"]').value.trim(),
      farbe: row.querySelector('[data-f="farbe"]').value,
      hervorheben: row.querySelector('[data-f="hervorheben"]').checked,
    }))
    .filter((k) => k.label);
  const texte = {};
  for (const input of $("texteEditor").querySelectorAll("[data-text]")) {
    const wert = input.value.trim();
    if (wert && wert !== STANDARD_TEXTE[input.dataset.text]) texte[input.dataset.text] = wert;
  }
  return {
    kategorien: neueKategorien,
    mobilitaet: $("mobilEditor").value.split("\n").map((z) => z.trim()).filter(Boolean),
    texte,
  };
}

async function speichereKonfiguration(body) {
  konfig = (await api("/api/konfiguration", { method: "PUT", body })).konfiguration;
  kategorien = konfig.kategorien;
  wendeTexteAn();
  fillSelects();
  if (!kategorien.some((k) => k.id === filterKat)) filterKat = "alle";
  render();
}

$("btnEinstellungen").onclick = () => {
  renderEinstellungen();
  $("dlgEinstellungen").showModal();
};
$("btnKatNeu").onclick = () => katZeile();
$("btnEinstellungenClose").onclick = () => $("dlgEinstellungen").close();
$("btnEinstellungenSpeichern").onclick = async () => {
  $("einstellungenError").textContent = "";
  try {
    await speichereKonfiguration(leseEinstellungen());
    $("dlgEinstellungen").close();
  } catch (err) {
    $("einstellungenError").textContent = err.message;
  }
};
$("btnEinstellungenReset").onclick = async () => {
  if (!confirm("Alle Bezeichnungen, Kategorien und Auswahllisten auf den Auslieferungszustand zurücksetzen?")) return;
  try {
    await speichereKonfiguration({});
    renderEinstellungen();
  } catch (err) {
    $("einstellungenError").textContent = err.message;
  }
};

$("btnPasswort").onclick = async () => {
  const pw = prompt("Neues eigenes Passwort (mind. 8 Zeichen):");
  if (!pw) return;
  try {
    await api(`/api/users/${ich.id}/passwort`, { method: "PUT", body: { passwort: pw } });
    alert("Passwort geändert.");
  } catch (err) {
    alert(err.message);
  }
};

$("btnBearbeiter").onclick = () => {
  if (ich && !ich.team) return;
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

["q", "fStapler", "fMobil", "fSort", "fAnsicht"].forEach((id) => $(id).addEventListener("input", render));

$("fAnsicht").addEventListener("change", () => localStorage.setItem("personalpool.ansicht", $("fAnsicht").value));

// ---------- CSV-Export ----------
$("btnExportCsv").onclick = () => {
  const cols = ["name", "kategorie", "bewertung", "sprachen", "nationalitaet", "wohnort", "mobilitaet",
    "staplerschein", "schichtbereit", "wiedereinstellbar", "vorerfahrung", "einsaetze", "kontakt", "verfuegbar",
    "einsatzEnde", "notiz"];
  const wert = (m, c) => {
    if (c === "kategorie") return katOf(m.kategorie).label;
    if (c === "einsatzEnde" || c === "verfuegbar") return m[c] ? dtFormat(m[c]) : "";
    if (c === "einsaetze") return (m.einsaetze || []).map((e) => [e.unternehmen, e.taetigkeit, zeitraumText(e), e.ergebnis].filter(Boolean).join(" | ")).join(" ; ");
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
  konfig = (await api("/api/konfiguration")).konfiguration;
  kategorien = konfig.kategorien;
  wendeTexteAn();
  const session = await api("/api/session");
  ich = session.user || null;
  if (!session.authed) {
    $("loginView").hidden = false;
    $("appView").hidden = true;
    $("loginBearbeiter").value = getBearbeiter();
    $("loginBenutzer").required = session.benutzerkonten;
    $("loginBearbeiter").hidden = session.benutzerkonten;
    if (!session.benutzerkonten) {
      $("loginBenutzer").placeholder = "Benutzername (leer lassen für gemeinsames Passwort)";
    }
    const hinweis = sessionStorage.getItem("personalpool.hinweis");
    sessionStorage.removeItem("personalpool.hinweis");
    if (hinweis) $("loginError").textContent = hinweis;
    else if (session.usesDevDefault) $("loginError").textContent = 'Entwicklungsmodus – Passwort: "demo"';
    return;
  }
  $("loginView").hidden = true;
  $("appView").hidden = false;
  $("btnBenutzer").hidden = !istAdmin();
  $("btnBackup").hidden = !istAdmin();
  $("btnEinstellungen").hidden = !istAdmin();
  $("btnPasswort").hidden = !ich || ich.team;
  renderBearbeiter();
  fillSelects();
  await reload();
}

start();
