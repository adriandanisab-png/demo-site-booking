// Rulează apps-script/Code.gs în Node, cu servicii Google simulate în memorie
// (Sheet, Lock, Cache, Mail, UrlFetch). Verifică fluxul complet fără cont Google.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');

function mediu({ ical = {} } = {}) {
  const mails = [];
  const sheets = {};
  function sheet(name) {
    const rows = [];
    const s = {
      name, rows,
      getRange(r, c, nr = 1, nc = 1) {
        return {
          setValues(v) { v.forEach((row, i) => row.forEach((x, j) => { (rows[r - 1 + i] = rows[r - 1 + i] || [])[c - 1 + j] = x; })); return this; },
          setValue(x) { (rows[r - 1] = rows[r - 1] || [])[c - 1] = x; return this; },
          setFontWeight() { return this; }, setNumberFormat() { return this; },
          clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (rows[r - 1 + i]) rows[r - 1 + i][c - 1 + j] = ''; return this; },
        };
      },
      getDataRange() {
        const w = Math.max(...rows.map((r) => (r ? r.length : 0)), 1);
        const used = rows.filter((r) => r && r.some((x) => x !== '' && x != null));
        return { getValues: () => used.map((r) => Array.from({ length: w }, (_, i) => (r[i] == null ? '' : r[i]))) };
      },
      appendRow(v) { rows.push(v.slice()); },
      getLastRow() { return rows.filter((r) => r && r.some((x) => x !== '' && x != null)).length; },
      getMaxRows() { return 1000; }, setFrozenRows() {}, autoResizeColumns() {},
    };
    return s;
  }
  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = sheet(n)),
    getSheets: () => Object.values(sheets), deleteSheet() {}, setSpreadsheetTimeZone() {},
  };
  const cache = {};
  const ctx = {
    console: { log() {}, error() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; }, removeAll: (ks) => ks.forEach((k) => delete cache[k]) }) },
    MailApp: { sendEmail: (o) => mails.push(o), getRemainingDailyQuota: () => 100 },
    UrlFetchApp: { fetchAll: (reqs) => reqs.map((r) => ({ getResponseCode: () => (ical[r.url] ? 200 : 500), getContentText: () => ical[r.url] || '' })) },
    HtmlService: {
      createHtmlOutputFromFile: (n) => ({ getContent: () => fs.readFileSync(path.join(ROOT, 'apps-script', n + '.html'), 'utf8') }),
      createHtmlOutput: (h) => ({ html: h, setTitle() { return this; }, addMetaTag() { return this; } }),
    },
    ContentService: { MimeType: { JSON: 'json', ICAL: 'ics', TEXT: 'text' }, createTextOutput: (t) => ({ text: t, setMimeType(m) { this.mime = m; return this; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, tz, f) => {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
          .formatToParts(d).map((x) => [x.type, x.value]));
        return f.replace('yyyy', p.year).replace('yy', p.year.slice(2)).replace('MM', p.month).replace('dd', p.day)
          .replace("'T'", 'T').replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second).replace("'Z'", 'Z');
      },
    },
    Session: { getActiveUser: () => ({ getEmail: () => 'gazda@example.com' }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/X/exec' }), getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }) }) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'core.js'), 'utf8').replace('var Core =', 'Core ='), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8'), ctx);
  ctx.setup();
  return { ctx, mails, sheets };
}

const post = (ctx, body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
const get = (ctx, p) => ctx.doGet({ parameter: p });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
const plus = (n) => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const cerere = (extra = {}) => ({
  action: 'book', lang: 'ro', checkIn: plus(10), checkOut: plus(13), adults: 2, children: [],
  rooms: [{ type: 'cabana', qty: 1 }], total: 3000, currency: 'lei',
  guest: { name: 'Ana Pop', email: 'ana@example.com', phone: '0722123456', arrival: '16:00', notes: '<b>târziu</b>' },
  consent: { data: true, offers: true }, website: '', ...extra,
});

test('cerere: se salvează în așteptare, blochează zilele, pleacă 2 emailuri', () => {
  const { ctx, mails } = mediu();
  const r = post(ctx, cerere());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.id, /^R\d{6}-/);
  assert.equal(mails.length, 2);
  assert.match(mails[0].subject, /Am primit cererea/);
  assert.match(mails[0].htmlBody, /Bună, Ana!/);
  assert.equal(mails[1].to, 'gazda@example.com');
  assert.match(mails[1].htmlBody, /action=confirm&amp;id=/);
  assert.match(mails[1].htmlBody, /&lt;b&gt;târziu/); // cererile oaspetelui sunt escape-uite
  const av = JSON.parse(get(ctx, { action: 'availability', from: plus(0), to: plus(30) }).text);
  assert.deepEqual(av.busy.cabana, [plus(10), plus(11), plus(12)]);
});

