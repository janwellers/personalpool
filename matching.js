// Disposition: regelbasierte Vorschläge passender Mitarbeiter je Anforderung und optionale KI-Empfehlung.
// Nationalität fließt bewusst nicht ein – Auswahl nur nach fachlicher Eignung, Verfügbarkeit und Nähe.

const KATEGORIE_GEWICHT = { gut: 12, nochmal: 6, student: 0, schlecht: -15 };
const AUSGESCHLOSSEN = new Set(["finger"]);
const NEGATIV = /(nicht|kein|abgebroch|schlecht|gekuendigt|gekündigt|abgemahnt|ungeeignet|unzuverl|nie wieder|gesperrt|fristlos|unpuenktl|unpünktl)/i;
const STOPP = new Set(["und", "oder", "der", "die", "das", "mit", "fuer", "von", "bei", "auf", "eine", "einer", "als", "nach", "sowie", "gute", "guter", "gutes", "sehr", "jahre", "jahr", "mind", "mindestens", "bereitschaft", "kenntnisse", "erfahrung", "erfahrungen", "wuenschenswert", "zwingend", "idealerweise"]);

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stamm = (wort) => norm(wort).slice(0, 7);

// Stichwort-Stamm → lesbares Originalwort; der Stamm fängt Endungen wie -ung/-er ab.
function stichworte(text) {
  const map = new Map();
  for (const wort of String(text || "").toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const n = norm(wort);
    if (n.length < 4 || STOPP.has(n) || /^\d+$/.test(n)) continue;
    if (!map.has(stamm(n))) map.set(stamm(n), wort);
  }
  return map;
}

const heuteIso = () => new Date().toISOString().slice(0, 10);
const datumDe = (iso) => (iso ? iso.split("-").reverse().join(".") : "");

function naehe(ort, wohnort) {
  if (!ort || !wohnort) return "";
  const plz = (s) => (String(s).match(/\b\d{5}\b/) || [])[0];
  const [a, b] = [plz(ort), plz(wohnort)];
  if (a && b && a === b) return "gleiche PLZ";
  if (a && b && a.slice(0, 2) === b.slice(0, 2)) return "gleiche PLZ-Region";
  const orte = (s) => norm(s).split(" ").filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  const ziel = new Set(orte(ort));
  const treffer = orte(wohnort).find((w) => ziel.has(w));
  return treffer ? `wohnt in ${wohnort}` : "";
}

const gleicheFirma = (x, y) => {
  const [a, b] = [norm(x), norm(y)];
  if (!a || !b) return false;
  return a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a)));
};

const ueberschneidet = (a, b) => {
  const startA = a.von || heuteIso();
  const startB = b.von || heuteIso();
  return (!b.bis || b.bis >= startA) && (!a.bis || startB <= a.bis);
};

