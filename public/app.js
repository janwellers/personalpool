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
  "karte.details": "Weitere Angaben",
  "karte.eingeplant": "Eingeplant",
  "feld.einplanung": "Einplanung",
  "firma.offen": "offen",
  "firma.besetzt": "besetzt",
  "firma.eingeplant": "Eingeplant",
  "firma.bisher": "Bisher eingesetzt",
  "firma.abgeschlossen": "Abgeschlossen",
  "firma.keineAnf": "Noch keine Anforderungen.",
  "firma.leer": "Noch keine Unternehmen erfasst. Lege oben rechts das erste an.",
  "firma.keinTreffer": "Keine Unternehmen für diesen Filter.",
  "firma.passend": "Passende Mitarbeiter",
  "firma.anfNeu": "+ Anforderung",
  "firma.bearbeiten": "Bearbeiten",
  "zahl.firmen": "Unternehmen",
  "zahl.anfOffen": "Offene Anforderungen",
  "zahl.plaetze": "Offene Plätze",
  "zahl.eingeplant": "Eingeplant",
  "titel.firmaNeu": "Unternehmen anlegen",
  "titel.firmaBearbeiten": "Unternehmen bearbeiten",
  "titel.anfNeu": "Anforderung anlegen",
  "titel.anfBearbeiten": "Anforderung bearbeiten",
  "titel.match": "Passende Mitarbeiter",
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
  einplanung: "feld.einplanung",
};

let konfig = { kategorien: [], mobilitaet: [], texte: {} };
const t = (key) => konfig.texte?.[key] || STANDARD_TEXTE[key] || key;
const farbeOf = (kat) => kat?.farbe || "var(--accent)";

let kategorien = [];
let daten = [];
let firmen = [];
let kiAktiv = false;
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
  $("anfMobil").innerHTML = optionen([["", "egal"], ...mobil]);
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

// Die Karte zeigt nur, was beim Überfliegen zählt; alles Weitere steckt im aufklappbaren Teil.
function karteHtml(m) {
  const k = katOf(m.kategorie);
  const kern = [
    [t("feld.wohnort"), m.wohnort],
    [t("feld.mobilitaet"), m.mobilitaet],
    [t("feld.verfuegbar"), m.verfuegbar ? dtFormat(m.verfuegbar) : ""],
  ].filter(([, wert]) => wert);
  const tags = [
    m.staplerschein && t("feld.staplerschein"),
    m.schichtbereit && t("feld.schichtbereit"),
    m.wiedereinstellbar && t("feld.wiedereinstellbar"),
    ...einplanungen(m.id).map(({ firma, anf }) => `${t("karte.eingeplant")}: ${firma.name} – ${anf.taetigkeit}`),
  ].filter(Boolean);
  const warnung =
    m.einsatzEnde && tageBis(m.einsatzEnde) <= WARNTAGE
      ? `${t("feld.einsatzEnde")} ${fristText(tageBis(m.einsatzEnde))}`
      : "";
  const einsaetze = (m.einsaetze || []).map(
    (e) => `<li>${esc([e.unternehmen, e.taetigkeit, zeitraumText(e), e.ergebnis].filter(Boolean).join(" | "))}</li>`
  );
  const details = [
    zeile(t("feld.sprachen"), m.sprachen),
    zeile(t("feld.nationalitaet"), m.nationalitaet),
    zeile(t("feld.kontakt"), m.kontakt),
    m.vorerfahrung ? `<div style="margin-top:8px;font-size:13px"><b>${esc(t("feld.vorerfahrung.kurz"))}:</b> ${esc(m.vorerfahrung)}</div>` : "",
    einsaetze.length
      ? `<div style="margin-top:8px;font-size:13px"><b>${esc(t("feld.einsaetze"))}:</b><ul style="margin:6px 0 0 18px;padding:0">${einsaetze.join("")}</ul></div>`
      : "",
    m.notiz ? `<div style="margin-top:8px;font-size:12px;color:var(--muted)">${esc(t("feld.notiz.kurz"))}: ${esc(m.notiz)}</div>` : "",
  ].filter(Boolean);

  return `<div class="card kat-${k.id}">
    <div class="kopf">
      <div>
        <h3>${esc(m.name)}</h3>
        <span class="badge kat-${k.id}">${esc(k.label)}</span>
      </div>
      ${bewertungHtml(m)}
    </div>
    ${kern.length ? `<div class="kern">${kern.map(([label, wert]) => `<span>${esc(label)}: <b>${esc(wert)}</b></span>`).join("")}</div>` : ""}
    ${tags.length || warnung ? `<div class="tags">${tags.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}${
      warnung ? `<span class="tag warn">⚠ ${esc(warnung)}</span>` : ""
    }</div>` : ""}
    ${details.length ? `<details class="mehr"><summary>${esc(t("karte.details"))}</summary><div style="margin-top:8px">${details.join("")}</div></details>` : ""}
    <div class="actions"><button data-edit="${m.id}">Bearbeiten</button><button data-log="${m.id}">Verlauf</button></div>
  </div>`;
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

  $("grid").innerHTML = liste.map(karteHtml).join("");

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

// ---------- Reiter ----------
function initTabs(leiste) {
  const tabs = [...leiste.querySelectorAll(".tab")];
  const zeige = (panel) => {
    for (const tab of tabs) {
      const aktiv = tab.dataset.panel === panel;
      tab.classList.toggle("active", aktiv);
      $(tab.dataset.panel).hidden = !aktiv;
    }
  };
  for (const tab of tabs) tab.onclick = () => zeige(tab.dataset.panel);
  return zeige;
}

const zeigeFormTab = initTabs($("tabsForm"));
const zeigeEinstellungenTab = initTabs($("tabsEinstellungen"));
const ersterFormTab = () => zeigeFormTab("panPerson");
const ersterEinstellungenTab = () => zeigeEinstellungenTab("panKategorien");

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
  $("dokuHinweis").hidden = Boolean(m);
  if (!$("einsaetze").children.length) addEinsatzRow();
  ersterFormTab();
  $("dlg").showModal();
}

