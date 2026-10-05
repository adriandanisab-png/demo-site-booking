/**
 * Backend pentru rezervarea directă: Google Apps Script + Google Sheet.
 * Folosește funcțiile pure din Core.gs (copie a fișierului core.js din site).
 *
 * Pași de instalare: README.md, secțiunea „Google”.
 * Funcții de rulat de mână din editor: setup(), creareDeclansator(), trimiteRevenire(),
 * testEmail(), testRezervare(). Panoul de admin (/admin pe site) cere parolaAdmin din Setari.
 */

var FOI = { rez: 'Rezervari', blk: 'Blocari', man: 'BlocariManuale', set: 'Setari' };
var COL_REZ = ['id', 'creat', 'status', 'checkIn', 'checkOut', 'unitati', 'tipuri', 'adulti', 'copii', 'nume', 'email',
  'telefon', 'oraSosire', 'cereri', 'total', 'moneda', 'limba', 'acordOferte', 'token', 'expiraLa', 'notaBooking', 'revenireTrimisa',
  'avansPlatit', 'notaGazda', 'preSosireTrimis', 'recenzieTrimis'];
var COL_BLK = ['unitate', 'deLa', 'panaLa', 'uid', 'importatLa'];
// Zile blocate de gazdă din panoul de admin (folosire proprie, rezervări la telefon). Importul iCal nu le atinge.
var COL_MAN = ['id', 'unitate', 'deLa', 'panaLa', 'motiv', 'creat'];
var VERSIUNE = 4;

// Setări adăugate în versiuni noi: apar singure la finalul foii Setari, cu explicația în coloana C
var SETARI_NOI = [
  ['emailuriSejur', 'da', 'da = trimite automat emailul dinainte de sosire și pe cel de după plecare; nu = oprit'],
  ['zileInainteSosire', 2, 'cu câte zile înainte de sosire pleacă emailul cu informații'],
  ['infoSosire', '', 'ce primește oaspetele înainte de sosire: drum, check-in, Wi-Fi, reguli (pe mai multe rânduri: Alt+Enter)'],
  ['linkHarta', '', 'link Google Maps către proprietate'],
  ['linkRecenzie', '', 'link spre recenzia pe Google; fără el, emailul de după plecare nu pleacă'],
  ['calendarGoogle', '', 'ID-ul calendarului Google în care apar rezervările; îl completează singură funcția creareCalendar']
];

// ============================================================ instalare

// Rulează o singură dată: creează foile și setările de pornire.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Europe/Bucharest');
  foaie(FOI.rez, COL_REZ);
  foaie(FOI.blk, COL_BLK);
  foaie(FOI.man, COL_MAN);
  var s = ss.getSheetByName(FOI.set);
  if (!s) {
    s = ss.insertSheet(FOI.set);
    s.getRange(1, 1, 1, 5).setValues([['cheie', 'valoare', '', '', '']]).setFontWeight('bold');
    var rows = [
      ['numeProprietate', 'Cabana Șapte', '', '', ''],
      ['emailGazda', Session.getActiveUser().getEmail(), '', '', ''],
      ['telefonGazda', '', '', '', ''],
      ['siteUrl', 'https://', '', '', ''],
      ['oreExpirare', 24, '', '', ''],
      ['culoare', '#8a4a2e', '', '', ''],
      ['avans', '', '', '', ''],
      ['anulare', '', '', '', ''],
      ['parolaAdmin', '', '', '', ''],
      ['mesajRevenire', 'Sezonul acesta avem din nou zile libere. Dacă rezervați direct, vorbiți cu noi, nu cu o platformă.', '', '', ''],
      ['', '', '', '', ''],
      ['# camere', 'id unitate (ca în site.config.js)', 'id tip', 'link iCal export din Booking.com', 'cheie .ics (nu o schimba)'],
      ['camera', 'cabana', 'cabana', '', cheieNoua()]
    ];
    s.getRange(2, 1, rows.length, 5).setValues(rows);
    s.getRange(2, 2, 1, 1).setNumberFormat('@');
    s.autoResizeColumns(1, 5);
  }
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Foaie1');
  if (def && ss.getSheets().length > 3) ss.deleteSheet(def);
}

function foaie(nume, coloane) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(nume);
  if (s) {
    // Foaie creată de o versiune mai veche: adaugă la final coloanele care lipsesc
    var head = s.getRange(1, 1, 1, Math.max(s.getLastColumn(), 1)).getValues()[0];
    var lipsa = coloane.filter(function (c) { return head.indexOf(c) < 0; });
    if (lipsa.length) {
      var start = head.filter(String).length + 1;
      s.getRange(1, start, 1, lipsa.length).setValues([lipsa]).setFontWeight('bold');
      s.getRange(1, start, s.getMaxRows(), lipsa.length).setNumberFormat('@');
    }
    return s;
  }
  s = ss.insertSheet(nume);
  s.getRange(1, 1, 1, coloane.length).setValues([coloane]).setFontWeight('bold');
  s.setFrozenRows(1);
  // Datele rămân text AAAA-LL-ZZ, ca Sheets să nu le transforme în alt fus orar
  s.getRange(1, 1, s.getMaxRows(), coloane.length).setNumberFormat('@');
  return s;
}

// Rulează o dată: importul iCal și expirarea cererilor la fiecare 15 minute.
function creareDeclansator() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'laFiecare15Minute') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('laFiecare15Minute').timeBased().everyMinutes(15).create();
}

function laFiecare15Minute() {
  pregateste();
  importaToate();
  expiraCereri();
  emailuriSejur();
  sincronizeazaCalendar();
}

// ============================================================ setări

function setari() {
  var v = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FOI.set).getDataRange().getValues();
  var out = { camere: [] };
  v.slice(1).forEach(function (r) {
    var k = String(r[0]).trim();
    if (k === 'camera' && r[1]) out.camere.push({ unit: String(r[1]).trim(), type: String(r[2]).trim(), ical: String(r[3]).trim(), key: String(r[4]).trim() });
    else if (k && k.charAt(0) !== '#') out[k] = r[1];
  });
  out.oreExpirare = Number(out.oreExpirare) || 24;
  return out;
}

