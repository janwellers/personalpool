# Personalpool – Mitarbeiter-Kategorisierung

Web-App für die Personaldienstleistung: Mitarbeiter kategorisieren, Qualifikationen festhalten
und die Einsatzhistorie pro Unternehmen dokumentieren. Mehrere Kollegen arbeiten auf denselben Daten.

## Kategorien

1. Gute Mitarbeiter
2. Schlechte Mitarbeiter
3. Kann man nochmal gebrauchen
4. Finger von lassen!
5. Studenten

## Erfasste Merkmale

- **Wer:** Name, Kontakt, Nationalität, Wohnort, verfügbar ab
- **Kann:** Sprachen, Staplerschein, Mobilität, Schichtbereitschaft, Vorerfahrung/Qualifikationen
- **Hat gemacht:** Einsätze mit Unternehmen, Tätigkeit, Zeitraum und Ergebnis
- **Bewertung:** 1–5 Sterne, Wiedereinstellbarkeit, interne Notiz

Dazu: Filter nach Kategorie, Staplerschein und Mobilität, Volltextsuche und CSV-Export.

## Lokal starten

```bash
npm install
npm start        # http://localhost:3000, Passwort im Dev-Modus: "demo"
```

Ohne `DATABASE_URL` werden die Daten in `data/employees.json` abgelegt (nur für die Entwicklung).

## Betrieb

| Variable       | Bedeutung                                                       |
| -------------- | --------------------------------------------------------------- |
| `DATABASE_URL` | Postgres-Verbindung (Neon/Supabase). Tabelle wird automatisch angelegt. |
| `APP_PASSWORD` | Passwort für den Zugang. Ohne Wert ist die App in Produktion gesperrt. |
| `APP_SECRET`   | Schlüssel für das Session-Cookie.                                |
| `PORT`         | Port (Standard 3000).                                            |

Deployment auf Render ist über `render.yaml` vorbereitet.