// Pflichtfelder auf einem geschlossenen Reiter wären sonst unsichtbar und der Dialog schiene zu klemmen.
form.addEventListener(
  "invalid",
  (e) => {
    const panel = e.target.closest(".felder");
    if (panel?.hidden) zeigeFormTab(panel.id);
  },
  true
);

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
  ["tab", "Reiter im Mitarbeiterformular"],
  ["karte", "Mitarbeiterkarte"],
  ["fristen", "Fristen"],
  ["nav", "Navigation"],
  ["firma", "Unternehmen-Seite"],
  ["anf", "Anforderungen"],
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
  ersterEinstellungenTab();
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

// ---------- Unternehmen & Disposition ----------
const navTabs = [...$("hauptnav").querySelectorAll(".tab")];
function zeigeView(view) {
  if (!navTabs.some((b) => b.dataset.view === view)) view = "viewMitarbeiter";
  for (const b of navTabs) {
    b.classList.toggle("active", b.dataset.view === view);
    $(b.dataset.view).hidden = b.dataset.view !== view;
  }
  localStorage.setItem("personalpool.view", view);
}
for (const b of navTabs) b.onclick = () => zeigeView(b.dataset.view);

const aktiveAnf = (firma) => (firma.anforderungen || []).filter((a) => !a.abgeschlossen);
const offenePlaetze = (a) => Math.max(0, a.anzahl - a.zugeordnet.length);
const nameVon = (id) => daten.find((m) => m.id === id)?.name || "?";

function einplanungen(mitarbeiterId) {
  return firmen.flatMap((firma) =>
    aktiveAnf(firma)
      .filter((a) => a.zugeordnet.includes(mitarbeiterId))
      .map((anf) => ({ firma, anf }))
  );
}

function zeitraumTage(a) {
  if (!a.von && !a.bis) return "";
  return `${a.von ? dtFormat(a.von) : "offen"} – ${a.bis ? dtFormat(a.bis) : "offen"}`;
}

function anfTags(a) {
  return [
    a.staplerschein && t("feld.staplerschein"),
    a.schichtbereit && t("feld.schichtbereit"),
    a.sprachen && `${t("feld.sprachen")}: ${a.sprachen}`,
    a.mobilitaet && `${t("feld.mobilitaet")}: ${a.mobilitaet}`,
  ]
    .filter(Boolean)
    .map((x) => `<span class="tag">${esc(x)}</span>`)
    .join("");
}