// Asigură foile și coloanele adăugate în versiuni noi (fără să mai rulezi setup)
function pregateste() {
  var c = CacheService.getScriptCache();
  if (c.get('schema' + VERSIUNE)) return;
  foaie(FOI.rez, COL_REZ);
  foaie(FOI.man, COL_MAN);
  setariLipsa();
  c.put('schema' + VERSIUNE, '1', 600);
}

function setariLipsa() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FOI.set);
  var chei = s.getDataRange().getValues().map(function (r) { return String(r[0]).trim(); });
  var lipsa = SETARI_NOI.filter(function (x) { return chei.indexOf(x[0]) < 0; });
  if (!lipsa.length) return;
  var start = s.getLastRow() + 2; // un rând gol înainte, ca să se vadă că sunt noi
  s.getRange(start, 1, lipsa.length, 3).setValues(lipsa.map(function (x) { return [x[0], x[1], x[2]]; }));
}

function cheieNoua() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8); }

function azi() { return Utilities.formatDate(new Date(), 'Europe/Bucharest', 'yyyy-MM-dd'); }

// ============================================================ citire / scriere în foi

function citeste(nume) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nume);
  var v = s.getDataRange().getValues();
  var head = v[0];
  return { sheet: s, head: head, rows: v.slice(1).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = r[j] instanceof Date ? Utilities.formatDate(r[j], 'Europe/Bucharest', 'yyyy-MM-dd') : r[j]; });
    return o;
  }) };
}

// Sheets „ghicește” tipul la scriere: „9, 1” devine dată, „16:00” oră, „0722…” număr fără 0.
// Un apostrof în față păstrează textul exact; nu se vede în foaie și nu apare la citire.
function text(v) { return typeof v === 'string' && v !== '' && v.charAt(0) !== "'" ? "'" + v : v; }
function rand(head, o) { return head.map(function (k) { return o[k] == null ? '' : text(o[k]); }); }

function scrieCelula(t, row, col, val) { t.sheet.getRange(row, t.head.indexOf(col) + 1).setValue(text(val)); }

// Rezervările care țin zilele ocupate: confirmate sau în așteptare neexpirate
function rezervariActive() {
  var now = new Date().toISOString();
  return citeste(FOI.rez).rows.filter(function (r) {
    return r.status === 'confirmata' || (r.status === 'asteptare' && String(r.expiraLa) > now);
  });
}

// { unitate: [{ from, to }] } din Blocari + rezervările active
function intervaleOcupate() {
  var out = {};
  var add = function (u, from, to) { (out[u] = out[u] || []).push({ from: String(from), to: String(to) }); };
  citeste(FOI.blk).rows.forEach(function (b) { if (b.unitate) add(String(b.unitate), b.deLa, b.panaLa); });
  blocariManuale().forEach(function (b) { add(String(b.unitate), b.deLa, b.panaLa); });
  rezervariActive().forEach(function (r) { String(r.unitati).split(',').forEach(function (u) { if (u) add(u.trim(), r.checkIn, r.checkOut); }); });
  return out;
}

function blocariManuale() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FOI.man);
  return s ? citeste(FOI.man).rows.filter(function (b) { return b.unitate && b.deLa; }) : [];
}

// ============================================================ GET

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'availability') return json(disponibilitate(p));
    if (p.action === 'ical') return ics(p);
    if (p.action === 'confirm' || p.action === 'decline') return paginaGazda(p);
    return json({ ok: true, versiune: VERSIUNE });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server', message: 'Eroare temporară. Încearcă din nou.' });
  }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function disponibilitate(p) {
  var from = p.from, to = p.to;
  if (!Core.isDate(from) || !Core.isDate(to) || to <= from || Core.nightsBetween(from, to) > 400) {
    return { ok: false, error: 'invalid', message: 'Interval greșit.' };
  }
  var cache = CacheService.getScriptCache();
  var cheie = 'av' + (cache.get('av-gen') || '0') + ':' + from + ':' + to + ':' + (p.room || '');
  var c = cache.get(cheie);
  if (c) return JSON.parse(c);
  var ocupat = intervaleOcupate();
  var busy = {};
  setari().camere.forEach(function (cam) {
    if (p.room && cam.unit !== p.room) return;
    var set = Core.busySet(ocupat[cam.unit]);
    busy[cam.unit] = Core.eachNight(from, to).filter(function (d) { return set[d]; });
  });
  var out = { ok: true, from: from, to: to, busy: busy };
  cache.put(cheie, JSON.stringify(out), 60); // un minut; se invalidează la orice schimbare
  return out;
}

// Orice schimbare de disponibilitate mută „generația”: toate răspunsurile din cache devin vechi
function golesteCache() { CacheService.getScriptCache().put('av-gen', String(Date.now()), 21600); }

// Calendarul .ics al unei camere, pentru importul în Booking.com (doar date, fără nume)
function ics(p) {
  var cam = setari().camere.filter(function (c) { return c.unit === p.room; })[0];
  if (!cam || !cam.key || p.key !== cam.key) return ContentService.createTextOutput('Nu există').setMimeType(ContentService.MimeType.TEXT);
  var ev = rezervariActive().filter(function (r) {
    return String(r.unitati).split(',').indexOf(cam.unit) >= 0 && String(r.checkOut) >= azi();
  }).map(function (r) { return { uid: r.id + '-' + cam.unit + '@rezervare-directa', from: String(r.checkIn), to: String(r.checkOut), summary: 'Rezervare directă' }; })
    .concat(blocariManuale().filter(function (b) { return String(b.unitate) === cam.unit && String(b.panaLa) >= azi(); })
      .map(function (b) { return { uid: b.id + '@rezervare-directa', from: String(b.deLa), to: String(b.panaLa), summary: 'Blocat' }; }));
  var stamp = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  return ContentService.createTextOutput(Core.buildICS(ev, setari().numeProprietate + ' – ' + cam.unit, stamp)).setMimeType(ContentService.MimeType.ICAL);
}

// ============================================================ POST: cererea de rezervare

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'invalid', message: 'Cerere greșită.' }); }
  if (b.website) { // capcană anti-spam: nimic salvat (se vede în Execuții)
    console.warn('Cerere ignorată de capcana anti-spam: ' + String(b.website).slice(0, 80));
    return json({ ok: true, id: 'X', status: 'pending' });
  }
  try {
    pregateste();
    return json(b.action === 'admin' ? admin(b) : rezerva(b));
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server', message: 'Nu am putut salva cererea.' });
  }
}

