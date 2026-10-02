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
        const w = Math.max(...rows.map((r) => (r ? r.length : 0)), 1);
        const used = rows.filter((r) => r && r.some((x) => x !== '' && x != null));
        return { getValues: () => used.map((r) => Array.from({ length: w }, (_, i) => (r[i] == null ? '' : r[i]))) };
      },
      appendRow(v) { s.raw.push(...v); rows.push(v.map(cell)); },
      deleteRow(r) { rows.splice(r - 1, 1); },
      getLastColumn() { return Math.max(0, ...rows.map((r) => (r ? r.length : 0))); },
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

module.exports = { mediu };