function anfHtml(firma, a) {
  const offen = offenePlaetze(a);
  const meta = [zeitraumTage(a), a.ort, a.schicht].filter(Boolean).join(" · ");
  const tags = anfTags(a);
  return `<div class="anf${offen ? "" : " voll"}${a.abgeschlossen ? " abg" : ""}">
    <div class="anf-kopf"><b>${esc(a.taetigkeit)}</b><span class="besetzt">${a.zugeordnet.length}/${a.anzahl} ${esc(t("firma.besetzt"))}</span></div>
    ${meta ? `<div class="logmeta">${esc(meta)}</div>` : ""}
    ${tags ? `<div class="tags">${tags}</div>` : ""}
    ${a.qualifikationen ? `<div class="logmeta">${esc(a.qualifikationen)}</div>` : ""}
    ${a.zugeordnet.length ? `<div class="anf-team">${esc(t("firma.eingeplant"))}: <b>${a.zugeordnet.map((id) => esc(nameVon(id))).join(", ")}</b></div>` : ""}
    <div class="actions">
      ${a.abgeschlossen ? "" : `<button class="primary" data-match="${firma.id}" data-aid="${a.id}">${esc(t("firma.passend"))}</button>`}
      <button data-anf-edit="${firma.id}" data-aid="${a.id}">${esc(t("firma.bearbeiten"))}</button>
    </div>
  </div>`;
}

function historieVon(firma) {
  const key = firma.name.trim().toLowerCase();
  return daten.flatMap((m) =>
    (m.einsaetze || []).filter((e) => (e.unternehmen || "").trim().toLowerCase() === key).map((e) => ({ m, e }))
  );
}

function firmaHtml(firma) {
  const aktiv = aktiveAnf(firma);
  const erledigt = (firma.anforderungen || []).filter((a) => a.abgeschlossen);
  const offen = aktiv.reduce((s, a) => s + offenePlaetze(a), 0);
  const unter = [firma.branche, firma.adresse].filter(Boolean).join(" · ");
  const kern = [
    [t("firma.ansprechpartner"), firma.ansprechpartner],
    [t("firma.kontakt"), firma.kontakt],
  ].filter(([, w]) => w);
  const historie = historieVon(firma);
  return `<div class="card firma${offen ? " hat-offen" : ""}">
    <div class="kopf">
      <div><h3>${esc(firma.name)}</h3>${unter ? `<div class="sub">${esc(unter)}</div>` : ""}</div>
      ${offen ? `<span class="badge offen">${offen} ${esc(t("firma.offen"))}</span>` : ""}
    </div>
    ${kern.length ? `<div class="kern">${kern.map(([l, w]) => `<span>${esc(l)}: <b>${esc(w)}</b></span>`).join("")}</div>` : ""}
    ${firma.notiz ? `<div class="logmeta" style="margin-top:8px">${esc(firma.notiz)}</div>` : ""}
    <div class="anf-liste">${aktiv.length ? aktiv.map((a) => anfHtml(firma, a)).join("") : `<div class="logmeta">${esc(t("firma.keineAnf"))}</div>`}</div>
    ${
      erledigt.length
        ? `<details class="mehr"><summary>${esc(t("firma.abgeschlossen"))} (${erledigt.length})</summary>${erledigt.map((a) => anfHtml(firma, a)).join("")}</details>`
        : ""
    }
    ${
      historie.length
        ? `<details class="mehr"><summary>${esc(t("firma.bisher"))} (${historie.length})</summary><ul class="historie">${historie
            .map(({ m, e }) => `<li><b>${esc(m.name)}</b>${[e.taetigkeit, zeitraumText(e), e.ergebnis].filter(Boolean).map((x) => ` · ${esc(x)}`).join("")}</li>`)
            .join("")}</ul></details>`
        : ""
    }
    <div class="actions">
      <button data-anf-neu="${firma.id}">${esc(t("firma.anfNeu"))}</button>
      <button data-firma-edit="${firma.id}">${esc(t("firma.bearbeiten"))}</button>
    </div>
  </div>`;
}

