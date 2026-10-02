# Arhitectură

Site static (Vercel, fără build) + Google Apps Script cu Google Sheet ca backend.
Deciziile D1–D16 din docs/SPEC.md au prioritate față de orice de aici.

## 1. Fișiere

```
index.html            doar scheletul: containere goale + scripturile, în ordine
style.css             variabilele celor două teme, apoi componentele
site.config.js        TOT conținutul (window.SITE = {...}); singurul fișier editat per client
core.js               funcții pure: date, nopți, preț, suprapuneri, iCal, validare
                      (merge în browser, în Node și în Apps Script – același fișier)
app.js                randează pagina din config: secțiuni, limbă, ?curat, SEO, galerie, meniu, animații
booking.js            fluxul de rezervare: panou, calendar, cei 4 pași, rezumat, trimitere
img/                  pozele clientului, nume fixe (vezi config.images)
tests/core.test.js    teste pentru core.js:  node --test tests/
apps-script/Code.gs   backend-ul (+ Core.gs = copie a core.js, lipită în proiectul Apps Script)
apps-script/email-confirmare.html, email-gazda.html, email-revenire.html
vercel.json           doar antete (fără build)
README.md             pași pentru neprogramatori
```

Ordinea în index.html: `site.config.js` → `core.js` → `app.js` → `booking.js`, toate cu `defer`.
Fonturile Google se încarcă din app.js, după tema din config (două fonturi pe temă).

## 2. Schema site.config.js

Un text poate fi șir simplu (română) sau `{ ro: "...", hu: "...", en: "..." }` (D2).
`null` sau `""` = lipsește → placeholder galben `[ETICHETĂ]`; în modul `?curat` dispare,
iar o secțiune fără conținut dispare cu totul. Orice `[...]` dintr-un text e tot placeholder.

```js
window.SITE = {
  demo: true,                         // bandă „Machetă…” + noindex
  appsScriptUrl: "",                  // gol = MOD DEMO (D1)
  languages: ["ro"],                  // prima = implicită; butonul apare de la 2 limbi
  theme: "editorial",                 // "editorial" | "cald"
  accent: null,                       // ex. "#9a4b2c" suprascrie accentul temei
  schemaType: "LodgingBusiness",      // sau "Hotel"

  property: { name, kind, locality, county, address, classification,
              description, different },
  seo:      { title, description },
  topBar:   "Cel mai bun preț e aici, când rezervi direct",
  hero:     { label, title: ["trezește-te", "în liniștea", "dealurilor"], text, images: [ref, ref, ref] },
  contact:  { phone, whatsapp, email, mapsUrl, social: [{ label, url }] },

  booking: {
    currency: "lei",
    discountPercent: null,            // „Preț direct: -X% față de platforme”
    deposit: null,                    // text (D7)
    cancellation: null,               // text
    confirmHours: null,               // „Gazda confirmă în cel mult X ore”
    childFreeUnderAge: null,          // D6
    maxRooms: 3,
    demoBusy: [{ unit: "c1", inDays: 6, nights: 3 }]   // doar MOD DEMO, relativ la azi
  },

  // Tipuri de camere; units = camerele fizice (D3). O singură unitate în total → pasul 2 se sare.
  rooms: [{
    id: "dubla", name, description, units: ["c1", "c2"],
    capacity: 2, beds, size, amenities: [..],
    price: null,                      // pe noapte, pentru o unitate
    seasons: [{ name, from: "06-15", to: "09-15", price }],   // LL-ZZ, „to” inclusiv, poate trece peste an
    extraBed: { max: 0, price: null },
    minNights: 1,
    images: [ref]
  }],

  benefits:   [{ icon, text }],       // 3–5 rânduri sub hero
  facilities: [{ icon, text }],
  whyDirect:  [{ title, text }],
  experiences:{ title: [..], text, items: [{ name, text, distance }] },
  gallery:    { title: [..], images: [ref], video: ref|null, drone: ref|null },
  reviews:    { rating, count, source, url, items: [{ text, author, source }] },
  policies:   { checkIn, checkOut, cancellation, deposit, pets, children, smoking, quiet, payment },
  hours:      { reception, checkIn, checkOut, breakfast },
  faq:        [{ q, a }],
  legal:      { company, cui, regCom, privacyUrl, cookiesUrl, anpcUrl },
  ui:         { ... }                 // opțional: suprascrie textele de interfață din app.js
};
// ref = { file: "img/camera-1.webp", alt: "...", label: "FOTO: dormitorul de la etaj" }
//       file null → bloc neutru cu label
```

Textele de interfață (butoane, pași, mesaje de eroare) stau în app.js, în dicționarul `UI` pe
limbi; nu sunt conținut despre proprietate. Config-ul le poate suprascrie prin `ui`.

## 3. Contractul site ↔ Apps Script

