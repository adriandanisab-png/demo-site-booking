/**
 * Backend pentru rezervarea directă: Google Apps Script + Google Sheet.
 * Folosește funcțiile pure din Core.gs (copie a fișierului core.js din site).
 *
 * Pași de instalare: README.md, secțiunea „Google”.
 * Funcții de rulat de mână din editor: setup(), creareDeclansator(), trimiteRevenire().
 */

var FOI = { rez: 'Rezervari', blk: 'Blocari', set: 'Setari' };
var COL_REZ = ['id', 'creat', 'status', 'checkIn', 'checkOut', 'unitati', 'tipuri', 'adulti', 'copii', 'nume', 'email',
  'telefon', 'oraSosire', 'cereri', 'total', 'moneda', 'limba', 'acordOferte', 'token', 'expiraLa', 'notaBooking', 'revenireTrimisa'];
var COL_BLK = ['unitate', 'deLa', 'panaLa', 'uid', 'importatLa'];
var VERSIUNE = 1;

// ============================================================ instalare

// Rulează o singură dată: creează foile și setările de pornire.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Europe/Bucharest');
  foaie(FOI.rez, COL_REZ);
  foaie(FOI.blk, COL_BLK);
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
  if (s) return s;
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
  importaToate();
  expiraCereri();
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

function scrieCelula(t, row, col, val) { t.sheet.getRange(row, t.head.indexOf(col) + 1).setValue(val); }

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
  rezervariActive().forEach(function (r) { String(r.unitati).split(',').forEach(function (u) { if (u) add(u.trim(), r.checkIn, r.checkOut); }); });
  return out;
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
  var cheie = 'av:' + from + ':' + to + ':' + (p.room || '');
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
  cache.put(cheie, JSON.stringify(out), 60); // un minut; se golește la orice rezervare nouă
  return out;
}

function golesteCache() { CacheService.getScriptCache().removeAll(['av:' + azi() + ':' + Core.addDays(azi(), 400) + ':']); }

// Calendarul .ics al unei camere, pentru importul în Booking.com (doar date, fără nume)
function ics(p) {
  var cam = setari().camere.filter(function (c) { return c.unit === p.room; })[0];
  if (!cam || !cam.key || p.key !== cam.key) return ContentService.createTextOutput('Nu există').setMimeType(ContentService.MimeType.TEXT);
  var ev = rezervariActive().filter(function (r) {
    return String(r.unitati).split(',').indexOf(cam.unit) >= 0 && String(r.checkOut) >= azi();
  }).map(function (r) { return { uid: r.id + '-' + cam.unit + '@rezervare-directa', from: String(r.checkIn), to: String(r.checkOut), summary: 'Rezervare directă' }; });
  var stamp = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  return ContentService.createTextOutput(Core.buildICS(ev, setari().numeProprietate + ' – ' + cam.unit, stamp)).setMimeType(ContentService.MimeType.ICAL);
}

// ============================================================ POST: cererea de rezervare

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'invalid', message: 'Cerere greșită.' }); }
  if (b.website) return json({ ok: true, id: 'X', status: 'pending' }); // capcană anti-spam: nimic salvat
  try { return json(rezerva(b)); } catch (err) {
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
      unitati: unitati.join(','), tipuri: b.rooms.map(function (r) { return r.type + '×' + r.qty; }).join(', '),
      adulti: b.adults, copii: (b.children || []).join(', '), nume: clip(b.guest.name, 100), email: clip(b.guest.email, 200).toLowerCase(),
      telefon: clip(b.guest.phone, 40), oraSosire: clip(b.guest.arrival, 10), cereri: clip(b.guest.notes, 1000),
      total: typeof b.total === 'number' ? b.total : '', moneda: clip(b.currency, 8) || 'lei', limba: clip(b.lang, 5) || 'ro',
      acordOferte: b.consent && b.consent.offers === true ? 'da' : '', token: cheieNoua(),
      expiraLa: new Date(Date.now() + cfg.oreExpirare * 3600000).toISOString(), notaBooking: nota, revenireTrimisa: ''
    };
    t.sheet.appendRow(COL_REZ.map(function (k) { return rez[k]; }));
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
  } catch (err) { console.error('Email eșuat', err); }

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
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var cfg = setari(), t = citeste(FOI.rez), r;
  try {
    r = t.rows.filter(function (x) { return x.id === id; })[0];
    if (!r || !egal(token, r.token)) return 'Link invalid.';
    if (r.status === 'confirmata' && action === 'confirm') return 'Cererea era deja confirmată.';
    if (r.status === 'refuzata') return 'Cererea era deja refuzată.';
    if (r.status === 'expirata' && action === 'confirm') return 'Cererea a expirat și zilele au fost eliberate. Contactează oaspetele direct.';
    r.status = action === 'confirm' ? 'confirmata' : 'refuzata';
    scrieCelula(t, r._row, 'status', r.status);
    SpreadsheetApp.flush();
    golesteCache();
  } finally { lock.releaseLock(); }

  var confirma = r.status === 'confirmata';
  trimite(r.email, 'email-confirmare', r.limba, (confirma ? 'Rezervare confirmată' : 'Cererea nu a putut fi confirmată') + ' – ' + cfg.numeProprietate, date(r, cfg, confirma ? {
    titlu: 'Rezervarea ta e confirmată',
    mesaj: 'Te așteptăm! Mai jos ai detaliile și condițiile de avans.'
  } : {
    titlu: 'Nu putem confirma cererea',
    mesaj: 'Ne pare rău, nu te putem primi în perioada aleasă. Zilele au fost eliberate; poți alege alte date pe site.'
  }), cfg.emailGazda);
  return confirma ? 'Gata: rezervarea e confirmată, oaspetele a primit emailul.' : 'Gata: cererea e refuzată, zilele sunt libere, oaspetele a primit emailul.';
}

function egal(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
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
    .map(function (r) { return COL_BLK.map(function (k) { return r[k]; }); });
  units.forEach(function (u) { noi[u].forEach(function (ev) { pastrate.push([u, ev.from, ev.to, ev.uid, acum]); }); });
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
    camere: r.tipuri, total: r.total !== '' && r.total != null ? Number(r.total).toLocaleString('ro-RO') + ' ' + r.moneda : 'de confirmat de gazdă',
    avans: cfg.avans || 'gazda îți trimite detaliile', anulare: cfg.anulare || 'gazda îți trimite detaliile',
    oreConfirmare: cfg.oreExpirare, telefonGazda: cfg.telefonGazda || '', emailGazda: cfg.emailGazda,
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
