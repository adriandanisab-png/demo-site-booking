// Rulează apps-script/Code.gs în Node, cu servicii Google simulate în memorie
// (Sheet, Lock, Cache, Mail, UrlFetch). Verifică fluxul complet fără cont Google.
const test = require('node:test');
const assert = require('node:assert/strict');

const { mediu } = require('./gas-mock.cjs');

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

test('formule: textul oaspetelui nu devine formulă în Sheets, telefonul +40 rămâne', () => {
  const { ctx, sheets } = mediu();
  const { id } = post(ctx, cerere({ guest: { name: '=HYPERLINK("x")', email: 'f@example.com', phone: '+40 722 123 456', notes: '@cmd' } }));
  const row = sheets.Rezervari.rows.find((r) => r && r[0] === id);
  // scris cu apostrof → Sheets îl păstrează ca text, nu ca formulă
  assert.ok(sheets.Rezervari.raw.includes("'=HYPERLINK(\"x\")"));
  assert.equal(row[9], '=HYPERLINK("x")');
  assert.equal(row[11], '+40 722 123 456');
  assert.equal(row[13], '@cmd');
});

test('funcțiile de test din editor rulează', () => {
  const { ctx, mails } = mediu();
  ctx.testEmail();
  assert.equal(mails.length, 2);
  ctx.testRezervare();
  assert.equal(mails.length, 4);
});

const adm = (ctx, op, extra = {}) => post(ctx, { action: 'admin', password: 'parola-lunga-1', op, ...extra });
function cuParola(env) {
  env.sheets.Setari.rows.find((r) => r && r[0] === 'parolaAdmin')[1] = 'parola-lunga-1';
  return env;
}

test('admin: fără parolă setată e oprit; parolă greșită refuzată și limitată', () => {
  const env = mediu();
  assert.equal(adm(env.ctx, 'list').error, 'setup');
  cuParola(env);
  assert.equal(post(env.ctx, { action: 'admin', password: 'gresit', op: 'list' }).error, 'auth');
  for (let i = 0; i < 10; i++) post(env.ctx, { action: 'admin', password: 'gresit', op: 'list' });
  assert.equal(adm(env.ctx, 'list').error, 'blocat');
});

test('admin: lista fără token, confirmare, avans, notă, anulare', () => {
  const env = cuParola(mediu());
  const { ctx, mails } = env;
  const { id } = post(ctx, cerere());
  let l = adm(ctx, 'list');
  assert.equal(l.ok, true);
  assert.equal(l.rezervari.length, 1);
  assert.equal(l.rezervari[0].token, undefined);
  assert.deepEqual(l.camere.map((c) => c.unit), ['cabana']);
  assert.equal(adm(ctx, 'status', { id, status: 'anulata' }).error, 'status'); // în așteptare nu se anulează
  assert.equal(adm(ctx, 'status', { id, status: 'confirmata' }).ok, true);
  assert.match(mails.at(-1).subject, /Rezervare confirmată/);
  adm(ctx, 'paid', { id, value: true });
  adm(ctx, 'note', { id, text: '=avans cash' });
  l = adm(ctx, 'list');
  assert.ok(l.rezervari[0].avansPlatit);
  assert.equal(l.rezervari[0].notaGazda, '=avans cash');
  assert.equal(adm(ctx, 'status', { id, status: 'anulata' }).ok, true);
  assert.match(mails.at(-1).subject, /anulată/);
  const av = JSON.parse(get(ctx, { action: 'availability', from: plus(0), to: plus(30) }).text);
  assert.deepEqual(av.busy.cabana, []);
});

test('admin: blocare manuală ocupă zilele, apare în .ics, nu se suprapune cu o rezervare, se șterge', () => {
  const env = cuParola(mediu());
  const { ctx, sheets } = env;
  post(ctx, cerere());
  assert.equal(adm(ctx, 'block', { unit: 'cabana', from: plus(11), to: plus(12) }).error, 'overlap');
  assert.equal(adm(ctx, 'block', { unit: 'nu', from: plus(1), to: plus(2) }).error, 'invalid');
  const b = adm(ctx, 'block', { unit: 'cabana', from: plus(20), to: plus(23), reason: 'familia' });
  assert.equal(b.ok, true);
  let av = JSON.parse(get(ctx, { action: 'availability', from: plus(0), to: plus(30) }).text);
  assert.deepEqual(av.busy.cabana, [plus(10), plus(11), plus(12), plus(20), plus(21), plus(22)]);
  const key = sheets.Setari.rows.find((r) => r && r[0] === 'camera')[4];
  assert.match(get(ctx, { action: 'ical', room: 'cabana', key }).text, /SUMMARY:Blocat/);
  // cererea de pe site pe zile blocate e refuzată
  assert.equal(post(ctx, cerere({ checkIn: plus(21), checkOut: plus(22), guest: { name: 'X', email: 'x@example.com', phone: '0733123456' } })).error, 'unavailable');
  // importul Booking.com nu șterge blocările manuale
  ctx.importaToate();
  assert.equal(adm(ctx, 'list').manuale.length, 1);
  assert.equal(adm(ctx, 'unblock', { id: b.id }).ok, true);
  av = JSON.parse(get(ctx, { action: 'availability', from: plus(0), to: plus(30) }).text);
  assert.deepEqual(av.busy.cabana, [plus(10), plus(11), plus(12)]);
});

test('migrare: o foaie Rezervari veche primește coloanele noi', () => {
  const env = mediu();
  const head = env.sheets.Rezervari.rows[0];
  head.splice(head.indexOf('avansPlatit'));       // ca la versiunea 1
  env.ctx.foaie('Rezervari', env.ctx.COL_REZ || []);
  env.ctx.pregateste();
  // cache-ul de schemă e gol în testul nou, deci pregateste a rulat
  const h = env.sheets.Rezervari.rows[0];
  assert.ok(h.includes('avansPlatit') && h.includes('notaGazda'));
  const { id } = post(env.ctx, cerere());
  assert.ok(env.sheets.Rezervari.rows.find((r) => r && r[0] === id));
});

test('Sheets nu transformă textul: copii, ora sosirii și telefonul rămân exact', () => {
  const { ctx, sheets } = mediu();
  const { id } = post(ctx, cerere({ children: [9, 1], guest: { name: 'Ianis', email: 'i@example.com', phone: '0724385355', arrival: '16:00', notes: '' } }));
  const row = sheets.Rezervari.rows.find((r) => r && r[0] === id);
  assert.equal(row[8], '9, 1');
  assert.equal(row[11], '0724385355');
  assert.equal(row[12], '16:00');
  assert.equal(row[7], 2); // numerele rămân numere
});
