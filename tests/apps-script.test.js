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
  ctx.testRezervare();
  assert.equal(mails.length, 2);
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

// ---- emailuri în jurul sejurului
function setare(sheets, cheie, val) {
  const r = sheets.Setari.rows.find((x) => x && x[0] === cheie);
  if (r) r[1] = val; else sheets.Setari.rows.push([cheie, val]);
}
// Rezervare confirmată pe orice interval (și în trecut): se creează în viitor, apoi i se mută datele în foaie
let liber = 100;
function confirmata(env, checkIn, checkOut, email = 'ana@example.com') {
  const r = post(env.ctx, cerere({ checkIn: plus(liber), checkOut: plus(liber + 2), guest: { name: 'Ana Pop', email, phone: '0722123456' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  liber += 3;
  const row = env.sheets.Rezervari.rows.find((x) => x && x[0] === r.id);
  row[2] = 'confirmata'; row[3] = checkIn; row[4] = checkOut;
  return row;
}
const col = (env, name) => env.sheets.Rezervari.rows[0].indexOf(name);

test('setările noi apar singure în Setari, o singură dată', () => {
  const env = mediu();
  post(env.ctx, cerere());
  const chei = env.sheets.Setari.rows.filter(Boolean).map((r) => r[0]);
  for (const k of ['emailuriSejur', 'zileInainteSosire', 'infoSosire', 'linkHarta', 'linkRecenzie']) assert.equal(chei.filter((x) => x === k).length, 1, k);
  assert.ok(col(env, 'preSosireTrimis') > 0 && col(env, 'recenzieTrimis') > 0);
});

test('înainte de sosire: pleacă o singură dată, cu textul gazdei escape-uit și pe rânduri', () => {
  const env = mediu();
  post(env.ctx, cerere({ checkIn: plus(40), checkOut: plus(42) })); // creează coloanele noi
  setare(env.sheets, 'infoSosire', 'Drumul: ultimii 2 km pe pietriș.\nWi-Fi: <cabana7>');
  setare(env.sheets, 'linkHarta', 'https://maps.app.goo.gl/x');
  const row = confirmata(env, plus(2), plus(4), 'b@example.com');
  const n0 = env.mails.length;
  assert.deepEqual({ ...env.ctx.emailuriSejur(true) }, { sosire: 1, recenzie: 0 });
  const m = env.mails.at(-1);
  assert.equal(m.to, 'b@example.com');
  assert.match(m.htmlBody, /pietriș\.<br>Wi-Fi: &lt;cabana7&gt;/);
  assert.match(m.htmlBody, /Deschide harta/);
  assert.ok(row[col(env, 'preSosireTrimis')]);
  env.ctx.emailuriSejur(true);
  assert.equal(env.mails.length, n0 + 1);
});

test('înainte de sosire: nu pleacă prea devreme, fără text, neconfirmată sau noaptea', () => {
  const env = mediu();
  post(env.ctx, cerere({ checkIn: plus(40), checkOut: plus(42) }));
  confirmata(env, plus(1), plus(3), 'c@example.com');
  const n0 = env.mails.length;
  assert.equal(env.ctx.emailuriSejur(true).sosire, 0); // infoSosire gol
  setare(env.sheets, 'infoSosire', 'Check-in de la 16:00.');
  env.ctx.__ora = 23;
  assert.equal(env.ctx.emailuriSejur().sosire, 0); // în afara orelor 9–20
  env.ctx.__ora = 10;
  assert.equal(env.ctx.emailuriSejur().sosire, 1);
  // rezervarea din 40 de zile e prea departe, iar cea în așteptare nu primește nimic
  assert.equal(env.mails.length, n0 + 1);
  setare(env.sheets, 'emailuriSejur', 'nu');
  confirmata(env, plus(2), plus(5), 'd@example.com');
  assert.equal(env.ctx.emailuriSejur(true).sosire, 0);
});

test('după plecare: recenzie a doua zi, doar dacă există link, nu pentru sejururi vechi', () => {
  const env = mediu();
  post(env.ctx, cerere({ checkIn: plus(40), checkOut: plus(42) }));
  const recent = confirmata(env, plus(-3), plus(-1), 'r@example.com');
  const vechi = confirmata(env, plus(-20), plus(-15), 'v@example.com');
  assert.equal(env.ctx.emailuriSejur(true).recenzie, 0); // fără linkRecenzie
  setare(env.sheets, 'linkRecenzie', 'https://g.page/r/abc/review');
  assert.equal(env.ctx.emailuriSejur(true).recenzie, 1);
  assert.match(env.mails.at(-1).htmlBody, /g\.page\/r\/abc\/review/);
  assert.equal(env.mails.at(-1).to, 'r@example.com');
  assert.ok(recent[col(env, 'recenzieTrimis')]);
  assert.ok(!vechi[col(env, 'recenzieTrimis')]);
});

test('admin: trimite manual emailul de sosire, doar pentru confirmate', () => {
  const env = cuParola(mediu());
  post(env.ctx, cerere({ checkIn: plus(40), checkOut: plus(42) }));
  const r = confirmata(env, plus(30), plus(33), 'm@example.com');
  assert.equal(adm(env.ctx, 'sejur', { id: r[0], kind: 'sosire' }).error, 'setup');
  setare(env.sheets, 'infoSosire', 'Cheia e la poartă.');
  assert.equal(adm(env.ctx, 'sejur', { id: r[0], kind: 'sosire' }).ok, true);
  assert.match(env.mails.at(-1).htmlBody, /Cheia e la poartă/);
  const l = adm(env.ctx, 'list');
  assert.deepEqual({ ...l.sejur }, { activ: true, info: true, recenzie: false, zile: 2 });
  const asteapta = env.sheets.Rezervari.rows.find((x) => x && x[2] === 'asteptare');
  assert.equal(adm(env.ctx, 'sejur', { id: asteapta[0], kind: 'sosire' }).error, 'status');
});

test('testEmail trimite toate cele 4 șabloane', () => {
  const env = mediu();
  env.ctx.testEmail();
  assert.equal(env.mails.length, 4);
});

test('emailuri: fără telefonul gazdei nu apare „sună la .”; camera apare cu numele de pe site', () => {
  const env = mediu();
  const { id } = post(env.ctx, cerere({ rooms: [{ type: 'cabana', name: 'Cabana întreagă', qty: 1 }] }));
  const guestMail = env.mails.find((m) => m.to === 'ana@example.com');
  assert.doesNotMatch(guestMail.htmlBody, /sună la/);
  assert.match(guestMail.htmlBody, /Răspunde la acest email\./);
  assert.match(guestMail.htmlBody, />Cabana întreagă</);
  setare(env.sheets, 'telefonGazda', '0722 000 111');
  const row = env.sheets.Rezervari.rows.find((r) => r && r[0] === id);
  const token = row[env.sheets.Rezervari.rows[0].indexOf('token')];
  env.ctx.actiuneGazda(id, token, 'confirm');
  assert.match(env.mails.at(-1).htmlBody, /sună la <a href="tel:0722000111"/);
});

// ---- Google Calendar
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function cuCalendar(env) {
  post(env.ctx, cerere({ checkIn: plus(60), checkOut: plus(62), guest: { name: 'Prima', email: 'p@example.com', phone: '0722123456' } })); // setările noi
  env.ctx.creareCalendar();
  const id = env.sheets.Setari.rows.find((r) => r && r[0] === 'calendarGoogle')[1];
  return env.ctx.CalendarApp.getCalendarById(id);
}

test('calendar: creareCalendar leagă calendarul și pune rezervările ca evenimente de toată ziua', () => {
  const env = cuParola(mediu());
  const cal = cuCalendar(env);
  assert.ok(cal);
  assert.equal(cal.events.length, 1);
  const ev = cal.events[0];
  assert.match(ev.title, /^⏳ Cerere: Prima · 2 pers\.$/);
  assert.equal(ymd(ev.start), plus(60));
  assert.equal(ymd(ev.end), plus(62)); // ziua plecării, exclusiv (ca în Google Calendar)
  assert.match(ev.description, /Telefon: 0722123456/);
  // o a doua rulare nu dublează nimic
  env.ctx.sincronizeazaCalendar();
  assert.equal(cal.events.length, 1);
});

test('calendar: confirmarea schimbă titlul, refuzul șterge, blocarea apare imediat', () => {
  const env = cuParola(mediu());
  const cal = cuCalendar(env);
  const id = env.sheets.Rezervari.rows[1][0];
  adm(env.ctx, 'status', { id, status: 'confirmata' });
  assert.equal(cal.events.length, 1);
  assert.equal(cal.events[0].title, 'Prima · 2 pers.');
  const b = adm(env.ctx, 'block', { unit: 'cabana', from: plus(70), to: plus(72), reason: 'familia' });
  assert.ok(cal.events.some((e) => e.title === 'Blocat: familia'));
  adm(env.ctx, 'unblock', { id: b.id });
  assert.ok(!cal.events.some((e) => e.title.startsWith('Blocat')));
  adm(env.ctx, 'status', { id, status: 'anulata' });
  assert.equal(cal.events.length, 0);
});

test('calendar: cererea nouă de pe site apare imediat; evenimentele altora din calendar nu sunt atinse', () => {
  const env = mediu();
  const cal = cuCalendar(env);
  cal.createAllDayEvent('Dentist', new Date(), new Date(Date.now() + 86400000)); // eveniment personal, fără tag
  post(env.ctx, cerere({ checkIn: plus(80), checkOut: plus(83), guest: { name: 'Doi', email: 'd2@example.com', phone: '0733123456' } }));
  assert.ok(cal.events.some((e) => e.title.includes('Doi')));
  env.ctx.sincronizeazaCalendar();
  assert.ok(cal.events.some((e) => e.title === 'Dentist'));
});

test('calendar: zilele din Booking.com apar, dar nu și ecoul propriilor rezervări', () => {
  const env = mediu();
  const cal = cuCalendar(env);
  const r = env.sheets.Rezervari.rows[1];
  env.sheets.Blocari.rows.push(['cabana', plus(90), plus(93), 'b1', '']);
  env.sheets.Blocari.rows.push(['cabana', r[3], r[4], 'ecou', '']); // Booking întoarce rezervarea noastră
  env.ctx.sincronizeazaCalendar();
  assert.equal(cal.events.filter((e) => e.title === 'Booking.com').length, 1);
});

test('calendar: fără calendarGoogle în Setari nu se întâmplă nimic', () => {
  const env = mediu();
  assert.deepEqual({ ...env.ctx.sincronizeazaCalendar() }, { create: 0, sterse: 0 });
});