function rezerva(b) {
  var cfg = setari();
  var bad = Core.validateBooking(b, azi(), null);
  var tipuri = {};
  cfg.camere.forEach(function (c) { (tipuri[c.type] = tipuri[c.type] || []).push(c); });
  if (Array.isArray(b.rooms) && b.rooms.some(function (r) { return !tipuri[r && r.type]; })) bad.push('rooms');
  if (bad.length) return { ok: false, error: 'invalid', fields: bad, message: 'Verifică datele cererii.' };

  // Aceeași adresă de email nu poate trimite mai des de o dată la 20 de secunde
  var cache = CacheService.getScriptCache(), ck = 'post:' + String(b.guest.email).toLowerCase();
  if (cache.get(ck)) return { ok: false, error: 'busy', message: 'Cererea a fost deja trimisă. Așteaptă câteva secunde.' };
  cache.put(ck, '1', 20);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy', message: 'Sunt multe cereri chiar acum. Încearcă din nou peste un minut.' };
  var rez, nota = '';
  try {
    // 1. import iCal proaspăt doar pentru camerele cerute (D9: dacă eșuează, mergem pe ultima listă)
    var cerute = [];
    b.rooms.forEach(function (r) { cerute = cerute.concat(tipuri[r.type]); });
    if (importa(cerute).length) nota = 'Importul din Booking.com a eșuat chiar acum: verifică pe Booking înainte să confirmi.';

    // 2. alege unități libere pe tot intervalul
    var ocupat = intervaleOcupate();
    var alege = function (checkIn, checkOut) {
      var ales = [];
      var ok = b.rooms.every(function (r) {
        var libere = tipuri[r.type].filter(function (c) { return Core.isFree(Core.busySet(ocupat[c.unit]), checkIn, checkOut); });
        if (libere.length < r.qty) return false;
        ales = ales.concat(libere.slice(0, r.qty).map(function (c) { return c.unit; }));
        return true;
      });
      return ok ? ales : null;
    };
    var unitati = alege(b.checkIn, b.checkOut);
    if (!unitati) {
      return { ok: false, error: 'unavailable', message: 'Perioada aleasă nu mai e liberă.',
        suggestions: Core.suggestDates(b.checkIn, b.checkOut, function (a, z) { return !!alege(a, z); }, azi()) };
    }

    // 3. salvează cererea „în așteptare”: zilele sunt blocate din acest moment
    var t = citeste(FOI.rez);
    rez = {
      id: 'R' + Utilities.formatDate(new Date(), 'Europe/Bucharest', 'yyMMdd') + '-' + cheieNoua().slice(0, 4).toUpperCase(),
      creat: new Date().toISOString(), status: 'asteptare', checkIn: b.checkIn, checkOut: b.checkOut,
      // numele camerei vine de la site (doar pentru afișare); id-ul tipului e verificat mai sus
      unitati: unitati.join(','), tipuri: b.rooms.map(function (r) { return clip(r.name, 60).replace(/^'/, '') || r.type; })
        .map(function (n, i) { return b.rooms[i].qty > 1 ? b.rooms[i].qty + ' × ' + n : n; }).join(', '),
      adulti: b.adults, copii: (b.children || []).join(', '), nume: clip(b.guest.name, 100), email: clip(b.guest.email, 200).toLowerCase(),
      telefon: clip(b.guest.phone, 40), oraSosire: clip(b.guest.arrival, 10), cereri: clip(b.guest.notes, 1000),
      total: typeof b.total === 'number' ? b.total : '', moneda: clip(b.currency, 8) || 'lei', limba: clip(b.lang, 5) || 'ro',
      acordOferte: b.consent && b.consent.offers === true ? 'da' : '', token: cheieNoua(),
      expiraLa: new Date(Date.now() + cfg.oreExpirare * 3600000).toISOString(), notaBooking: nota, revenireTrimisa: '',
      avansPlatit: '', notaGazda: ''
    };
    t.sheet.appendRow(rand(t.head, rez));
    SpreadsheetApp.flush();
    golesteCache();
  } finally {
    lock.releaseLock();
  }

  // 4. emailurile, după eliberarea lock-ului
  var url = ScriptApp.getService().getUrl();
  try {
    trimite(rez.email, 'email-confirmare', rez.limba, 'Am primit cererea ta – ' + cfg.numeProprietate, date(rez, cfg, {
      titlu: 'Am primit cererea ta',
      mesaj: 'Gazda o verifică și îți răspunde în cel mult ' + cfg.oreExpirare + ' ore. Până atunci, zilele sunt păstrate pentru tine.'
    }), cfg.emailGazda);
    trimite(cfg.emailGazda, 'email-gazda', 'ro', 'Cerere nouă: ' + rez.nume + ', ' + fmt(rez.checkIn) + ' – ' + fmt(rez.checkOut), date(rez, cfg, {
      linkConfirm: url + '?action=confirm&id=' + rez.id + '&token=' + rez.token,
      linkRefuz: url + '?action=decline&id=' + rez.id + '&token=' + rez.token,
      notaBooking: nota ? '<p style="background:#fff1b8;padding:12px 16px;border-radius:6px;font-size:14px">' + Core.esc(nota) + '</p>' : ''
    }), rez.email);
  } catch (err) {
    console.error('Email eșuat', err);
    var tr = citeste(FOI.rez), rr = tr.rows.filter(function (x) { return x.id === rez.id; })[0];
    if (rr) scrieCelula(tr, rr._row, 'notaBooking', (nota ? nota + ' ' : '') + 'EMAIL EȘUAT: ' + err.message);
  }

  calendarDupaSchimbare();
  return { ok: true, id: rez.id, status: 'pending', expiresAt: rez.expiraLa };
}

// Text de la oaspete: tăiat la n caractere; un apostrof în față dacă ar arăta ca o formulă în Sheets
function clip(v, n) {
  var s = String(v == null ? '' : v).trim().slice(0, n);
  return /^([=@]|[+\-][^\d\s])/.test(s) ? "'" + s : s;
}

// ============================================================ confirmare / refuz de către gazdă

// Link-ul din email deschide doar o pagină cu buton (D11): scannerele de email nu pot confirma singure.
function paginaGazda(p) {
  var r = citeste(FOI.rez).rows.filter(function (x) { return x.id === p.id; })[0];
  var ok = r && egal(p.token, r.token);
  var confirma = p.action === 'confirm';
  var html = '<!doctype html><html lang="ro"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    'body{font-family:Arial,sans-serif;background:#f4efe7;color:#1b1a17;margin:0;padding:32px 20px}main{max-width:520px;margin:0 auto}' +
    'h1{font-family:Georgia,serif;font-weight:400;font-size:30px}button{font:inherit;font-weight:bold;border:0;border-radius:999px;padding:14px 26px;cursor:pointer;color:#fff;background:' + (confirma ? '#2f5240' : '#8a2e2e') + '}' +
    'p{line-height:1.6}</style></head><body><main>';
  if (!ok) html += '<h1>Link invalid</h1><p>Cererea nu există sau link-ul e greșit.</p>';
  else {
    html += '<h1>' + (confirma ? 'Confirmi cererea?' : 'Refuzi cererea?') + '</h1>' +
      '<p><b>' + Core.esc(r.nume) + '</b><br>' + fmt(r.checkIn) + ' – ' + fmt(r.checkOut) + '<br>' + Core.esc(r.tipuri) + ' · ' + Core.esc(r.adulti) + ' adulți' + (r.copii ? ', copii: ' + Core.esc(r.copii) : '') + '</p>' +
      '<p>Status acum: <b>' + Core.esc(r.status) + '</b></p>' +
      '<button id="b">' + (confirma ? 'Da, confirm' : 'Da, refuz') + '</button><p id="m"></p>' +
      '<script>document.getElementById("b").onclick=function(){var b=this;b.disabled=true;b.textContent="Se salvează…";' +
      'google.script.run.withSuccessHandler(function(t){document.getElementById("m").textContent=t;b.remove();})' +
      '.withFailureHandler(function(e){document.getElementById("m").textContent="Eroare: "+e.message;b.disabled=false;})' +
      '.actiuneGazda(' + JSON.stringify(p.id) + ',' + JSON.stringify(p.token) + ',' + JSON.stringify(p.action) + ');};<\/script>';
  }
  return HtmlService.createHtmlOutput(html + '</main></body></html>').setTitle('Rezervare').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Apelată din pagina de mai sus (google.script.run)
function actiuneGazda(id, token, action) {
  var t = citeste(FOI.rez);
  var r = t.rows.filter(function (x) { return x.id === id; })[0];
  if (!r || !egal(token, r.token)) return 'Link invalid.';
  var res = schimbaStatus(id, action === 'confirm' ? 'confirmata' : 'refuzata', true);
  if (!res.ok) return res.message;
  return res.status === 'confirmata' ? 'Gata: rezervarea e confirmată, oaspetele a primit emailul.' : 'Gata: cererea e refuzată, zilele sunt libere, oaspetele a primit emailul.';
}

var MESAJE_STATUS = {
  confirmata: { subiect: 'Rezervare confirmată', titlu: 'Rezervarea ta e confirmată', mesaj: 'Te așteptăm! Mai jos ai detaliile și condițiile de avans.' },
  refuzata: { subiect: 'Cererea nu a putut fi confirmată', titlu: 'Nu putem confirma cererea', mesaj: 'Ne pare rău, nu te putem primi în perioada aleasă. Zilele au fost eliberate; poți alege alte date pe site.' },
  anulata: { subiect: 'Rezervare anulată', titlu: 'Rezervarea a fost anulată', mesaj: 'Rezervarea de mai jos a fost anulată. Pentru întrebări, răspunde la acest email sau sună-ne.' }
};

// Schimbă statusul unei rezervări (din emailul gazdei sau din panoul de admin) și anunță oaspetele
function schimbaStatus(id, status, anunta) {
  if (!MESAJE_STATUS[status]) return { ok: false, message: 'Status necunoscut.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var cfg = setari(), r;
  try {
    var t = citeste(FOI.rez);
    r = t.rows.filter(function (x) { return x.id === id; })[0];
    if (!r) return { ok: false, message: 'Rezervarea nu există.' };
    if (r.status === status) return { ok: false, message: 'Rezervarea are deja acest status.' };
    if (r.status === 'refuzata' || r.status === 'anulata') return { ok: false, message: 'Rezervarea e ' + r.status + '; fă o rezervare nouă dacă e nevoie.' };
    if (status === 'confirmata' && r.status === 'expirata') {
      // a expirat: confirmăm doar dacă zilele sunt încă libere
      var ocupat = intervaleOcupate();
      var libere = String(r.unitati).split(',').every(function (u) { return Core.isFree(Core.busySet(ocupat[u.trim()]), String(r.checkIn), String(r.checkOut)); });
      if (!libere) return { ok: false, message: 'Cererea a expirat și între timp zilele s-au ocupat. Contactează oaspetele.' };
    }
    if (status === 'anulata' && r.status !== 'confirmata') return { ok: false, message: 'Doar o rezervare confirmată se anulează; o cerere în așteptare se refuză.' };
    r.status = status;
    scrieCelula(t, r._row, 'status', status);
    SpreadsheetApp.flush();
    golesteCache();
  } finally { lock.releaseLock(); }
  if (anunta) {
    var m = MESAJE_STATUS[status];
    trimite(r.email, 'email-confirmare', r.limba, m.subiect + ' – ' + cfg.numeProprietate, date(r, cfg, { titlu: m.titlu, mesaj: m.mesaj }), cfg.emailGazda);
  }
  calendarDupaSchimbare();
  return { ok: true, status: status };
}

function egal(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ============================================================ panoul de admin (/admin pe site)

// Toate cererile vin prin POST (parola nu ajunge în adrese sau în istoricul browserului).
function admin(b) {
  var cfg = setari();
  var parola = String(cfg.parolaAdmin || '');
  if (parola.length < 8) return { ok: false, error: 'setup', message: 'Panoul e oprit: pune în foaia Setari, la parolaAdmin, o parolă de cel puțin 8 caractere.' };
  var cache = CacheService.getScriptCache();
  var gresite = Number(cache.get('admin-gresit') || 0);
  if (gresite >= 10) return { ok: false, error: 'blocat', message: 'Prea multe încercări greșite. Așteaptă 15 minute.' };
  if (!egal(b.password, parola)) {
    cache.put('admin-gresit', String(gresite + 1), 900);
    Utilities.sleep(800);
    return { ok: false, error: 'auth', message: 'Parolă greșită.' };
  }
  var op = b.op, t;
  if (op === 'list') return adminLista(cfg);
  if (op === 'status') {
    var res = schimbaStatus(String(b.id), String(b.status), b.notify !== false);
    return res.ok ? { ok: true } : { ok: false, error: 'status', message: res.message };
  }
  if (op === 'paid' || op === 'note') {
    t = citeste(FOI.rez);
    var r = t.rows.filter(function (x) { return x.id === b.id; })[0];
    if (!r) return { ok: false, error: 'missing', message: 'Rezervarea nu există.' };
    if (op === 'paid') scrieCelula(t, r._row, 'avansPlatit', b.value ? new Date().toISOString() : '');
    else scrieCelula(t, r._row, 'notaGazda', clip(b.text, 1000));
    return { ok: true };
  }
  if (op === 'block') {
    var rb = adminBlocheaza(cfg, b);
    if (rb.ok) calendarDupaSchimbare();
    return rb;
  }
  if (op === 'sejur') {
    t = citeste(FOI.rez);
    var rs = t.rows.filter(function (x) { return x.id === b.id; })[0];
    if (!rs || rs.status !== 'confirmata') return { ok: false, error: 'status', message: 'Emailul se trimite doar pentru rezervări confirmate.' };
    var lipsaSetare = b.kind === 'recenzie' ? (!cfg.linkRecenzie && 'linkRecenzie') : (!cfg.infoSosire && 'infoSosire');
    if (lipsaSetare) return { ok: false, error: 'setup', message: 'Completează ' + lipsaSetare + ' în foaia Setari.' };
    return trimiteSejur(t, rs, cfg, b.kind === 'recenzie' ? 'recenzie' : 'sosire') ? { ok: true } : { ok: false, error: 'mail', message: 'Emailul nu a putut fi trimis.' };
  }
  if (op === 'unblock') {
    t = citeste(FOI.man);
    var bl = t.rows.filter(function (x) { return x.id === b.id; })[0];
    if (!bl) return { ok: false, error: 'missing', message: 'Blocarea nu există.' };
    t.sheet.deleteRow(bl._row);
    golesteCache();
    calendarDupaSchimbare();
    return { ok: true };
  }
  return { ok: false, error: 'invalid', message: 'Operație necunoscută.' };
}

// Rezervările din ultimele 90 de zile și cele viitoare, blocările Booking și cele manuale
function adminLista(cfg) {
  var din = Core.addDays(azi(), -90), now = new Date().toISOString();
  var rez = citeste(FOI.rez).rows.filter(function (r) { return r.id && String(r.checkOut) >= din; }).map(function (r) {
    var o = {};
    COL_REZ.forEach(function (k) { if (k !== 'token') o[k] = r[k] == null ? '' : String(r[k]); });
    // o cerere „în așteptare” trecută de termen e expirată chiar dacă declanșatorul n-a rulat încă
    if (o.status === 'asteptare' && o.expiraLa && o.expiraLa <= now) o.status = 'expirata';
    return o;
  });
  var booking = citeste(FOI.blk).rows.filter(function (b) { return b.unitate && String(b.panaLa) >= din; })
    .map(function (b) { return { unitate: String(b.unitate), deLa: String(b.deLa), panaLa: String(b.panaLa), importatLa: String(b.importatLa || '') }; });
  var manuale = blocariManuale().filter(function (b) { return String(b.panaLa) >= din; })
    .map(function (b) { return { id: String(b.id), unitate: String(b.unitate), deLa: String(b.deLa), panaLa: String(b.panaLa), motiv: String(b.motiv || '') }; });
  return { ok: true, azi: azi(), rezervari: rez, booking: booking, manuale: manuale,
    sejur: { activ: String(cfg.emailuriSejur || 'da').toLowerCase() === 'da', info: !!cfg.infoSosire, recenzie: !!cfg.linkRecenzie, zile: Number(cfg.zileInainteSosire) || 2 },
    camere: cfg.camere.map(function (c) { return { unit: c.unit, type: c.type, ical: !!c.ical }; }),
    emailuriRamase: MailApp.getRemainingDailyQuota() };
}

function adminBlocheaza(cfg, b) {
  var unit = String(b.unit || '');
  if (!cfg.camere.some(function (c) { return c.unit === unit; })) return { ok: false, error: 'invalid', message: 'Camera nu există.' };
  if (!Core.isDate(b.from) || !Core.isDate(b.to) || b.to <= b.from) return { ok: false, error: 'invalid', message: 'Interval greșit.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // nu blocăm peste o rezervare directă activă: aceea se anulează sau se refuză
    var peste = rezervariActive().filter(function (r) {
      return String(r.unitati).split(',').indexOf(unit) >= 0 && Core.overlaps(b.from, b.to, String(r.checkIn), String(r.checkOut));
    });
    if (peste.length) return { ok: false, error: 'overlap', message: 'Intervalul se suprapune cu rezervarea ' + peste[0].id + ' (' + peste[0].nume + ').' };
    var t = citeste(FOI.man);
    var id = 'B' + cheieNoua().slice(0, 8).toUpperCase();
    var row = { id: id, unitate: unit, deLa: b.from, panaLa: b.to, motiv: clip(b.reason, 200), creat: new Date().toISOString() };
    t.sheet.appendRow(rand(t.head, row));
    SpreadsheetApp.flush();
    golesteCache();
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

// ============================================================ Google Calendar

// Rulează o dată din editor: creează calendarul „Rezervări <nume>” în contul tău, îl leagă (Setari →
// calendarGoogle) și îl umple. Prima rulare cere și permisiunea pentru Calendar.
function creareCalendar() {
  pregateste();
  var cfg = setari();
  var cal = cfg.calendarGoogle && CalendarApp.getCalendarById(String(cfg.calendarGoogle));
  if (!cal) {
    cal = CalendarApp.createCalendar('Rezervări ' + cfg.numeProprietate, { timeZone: 'Europe/Bucharest', color: CalendarApp.Color.BROWN });
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FOI.set);
    var v = s.getDataRange().getValues();
    for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim() === 'calendarGoogle') { s.getRange(i + 1, 2).setValue(text(cal.getId())); break; }
  }
  var n = sincronizeazaCalendar();
  console.log('Calendar: „' + cal.getName() + '”. ' + JSON.stringify(n) + '. Îl găsești în Google Calendar, la „Calendarele mele”.');
}

// După o rezervare, confirmare, anulare sau blocare: actualizează calendarul imediat (fără să strice operația dacă eșuează)
function calendarDupaSchimbare() {
  try { sincronizeazaCalendar(); } catch (err) { console.error('Sincronizare calendar eșuată', err); }
}

// Evenimentele care trebuie să existe: rezervări directe active, blocări proprii, zile din Booking.com
function evenimenteDorite(cfg) {
  var din = Core.addDays(azi(), -30), multe = cfg.camere.length > 1, out = [];
  var cam = function (u) { return multe ? u + ' · ' : ''; };
  rezervariActive().filter(function (r) { return String(r.checkOut) >= din; }).forEach(function (r) {
    var pers = Number(r.adulti || 0) + String(r.copii || '').split(',').filter(function (x) { return x.trim() !== ''; }).length;
    var desc = [
      r.status === 'asteptare' ? 'CERERE NECONFIRMATĂ – expiră ' + String(r.expiraLa).slice(0, 16).replace('T', ' ') + ' (UTC)' : 'Confirmată',
      'Telefon: ' + r.telefon, 'Email: ' + r.email,
      'Oaspeți: ' + r.adulti + ' adulți' + (r.copii ? ', copii: ' + r.copii + ' ani' : ''),
      r.oraSosire ? 'Sosire: ~' + r.oraSosire : '',
      r.total !== '' && r.total != null ? 'Total estimat: ' + r.total + ' ' + r.moneda : '',
      r.avansPlatit ? 'Avans primit' : 'Avans: neîncasat',
      r.cereri ? 'Cereri: ' + r.cereri : '', r.notaGazda ? 'Notițe: ' + r.notaGazda : '',
      'Nr. cerere: ' + r.id
    ].filter(Boolean).join('\n');
    String(r.unitati).split(',').filter(Boolean).forEach(function (u) {
      u = u.trim();
      out.push({ cheie: 'rez:' + r.id + ':' + u, from: String(r.checkIn), to: String(r.checkOut), desc: desc,
        titlu: cam(u) + (r.status === 'asteptare' ? '⏳ Cerere: ' : '') + r.nume + ' · ' + pers + ' pers.' });
    });
  });
  blocariManuale().filter(function (b) { return String(b.panaLa) >= din; }).forEach(function (b) {
    out.push({ cheie: 'man:' + b.id, from: String(b.deLa), to: String(b.panaLa), titlu: cam(String(b.unitate)) + 'Blocat' + (b.motiv ? ': ' + b.motiv : ''), desc: 'Blocat din panoul de admin.' });
  });
  citeste(FOI.blk).rows.filter(function (b) { return b.unitate && String(b.panaLa) >= din; }).forEach(function (b) {
    var u = String(b.unitate);
    out.push({ cheie: 'bk:' + u + ':' + b.deLa + ':' + b.panaLa, from: String(b.deLa), to: String(b.panaLa), titlu: cam(u) + 'Booking.com', desc: 'Ocupat pe Booking.com (din calendarul iCal). Detaliile sunt în extranet.' });
  });
  // un interval de pe Booking.com identic cu o rezervare directă e chiar rezervarea noastră, întoarsă de Booking
  var directe = {};
  out.forEach(function (e) { if (e.cheie.indexOf('rez:') === 0) directe[e.cheie.split(':')[2] + ':' + e.from + ':' + e.to] = true; });
  return out.filter(function (e) { return e.cheie.indexOf('bk:') !== 0 || !directe[e.cheie.slice(3)]; });
}

// Rezumat scurt al conținutului unui eveniment (tag-urile au lungime limitată)
function semnatura(s) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8));
}

function dataLocala(iso) { return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); }

// Aduce calendarul Google la zi: creează ce lipsește, refă ce s-a schimbat, șterge ce nu mai există.
// Atinge doar evenimentele create de script (marcate cu tag-ul „rezervare”); restul calendarului rămâne neatins.
function sincronizeazaCalendar() {
  var cfg = setari(), n = { create: 0, sterse: 0 };
  if (!cfg.calendarGoogle) return n;
  var cal = CalendarApp.getCalendarById(String(cfg.calendarGoogle));
  if (!cal) { console.warn('Calendarul din Setari (calendarGoogle) nu există sau nu e al tău.'); return n; }
  var dorite = {};
  evenimenteDorite(cfg).forEach(function (e) { e.sig = semnatura([e.titlu, e.desc, e.from, e.to].join('|')); dorite[e.cheie] = e; });
  var existente = cal.getEvents(dataLocala(Core.addDays(azi(), -60)), dataLocala(Core.addDays(azi(), 500)));
  var vazute = {};
  existente.forEach(function (ev) {
    var cheie = ev.getTag('rezervare');
    if (!cheie) return;
    var d = dorite[cheie];
    if (d && !vazute[cheie] && ev.getTag('sig') === d.sig) { vazute[cheie] = true; return; }
    ev.deleteEvent(); // anulată, refuzată, expirată, deblocată, mutată sau duplicat
    n.sterse++;
  });
  Object.keys(dorite).forEach(function (k) {
    if (vazute[k]) return;
    var d = dorite[k];
    var ev = cal.createAllDayEvent(d.titlu, dataLocala(d.from), dataLocala(d.to), { description: d.desc });
    ev.setTag('rezervare', k);
    ev.setTag('sig', d.sig);
    n.create++;
  });
  return n;
}

// ============================================================ iCal Booking.com

function importaToate() { return importa(setari().camere); }

// Citește calendarele iCal ale camerelor date și rescrie rândurile lor din Blocari.
// Întoarce lista camerelor la care importul a eșuat.
function importa(camere) {
  var cuLink = camere.filter(function (c) { return /^https:\/\//.test(c.ical); });
  if (!cuLink.length) return [];
  var raspunsuri = UrlFetchApp.fetchAll(cuLink.map(function (c) { return { url: c.ical, muteHttpExceptions: true }; }));
  var noi = {}, esuate = [];
  raspunsuri.forEach(function (res, i) {
    var c = cuLink[i];
    var txt = res.getResponseCode() === 200 ? res.getContentText() : '';
    if (txt.indexOf('BEGIN:VCALENDAR') < 0) { esuate.push(c.unit); return; }
    noi[c.unit] = Core.parseICS(txt).filter(function (ev) { return ev.to > azi(); });
  });
  var units = Object.keys(noi);
  if (!units.length) return esuate;
  var t = citeste(FOI.blk), acum = new Date().toISOString();
  var pastrate = t.rows.filter(function (r) { return r.unitate && units.indexOf(String(r.unitate)) < 0; })
    .map(function (r) { return COL_BLK.map(function (k) { return text(r[k] == null ? '' : String(r[k])); }); });
  units.forEach(function (u) { noi[u].forEach(function (ev) { pastrate.push([u, ev.from, ev.to, ev.uid, acum].map(text)); }); });
  if (t.sheet.getLastRow() > 1) t.sheet.getRange(2, 1, t.sheet.getLastRow() - 1, COL_BLK.length).clearContent();
  if (pastrate.length) t.sheet.getRange(2, 1, pastrate.length, COL_BLK.length).setValues(pastrate);
  golesteCache();
  return esuate;
}

// Cererile neconfirmate la timp expiră și eliberează zilele
function expiraCereri() {
  var cfg = setari(), t = citeste(FOI.rez), now = new Date().toISOString();
  t.rows.forEach(function (r) {
    if (r.status !== 'asteptare' || String(r.expiraLa) > now) return;
    scrieCelula(t, r._row, 'status', 'expirata');
    try {
      trimite(r.email, 'email-confirmare', r.limba, 'Cererea ta a expirat – ' + cfg.numeProprietate, date(r, cfg, {
        titlu: 'Cererea ta a expirat',
        mesaj: 'Gazda nu a putut răspunde la timp, așa că zilele au fost eliberate. Te rugăm să ne suni sau să trimiți o cerere nouă.'
      }), cfg.emailGazda);
    } catch (err) { console.error(err); }
  });
  golesteCache();
}

// ============================================================ emailuri în jurul sejurului

// Rulează din declanșatorul de 15 minute, doar între 9 și 20 (ora României), pentru rezervări confirmate:
// - cu zileInainteSosire zile înainte de sosire: informațiile din infoSosire;
// - a doua zi după plecare (până la 7 zile): mulțumesc + link spre recenzie.
// Fiecare pleacă o singură dată; dacă trimiterea eșuează, se reîncearcă la următoarea rulare.
function emailuriSejur(oriceOra) {
  var cfg = setari(), n = { sosire: 0, recenzie: 0 };
  if (String(cfg.emailuriSejur || 'da').toLowerCase() !== 'da') return n;
  var ora = Number(Utilities.formatDate(new Date(), 'Europe/Bucharest', 'H'));
  if (!oriceOra && (ora < 9 || ora >= 20)) return n;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return n;
  try {
    var z = azi(), zile = Number(cfg.zileInainteSosire) || 2, t = citeste(FOI.rez);
    t.rows.forEach(function (r) {
      if (r.status !== 'confirmata') return;
      var ci = String(r.checkIn), co = String(r.checkOut);
      if (cfg.infoSosire && !r.preSosireTrimis && ci >= z && ci <= Core.addDays(z, zile) && trimiteSejur(t, r, cfg, 'sosire')) n.sosire++;
      if (cfg.linkRecenzie && !r.recenzieTrimis && co < z && co >= Core.addDays(z, -7) && trimiteSejur(t, r, cfg, 'recenzie')) n.recenzie++;
    });
  } finally { lock.releaseLock(); }
  if (n.sosire || n.recenzie) console.log('Emailuri sejur: ' + JSON.stringify(n));
  return n;
}

// Butonul de hartă din emailul de sosire; lipsește dacă nu e completat linkHarta
function butonHarta(cfg) {
  if (!/^https:\/\//.test(String(cfg.linkHarta || ''))) return '';
  return '<p style="margin:24px 0 0"><a href="' + Core.esc(cfg.linkHarta) + '" style="display:inline-block;background:' + Core.esc(cfg.culoare || '#8a4a2e') +
    ';color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-family:Arial,sans-serif;font-weight:bold">Deschide harta</a></p>';
}

function trimiteSejur(t, r, cfg, tip) {
  var col = tip === 'sosire' ? 'preSosireTrimis' : 'recenzieTrimis';
  scrieCelula(t, r._row, col, new Date().toISOString()); // marcăm întâi, ca să nu plece de două ori
  try {
    if (tip === 'sosire') {
      trimite(r.email, 'email-sosire', r.limba, 'Ne vedem pe ' + fmt(r.checkIn) + ' – ' + cfg.numeProprietate, date(r, cfg, {
        infoSosire: Core.esc(cfg.infoSosire).replace(/\r?\n/g, '<br>'),
        butonHarta: butonHarta(cfg)
      }), cfg.emailGazda);
    } else {
      trimite(r.email, 'email-recenzie', r.limba, 'Mulțumim că ați stat la ' + cfg.numeProprietate, date(r, cfg, { linkRecenzie: cfg.linkRecenzie }), cfg.emailGazda);
    }
    r[col] = 'trimis';
    return true;
  } catch (err) {
    console.error('Email ' + tip + ' eșuat pentru ' + r.id, err);
    scrieCelula(t, r._row, col, '');
    return false;
  }
}

// ============================================================ email de revenire

// Rulează de mână, o dată pe sezon. Trimite doar oaspeților confirmați din ultimul an,
// care au bifat acordul pentru oferte și n-au primit deja mesajul.
function trimiteRevenire() {
  var cfg = setari(), t = citeste(FOI.rez), z = azi(), trimise = 0;
  t.rows.forEach(function (r) {
    if (r.status !== 'confirmata' || r.acordOferte !== 'da' || r.revenireTrimisa) return;
    if (!(String(r.checkOut) < z && String(r.checkOut) >= Core.addDays(z, -365))) return;
    if (MailApp.getRemainingDailyQuota() < 5) return;
    trimite(r.email, 'email-revenire', r.limba, cfg.numeProprietate + ' vă așteaptă din nou', date(r, cfg, { mesaj: cfg.mesajRevenire }), cfg.emailGazda);
    scrieCelula(t, r._row, 'revenireTrimisa', new Date().toISOString());
    trimise++;
  });
  console.log('Emailuri de revenire trimise: ' + trimise);
}

// ============================================================ emailuri

var LUNI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
var ZILE = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
function fmt(iso) {
  iso = String(iso);
  var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  return ZILE[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + LUNI[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

// Datele pentru șabloane ({{cheie}})
function date(r, cfg, extra) {
  var n = Core.nightsBetween(String(r.checkIn), String(r.checkOut));
  var copii = String(r.copii || '').split(',').filter(function (x) { return x.trim() !== ''; }).length;
  var o = {
    numeProprietate: cfg.numeProprietate, nume: r.nume, prenume: String(r.nume).split(/\s+/)[0], id: r.id,
    checkIn: fmt(r.checkIn), checkOut: fmt(r.checkOut), nopti: n,
    oaspeti: r.adulti + (Number(r.adulti) === 1 ? ' adult' : ' adulți') + (copii ? ', ' + copii + (copii === 1 ? ' copil' : ' copii') : ''),
    camere: String(r.tipuri).replace(/×1\b/g, ''), total: r.total !== '' && r.total != null ? Number(r.total).toLocaleString('ro-RO') + ' ' + r.moneda : 'de confirmat de gazdă',
    avans: cfg.avans || 'gazda îți trimite detaliile', anulare: cfg.anulare || 'gazda îți trimite detaliile',
    oreConfirmare: cfg.oreExpirare, telefonGazda: cfg.telefonGazda || '', emailGazda: cfg.emailGazda,
    // „sună la …” doar dacă telefonul gazdei e completat în Setari
    contactGazda: cfg.telefonGazda
      ? 'Răspunde la acest email sau sună la <a href="tel:' + Core.esc(String(cfg.telefonGazda).replace(/\s/g, '')) + '" style="color:' + Core.esc(cfg.culoare || '#8a4a2e') + '">' + Core.esc(cfg.telefonGazda) + '</a>.'
      : 'Răspunde la acest email.',
    oraSosire: r.oraSosire || '—', cereri: r.cereri || '—', telefon: r.telefon, email: r.email,
    siteUrl: cfg.siteUrl, culoare: cfg.culoare || '#8a4a2e', notaBooking: '', linkConfirm: '#', linkRefuz: '#'
  };
  Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
  return o;
}

// Șablonul în limba oaspetelui (ex. email-confirmare.hu), altfel cel în română
function sablon(nume, limba) {
  if (limba && limba !== 'ro') {
    try { return HtmlService.createHtmlOutputFromFile(nume + '.' + limba).getContent(); } catch (e) {}
  }
  return HtmlService.createHtmlOutputFromFile(nume).getContent();
}

function trimite(catre, nume, limba, subiect, data, replyTo) {
  if (!catre) return;
  var o = { to: catre, subject: subiect, htmlBody: Core.fillTemplate(sablon(nume, limba), data), name: data.numeProprietate };
  if (replyTo) o.replyTo = replyTo;
  MailApp.sendEmail(o);
}

// ============================================================ teste (se rulează din editor)

// Trimite cele două emailuri (oaspete + gazdă) la emailGazda, cu date de probă.
// Dacă ceva e greșit (șablon lipsă, permisiune, adresă goală), eroarea apare în jurnal.
function testEmail() {
  var cfg = setari();
  if (!cfg.emailGazda) throw new Error('Completează emailGazda în foaia Setari.');
  var r = { id: 'TEST', nume: 'Oaspete Test', email: cfg.emailGazda, telefon: '0700000000', checkIn: Core.addDays(azi(), 30),
    checkOut: Core.addDays(azi(), 32), tipuri: 'cabana×1', adulti: 2, copii: '', total: 1000, moneda: 'lei', oraSosire: '16:00', cereri: 'test', limba: 'ro' };
  trimite(cfg.emailGazda, 'email-confirmare', 'ro', 'TEST oaspete – ' + cfg.numeProprietate, date(r, cfg, { titlu: 'Test email oaspete', mesaj: 'Dacă vezi asta, emailul către oaspete merge.' }));
  trimite(cfg.emailGazda, 'email-gazda', 'ro', 'TEST gazdă – ' + cfg.numeProprietate, date(r, cfg, {}));
  trimite(cfg.emailGazda, 'email-sosire', 'ro', 'TEST înainte de sosire – ' + cfg.numeProprietate, date(r, cfg, {
    infoSosire: Core.esc(cfg.infoSosire || '(aici apare textul din infoSosire, foaia Setari)').replace(/\r?\n/g, '<br>'), butonHarta: butonHarta(cfg) }));
  trimite(cfg.emailGazda, 'email-recenzie', 'ro', 'TEST după plecare – ' + cfg.numeProprietate, date(r, cfg, { linkRecenzie: cfg.linkRecenzie || '#' }));
  console.log('Trimise 4 emailuri de test către ' + cfg.emailGazda + '. Mai poți trimite azi: ' + MailApp.getRemainingDailyQuota());
}

// Simulează o cerere de pe site, cap-coadă (rând în Rezervari + emailuri). Șterge apoi rândul TEST.
function testRezervare() {
  var cfg = setari();
  var tip = cfg.camere.length ? cfg.camere[0].type : '';
  var rez = rezerva({ action: 'book', lang: 'ro', checkIn: Core.addDays(azi(), 300), checkOut: Core.addDays(azi(), 302), adults: 2, children: [],
    rooms: [{ type: tip, qty: 1 }], total: 1000, currency: 'lei',
    guest: { name: 'Test Site', email: cfg.emailGazda, phone: '0700000000', arrival: '', notes: 'test din editor' },
    consent: { data: true, offers: false } });
  console.log(JSON.stringify(rez));
}
