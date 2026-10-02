# Specificație: template site pensiune cu rezervare directă

Ești un web developer și copywriter cu experiență în site-uri pentru pensiuni și hoteluri mici
din România. Construiește un TEMPLATE REFOLOSIBIL de site cu rezervare directă pentru o
pensiune sau un hotel mic de 8–10 camere. Prima instanță e o MACHETĂ DEMONSTRATIVĂ pe care
o arătăm proprietarului la o întâlnire.

## OBIECTIVUL PRINCIPAL: TEMPLATE IEFTIN DE MODIFICAT ȘI UȘOR DE INTEGRAT
- Tot conținutul stă într-un singur fișier: site.config.js (obiect JavaScript bine comentat,
  în română): nume, contact, camere, prețuri, facilități, politici, texte, traduceri,
  recenzii, căile pozelor, tema vizuală, plus setările de integrare de mai jos. Niciun text
  de conținut scris direct în HTML.
- Un client nou = copiez proiectul, completez site.config.js, înlocuiesc pozele din /img,
  fac setup-ul Google în pașii din README. Zero modificări de cod.
- Lista de camere din config: site-ul se adaptează singur la orice număr de camere.
- Site static: HTML, CSS și JavaScript simplu, fără framework, fără pas de build,
  fără librării externe. Se publică direct pe Vercel.
- Cod scurt, curat, comentat. Fără funcții pe care nu le cer.

## FIȘIERE
- index.html, style.css, app.js, booking.js (tot fluxul de rezervare), site.config.js
- apps-script/Code.gs: backend-ul în Google Apps Script
- apps-script/email-confirmare.html, apps-script/email-gazda.html,
  apps-script/email-revenire.html: șabloanele de email
- README.md în română (vezi la final)
- /img cu nume fixe documentate în config; unde lipsește o poză, un bloc neutru „[FOTO: ...]”

## BACKEND: GOOGLE APPS SCRIPT + GOOGLE SHEET (în contul Google al proprietarului)
Code.gs, publicat ca Web App, face următoarele:
1. setup(): o funcție rulată o singură dată care creează în Google Sheet foile:
   Rezervari, Blocari, Setari (cu URL-urile iCal ale camerelor).
2. doGet?action=availability&room=ID&from=...&to=...: întoarce JSON cu zilele ocupate
   pentru fiecare cameră, combinând rezervările directe confirmate sau în așteptare și
   zilele ocupate citite din calendarele iCal Booking.com.
3. doGet?action=ical&room=ID: întoarce un fișier .ics cu rezervările directe ale camerei,
   ca Booking.com să le poată importa și să blocheze acele zile.
4. Un declanșator la fiecare 15 minute care citește calendarele iCal exportate din
   Booking.com (UrlFetchApp), le parsează și salvează zilele ocupate în foaia Blocari.
5. doPost: primește cererea de rezervare și:
   - validează datele (câmpuri obligatorii, date logice, câmp ascuns anti-spam);
   - folosește LockService și verifică DIN NOU disponibilitatea, inclusiv un import iCal
     proaspăt pentru camera respectivă, ca două cereri simultane sau o rezervare nouă
     de pe Booking să nu ducă la overbooking;
   - dacă e liber: salvează rezervarea cu status „în așteptare”, blochează imediat zilele,
     trimite email de confirmare a cererii către oaspete și email de notificare către
     gazdă, cu link-uri „Confirm” și „Refuz”;
   - dacă nu e liber: răspunde cu un mesaj clar și sugerează alte camere sau date libere.
6. doGet?action=confirm|decline&id=...&token=...: gazda confirmă sau refuză din email;
   oaspetele primește automat emailul corespunzător; un refuz eliberează zilele.
   Token unic per rezervare, ca link-urile să nu poată fi ghicite.
7. O cerere neconfirmată în X ore (setabil) expiră automat și eliberează zilele.
8. Emailurile se trimit cu MailApp din contul proprietarului, în format HTML, din
   șabloanele din apps-script/. Numele expeditorului = numele pensiunii.
9. O funcție trimiteRevenire() pe care gazda o poate rula: trimite email-revenire doar
   oaspeților din sezonul trecut care au bifat acordul pentru mesaje viitoare.

Front-end-ul trimite datele către Web App ca POST cu Content-Type text/plain (corpul JSON),
ca să evite problemele de CORS. Dacă appsScriptUrl din config e gol, site-ul rulează în
MOD DEMO: disponibilitate falsă din config, fără trimitere de date, cu exemple de email
deschise local.

