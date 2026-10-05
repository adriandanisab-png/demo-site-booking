// Servicii Google simulate în memorie (Sheet, Lock, Cache, Mail, UrlFetch), pentru a rula
// apps-script/Code.gs în Node: în teste și în verificarea panoului de admin în browser.
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
    // ca Sheets: fără apostrof, un text care arată a număr devine număr; cu apostrof rămâne text (fără apostrof)
    const cell = (x) => (typeof x === 'string' && x.startsWith("'") ? x.slice(1) : typeof x === 'string' && /^\d+$/.test(x) ? Number(x) : x);
    const s = {
      name, rows, raw: [],
      getRange(r, c, nr = 1, nc = 1) {
        return {
          setValues(v) { v.forEach((row, i) => row.forEach((x, j) => { (rows[r - 1 + i] = rows[r - 1 + i] || [])[c - 1 + j] = cell(x); })); return this; },
          setValue(x) { s.raw.push(x); (rows[r - 1] = rows[r - 1] || [])[c - 1] = cell(x); return this; },
          setFontWeight() { return this; }, setNumberFormat() { return this; },
          getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((rows[r - 1 + i] || [])[c - 1 + j] ?? ''))); },
          clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (rows[r - 1 + i]) rows[r - 1 + i][c - 1 + j] = ''; return this; },
        };
      },
      getDataRange() {
        const w = Math.max(...Array.from(rows, (r) => (r ? r.length : 0)), 1); // Array.from: fără găuri în tablou
        // ca în Sheets: de la primul rând până la ultimul cu conținut, inclusiv rândurile goale dintre ele
        const used = Array.from(rows.slice(0, s.getLastRow()), (r) => r || []);
        return { getValues: () => used.map((r) => Array.from({ length: w }, (_, i) => (r[i] == null ? '' : r[i]))) };
      },
      appendRow(v) { s.raw.push(...v); rows.push(v.map(cell)); },
      deleteRow(r) { rows.splice(r - 1, 1); },
      getLastColumn() { return Math.max(0, ...Array.from(rows, (r) => (r ? r.length : 0))); },
      // ca în Sheets: numărul ultimului rând cu conținut (rândurile goale din mijloc contează)
      getLastRow() { let n = 0; rows.forEach((r, i) => { if (r && r.some((x) => x !== '' && x != null)) n = i + 1; }); return n; },
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
    console: { log() {}, warn() {}, error() {} },
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
      sleep() {},
      DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => [...crypto.createHash(alg).update(s, 'utf8').digest()],
      base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, tz, f) => {
        if (f === 'H') return String(ctx.__ora != null ? ctx.__ora : Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(d)));
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
          .formatToParts(d).map((x) => [x.type, x.value]));
        return f.replace('yyyy', p.year).replace('yy', p.year.slice(2)).replace('MM', p.month).replace('dd', p.day)
          .replace("'T'", 'T').replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second).replace("'Z'", 'Z');
      },
    },
    CalendarApp: {
      Color: { BROWN: 'brown' },
      calendars: {},
      getCalendarById(id) { return this.calendars[id] || null; },
      createCalendar(name) {
        const id = 'cal' + Object.keys(this.calendars).length + '@group.calendar.google.com';
        const events = [];
        const cal = {
          events, getId: () => id, getName: () => name,
          createAllDayEvent(title, start, end, opt) {
            const tags = {};
            const ev = { title, start, end, description: (opt || {}).description, tags,
              getTag: (k) => tags[k] ?? null, setTag(k, v) { tags[k] = String(v); return ev; },
              deleteEvent() { events.splice(events.indexOf(ev), 1); } };
            events.push(ev);
            return ev;
          },
          getEvents(a, b) { return events.filter((e) => e.start < b && e.end > a); },
        };
        this.calendars[id] = cal;
        return cal;
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

module.exports = { mediu };
