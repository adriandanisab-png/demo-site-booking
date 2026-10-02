# Site cu rezervare directă pentru pensiuni și cabane

Site static (HTML, CSS, JavaScript simplu), publicat pe Vercel. Rezervările ajung într-un
Google Sheet din contul proprietarului, printr-un script Google Apps Script. Calendarul se
sincronizează cu Booking.com prin iCal.

Fără `appsScriptUrl` completat, site-ul rulează în **mod demo**: zile ocupate de probă, nimic
trimis, iar la final poți deschide exemplele de email.

Adaugă `?curat` la adresă (ex. `site.ro/?curat`) ca să ascunzi placeholderele galbene și
secțiunile goale când arăți site-ul cuiva.

---

## 1. Un client nou: site.config.js

Copiezi tot proiectul și editezi **doar** `site.config.js` și folderul `img/`.

- Deschide `site.config.js` într-un editor de text (ex. Visual Studio Code, TextEdit în mod text).
- Fiecare câmp are un comentariu care spune ce pui acolo.
- Ce nu știi lasă `null`: pe site apare un câmp galben `[ETICHETĂ]`, ca să vezi ce lipsește.
- Nu inventa: prețuri, recenzii, distanțe, facilități doar de la proprietar.
- **Camerele** (`rooms`): câte un tip de cameră pe bloc. În `units` pui câte un nume scurt
  pentru fiecare cameră fizică, ex. `["d1", "d2", "d3"]` pentru 3 camere duble.
  Aceleași nume le vei scrie în foaia Setari (pasul 2).
  Dacă există o singură unitate (o cabană închiriată întreagă), pasul „Alege camera” dispare.
- **Pozele**: le pui în `img/` (de preferat `.webp`, cel mult ~1600 px lățime) și scrii calea
  în config, ex. `{ file: "img/living.webp", alt: "Livingul cu șemineu", label: "..." }`.
- **Tema**: `theme: "editorial"` (modern) sau `"cald"` (rustic, de munte). `accent` schimbă culoarea butoanelor.
- **Limbi**: `languages: ["ro"]`. Pentru maghiară și engleză, scrie textele ca
  `{ ro: "...", hu: "...", en: "..." }` și pune `languages: ["ro", "hu", "en"]`.
- La lansare: `demo: false` (scoate banda „Machetă” și eticheta noindex).

Verificare: deschide `index.html` cu un server local (vezi „Pentru programatori”) sau publică pe Vercel.

## 2. Google: Sheet-ul și scriptul

Totul se face din contul Google al proprietarului (ideal un Gmail dedicat pensiunii).

1. Intră pe https://sheets.google.com → **Foaie nouă**. Numește-o, ex. „Rezervări Cabana”.
2. În foaie: **Extensii → Apps Script**. Se deschide editorul.
3. În editor:
   - șterge tot din `Code.gs` și lipește conținutul fișierului `apps-script/Code.gs`;
   - **+ → Script**, numește-l `Core` și lipește conținutul fișierului `core.js` (din rădăcina proiectului);
   - **+ → HTML** de trei ori, cu numele exacte `email-confirmare`, `email-gazda`, `email-revenire`,
     și lipește în fiecare fișierul cu același nume din `apps-script/`.
4. ⚙️ **Setări proiect** → Fus orar: **(GMT+02:00) Bucharest**.
5. Sus, din lista de funcții alege `setup` → **Rulează**. Acceptă permisiunile
   (Google avertizează că aplicația nu e verificată: **Avansat → Accesează … (nesigur)** — e scriptul tău).
   În foaie apar Rezervari, Blocari și Setari.