function renderFirmen() {
  const aktiv = firmen.flatMap(aktiveAnf);
  const offeneAnf = aktiv.filter((a) => offenePlaetze(a) > 0);
  const eingeplant = new Set(aktiv.flatMap((a) => a.zugeordnet));
  $("firmaStats").innerHTML = [
    [t("zahl.firmen"), firmen.length],
    [t("zahl.anfOffen"), offeneAnf.length],
    [t("zahl.plaetze"), aktiv.reduce((s, a) => s + offenePlaetze(a), 0)],
    [t("zahl.eingeplant"), eingeplant.size],
  ]
    .map(([l, w]) => `<div class="stat">${esc(l)}: <b>${w}</b></div>`)
    .join("");

  const q = $("firmaSuche").value.trim().toLowerCase();
  const nurOffen = $("firmaFilter").value === "offen";
  const liste = firmen.filter((f) => {
    if (nurOffen && !aktiveAnf(f).some((a) => offenePlaetze(a) > 0)) return false;
    if (!q) return true;
    return [f.name, f.branche, f.adresse, f.ansprechpartner, ...(f.anforderungen || []).flatMap((a) => [a.taetigkeit, a.ort, a.qualifikationen])]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  $("firmenGrid").innerHTML = liste.map(firmaHtml).join("");
  $("firmenLeer").hidden = liste.length > 0;
  $("firmenLeer").textContent = firmen.length ? t("firma.keinTreffer") : t("firma.leer");
}
$("firmaSuche").addEventListener("input", renderFirmen);
$("firmaFilter").addEventListener("change", renderFirmen);

$("firmenGrid").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.match) openMatch(b.dataset.match, b.dataset.aid);
  else if (b.dataset.anfEdit) openAnf(b.dataset.anfEdit, b.dataset.aid);
  else if (b.dataset.anfNeu) openAnf(b.dataset.anfNeu, null);
  else if (b.dataset.firmaEdit) openFirma(b.dataset.firmaEdit);
});

async function speichereFirma(firma) {
  const { company } = await api(`/api/companies/${firma.id}`, { method: "PUT", body: firma });
  firmen = firmen.map((f) => (f.id === company.id ? company : f));
  render();
  renderFirmen();
  return company;
}

// Unternehmen anlegen/bearbeiten
const firmaForm = $("firmaForm");
let firmaEditId = null;

function openFirma(id) {
  firmaEditId = id || null;
  firmaForm.reset();
  $("firmaError").textContent = "";
  const f = firmen.find((x) => x.id === id);
  $("firmaTitel").textContent = f ? t("titel.firmaBearbeiten") : t("titel.firmaNeu");
  $("btnFirmaLoeschen").hidden = !f || !istAdmin();
  if (f) for (const el of firmaForm.elements) if (el.name) el.value = f[el.name] ?? "";
  $("dlgFirma").showModal();
}

firmaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const felder = Object.fromEntries(new FormData(firmaForm).entries());
  try {
    if (firmaEditId) await speichereFirma({ ...firmen.find((f) => f.id === firmaEditId), ...felder });
    else {
      const { company } = await api("/api/companies", { method: "POST", body: { ...felder, anforderungen: [] } });
      firmen = [...firmen, company].sort((a, b) => a.name.localeCompare(b.name));
      renderFirmen();
    }
    $("dlgFirma").close();
  } catch (err) {
    $("firmaError").textContent = err.message;
  }
});
$("btnFirmaNeu").onclick = () => openFirma(null);
$("btnFirmaAbbrechen").onclick = () => $("dlgFirma").close();
$("btnFirmaLoeschen").onclick = async () => {
  const f = firmen.find((x) => x.id === firmaEditId);
  if (!f || !confirm(`„${f.name}" samt allen Anforderungen und Einplanungen löschen?`)) return;
  try {
    await api(`/api/companies/${f.id}`, { method: "DELETE" });
    $("dlgFirma").close();
    await reload();
  } catch (err) {
    $("firmaError").textContent = err.message;
  }
};

// Anforderung anlegen/bearbeiten
const anfForm = $("anfForm");
let anfCtx = null;

function openAnf(firmaId, aid) {
  const firma = firmen.find((f) => f.id === firmaId);
  if (!firma) return;
  const a = (firma.anforderungen || []).find((x) => x.id === aid);
  anfCtx = { firmaId, aid: a ? a.id : null };
  anfForm.reset();
  $("anfError").textContent = "";
  $("anfTitel").textContent = `${a ? t("titel.anfBearbeiten") : t("titel.anfNeu")} – ${firma.name}`;
  $("anfOrt").placeholder = firma.adresse || "PLZ / Ort";
  $("btnAnfLoeschen").hidden = !a;
  if (a) {
    for (const el of anfForm.elements) {
      if (!el.name) continue;
      if (el.type === "checkbox") el.checked = Boolean(a[el.name]);
      else el.value = a[el.name] ?? "";
    }
  }
  $("dlgAnf").showModal();
}

anfForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const firma = firmen.find((f) => f.id === anfCtx.firmaId);
  const felder = Object.fromEntries(new FormData(anfForm).entries());
  for (const k of ["staplerschein", "schichtbereit", "abgeschlossen"]) felder[k] = anfForm.elements[k].checked;
  const alt = (firma.anforderungen || []).find((a) => a.id === anfCtx.aid);
  const anf = { ...(alt || { zugeordnet: [] }), ...felder };
  const anforderungen = alt ? firma.anforderungen.map((a) => (a.id === alt.id ? anf : a)) : [...(firma.anforderungen || []), anf];
  try {
    await speichereFirma({ ...firma, anforderungen });
    $("dlgAnf").close();
  } catch (err) {
    $("anfError").textContent = err.message;
  }
});
$("btnAnfAbbrechen").onclick = () => $("dlgAnf").close();
$("btnAnfLoeschen").onclick = async () => {
  const firma = firmen.find((f) => f.id === anfCtx.firmaId);
  if (!firma || !confirm("Anforderung samt Einplanungen löschen?")) return;
  try {
    await speichereFirma({ ...firma, anforderungen: firma.anforderungen.filter((a) => a.id !== anfCtx.aid) });
    $("dlgAnf").close();
  } catch (err) {
    $("anfError").textContent = err.message;
  }
};

// Passende Mitarbeiter
let matchCtx = null;
const matchDaten = () => {
  const firma = firmen.find((f) => f.id === matchCtx?.firmaId);
  const anf = firma?.anforderungen?.find((a) => a.id === matchCtx.aid);
  return anf ? { firma, anf } : null;
};

function trefferHtml(k, { eingeplant = false, voll = false } = {}) {
  const kat = katOf(k.kategorie);
  const tags = [
    ...k.gruende.map((x) => `<span class="tag ok">${esc(x)}</span>`),
    ...k.maengel.map((x) => `<span class="tag warn">${esc(x)}</span>`),
    ...k.fehlt.map((x) => `<span class="tag fehlt">${esc(x)}</span>`),
  ].join("");
  const knopf = eingeplant
    ? `<button data-ausplanen="${k.id}">Ausplanen</button>`
    : `<button class="primary" data-einplanen="${k.id}"${voll ? " disabled title='Alle Plätze besetzt'" : ""}>Einplanen</button>`;
  return `<div class="treffer${k.passend ? "" : " eingeschraenkt"}">
    <div class="treffer-kopf">
      <div><b>${esc(k.name)}</b> <span class="badge kat-${kat.id}">${esc(kat.label)}</span></div>
      <div class="punkte" title="Übereinstimmung"><div class="balken"><span style="width:${k.punkte}%"></span></div><b>${k.punkte}</b></div>
    </div>
    ${tags ? `<div class="tags">${tags}</div>` : ""}
    <div class="actions">${knopf}<button data-profil="${k.id}">Profil</button></div>
  </div>`;
}

async function renderMatch() {
  const d = matchDaten();
  if (!d) return $("dlgMatch").close();
  const { firma, anf } = d;
  const voll = offenePlaetze(anf) === 0;
  $("matchTitel").textContent = `${t("titel.match")}: ${anf.taetigkeit} – ${firma.name}`;
  const meta = [zeitraumTage(anf), anf.ort || firma.adresse, anf.schicht].filter(Boolean).join(" · ");
  $("matchInfo").innerHTML = `<div class="logmeta">${esc(meta)}${meta ? " · " : ""}<b>${anf.zugeordnet.length}/${anf.anzahl} ${esc(
    t("firma.besetzt")
  )}</b></div><div class="tags">${anfTags(anf)}</div>`;
  $("btnKi").title = kiAktiv ? "" : "Die KI ist noch nicht eingerichtet.";
  $("matchError").textContent = "";
  try {
    const r = await api(`/api/companies/${firma.id}/anforderungen/${anf.id}/vorschlaege`);
    $("matchEingeplant").innerHTML = r.eingeplant.length
      ? `<h4>${esc(t("firma.eingeplant"))}</h4>${r.eingeplant.map((k) => trefferHtml(k, { eingeplant: true })).join("")}`
      : "";
    const passend = r.kandidaten.filter((k) => k.passend);
    const rest = r.kandidaten.filter((k) => !k.passend);
    $("matchListe").innerHTML =
      `<h4>Vorschläge (${passend.length} passend)</h4>` +
      (passend.length ? passend.map((k) => trefferHtml(k, { voll })).join("") : "<div class='logmeta'>Niemand erfüllt alle Pflichtangaben.</div>") +
      (rest.length
        ? `<details class="mehr"><summary>Mit fehlenden Pflichtangaben (${rest.length})</summary>${rest.map((k) => trefferHtml(k, { voll })).join("")}</details>`
        : "") +
      (r.ausgeschlossen ? `<div class="logmeta" style="margin-top:10px">${r.ausgeschlossen} Mitarbeiter aus „${esc(katOf("finger").label)}" nicht vorgeschlagen.</div>` : "");
  } catch (err) {
    $("matchError").textContent = err.message;
  }
}