test('overbooking: a doua cerere pe aceleași zile e refuzată, cu sugestii', () => {
  const { ctx } = mediu();
  assert.equal(post(ctx, cerere()).ok, true);
  const r = post(ctx, cerere({ checkIn: plus(11), checkOut: plus(12), guest: { name: 'Ion', email: 'ion@example.com', phone: '0733123456' } }));
  assert.equal(r.error, 'unavailable');
  assert.ok(r.suggestions.length > 0);
  // ziua de plecare a primului e liberă pentru sosire
  assert.equal(post(ctx, cerere({ checkIn: plus(13), checkOut: plus(15), guest: { name: 'Maria', email: 'maria@example.com', phone: '0733123456' } })).ok, true);
  // aceeași adresă de email, de două ori în 20 de secunde → refuzat
  assert.equal(post(ctx, cerere({ checkIn: plus(20), checkOut: plus(22), guest: { name: 'Maria', email: 'maria@example.com', phone: '0733123456' } })).error, 'busy');
});

test('iCal Booking.com: zilele importate sunt ocupate', () => {
  const url = 'https://ical.booking.com/v1/export?t=abc';
  const { ctx, sheets } = mediu({ ical: { [url]: `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${plus(20).replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${plus(22).replace(/-/g, '')}\r\nUID:b1\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n` } });
  const set = sheets.Setari.rows;
  set.find((r) => r && r[0] === 'camera')[3] = url;
  const r = post(ctx, cerere({ checkIn: plus(21), checkOut: plus(23) }));
  assert.equal(r.error, 'unavailable');
  assert.equal(sheets.Blocari.rows.filter((x) => x && x[0] === 'cabana').length, 1);
});

test('import eșuat: cererea trece, gazda primește avertisment', () => {
  const { ctx, sheets, mails } = mediu();
  sheets.Setari.rows.find((r) => r && r[0] === 'camera')[3] = 'https://ical.booking.com/cade';
  assert.equal(post(ctx, cerere()).ok, true);
  assert.match(mails[1].htmlBody, /verifică pe Booking/);
});

test('.ics export: doar cu cheia corectă, fără nume', () => {
  const { ctx, sheets } = mediu();
  post(ctx, cerere());
  const key = sheets.Setari.rows.find((r) => r && r[0] === 'camera')[4];
  assert.equal(get(ctx, { action: 'ical', room: 'cabana', key: 'gresit' }).text, 'Nu există');
  const out = get(ctx, { action: 'ical', room: 'cabana', key }).text;
  assert.match(out, /BEGIN:VEVENT/);
  assert.doesNotMatch(out, /Ana/);
});

test('confirmare: pagina nu schimbă nimic, butonul da; token greșit refuzat', () => {
  const { ctx, sheets, mails } = mediu();
  const { id } = post(ctx, cerere());
  const row = sheets.Rezervari.rows.find((r) => r && r[0] === id);
  const token = row[18];
  const page = get(ctx, { action: 'confirm', id, token });
  assert.match(page.html, /Confirmi cererea/);
  assert.equal(row[2], 'asteptare');
  assert.equal(ctx.actiuneGazda(id, 'x' + token.slice(1), 'confirm'), 'Link invalid.');
  assert.match(ctx.actiuneGazda(id, token, 'confirm'), /confirmată/);
  assert.equal(row[2], 'confirmata');
  assert.match(mails.at(-1).subject, /Rezervare confirmată/);
});

test('refuz: zilele se eliberează', () => {
  const { ctx, sheets } = mediu();
  const { id } = post(ctx, cerere());
  const token = sheets.Rezervari.rows.find((r) => r && r[0] === id)[18];
  ctx.actiuneGazda(id, token, 'decline');
  const av = JSON.parse(get(ctx, { action: 'availability', from: plus(0), to: plus(30) }).text);
  assert.deepEqual(av.busy.cabana, []);
});

test('expirare: cererea neconfirmată la timp eliberează zilele', () => {
  const { ctx, sheets, mails } = mediu();
  const { id } = post(ctx, cerere());
  const row = sheets.Rezervari.rows.find((r) => r && r[0] === id);
  row[19] = new Date(Date.now() - 1000).toISOString();
  ctx.expiraCereri();
  assert.equal(row[2], 'expirata');
  assert.match(mails.at(-1).subject, /expirat/);
  assert.equal(post(ctx, cerere({ guest: { name: 'Ion', email: 'ion@example.com', phone: '0733123456' } })).ok, true);
});

test('validare și anti-spam', () => {
  const { ctx, sheets } = mediu();
  assert.equal(post(ctx, cerere({ checkOut: plus(9) })).error, 'invalid');
  assert.equal(post(ctx, cerere({ rooms: [{ type: 'nu-exista', qty: 1 }] })).error, 'invalid');
  assert.equal(post(ctx, cerere({ website: 'spam' })).ok, true);
  assert.equal(sheets.Rezervari.rows.length, 1); // doar antetul
});

test('revenire: doar confirmați, cu acord, din ultimul an, o singură dată', () => {
  const { ctx, sheets, mails } = mediu();
  const { id } = post(ctx, cerere());
  const row = sheets.Rezervari.rows.find((r) => r && r[0] === id);
  row[2] = 'confirmata'; row[3] = plus(-40); row[4] = plus(-37);
  const n = mails.length;
  ctx.trimiteRevenire();
  assert.equal(mails.length, n + 1);
  assert.match(mails.at(-1).htmlBody, /Ne-ar plăcea să vă revedem, Ana/);
  ctx.trimiteRevenire();
  assert.equal(mails.length, n + 1);
});