Bază: `appsScriptUrl` (…/exec). Toate răspunsurile sunt JSON `{ ok: true, ... }` sau
`{ ok: false, error: "<cod>", message: "<text pentru oaspete>" }`.

| Cerere | Parametri | Răspuns |
|---|---|---|
| `GET ?action=availability` | `from`, `to` (AAAA-LL-ZZ, max. 400 zile), `room` opțional (D4) | `{ ok, from, to, busy: { "c1": ["2026-10-08", ...] } }` – nopțile ocupate |
| `GET ?action=ical` | `room`, `key` (D10) | `text/calendar` cu rezervările directe active |
| `GET ?action=confirm` / `decline` | `id`, `token` | pagină HTML cu buton (D11); butonul apelează `hostAction` |
| `POST` (corp JSON, `Content-Type: text/plain`) | vezi mai jos | `{ ok, id, status: "pending", expiresAt }` |

Corpul POST:
```json
{ "action": "book", "lang": "ro",
  "checkIn": "2026-10-10", "checkOut": "2026-10-13",
  "adults": 2, "children": [7],
  "rooms": [{ "type": "dubla", "qty": 1 }],
  "total": 1350, "currency": "lei",
  "guest": { "name": "", "email": "", "phone": "", "arrival": "16:00", "notes": "" },
  "consent": { "data": true, "offers": false },
  "website": "" }
```
Erori: `invalid` (+ `fields: [...]`), `unavailable` (+ `suggestions: [{checkIn, checkOut}]`),
`busy` (lock ocupat, „încearcă din nou”), `server`. Câmpul `website` completat = spam:
răspuns `ok` fals-pozitiv, nimic salvat.
Totalul vine de la site și e marcat „estimat”: gazda confirmă oricum manual și nu există plată
online (D7). Serverul recalculează doar nopțile.

## 4. Google Sheet

- **Rezervari**: id · creat · status (`asteptare` | `confirmata` | `refuzata` | `expirata`) ·
  checkIn · checkOut · unitati (ex. `c1,c2`) · tipuri · adulti · copii · nume · email · telefon ·
  oraSosire · cereri · total · moneda · limba · acordOferte · token · expiraLa · notaBooking ·
  revenireTrimisa
- **Blocari**: unitate · de la · până la (exclusiv) · uid · importat la
  (doar ce vine din iCal Booking.com; se rescrie la fiecare import)
- **Setari**: cheie | valoare (numeProprietate, emailGazda, siteUrl, oreExpirare, limba),
  apoi câte un rând per cameră: `camera` | id unitate | id tip | link iCal Booking | cheie .ics

O unitate e ocupată într-o noapte dacă există un rând în Blocari sau o rezervare
`asteptare` (neexpirată) ori `confirmata` care acoperă noaptea.

## 5. Fără overbooking, pas cu pas (doPost)

1. Validare (`Core.validateBooking`): câmpuri, date logice, minim de nopți, acord, anti-spam.
2. `LockService.getScriptLock().tryLock(20000)`; fără lock → `busy`.
3. Import iCal proaspăt doar pentru unitățile tipurilor cerute (timeout scurt).
   Dacă eșuează → folosește Blocari existente și notează „verifică pe Booking” (D9).
4. Citește Blocari + Rezervari active; pentru fiecare tip alege `qty` unități libere
   pe tot intervalul (`Core.isFree`).
5. Lipsă unități → răspuns `unavailable` cu `Core.suggestDates` (cele mai apropiate intervale
   de aceeași lungime, ±14 zile).
6. Scrie rândul `asteptare` cu token aleator și `expiraLa` → zilele sunt blocate imediat.
7. `SpreadsheetApp.flush()`, eliberează lock-ul, apoi trimite emailurile (oaspete + gazdă).

Declanșatorul la 15 minute (`laFiecare15Minute`): importă toate calendarele și marchează
`expirata` cererile trecute de `expiraLa`. Booking.com importă .ics-ul nostru la câteva
ore (D8): confirmarea gazdei acoperă fereastra.

## 6. Funcții pure (core.js)

`addDays`, `nightsBetween`, `eachNight`, `overlaps`, `busySet`, `isFree`, `priceStay`
(sezoane, pat suplimentar, copii gratuit sub prag, reducere), `suggestDates`, `parseICS`
(linii pliate, DATE și DATE-TIME, DTEND lipsă = o zi), `buildICS` (CRLF, pliere la 75),
`validateBooking`, `fillTemplate` ({{cheie}} cu escape HTML).
Datele sunt mereu text `AAAA-LL-ZZ`, calculate în UTC (D12).

## 7. Mod demo

`appsScriptUrl` gol: disponibilitatea vine din `booking.demoBusy` (relativ la azi),
trimiterea doar simulează, iar confirmarea are link-uri care deschid șabloanele de email
completate local (aceleași fișiere din apps-script/, cu `Core.fillTemplate`).
