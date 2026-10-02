// Teste pentru core.js, fără librării:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../core.js');

test('date: validare, adunare, nopți', () => {
  assert.equal(Core.isDate('2026-02-28'), true);
  assert.equal(Core.isDate('2026-02-30'), false);
  assert.equal(Core.isDate('2026-2-3'), false);
  assert.equal(Core.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(Core.addDays('2026-03-29', 1), '2026-03-30'); // schimbarea orei de vară nu contează
  assert.equal(Core.nightsBetween('2026-10-29', '2026-11-02'), 4);
  assert.deepEqual(Core.eachNight('2026-10-30', '2026-11-01'), ['2026-10-30', '2026-10-31']);
});

test('suprapunere: check-out în aceeași zi cu check-in-ul altcuiva e liber', () => {
  assert.equal(Core.overlaps('2026-10-10', '2026-10-12', '2026-10-12', '2026-10-15'), false);
  assert.equal(Core.overlaps('2026-10-12', '2026-10-15', '2026-10-10', '2026-10-12'), false);
  assert.equal(Core.overlaps('2026-10-10', '2026-10-13', '2026-10-12', '2026-10-15'), true);
  assert.equal(Core.overlaps('2026-10-01', '2026-10-30', '2026-10-12', '2026-10-13'), true);
  const set = Core.busySet([{ from: '2026-10-10', to: '2026-10-12' }]);
  assert.equal(Core.isFree(set, '2026-10-12', '2026-10-14'), true);
  assert.equal(Core.isFree(set, '2026-10-08', '2026-10-10'), true);
  assert.equal(Core.isFree(set, '2026-10-11', '2026-10-13'), false);
});

const room = {
  id: 'cabana', price: 1000,
  seasons: [
    { name: 'vară', from: '06-15', to: '09-15', price: 1500 },
    { name: 'sărbători', from: '12-20', to: '01-05', price: 2000 },
  ],
  extraBed: { max: 1, price: 100 },
};

test('preț: sejur peste schimbarea de sezon', () => {
  const p = Core.priceStay([{ room, qty: 1 }], '2026-09-14', '2026-09-18', 0);
  // 14, 15 = vară; 16, 17 = bază
  assert.equal(p.nights, 4);
  assert.equal(p.total, 1500 * 2 + 1000 * 2);
});

test('preț: sezon peste Anul Nou, pat suplimentar, reducere informativă', () => {
  assert.equal(Core.nightPrice(room, '2026-12-31'), 2000);
  assert.equal(Core.nightPrice(room, '2027-01-05'), 2000);
  assert.equal(Core.nightPrice(room, '2027-01-06'), 1000);
  const p = Core.priceStay([{ room, qty: 2, extraBeds: 1 }], '2027-01-05', '2027-01-07', 10);
  assert.equal(p.total, 2000 * 2 + 1000 * 2 + 100 * 2);
  assert.equal(p.platform, Math.round(p.total / 0.9));
  assert.equal(p.discount, p.platform - p.total);
});

test('preț: lipsă de preț → total null, nu 0', () => {
  const p = Core.priceStay([{ room: { id: 'x', price: null }, qty: 1 }], '2026-10-01', '2026-10-03', 0);
  assert.equal(p.total, null);
  assert.equal(p.lines[0].amount, null);
});

test('sugestii: cele mai apropiate intervale libere de aceeași lungime', () => {
  const set = Core.busySet([{ from: '2026-10-10', to: '2026-10-15' }]);
  const free = (a, b) => Core.isFree(set, a, b);
  const s = Core.suggestDates('2026-10-11', '2026-10-13', free, '2026-10-01');
  assert.ok(s.length > 0);
  s.forEach((x) => assert.ok(free(x.checkIn, x.checkOut)));
  assert.deepEqual(s[0], { checkIn: '2026-10-08', checkOut: '2026-10-10' });
  // nu sugerează în trecut
  assert.ok(Core.suggestDates('2026-10-11', '2026-10-13', free, '2026-10-11').every((x) => x.checkIn >= '2026-10-11'));
});

test('iCal: evenimente pe mai multe zile, linii pliate, DATE-TIME, DTEND lipsă', () => {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Booking.com//EN',
    'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261010', 'DTEND;VALUE=DATE:20261015',
    'UID:abc@booking', 'SUMMARY:CLOSED - Not avail', ' able', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART:20261020T140000Z', 'DTEND:20261022T100000Z', 'UID:def', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261101', 'UID:ghi', 'END:VEVENT',
    'END:VCALENDAR', '',
  ].join('\r\n');
  assert.deepEqual(Core.parseICS(ics), [
    { uid: 'abc@booking', from: '2026-10-10', to: '2026-10-15' },
    { uid: 'def', from: '2026-10-20', to: '2026-10-22' },
    { uid: 'ghi', from: '2026-11-01', to: '2026-11-02' },
  ]);
  assert.deepEqual(Core.parseICS(''), []);
});

test('iCal: generarea se poate citi înapoi și are CRLF', () => {
  const out = Core.buildICS([{ uid: 'r1@site', from: '2026-10-10', to: '2026-10-12', summary: 'Rezervare directă' }], 'Cabana, test', '20261002T120000Z');
  assert.match(out, /\r\n/);
  assert.match(out, /X-WR-CALNAME:Cabana\\, test/);
  assert.ok(out.split('\r\n').every((l) => l.length <= 75));
  assert.deepEqual(Core.parseICS(out), [{ uid: 'r1@site', from: '2026-10-10', to: '2026-10-12' }]);
});

const ok = {
  checkIn: '2026-10-10', checkOut: '2026-10-12', adults: 2, children: [5],
  rooms: [{ type: 'cabana', qty: 1 }],
  guest: { name: 'Ana Pop', email: 'ana@example.com', phone: '0722 123 456' },
  consent: { data: true, offers: false },
};

test('validare: cerere corectă', () => {
  assert.deepEqual(Core.validateBooking(ok, '2026-10-01', { cabana: 2 }), []);
});

test('validare: date, minim de nopți, contact, acord', () => {
  assert.deepEqual(Core.validateBooking({ ...ok, checkIn: '2026-09-30' }, '2026-10-01'), ['checkIn']);
  assert.deepEqual(Core.validateBooking({ ...ok, checkOut: '2026-10-10' }, '2026-10-01'), ['checkOut']);
  assert.deepEqual(Core.validateBooking(ok, '2026-10-01', { cabana: 3 }), ['nights']);
  assert.deepEqual(Core.validateBooking({ ...ok, guest: { name: ' ', email: 'x', phone: '12' } }, '2026-10-01'), ['name', 'email', 'phone']);
  assert.deepEqual(Core.validateBooking({ ...ok, consent: { data: false } }, '2026-10-01'), ['consent']);
  assert.deepEqual(Core.validateBooking({ ...ok, children: [19] }, '2026-10-01'), ['children']);
  assert.ok(Core.validateBooking(null, '2026-10-01').length > 5);
});

test('șabloane: escape HTML implicit', () => {
  assert.equal(Core.fillTemplate('Bună, {{nume}}! {{{link}}} {{lipsa}}', { nume: '<b>Ana</b>', link: '<a>x</a>' }),
    'Bună, &lt;b&gt;Ana&lt;/b&gt;! <a>x</a> ');
});
