# ROCKHARZ 2027 Band Planner

## Start

1. Entpacke das ZIP in einen eigenen Ordner.
2. Öffne `index.html` über einen lokalen Webserver. Zum Beispiel im Projektordner:
   `py -m http.server 5500`
3. Öffne `http://localhost:5500` im Browser.

Der Planner enthält 30 Bands, die Ansichten Line-up/Favoriten/unbewertet, Suche, Bewertungen mit lokaler Speicherung, Hörproben, Lautstärkeregelung und Druck-/PDF-Export.

Die Tagesfilter sind aktiv und reagieren auf Klicks. In den gelieferten Daten ist noch keine bestätigte Running Order enthalten; deshalb zeigt ein ausgewählter Tag vorerst einen klaren Hinweis statt erfundener Auftritte. Sobald bestätigte Tage vorliegen, können `day`-Werte in `bands.js` gesetzt werden (`wed`, `thu`, `fri`, `sat`).

Bandbilder und Hörproben werden – soweit verfügbar – von Wikipedia, iTunes und Deezer geladen und benötigen Internetzugang. Bewertungen und Lautstärke werden im Browser gespeichert.

## Camp-Sync absichern (Firebase)

Die Datenbank ist nur für Geräte offen, die einmal die Crew-Phrase eingegeben haben. Die Phrase steht nirgends im Code, sondern nur in der Datenbank unter `/crewSecret`, und dort kann sie niemand auslesen. Geprüft wird sie allein von den Regeln in `database.rules.json`.

Einrichtung in der [Firebase-Konsole](https://console.firebase.google.com), Projekt „rockharz-bands“:

1. **Authentication** → „Jetzt starten“ → Tab „Anmeldemethode“ → **Anonym** aktivieren.
2. **Realtime Database** → Tab „Daten“ → auf der obersten Ebene ein Feld `crewSecret` mit der Phrase als Text anlegen (mindestens 12 Zeichen, z. B. drei Wörter mit Bindestrichen).
3. **Realtime Database** → Tab „Regeln“ → den Inhalt von `database.rules.json` einfügen → „Veröffentlichen“.

Danach gibt jedes Gerät einmal die Phrase ein; die bisherigen Wertungen unter `/ratings` bleiben erhalten.

**Alle Geräte aussperren** (z. B. wenn die Phrase weitergegeben wurde): in der Konsole den Knoten `members` löschen und `crewSecret` ändern. Offene Apps sperren sofort, jedes Gerät fragt nach der neuen Phrase.

## Dateien

- `index.html`, `app.js`, `bands.js`, `crew-gate.js`
- `database.rules.json` (Firebase-Regeln, in der Konsole einfügen)
- `style.css`, `rockharz-theme.css`
- `assets/` inklusive neu erstellter Desktop- und Mobilbanner
- `TESTBERICHT.md`