## FLUXUL DE REZERVARE: CA PE MARILE PLATFORME, DAR CU DESIGNUL NOSTRU
Copiază fluxul și claritatea platformelor mari de rezervări, NU designul, logo-ul, culorile
sau textele lor.

Pasul 1 — Caută:
- calendar de selectare a intervalului check-in/check-out construit de noi (fără librării),
  două luni afișate pe desktop, una pe mobil; zilele trecute și cele complet ocupate apar
  tăiate; selecția intervalului vizibilă; minimul de nopți respectat;
- număr adulți, copii (cu vârste), camere.

Pasul 2 — Alege camera:
- doar tipurile de camere disponibile pe tot intervalul, fiecare cu poze, capacitate,
  paturi, facilități, prețul total al sejurului (nu doar pe noapte), politica de anulare
  și avans afișate clar sub preț;
- eticheta „Preț direct: -X% față de platforme”, dacă reducerea e setată;
- dacă sunt mai multe camere de același tip, selector de cantitate;
- dacă nimic nu e liber, sugerează cele mai apropiate date libere.

Pasul 3 — Detaliile tale:
- nume, email, telefon, ora estimată de sosire, cereri speciale;
- bifă obligatorie pentru prelucrarea datelor, bifă separată opțională pentru oferte viitoare.

Pasul 4 — Confirmare:
- mesaj clar: „Cererea ta a fost trimisă. Gazda o confirmă în cel mult X ore.”, cu numele
  oaspetelui (verifică să nu apară gol), datele, camera, totalul și pașii următori.

Pe tot parcursul: un panou de rezumat (date, nopți, cameră, total, reducere) fix în lateral
pe desktop și ca bară jos pe mobil; indicator de pași (1 Caută · 2 Camera · 3 Detalii ·
4 Confirmare); buton înapoi care nu pierde datele introduse.

## REGULI STRICTE
- Nu inventa nimic: fără recenzii, stele, facilități, distanțe sau prețuri care nu sunt
  în config. Unde lipsește o informație, site-ul afișează un placeholder între paranteze
  drepte.
- Mod prezentare: cu ?curat în URL, ascunde placeholderele și secțiunile goale.
- Texte în română cu diacritice, ton cald, fără clișee. Mobile-first.
- Bandă discretă „Machetă demonstrativă pentru [NUME]” și <meta name="robots"
  content="noindex"> cât timp demo: true în config.
- Limbi: română, plus maghiară și engleză dacă sunt în config; buton de schimbare a limbii;
  emailurile se trimit în limba aleasă de oaspete.

## STIL VIZUAL
Referință de stil: site-ul https://www.vanderhotel.com (un design hotel din Ljubljana).
Inspiră-te din DIRECȚIA lui, nu copia nimic: fără textele, logo-ul, grafica, jocurile de
cuvinte sau alte elemente de brand ale lui. Dacă nu poți accesa site-ul, urmează descrierea
de mai jos.

Direcția: editorială, minimalistă, de „boutique hotel”. Mult spațiu liber, fotografia e
protagonista, textul e puțin și bine scris.

Teme
- În config există theme: "editorial" sau "cald".
  "editorial" = stilul descris mai jos, pentru proprietăți moderne;
  "cald" = aceeași structură și aceleași componente, dar cu paletă caldă (lemn, crem,
  verde închis), colțuri ușor rotunjite și un serif mai prietenos, pentru pensiuni
  rustice și de munte.
- Toate culorile, fonturile, spațierile și razele colțurilor sunt variabile CSS, definite
  per temă la începutul style.css. O culoare de accent se poate suprascrie din config.

Tipografie
- Titlurile de secțiune: foarte mari, scrise cu litere mici, rupte intenționat pe 2–3 rânduri
  (ex: „trezește-te / în liniștea / dealurilor”), cu un serif elegant cu contrast mare.
- Textul: un sans-serif simplu și foarte lizibil, 17–18 px pe mobil, rânduri aerisite.
- Etichete mici, cu majuscule și spațiere între litere, deasupra titlurilor (ex: „CAMERE”).
- Maximum două fonturi, încărcate din Google Fonts, cu font-display: swap și fonturi de
  rezervă din sistem; ambele trebuie să aibă diacriticele românești ș, ț, ă, â, î.

Structură și compoziție
- Secțiunile principale numerotate 01, 02, 03 (Camere, Experiențe / Împrejurimi, Rezervare
  directă), cu numărul mare și discret lângă titlu.
- Hero: un colaj asimetric de 3–4 fotografii (nu slider), cu titlul mare alături sau
  deasupra; pe mobil, o fotografie mare și titlul sub ea.