6. Completează foaia **Setari**: numele, emailul și telefonul gazdei, `siteUrl`, `oreExpirare`
   (în câte ore expiră o cerere neconfirmată), avansul, anularea. Pentru fiecare cameră fizică
   un rând `camera` cu id-ul unității și id-ul tipului, exact ca în `site.config.js`.
   Coloana „cheie .ics” se completează singură pentru primul rând; pentru celelalte camere pune
   orice șir lung de litere și cifre (ex. generat cu https://www.uuidgenerator.net).
7. **Implementare → Implementare nouă** → tip **Aplicație web**:
   - Execută ca: **Eu**
   - Cine are acces: **Oricine**
   → **Implementează** și copiază **URL-ul aplicației web** (se termină în `/exec`).
8. Pune URL-ul în `site.config.js` la `appsScriptUrl` și publică site-ul.

„Oricine” înseamnă doar că URL-ul poate fi apelat de site; datele oaspeților rămân în Sheet-ul tău.
Când modifici scriptul: **Implementare → Gestionează implementările → ✏️ → Versiune nouă**. URL-ul rămâne același.

## 3. Calendarul din Booking.com → site

Pentru fiecare cameră:

1. Extranet Booking.com → **Tarife și disponibilitate → Sincronizare calendare**.
2. Alege camera → **Exportă calendarul** → copiază link-ul (`https://ical.booking.com/...`).
3. Lipește-l în foaia Setari, pe rândul camerei, coloana „link iCal export din Booking.com”.

## 4. Calendarul de pe site → Booking.com

Pentru fiecare cameră, link-ul nostru este:

```
URL-ul aplicației web + ?action=ical&room=ID_UNITATE&key=CHEIA_ICS
```

ex. `https://script.google.com/macros/s/AKfy.../exec?action=ical&room=cabana&key=3f9a...`

În extranet: **Sincronizare calendare** → camera → **Importă calendar** → lipește link-ul → numește-l „Site”.
Cheia din link împiedică pe altcineva să-ți vadă calendarul. Fișierul are doar zilele ocupate, fără nume.

## 5. Declanșatorul la 15 minute

În editorul Apps Script, alege funcția `creareDeclansator` → **Rulează** (o singură dată).
De acum, la fiecare 15 minute scriptul citește calendarele Booking.com și expiră cererile
neconfirmate la timp. Se vede în meniul din stânga, la **Declanșatoare** (⏰).

## 6. Test înainte de predare (obligatoriu)

1. Pe site, trimite o cerere pe niște zile libere. Trebuie să primești:
   un email de oaspete și un email de gazdă cu butoanele **Confirm / Refuz**.
2. Apasă **Confirm** în emailul de gazdă → pe pagina care se deschide, **Da, confirm**.
   Oaspetele primește emailul de confirmare.
3. Așteaptă importul Booking.com (câteva ore) și verifică în extranet că zilele sunt blocate.
4. Fă o rezervare de test pe Booking.com (sau blochează zile din extranet). După cel mult
   15 minute, zilele trebuie să apară ocupate în calendarul de pe site.
5. Șterge rezervările de test din foaia Rezervari.

## 7. Panoul de admin (/admin)

Pe adresa site-ului + `/admin` (ex. `https://site.ro/admin/`) gazda are:

- **Cereri**: confirmă, refuză, anulează (oaspetele primește email automat), bifează „Avans primit”,
  își scrie notițe; caută după nume, telefon sau email.
- **Calendar**: ocuparea pe luni, pe camere (rezervări directe, Booking.com, blocări proprii).
  Apasă pe prima și pe ultima noapte ca să **blochezi zile** (folosire proprie, rezervare la telefon);
  apasă pe o zi blocată ca să o deblochezi. Blocările ajung și pe Booking.com, prin link-ul .ics.

Pornire:
1. În foaia **Setari**, pe un rând nou: `parolaAdmin` în coloana A și parola în coloana B
   (cel puțin 8 caractere; la instalări noi rândul există deja).
2. Lipește în Apps Script versiunea nouă a `Code.gs` și publică o **versiune nouă** a implementării
   (Implementare → Gestionează implementările → ✏️ → Versiune nouă).
3. Deschide `/admin` și intră cu parola. Parola se cere din nou la fiecare sesiune de browser.

După 10 parole greșite, panoul se blochează 15 minute.

## 8. Limite de știut

- **Booking.com importă calendarul extern periodic, nu instant** (de obicei la câteva ore).
  De aceea cererile de pe site sunt confirmate de gazdă: înainte de Confirm, uită-te în extranet.
  Dacă importul iCal a eșuat chiar în momentul cererii, emailul de gazdă te avertizează.
- **Emailuri**: un cont Gmail gratuit trimite cel mult **100 de emailuri pe zi** (Google Workspace: 1.500).
  O cerere consumă 2–3 emailuri.
- **Cererile neconfirmate** expiră după `oreExpirare` ore și eliberează zilele.
- **Totalul** afișat oaspetelui e estimat de site din prețurile din config; gazda îl confirmă.
  Nu există plată online: avansul se plătește după instrucțiunile din email.
- Emailul de revenire (`trimiteRevenire`) îl rulezi de mână, o dată pe sezon. Pleacă doar la oaspeții
  confirmați din ultimul an care au bifat acordul pentru oferte.

---

## Pentru programatori

```bash
python3 -m http.server 8000        # sau orice server static → http://localhost:8000
node --test                        # funcțiile pure + backend-ul Apps Script, simulat în Node
```

Structura și contractul site ↔ Apps Script: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Specificația și deciziile: [docs/SPEC.md](docs/SPEC.md).