function bewerte({ firma, anf, m, kategorien, belegungen }) {
  const gruende = [];
  const maengel = [];
  const fehlt = [];
  let punkte = 50;
  const plus = (n, text) => {
    punkte += n;
    if (text) (n >= 0 ? gruende : maengel).push(text);
  };

  const kat = kategorien.find((k) => k.id === m.kategorie);
  const gewicht = KATEGORIE_GEWICHT[m.kategorie] ?? 0;
  if (gewicht) plus(gewicht, kat?.label || m.kategorie);

  if (m.bewertung) plus((Number(m.bewertung) - 3) * 5, `${m.bewertung} von 5 Sternen`);
  if (m.wiedereinstellbar) plus(3, "wiedereinstellbar");

  if (anf.staplerschein) {
    if (m.staplerschein) plus(8, "Staplerschein");
    else fehlt.push("kein Staplerschein");
  }
  if (anf.schichtbereit) {
    if (m.schichtbereit) plus(6, "schichtbereit");
    else fehlt.push("nicht schichtbereit");
  }

  const gesprochen = norm(m.sprachen);
  for (const sprache of String(anf.sprachen || "").split(/[,;/]|\bund\b/)) {
    const name = sprache.trim().split(/\s+/)[0];
    if (!name) continue;
    if (gesprochen.split(" ").some((w) => w.startsWith(stamm(name).slice(0, 5)))) plus(4, `spricht ${name}`);
    else fehlt.push(`kein ${name}`);
  }

  if (anf.mobilitaet) {
    if (m.mobilitaet === anf.mobilitaet) plus(6, m.mobilitaet);
    else fehlt.push(m.mobilitaet ? `Mobilität: ${m.mobilitaet} statt ${anf.mobilitaet}` : `Mobilität unbekannt (${anf.mobilitaet} nötig)`);
  }

  const nah = naehe(anf.ort || firma.adresse, m.wohnort);
  if (nah) plus(10, nah);

  const gesucht = stichworte(`${anf.taetigkeit} ${anf.qualifikationen}`);
  const kann = stichworte(`${m.vorerfahrung} ${(m.einsaetze || []).map((e) => e.taetigkeit).join(" ")}`);
  const treffer = [...gesucht].filter(([s]) => kann.has(s)).map(([, wort]) => wort);
  if (treffer.length) plus(Math.min(20, treffer.length * 5), `Erfahrung: ${treffer.slice(0, 4).join(", ")}`);

  for (const e of (m.einsaetze || []).filter((e) => gleicheFirma(e.unternehmen, firma.name))) {
    if (e.ergebnis && NEGATIV.test(e.ergebnis)) plus(-25, `bei ${firma.name}: ${e.ergebnis}`);
    else plus(12, `war schon bei ${firma.name}${e.ergebnis ? ` (${e.ergebnis})` : ""}`);
  }

  const start = anf.von || heuteIso();
  if (m.verfuegbar && m.verfuegbar > start) fehlt.push(`verfügbar erst ab ${datumDe(m.verfuegbar)}`);
  if (m.einsatzEnde && m.einsatzEnde >= heuteIso() && m.einsatzEnde >= start) {
    fehlt.push(`noch im Einsatz bis ${datumDe(m.einsatzEnde)}`);
  }
  for (const b of belegungen.get(m.id) || []) {
    if (b.anf.id !== anf.id && ueberschneidet(anf, b.anf)) fehlt.push(`eingeplant: ${b.firma} – ${b.anf.taetigkeit}`);
  }

  punkte -= fehlt.length * 30;
  return {
    id: m.id,
    name: m.name,
    kategorie: m.kategorie,
    punkte: Math.max(0, Math.min(100, Math.round(punkte))),
    passend: fehlt.length === 0,
    gruende,
    maengel,
    fehlt,
  };
}

export function vorschlaege({ firma, anf, mitarbeiter, firmen, kategorien }) {
  const belegungen = new Map();
  for (const c of firmen) {
    for (const a of c.anforderungen || []) {
      if (a.abgeschlossen) continue;
      for (const mid of a.zugeordnet || []) {
        if (!belegungen.has(mid)) belegungen.set(mid, []);
        belegungen.get(mid).push({ firma: c.name, anf: a });
      }
    }
  }
  const eingeplantIds = new Set(anf.zugeordnet || []);
  const bewertet = mitarbeiter.map((m) => bewerte({ firma, anf, m, kategorien, belegungen }));
  const sortiert = (liste) => liste.sort((a, b) => b.passend - a.passend || b.punkte - a.punkte || a.name.localeCompare(b.name));
  return {
    eingeplant: sortiert(bewertet.filter((k) => eingeplantIds.has(k.id))),
    kandidaten: sortiert(bewertet.filter((k) => !eingeplantIds.has(k.id) && !AUSGESCHLOSSEN.has(k.kategorie))),
    ausgeschlossen: bewertet.filter((k) => !eingeplantIds.has(k.id) && AUSGESCHLOSSEN.has(k.kategorie)).length,
  };
}

// ---------- KI ----------
// OpenAI-kompatibler Chat-Endpunkt; ohne Schlüssel bleibt es bei den regelbasierten Vorschlägen.
const kiSchluessel = () => process.env.KI_API_KEY || process.env.OPENAI_API_KEY || "";
const kiUrl = () => process.env.KI_API_URL || "https://api.openai.com/v1/chat/completions";
const kiModell = () => process.env.KI_MODEL || "gpt-4o-mini";
export const kiAktiv = () => Boolean(kiSchluessel());

const MAX_KI_KANDIDATEN = 12;

const fehler = (status, text) => Object.assign(new Error(text), { status });

