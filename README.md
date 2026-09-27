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

## Weitere Funktionen

- **Änderungsverlauf:** wer wann welches Feld geändert, angelegt oder gelöscht hat
- **Kundenansicht:** alle Einsätze nach Unternehmen gruppiert
- **Duplikatprüfung:** Warnung, wenn Name oder Kontakt schon vorhanden ist
- **Fristen:** Einsatzende, überfällig oder in den nächsten 30 Tagen
- **Dokumente:** Dateien pro Mitarbeiter (max. 8 MB), in der Datenbank gespeichert
- **DSGVO:** Auskunftsexport pro Person und Übersicht lange unveränderter Datensätze
- **Persönliche Zugänge:** Benutzerkonten mit Rollen statt eines gemeinsamen Passworts
- **Sicherung:** täglicher Export aller Daten in einen S3-kompatiblen Speicher, zusätzlich Download für Administratoren

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
| `APP_PASSWORD` | Gemeinsames Start-Passwort. Gilt nur, solange kein Benutzerkonto existiert. |
| `APP_SECRET`   | Optionaler Schlüssel für das Session-Cookie. Ohne Angabe erzeugt die App einmalig einen Zufallsschlüssel und speichert ihn. |
| `PORT`         | Port (Standard 3000).                                            |

Deployment auf Render ist über `render.yaml` vorbereitet.

## Automatische Sicherung

Sind die folgenden Variablen gesetzt, legt die App etwa einmal täglich eine komprimierte
JSON-Sicherung (Mitarbeiter, Verlauf, Dokumente, Benutzerliste ohne Passwörter) in einem
S3-kompatiblen Speicher ab – getestet mit Cloudflare R2 und Backblaze B2. Fehlen sie, läuft die
App normal weiter, es werden aber keine Sicherungen erzeugt; der manuelle Download bleibt möglich.

| Variable                | Bedeutung                                                       |
| ----------------------- | --------------------------------------------------------------- |
| `BACKUP_S3_ENDPOINT`    | Endpunkt des Speichers, z. B. `https://<konto>.r2.cloudflarestorage.com` |
| `BACKUP_S3_BUCKET`      | Name des Buckets.                                                |
| `BACKUP_S3_REGION`      | Region, Standard `auto` (R2). Bei AWS/Backblaze die echte Region. |
| `BACKUP_S3_KEY_ID`      | Zugriffsschlüssel-ID.                                            |
| `BACKUP_S3_SECRET`      | Geheimer Schlüssel.                                              |
| `BACKUP_S3_PREFIX`      | Ordner im Bucket, Standard `personalpool`.                       |
| `BACKUP_RETENTION_DAYS` | Aufbewahrung in Tagen, Standard 30. `0` schaltet das Aufräumen ab. |

Administratoren sehen den Stand unter **Sicherung**, können dort manuell sichern und eine Kopie
herunterladen.

## Persönliche Zugänge einrichten

Beim ersten Mal mit dem gemeinsamen Passwort anmelden (Benutzername leer lassen), dann oben
über **Benutzer** das eigene Konto als Administrator anlegen. Ab dem ersten Konto wird das
gemeinsame Passwort abgelehnt und jede Änderung läuft auf einen Namen.

Das erste Konto wird immer als Administrator angelegt, damit die Benutzerverwaltung erreichbar
bleibt. Endgültiges Löschen von Mitarbeitern ist Administratoren vorbehalten; dabei werden
Dokumente und Verlaufseinträge der Person mit entfernt.