- Alternanță text–imagine de la o secțiune la alta, cu imagini mari, uneori de la margine
  la margine.
- Beneficii scurte ca listă de 3–5 rânduri cu iconițe liniare subțiri
  (ex: „Mic dejun inclus”, „Parcare privată”, „Check-in flexibil”), doar din config.
- O bandă subțire în partea de sus cu mesajul de rezervare directă din config
  (ex: „Cel mai bun preț e aici, când rezervi direct”).
- Header minimal: logo sau nume în stânga, 4–5 link-uri, buton „Rezervă” evidențiat,
  care rămâne vizibil la scroll. Pe mobil, meniul se deschide pe tot ecranul, iar butonul
  „Rezervă” stă fix jos.
- Fluxul de rezervare se deschide într-un panou lateral larg pe desktop și pe tot ecranul
  pe mobil, cu aceeași tipografie și același aer ca restul site-ului.
- Galerie: o bandă orizontală de fotografii care se derulează lent și continuu, oprită la
  hover; plus o grilă simplă la pagina de galerie.
- Footer bogat și ordonat: program (recepție, check-in, check-out, mic dejun), contact,
  adresă cu link de hartă, date firmă, link-uri legale, rețele sociale.

Culori
- Paletă restrânsă: un fundal deschis cald (nisip sau ivoire), text aproape negru, o singură
  culoare de accent pentru butoane și detalii. Secțiunea de rezervare poate avea fundal
  închis, pentru contrast.
- Contrast suficient peste tot (minimum WCAG AA), inclusiv pe butoane și peste fotografii.

Fotografii
- Mari, de calitate, aceleași proporții în aceeași secțiune (ex: 4:5 pentru camere, 16:9
  pentru peisaje), încărcate ca .webp, cu loading="lazy" (excepție: prima poză din hero).
- Placeholder-ele pentru poze lipsă: blocuri neutre în culorile temei, nu imagini de stoc.

Mișcare
- Animații discrete: apariție ușoară a secțiunilor la scroll, zoom foarte mic pe poze la
  hover, tranziții line între pașii rezervării.
- Respectă prefers-reduced-motion: dacă utilizatorul a cerut mai puțină mișcare, oprește
  animațiile și banda care se derulează.

Ton al textelor
- Personal, cald, cu o notă ușoară de umor acolo unde se potrivește, fără clișee de tipul
  „oază de liniște” sau „experiență de neuitat”. Fraze scurte. Fiecare text se poate
  schimba din config.

## STRUCTURA PAGINII
1. Hero: nume, localitate, o frază despre loc, căutarea de la Pasul 1 direct în hero,
   buton „Sună acum”.
2. Camere: card pentru fiecare tip de cameră, cu buton care deschide fluxul cu camera
   preselectată.
3. Facilități: iconițe simple, doar din config.
4. De ce să rezervi direct: preț mai bun, contact direct cu gazda, flexibilitate.
5. Galerie cu loc pentru video și cadre cu drona.
6. Recenzii reale din config, cu nota și numărul de recenzii de pe platforme dacă există.
7. Ce e prin apropiere, cu distanțe doar dacă sunt completate.
8. Politici: check-in/check-out, anulare, avans, animale, copii, fumat, plată.
9. Întrebări frecvente din config.
10. Contact: telefon, WhatsApp, email, buton „Deschide în Google Maps”.
11. Footer: date firmă, Politica de confidențialitate, Politica de cookies, ANPC.

## SEO
- Title și meta description din config.
- Date structurate schema.org LodgingBusiness sau Hotel (setabil), doar cu date reale.

## README.md (în română, pas cu pas, pentru cineva care nu e programator)
1. Cum completez site.config.js pentru o pensiune nouă.
2. Cum creez Google Sheet-ul, lipesc Code.gs, rulez setup() și public Web App-ul
   (acces: „Oricine”), apoi pun URL-ul în config.
3. Cum iau din extranetul Booking.com link-ul de export iCal pentru fiecare cameră și îl
   pun în foaia Setari.
4. Cum pun în extranetul Booking.com link-ul nostru .ics pentru fiecare cameră, ca import.
5. Cum activez declanșatorul de 15 minute.
6. Cum testez: o rezervare directă trebuie să apară blocată pe Booking după import,
   iar o rezervare de pe Booking trebuie să apară ocupată pe site.
7. Limite: Booking.com importă calendarul periodic, nu instant; cererile sunt confirmate
   de gazdă tocmai pentru a acoperi această fereastră; limita zilnică de emailuri a
   contului Google.