function openMatch(firmaId, aid) {
  matchCtx = { firmaId, aid };
  $("kiErgebnis").innerHTML = "";
  $("kiStatus").textContent = "";
  $("matchEingeplant").innerHTML = "";
  $("matchListe").innerHTML = "Lädt …";
  $("dlgMatch").showModal();
  renderMatch();
}

async function setzeZuordnung(mitarbeiterId, einplanen) {
  const d = matchDaten();
  if (!d) return;
  const zugeordnet = einplanen ? [...d.anf.zugeordnet, mitarbeiterId] : d.anf.zugeordnet.filter((x) => x !== mitarbeiterId);
  try {
    await speichereFirma({ ...d.firma, anforderungen: d.firma.anforderungen.map((a) => (a.id === d.anf.id ? { ...a, zugeordnet } : a)) });
    aktualisiereKiKnoepfe();
    await renderMatch();
  } catch (err) {
    $("matchError").textContent = err.message;
  }
}

// Die KI-Liste wird nicht neu geladen – ihre Knöpfe müssen zur aktuellen Belegung passen.
function aktualisiereKiKnoepfe() {
  const d = matchDaten();
  if (!d) return;
  const voll = offenePlaetze(d.anf) === 0;
  for (const li of $("kiErgebnis").querySelectorAll("li[data-id]")) {
    const id = li.dataset.id;
    const slot = li.querySelector(".ki-aktion");
    if (!slot) continue;
    slot.innerHTML = d.anf.zugeordnet.includes(id)
      ? `<button data-ausplanen="${id}">Ausplanen</button>`
      : `<button class="primary" data-einplanen="${id}"${voll ? " disabled title='Alle Plätze besetzt'" : ""}>Einplanen</button>`;
  }
}

$("dlgMatch").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.einplanen) setzeZuordnung(b.dataset.einplanen, true);
  else if (b.dataset.ausplanen) setzeZuordnung(b.dataset.ausplanen, false);
  else if (b.dataset.profil) openDialog(b.dataset.profil);
});

$("btnKi").onclick = async () => {
  const d = matchDaten();
  if (!d) return;
  $("kiErgebnis").innerHTML = "";
  if (!kiAktiv) {
    $("kiStatus").textContent = "Die KI ist noch nicht eingerichtet (Administrator: KI_API_KEY in Render hinterlegen). Die Vorschläge unten sind regelbasiert.";
    return;
  }
  $("btnKi").disabled = true;
  $("kiStatus").textContent = "KI wertet die Kandidaten aus …";
  try {
    const r = await api(`/api/companies/${d.firma.id}/anforderungen/${d.anf.id}/ki`, { method: "POST" });
    $("kiStatus").textContent = `Empfehlung der KI (${r.modell}) – bitte selbst prüfen.`;
    $("kiErgebnis").innerHTML =
      (r.empfehlungen.length
        ? `<ol class="ki-liste">${r.empfehlungen
            .map(
              (e) => `<li data-id="${e.id}"><div class="treffer-kopf"><b>${esc(e.name)}</b><span class="actions" style="margin:0"><span class="ki-aktion"></span><button data-profil="${e.id}">Profil</button></span></div><div class="logmeta">${esc(e.begruendung)}</div></li>`
            )
            .join("")}</ol>`
        : "<div class='logmeta'>Die KI hat niemanden empfohlen.</div>") + (r.hinweis ? `<div class="logmeta" style="margin-top:6px"><b>Hinweis:</b> ${esc(r.hinweis)}</div>` : "");
    aktualisiereKiKnoepfe();
  } catch (err) {
    $("kiStatus").textContent = "";
    $("kiErgebnis").innerHTML = `<div class="error">${esc(err.message)}</div>`;
  } finally {
    $("btnKi").disabled = false;
  }
};
$("btnMatchClose").onclick = () => $("dlgMatch").close();

// ---------- Start ----------
async function reload() {
  const [ma, fi] = await Promise.all([api("/api/employees"), api("/api/companies")]);
  daten = ma.employees;
  firmen = fi.companies;
  kiAktiv = fi.kiAktiv;
  render();
  renderFirmen();
  if ($("dlgMatch").open) renderMatch();
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
  zeigeView(localStorage.getItem("personalpool.view") || "viewMitarbeiter");
  await reload();
}

start();
