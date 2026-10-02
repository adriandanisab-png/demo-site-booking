# Workflow cu Claude Code + SuperClaude

Fiecare fază se termină cu un commit (git add . && git commit -m "..."), ca o greșeală
să coste un git reset, nu o regenerare. Specificația stă în docs/SPEC.md și comenzile o
citesc de acolo: nu o lipi în chat. Comenzile cu mai mulți agenți consumă mult, așa că
le rulezi o singură dată, pe template, nu la fiecare client.

Dacă o comandă SuperClaude se comportă altfel decât te aștepți, aceleași instrucțiuni
merg și scrise direct, fără comandă.

## Faza 1: verificarea specificației

/sc:analyze @requirements-analyst Citește docs/SPEC.md și CLAUDE.md. Fă o listă scurtă cu:
contradicții, cerințe neclare sau imposibil de făcut cu un site static plus Google Apps
Script, și riscuri legate de sincronizarea iCal cu Booking.com. Nu scrie cod. Propune
pentru fiecare problemă o decizie simplă, ca să o aprob.

După: notează deciziile la finalul docs/SPEC.md, în secțiunea „Decizii”. Commit.

## Faza 2: arhitectura

/sc:design @system-architect Pe baza docs/SPEC.md (inclusiv secțiunea Decizii), scrie
docs/ARCHITECTURE.md cu: structura de fișiere, schema completă a site.config.js cu
exemple, contractul dintre site și Apps Script (fiecare endpoint, parametri, răspuns
JSON, erori), modelul de date din Google Sheet și cum previi overbooking-ul pas cu pas.
Logica de suprapunere a datelor și parsarea iCal să fie funcții pure, într-un fișier
separat, ca să le pot testa local cu Node. Nu scrie încă codul aplicației.

După: citește arhitectura, mai ales schema config-ului (o vei edita de mână la fiecare
client). Commit.

## Faza 3: implementarea pe bucăți (commit după fiecare)

### 3a. Config, randare și stil
/sc:implement @frontend-architect Implementează conform docs/ARCHITECTURE.md:
site.config.js completat cu date demo marcate clar ca placeholdere, index.html, style.css
cu cele două teme (editorial și cald) din docs/SPEC.md, app.js care randează toate
secțiunile din config, modul ?curat și banda de demo. Fără fluxul de rezervare deocamdată.
Folosește skill-ul high-end-visual-design pentru aspect, respectând regulile din CLAUDE.md.

### 3b. Fluxul de rezervare în mod demo
/sc:implement @frontend-architect Implementează booking.js conform docs/SPEC.md și
docs/ARCHITECTURE.md: calendarul de interval construit de la zero, cei 4 pași, panoul
de rezumat, calculul cu sezoane și reducere, confirmarea cu numele oaspetelui. Doar în
MOD DEMO (appsScriptUrl gol): disponibilitate falsă din config, fără trimitere de date.
Mobile-first.

### 3c. Funcțiile pure și testele lor
/sc:implement @backend-architect Implementează fișierul de funcții pure din
docs/ARCHITECTURE.md: suprapunerea intervalelor de date, calculul nopților și al
prețului, parsarea iCal și generarea .ics. Scrie teste care rulează cu Node, fără
librării, inclusiv cazuri limită: check-out în aceeași zi cu check-in-ul altcuiva,
rezervări peste schimbarea de sezon, iCal cu evenimente pe mai multe zile.

### 3d. Backend-ul Apps Script
/sc:implement @backend-architect Implementează apps-script/Code.gs conform
docs/ARCHITECTURE.md, folosind funcțiile pure testate: setup(), availability, ical,
doPost cu LockService și reverificare de disponibilitate, confirmare/refuz cu token,
expirarea cererilor, importul iCal la 15 minute, trimiteRevenire(). Plus cele trei
șabloane de email HTML.

### 3e. Legarea site-ului de backend și README-ul
/sc:implement Leagă booking.js de Apps Script când appsScriptUrl e completat (POST cu
text/plain), cu mesaje clare de eroare și fallback. Scrie README.md pas cu pas pentru
un neprogramator, conform secțiunii README din docs/SPEC.md.

## Faza 4: testarea

/sc:test Rulează testele funcțiilor pure. Apoi verifică fluxul de rezervare în mod demo
pe ecran de telefon și de desktop: selecție de date, cameră indisponibilă, sugestie de
alte date, buton înapoi fără pierdere de date, confirmare cu numele oaspetelui, modul
?curat. Raportează ce nu merge, nu repara încă.

Dacă ai Playwright instalat, cere explicit ca verificarea în browser să se facă cu el.
Reparațiile le ceri apoi țintit, cu fișierul și problema.

Testul de overbooking cu Booking.com se face MANUAL, după pașii din README.md, înainte
de a preda site-ul unui client real.

## Faza 5: verificarea finală

/sc:analyze Verifică proiectul cu skill-ul web-design-guidelines și raportează
problemele de accesibilitate, contrast, performanță (mărimea pozelor, lazy loading)
și securitate în Code.gs (validare, token-uri, date personale). Prioritizează.

După: repari doar ce e important, commit, publici pe Vercel, testezi pe telefon cu ?curat.

## Pentru fiecare client nou
Nu mai rulezi comenzile de mai sus. Copiezi proiectul, completezi site.config.js, pui
pozele în /img și faci setup-ul Google din README.md.

## Sfaturi de economisire a creditelor
- Modificările de conținut (prețuri, texte, camere, poze) le faci de mână în
  site.config.js, fără AI.
- Când ai nevoie de AI, grupează mai multe modificări într-un mesaj și numește exact
  fișierul și secțiunea.
- /sc:pm și /sc:brainstorm sunt lăsate deoparte intenționat: specificația e deja făcută.