// Namen, Kontaktdaten, Notizen und Nationalität verlassen die App nicht; die KI sieht nur Kürzel.
function kiProfil(ref, k, m, kategorien) {
  return {
    ref,
    kategorie: kategorien.find((x) => x.id === m.kategorie)?.label || m.kategorie,
    bewertung: m.bewertung || null,
    sprachen: m.sprachen,
    wohnort: m.wohnort,
    mobilitaet: m.mobilitaet,
    staplerschein: m.staplerschein,
    schichtbereit: m.schichtbereit,
    verfuegbarAb: m.verfuegbar || null,
    aktuellerEinsatzEndet: m.einsatzEnde || null,
    vorerfahrung: m.vorerfahrung,
    einsaetze: (m.einsaetze || []).map((e) => ({
      unternehmen: e.unternehmen,
      taetigkeit: e.taetigkeit,
      zeitraum: e.von || e.bis ? `${e.von || "?"} bis ${e.bis || "heute"}` : e.zeitraum,
      ergebnis: e.ergebnis,
    })),
    regelPunkte: k.punkte,
    fehlendeMussKriterien: k.fehlt,
  };
}

export async function kiEmpfehlung({ firma, anf, kandidaten, mitarbeiter, kategorien }) {
  if (!kiAktiv()) throw fehler(503, "Die KI ist nicht eingerichtet. Ein Administrator muss dafür KI_API_KEY hinterlegen.");
  const auswahl = kandidaten.slice(0, MAX_KI_KANDIDATEN);
  if (!auswahl.length) return { empfehlungen: [], hinweis: "Keine Kandidaten vorhanden.", modell: kiModell() };
  const nachId = new Map(mitarbeiter.map((m) => [m.id, m]));
  const refs = new Map(auswahl.map((k, i) => [`K${i + 1}`, k]));
  const profile = [...refs].map(([ref, k]) => kiProfil(ref, k, nachId.get(k.id), kategorien));
  const offen = Math.max(0, anf.anzahl - (anf.zugeordnet || []).length);

  const anfrage = {
    unternehmen: firma.name,
    branche: firma.branche,
    einsatzort: anf.ort || firma.adresse,
    taetigkeit: anf.taetigkeit,
    offenePlaetze: offen,
    zeitraum: { von: anf.von || null, bis: anf.bis || null },
    schicht: anf.schicht,
    staplerscheinNoetig: anf.staplerschein,
    schichtbereitschaftNoetig: anf.schichtbereit,
    sprachen: anf.sprachen,
    mobilitaet: anf.mobilitaet,
    anforderungen: anf.qualifikationen,
  };

  let res;
  try {
    res = await fetch(kiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${kiSchluessel()}` },
      body: JSON.stringify({
        model: kiModell(),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Du bist erfahrener Disponent in einer Personaldienstleistung. Wähle aus den Kandidaten die geeignetsten für die Anforderung aus. " +
              "Bewerte ausschließlich fachliche Eignung, Erfahrung, Verfügbarkeit, frühere Einsätze beim Kunden, Bewertung und Erreichbarkeit des Einsatzorts. " +
              "Herkunft, Nationalität, Geschlecht und Alter spielen keine Rolle. Fehlende Muss-Kriterien sind ein starkes Gegenargument. " +
              'Antworte nur mit JSON der Form {"empfehlungen":[{"ref":"K1","begruendung":"..."}],"hinweis":"..."}: ' +
              "höchstens 5 Empfehlungen, beste zuerst, Begründung je höchstens zwei kurze Sätze auf Deutsch; " +
              '"hinweis" ist ein Satz zur Gesamtlage (z. B. Engpässe), sonst leer.',
          },
          { role: "user", content: JSON.stringify({ anforderung: anfrage, kandidaten: profile }) },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw fehler(502, "Die KI ist gerade nicht erreichbar. Bitte später erneut versuchen.");
  }
  if (!res.ok) throw fehler(502, `Die KI hat mit Fehler ${res.status} geantwortet.`);

  let antwort;
  try {
    const daten = await res.json();
    antwort = JSON.parse(daten.choices?.[0]?.message?.content || "{}");
  } catch {
    throw fehler(502, "Die Antwort der KI war nicht lesbar.");
  }
  const empfehlungen = (Array.isArray(antwort.empfehlungen) ? antwort.empfehlungen : [])
    .filter((e) => refs.has(String(e?.ref)))
    .slice(0, 5)
    .map((e) => {
      const k = refs.get(String(e.ref));
      return { id: k.id, name: k.name, punkte: k.punkte, begruendung: String(e.begruendung || "").slice(0, 600) };
    });
  return { empfehlungen, hinweis: String(antwort.hinweis || "").slice(0, 400), modell: kiModell() };
}