## DATE DESPRE PROPRIETATE (direct în site.config.js; ce e gol rămâne gol)
1. Identitate: nume, tip, adresă, clasificare reală, descriere în 2–3 fraze, ce o face diferită.
2. Camere (pe tip): nume, câte camere, capacitate, paturi, suprafață, facilități, preț pe
   noapte și pe sezoane cu datele lor, pat suplimentar și copii, minim de nopți.
3. Rezervare directă: reducere față de platforme (%), avans și cum se plătește, politică
   de anulare, în câte ore confirmă gazda, email-ul gazdei pentru notificări.
4. Facilități generale: mic dejun, parcare, Wi-Fi, piscină, spa, grătar, loc de joacă, animale.
5. Reguli: check-in, check-out, fumat, liniște.
6. Contact: telefon, WhatsApp, email, Google Maps, Facebook, Instagram.
7. Încredere: nota și nr. de recenzii reale pe platforme, 2–3 recenzii reale cu sursă.
8. Împrejurimi: atracții și distanțe reale.
9. Limbi: ce vorbește gazda; traduceri HU/EN (sau le traduci tu, marcate „de verificat”).
10. Stil vizual: temă (editorial / cald), culoare de accent, logo.
11. Date legale: firmă, CUI, nr. Registrul Comerțului.

La final, scrie lista câmpurilor din config rămase goale, ca să știu ce mai am de
întrebat proprietarul.

## Decizii
Aprobate după Faza 1 (verificarea specificației).

Găzduire și limbi
- D1. Site static pe Vercel, fără pas de build, fără funcții Vercel și fără bază de date.
  Backend-ul e doar Apps Script + Google Sheet. Pe Vercel nu sunt variabile de mediu.
- D2. Prima versiune doar în română. Textele din config acceptă deja forma
  { ro: "...", hu: "...", en: "..." }, ca maghiara și engleza să se adauge fără cod.
  Butonul de limbă apare doar când există cel puțin două limbi în config.

Camere și disponibilitate
- D3. Fiecare cameră fizică are un ID propriu și perechea ei de link-uri iCal
  (import din Booking.com, export .ics către Booking.com). Pe site camerele se grupează
  pe tip. Comportamentul Booking.com pentru tipuri cu mai multe camere se verifică în
  extranetul real înainte de primul client.
- D4. doGet?action=availability fără parametrul room întoarce toate camerele într-un
  singur apel; room=ID rămâne pentru o singură cameră.
- D5. Oaspetele alege cantitatea pe fiecare tip de cameră. Site-ul verifică doar că
  totalul de locuri acoperă numărul de persoane; nu împarte singur oaspeții pe camere.
- D6. Copii: în config, un prag de vârstă sub care stau gratuit și un preț de pat
  suplimentar. Nimic mai complex până nu o cere un client.
- D7. Fără plată online. Avansul e text (sumă, transfer bancar), afișat la cameră și
  trimis în emailul de confirmare.

Booking.com și siguranță
- D8. Booking.com importă calendarul extern la câteva ore, nu instant; confirmarea
  manuală a gazdei acoperă fereastra asta. Limita se scrie explicit în README.
- D9. Dacă importul iCal proaspăt din doPost eșuează, se folosește ultima listă din foaia
  Blocari, iar emailul către gazdă poartă mențiunea „verifică pe Booking”.
- D10. Link-ul .ics al fiecărei camere conține un cod secret; fișierul are doar date,
  fără nume de oaspeți.
- D11. Link-urile „Confirm” / „Refuz” din email deschid o pagină cu buton; acțiunea se
  face doar la apăsare (scannerele de email deschid automat link-urile).
- D12. Datele se țin ca text AAAA-LL-ZZ, scriptul rulează pe Europe/Bucharest; ziua de
  check-out e liberă pentru check-in-ul următor. Cazurile limită intră în teste (3c).
- D13. Limita Gmail (100 destinatari/zi la cont gratuit) se scrie în README; o rezervare
  consumă 2–3 emailuri.

Pagina
- D14. Titlul, descrierea și datele schema.org se pun din JavaScript, din config.
  Acceptat pentru demo: Google le citește, previzualizarea pe Facebook/WhatsApp rămâne
  generică. Se rediscută la lansare dacă e nevoie.
- D15. Galeria completă se deschide peste pagină (lightbox cu grilă), fără un al doilea
  fișier HTML.

Demo
- D16. Prima instanță: Cabana Sapte (cabanasapte.com), Breaza, jud. Brașov.
  De lămurit: cabana pare să se închirieze întreagă (4 dormitoare, max. 9 persoane),
  nu pe camere.
