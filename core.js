// Funcții pure, fără DOM și fără rețea. Același fișier rulează în browser (window.Core),
// în Node (require) pentru teste și în Google Apps Script (copiat ca Core.gs).
// Datele sunt mereu text AAAA-LL-ZZ; calculele se fac în UTC, ca fusul orar să nu mute zilele.
var Core = (function () {
  var DAY = 86400000;

  function toTime(iso) { return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); }
  function fromTime(t) { return new Date(t).toISOString().slice(0, 10); }

  function isDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return fromTime(toTime(s)) === s; // respinge 2026-02-30
  }

  function addDays(iso, n) { return fromTime(toTime(iso) + n * DAY); }

  function nightsBetween(checkIn, checkOut) { return Math.round((toTime(checkOut) - toTime(checkIn)) / DAY); }

  // Nopțile unui sejur: data fiecărei nopți (check-out-ul nu e inclus)
  function eachNight(checkIn, checkOut) {
    var out = [];
    for (var d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d);
    return out;
  }

  // Intervale [in, out): ziua de plecare a unuia poate fi ziua de sosire a altuia
  function overlaps(aIn, aOut, bIn, bOut) { return aIn < bOut && bIn < aOut; }

  // Din intervale {from, to} (to exclusiv) → obiect { "AAAA-LL-ZZ": true } cu nopțile ocupate
  function busySet(intervals) {
    var set = {};
    (intervals || []).forEach(function (r) {
      eachNight(r.from, r.to).forEach(function (d) { set[d] = true; });
    });
    return set;
  }

  function isFree(set, checkIn, checkOut) {
    return eachNight(checkIn, checkOut).every(function (d) { return !set[d]; });
  }

  // „LL-ZZ” e în sezonul {from, to}? Sezonul poate trece peste Anul Nou (ex. 12-20 → 01-10).
  function inSeason(iso, s) {
    var md = iso.slice(5);
    return s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to;
  }

  // Noaptea de după această zi e de weekend? weekendDays = zilele săptămânii (0 = duminică … 6 = sâmbătă),
  // implicit vineri și sâmbătă noaptea.
  function isWeekendNight(room, iso) {
    var days = room.weekendDays || [5, 6];
    return days.indexOf(new Date(toTime(iso)).getUTCDay()) >= 0;
  }

  // Prețul unei nopți: primul sezon potrivit, altfel prețul de bază; fiecare poate avea preț de weekend
  function nightPrice(room, iso) {
    var src = room, seasons = room.seasons || [];
    for (var i = 0; i < seasons.length; i++) {
      if (seasons[i].price != null && inSeason(iso, seasons[i])) { src = seasons[i]; break; }
    }
    if (src.weekendPrice != null && isWeekendNight(room, iso)) return src.weekendPrice;
    return src.price == null ? null : src.price;
  }

  // Prețul sejurului. rooms = [{ room, qty, extraBeds }]. Întoarce total null dacă lipsește vreun preț.
  function priceStay(rooms, checkIn, checkOut, discountPercent) {
    var nights = eachNight(checkIn, checkOut);
    var subtotal = 0, missing = false;
    var lines = rooms.map(function (r) {
      var sum = 0, lineMissing = false;
      nights.forEach(function (d) {
        var p = nightPrice(r.room, d);
        if (p == null) lineMissing = true; else sum += p * r.qty;
      });
      var beds = r.extraBeds || 0;
      if (beds) {
        var bp = r.room.extraBed && r.room.extraBed.price;
        if (bp == null) lineMissing = true; else sum += bp * beds * nights.length;
      }
      if (lineMissing) missing = true; else subtotal += sum;
      return { id: r.room.id, qty: r.qty, amount: lineMissing ? null : sum };
    });
    if (missing) return { nights: nights.length, lines: lines, subtotal: null, discount: null, total: null };
    // Reducerea „preț direct” e informativă: prețurile din config sunt deja cele directe.
    var pct = discountPercent || 0;
    var platform = pct ? Math.round(subtotal / (1 - pct / 100)) : subtotal;
    return { nights: nights.length, lines: lines, subtotal: subtotal, platform: platform, discount: platform - subtotal, total: subtotal };
  }

  // Cele mai apropiate intervale libere cu același număr de nopți, în ±range zile.
  // free(checkIn, checkOut) → boolean, ca funcția să nu știe cum se calculează disponibilitatea.
  function suggestDates(checkIn, checkOut, free, today, range, max) {
    var n = nightsBetween(checkIn, checkOut), found = [];
    range = range || 14; max = max || 3;
    for (var k = 1; k <= range && found.length < max; k++) {
      [k, -k].forEach(function (off) {
        var a = addDays(checkIn, off);
        if (found.length < max && a >= today && free(a, addDays(a, n))) found.push({ checkIn: a, checkOut: addDays(a, n) });
      });
    }
    return found;
  }

  // ---- iCal ----

  // Ziua dintr-o valoare DTSTART/DTEND: 20261008 sau 20261008T140000Z
  function icsDate(v) {
    var m = /(\d{4})(\d{2})(\d{2})/.exec(v || '');
    return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
  }

  // Evenimentele dintr-un calendar .ics → [{ uid, from, to }] (to exclusiv)
  function parseICS(text) {
    var lines = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
    var events = [], ev = null;
    lines.forEach(function (line) {
      if (line === 'BEGIN:VEVENT') { ev = {}; return; }
      if (line === 'END:VEVENT') {
        if (ev && ev.from) {
          var to = ev.to && ev.to > ev.from ? ev.to : addDays(ev.from, 1);
          events.push({ uid: ev.uid || '', from: ev.from, to: to });
        }
        ev = null; return;
      }
      if (!ev) return;
      var i = line.indexOf(':');
      if (i < 0) return;
      var key = line.slice(0, i).split(';')[0].toUpperCase(), val = line.slice(i + 1).trim();
      if (key === 'DTSTART') ev.from = icsDate(val);
      else if (key === 'DTEND') ev.to = icsDate(val);
      else if (key === 'UID') ev.uid = val;
    });
    return events;
  }

  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }

  // Liniile mai lungi de 75 de octeți se pliază (RFC 5545)
  function fold(line) {
    var out = '';
    while (line.length > 75) { out += line.slice(0, 75) + '\r\n '; line = line.slice(75); }
    return out + line;
  }

  // events = [{ uid, from, to, summary }]; stamp = „20261002T120000Z”
  function buildICS(events, calName, stamp) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//rezervare-directa//RO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEscape(calName || 'Rezervări')];
    events.forEach(function (e) {
      L.push('BEGIN:VEVENT', 'UID:' + e.uid, 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + e.from.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + e.to.replace(/-/g, ''),
        'SUMMARY:' + icsEscape(e.summary || 'Ocupat'), 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  // ---- validare ----

  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()); }

  // Întoarce lista câmpurilor greșite (gol = în regulă). minNights = { tip: n }.
  function validateBooking(b, today, minNights) {
    var bad = [];
    b = b || {};
    var g = b.guest || {};
    if (!isDate(b.checkIn) || b.checkIn < today) bad.push('checkIn');
    if (!isDate(b.checkOut) || !(b.checkOut > b.checkIn)) bad.push('checkOut');
    else if (nightsBetween(b.checkIn, b.checkOut) > 60) bad.push('checkOut');
    if (!(b.adults >= 1 && b.adults <= 50)) bad.push('adults');
    if (!Array.isArray(b.children) || b.children.some(function (a) { return !(a >= 0 && a <= 17); })) bad.push('children');
    if (!Array.isArray(b.rooms) || !b.rooms.length || b.rooms.some(function (r) { return !r || !r.type || !(r.qty >= 1 && r.qty <= 10); })) bad.push('rooms');
    else if (bad.indexOf('checkOut') < 0 && minNights) {
      var n = nightsBetween(b.checkIn, b.checkOut);
      if (b.rooms.some(function (r) { return n < (minNights[r.type] || 1); })) bad.push('nights');
    }
    if (!String(g.name || '').trim() || String(g.name).length > 100) bad.push('name');
    if (!validEmail(g.email)) bad.push('email');
    if (String(g.phone || '').replace(/\D/g, '').length < 9) bad.push('phone');
    if (!b.consent || b.consent.data !== true) bad.push('consent');
    return bad;
  }

  // ---- șabloane de email: {{cheie}} cu escape HTML, {{{cheie}}} fără ----
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fillTemplate(tpl, data) {
    return String(tpl)
      .replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, function (_, k) { return data[k] == null ? '' : String(data[k]); })
      .replace(/\{\{\s*(\w+)\s*\}\}/g, function (_, k) { return esc(data[k]); });
  }

  return {
    isDate: isDate, addDays: addDays, nightsBetween: nightsBetween, eachNight: eachNight,
    overlaps: overlaps, busySet: busySet, isFree: isFree, inSeason: inSeason, isWeekendNight: isWeekendNight, nightPrice: nightPrice,
    priceStay: priceStay, suggestDates: suggestDates, parseICS: parseICS, buildICS: buildICS,
    validEmail: validEmail, validateBooking: validateBooking, esc: esc, fillTemplate: fillTemplate
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Core;
