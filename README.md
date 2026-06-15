# Golf Tracker

Eine kleine Progressive Web App (PWA), um Golf-Ausgaben (einmalig & wiederkehrend) und
Rundenresultate (Brutto/Netto) zu erfassen – nutzbar auf Handy und Laptop, mit
Synchronisation über ein kostenloses Firebase-Projekt (kein eigener Server nötig).

## Funktionen

- Ausgaben erfassen: Greenfee, Mitgliedschaft, Driving Range, Golf Pro Stunde, Ausrüstung, Bälle & Zubehör, Kleidung, Reise, Sonstiges
- Unterscheidung einmalig / monatlich / jährlich wiederkehrend
- Übersicht/Dashboard: Ausgaben aktuelles Jahr & aktueller Monat, aktuelles Handicap, letzte 5 Runden
- Runden erfassen: Club, Datum, Anzahl Löcher, Brutto- und Netto-Resultat
- Scorecard als Foto oder PDF hochladen, automatische Texterkennung (OCR) als Ausfüllhilfe
- Statistiken nach Kalenderjahr mit Jahres-/Monatsfilter (Ausgaben nach Kategorie, pro Monat, Score-Verlauf)
- Budgetziele mit Fortschrittsanzeige, Handicap-Eingabe
- Installierbar als App (Add to Home Screen) auf iOS/Android und Desktop, mit Offline-Caching

## 1. Firebase-Projekt einrichten (einmalig, ca. 10 Minuten)

Firebase ist Googles "Backend-as-a-Service" – du brauchst keinen eigenen Server, der
kostenlose "Spark"-Tarif reicht für privaten Gebrauch problemlos aus.

1. Gehe auf https://console.firebase.google.com und melde dich mit deinem Google-Konto an.
2. **Projekt erstellen** → einen Namen vergeben (z.B. "golf-tracker") → Google Analytics kannst du deaktivieren.
3. Im Projekt links auf **Build → Authentication** → "Get started" → Anbieter **Google** aktivieren.
4. Links auf **Build → Firestore Database** → "Datenbank erstellen" → Modus **Produktion** → Standort wählen (z.B. `eur3 (europe-west)`).
5. Links auf **Build → Storage** → "Los geht's" → gleicher Standort wie Firestore.
6. Zurück auf die **Projektübersicht** (Symbol oben links) → "</> Web-App hinzufügen" → Namen vergeben (z.B. "golf-tracker-web") → **Hosting nicht nötig**.
7. Du erhältst ein Code-Snippet mit `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`. Diese Werte brauchst du im nächsten Schritt.

### Sicherheitsregeln setzen

Damit jede:r Nutzer:in nur die eigenen Daten lesen/schreiben kann:

**Firestore** (Build → Firestore Database → Regeln):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Storage** (Build → Storage → Regeln):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Jeweils auf "Veröffentlichen" klicken.

## 2. Konfiguration eintragen

Öffne [js/firebase-config.js](js/firebase-config.js) und ersetze die Platzhalter mit den
Werten aus deinem Firebase-Web-App-Snippet:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 3. Lokal testen

Da die App ohne Build-Tool läuft, reicht ein einfacher lokaler Webserver (Browser
blockieren ES-Module und Kamera-Zugriff bei `file://`):

```bash
cd golf-tracker
python3 -m http.server 8080
```

Dann im Browser `http://localhost:8080` öffnen.

> Hinweis: In der Firebase-Konsole unter Authentication → Settings → "Authorized domains"
> ist `localhost` standardmässig bereits erlaubt.

## 4. Veröffentlichen, damit Handy & Laptop zugreifen können

Am einfachsten über **GitHub Pages** (kostenlos, HTTPS, kein eigener Server):

1. Erstelle ein (privates oder öffentliches) GitHub-Repository und lade den Inhalt
   dieses Ordners hoch (z.B. via `git init`, `git add .`, `git commit`, `git push`).
2. Im Repo: **Settings → Pages** → unter "Source" den Branch (z.B. `main`) und Ordner `/ (root)` wählen → Speichern.
3. Nach ein bis zwei Minuten ist die App unter `https://<dein-username>.github.io/<repo-name>/` erreichbar.
4. Diese URL in der Firebase-Konsole unter **Authentication → Settings → Authorized domains** hinzufügen (sonst funktioniert der Google-Login nicht).
5. Die URL auf Handy und Laptop öffnen, einloggen, und über das Browser-Menü
   "Zum Startbildschirm hinzufügen" / "App installieren" auswählen.

Da alle Daten in Firebase liegen, sind sie auf beiden Geräten automatisch synchron,
sobald du dich mit demselben Google-Konto anmeldest.

## 5. Hinweise zur Texterkennung (OCR)

Beim Hochladen eines Fotos oder PDFs der Scorecard versucht die App, Datum und
Golfclub-Namen automatisch zu erkennen (mit Tesseract.js, läuft komplett im Browser,
keine Daten werden an Dritte gesendet). Die Erkennung ist ein Hilfsmittel – bitte
Datum, Club, Brutto- und Netto-Resultat vor dem Speichern immer prüfen, da OCR
insbesondere bei handschriftlichen Scorekarten nicht immer korrekt ist.

## 6. Kosten

Der Firebase "Spark"-Tarif ist dauerhaft kostenlos und beinhaltet u.a.:
- Firestore: 1 GiB Speicher, 50'000 Lesevorgänge/Tag
- Storage: 5 GB Speicher
- Authentication: unbegrenzt

Für den privaten Gebrauch (eine Person, ein paar hundert Einträge/Jahr) wird dieses
Kontingent nicht annähernd ausgeschöpft.
