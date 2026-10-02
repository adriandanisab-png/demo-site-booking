// Fluxul de rezervare: 1 Caută · 2 Camera · 3 Detalii · 4 Confirmare.
// Starea stă într-un singur obiect, așa că „Înapoi” nu pierde nimic.
// Fără appsScriptUrl: MOD DEMO (disponibilitate din config, nimic trimis).
(function () {
  var A = window.App, S = A.S, esc = A.esc, L = A.L, T = A.T;
  var B = S.booking || {};
  var ROOMS = S.rooms || [];
  var LIVE = !!S.appsScriptUrl;
  var cur = B.currency || 'lei';

  var BK = {
    ro: {
      title: ['rezervă', 'direct'], steps: ['Caută', 'Camera', 'Detalii', 'Confirmare'],
      back: 'Înapoi', close: 'Închide', next: 'Continuă', send: 'Trimite cererea', sending: 'Se trimite…',
      datesTitle: 'când veniți?', datesHint: 'Alege ziua sosirii, apoi ziua plecării.',
      prevMonth: 'Luna anterioară', nextMonth: 'Luna următoare', dow: ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'],
      legendBusy: 'ocupat', legendSel: 'selecția ta', loading: 'Se verifică disponibilitatea…',
      loadErr: 'Nu am putut verifica disponibilitatea acum. Poți trimite cererea: gazda o verifică înainte să confirme.',
      adults: 'Adulți', adultsHint: '18+ ani', children: 'Copii', childrenHint: '0–17 ani', childAge: function (i) { return 'Vârsta copilului ' + i; },
      years: function (n) { return n === 1 ? '1 an' : n + ' ani'; }, under1: 'sub 1 an',
      minNights: function (n) { return 'Minimum ' + n + ' nopți pentru aceste date.'; },
      pickBoth: 'Alege ambele date: sosirea și plecarea.',
      noneFree: 'În perioada aleasă nu mai e liber.', tryThese: 'Cele mai apropiate date libere:',
      noSuggest: 'Nu am găsit date libere apropiate. Sună-ne și căutăm împreună.',
      tooMany: function (n) { return 'Aveți loc pentru cel mult ' + n + ' persoane. Reduceți numărul de oaspeți sau alegeți mai multe camere.'; },
      tooManyOne: function (n) { return 'Încap cel mult ' + n + ' persoane.'; },
      roomsTitle: 'alege camera', roomsHint: 'Apar doar camerele libere pe toată perioada.',
      free: function (n) { return n === 1 ? 'mai e 1 liberă' : 'mai sunt ' + n + ' libere'; },
      qty: 'Câte', extraBeds: 'Paturi suplimentare', persons: 'persoane', totalFor: function (n) { return 'total pentru ' + n; },
      pickRoom: 'Alege cel puțin o cameră.',
      detailsTitle: 'detaliile tale', name: 'Nume și prenume', email: 'Email', phone: 'Telefon',
      arrival: 'Ora estimată de sosire', optional: '(opțional)', notes: 'Cereri speciale',
      notesPh: 'Sosire târziu, pătuț pentru bebeluș, animal de companie…',
      consentData: 'Sunt de acord cu prelucrarea datelor mele pentru această rezervare, conform', privacy: 'Politicii de confidențialitate',
      consentOffers: 'Vreau să primesc pe email, rar, oferte pentru sejururi viitoare.',
      fixFields: 'Verifică câmpurile marcate.',
      errors: { name: 'Scrie numele.', email: 'Emailul nu pare corect.', phone: 'Telefonul nu pare corect.', consent: 'Bifează acordul pentru prelucrarea datelor.' },
      doneTitle: function (n) { return 'mulțumim, ' + n + '!'; },
      doneText: function (h) { return 'Cererea ta a fost trimisă. Gazda o confirmă în cel mult ' + h + ' ore.'; },
      next1: 'Primești acum un email cu cererea ta.', next2: 'Gazda verifică și confirmă; primești al doilea email.', next3: 'Plătești avansul, după instrucțiunile din email.',
      demoNote: 'Machetă: cererea nu a fost trimisă nicăieri.', seeGuestMail: 'Emailul pentru oaspete', seeHostMail: 'Emailul pentru gazdă',
      sumTitle: 'Rezumat', sumDates: 'Perioada', sumNights: 'Nopți', sumGuests: 'Oaspeți', sumRoom: 'Camera', total: 'Total',
      platformPrice: 'Pe platforme', directSaves: 'Economisești', estimate: 'Totalul e estimat; gazda îl confirmă.',
      priceMissing: 'PREȚ', deposit: 'Avans', cancellation: 'Anulare', chooseDates: 'Alege datele',
      sendErr: 'Nu am putut trimite cererea.', callUs: function (p) { return ' Sună-ne la ' + p + '.'; },
      unavailableNow: 'Între timp, perioada aleasă s-a ocupat.'
    }
  };
  var t = Object.assign({}, BK.ro, BK[A.lang] || {}, (S.ui && S.ui.booking) || {});

  // ---------------------------------------------------------------- stare
  var today = isoToday();
  var st = { step: 1, checkIn: null, checkOut: null, adults: 2, children: [], sel: {}, room: null,
    guest: { name: '', email: '', phone: '', arrival: '', notes: '' }, consent: { data: false, offers: false },
    errors: [], msg: '', suggestions: null, sending: false, done: null };
  var busy = null;          // { unitId: { "AAAA-LL-ZZ": true } }
  var loadState = 'idle';   // idle | loading | ok | error
  var month = today.slice(0, 7);
  var root = document.getElementById('booking');
  var lastFocus = null;

  function isoToday() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmt(iso, opts) {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString(A.lang + '-RO', Object.assign({ timeZone: 'UTC', day: 'numeric', month: 'short' }, opts || {}));
  }
  function money(n) { return n == null ? null : Math.round(n).toLocaleString('ro-RO') + ' ' + cur; }
  function nights() { return st.checkIn && st.checkOut ? Core.nightsBetween(st.checkIn, st.checkOut) : 0; }
  function persons() { return st.adults + st.children.length; }
  function roomById(id) { return ROOMS.filter(function (r) { return r.id === id; })[0]; }
  function setOf(u) { return (busy && busy[u]) || {}; }
  function freeUnits(r, a, b) { return (r.units || []).filter(function (u) { return Core.isFree(setOf(u), a, b); }); }
  // Tipurile luate în calcul în calendar: camera preselectată sau toate
  function scope() { return st.room ? [roomById(st.room)].filter(Boolean) : ROOMS; }
  function anyFree(a, b) { return scope().some(function (r) { return freeUnits(r, a, b).length > 0; }); }
  function nightFull(d) { return !anyFree(d, Core.addDays(d, 1)); }
  function minNights() {
    var m = scope().map(function (r) { return r.minNights || 1; });
    return m.length ? Math.min.apply(null, m) : 1;
  }

  // ---------------------------------------------------------------- disponibilitate
  function loadAvailability() {
    if (loadState === 'ok' || loadState === 'loading') return;
    if (!LIVE) { busy = demoBusy(); loadState = 'ok'; return; }
    loadState = 'loading';
    var url = S.appsScriptUrl + '?action=availability&from=' + today + '&to=' + Core.addDays(today, 400);
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.message || 'availability');
      busy = {};
      Object.keys(j.busy || {}).forEach(function (u) { busy[u] = {}; j.busy[u].forEach(function (d) { busy[u][d] = true; }); });
      loadState = 'ok';
    }).catch(function () { busy = {}; loadState = 'error'; }).then(draw);
  }
  function demoBusy() {
    var out = {};
    (B.demoBusy || []).forEach(function (x) {
      var from = Core.addDays(today, x.inDays);
      out[x.unit] = out[x.unit] || {};
      Core.eachNight(from, Core.addDays(from, x.nights)).forEach(function (d) { out[x.unit][d] = true; });
    });
    return out;
  }

  // ---------------------------------------------------------------- deschidere / închidere
  function open(o) {
    o = o || {};
    lastFocus = document.activeElement;
    if (o.room && roomById(o.room)) { st.room = o.room; if (st.step > 2) st.step = 1; }
    if (st.done) reset();
    loadAvailability();
    root.hidden = false;
    document.body.classList.add('locked');
    draw();
    requestAnimationFrame(function () { root.classList.add('open'); var h = root.querySelector('h2'); if (h) h.focus(); });
  }
  function close() {
    root.classList.remove('open');
    document.body.classList.remove('locked');
    setTimeout(function () { root.hidden = true; }, 450);
    if (lastFocus) lastFocus.focus();
  }
  function reset() {
    st.step = 1; st.sel = {}; st.done = null; st.errors = []; st.msg = ''; st.suggestions = null;
  }

  // ---------------------------------------------------------------- randare
  function draw() {
    var keepScroll = root.querySelector('.bk-main');
    var top = keepScroll ? keepScroll.scrollTop : 0;
    var stepHtml = st.step === 1 ? step1() : st.step === 2 ? step2() : st.step === 3 ? step3() : step4();
    var skip2 = A.units === 1;
    root.innerHTML = '<div class="bk-back" data-x="close"></div>' +
      '<div class="bk-panel" role="dialog" aria-modal="true" aria-label="' + esc(t.title.join(' ')) + '">' +
      '<div class="bk-top">' +
        (st.step > 1 && st.step < 4 ? '<button class="round" type="button" data-x="back" aria-label="' + esc(t.back) + '" style="background:var(--bg-2);color:var(--ink)">‹</button>' : '<span style="width:42px"></span>') +
        '<ol class="steps">' + t.steps.map(function (s, i) {
          if (skip2 && i === 1) return '';
          var n = skip2 && i > 1 ? i : i + 1;
          return '<li class="' + (st.step === i + 1 ? 'on' : st.step > i + 1 ? 'done' : '') + '"' + (st.step === i + 1 ? ' aria-current="step"' : '') + '><b>' + n + '</b><span>' + esc(s) + '</span></li>';
        }).join('') + '</ol>' +
        '<button class="round" type="button" data-x="close" aria-label="' + esc(t.close) + '">×</button>' +
      '</div>' +
      '<div class="bk-body"><div class="bk-main"><div class="bk-step">' + stepHtml + '</div>' + navButtons() + '</div>' +
      '<aside class="bk-sum" aria-label="' + esc(t.sumTitle) + '">' + summary() + '</aside></div>' +
      (st.step < 4 ? bar() : '') + '</div>';
    if (st.step === 1 && keepScroll) root.querySelector('.bk-main').scrollTop = top;
    A.updateSearch(st);
  }

  function navButtons() {
    if (st.step === 4) return '';
    return '<div class="bk-nav">' +
      (st.step > 1 ? '<button class="btn ghost plain" type="button" data-x="back">' + esc(t.back) + '</button>' : '') +
      '<button class="btn" type="button" data-x="next"' + (st.sending ? ' disabled' : '') + '>' + esc(st.step === 3 ? (st.sending ? t.sending : t.send) : t.next) + A.btnIco() + '</button></div>';
  }

  function bar() {
    var p = price();
    var line = st.checkIn && st.checkOut ? fmt(st.checkIn) + ' – ' + fmt(st.checkOut) + ' · ' + A.ui.nightsN(nights()) : t.chooseDates;
    return '<div class="bk-bar"><div class="mini">' + esc(line) + '<b>' + (p && p.total != null ? esc(money(p.total)) : '') + '</b></div>' +
      '<button class="btn" type="button" data-x="next"' + (st.sending ? ' disabled' : '') + '>' + esc(st.step === 3 ? (st.sending ? t.sending : t.send) : t.next) + A.btnIco() + '</button></div>';
  }

  // ---- pasul 1: date și oaspeți
  function step1() {
    var mobile = !matchMedia('(min-width: 720px)').matches;
    var months = [month]; if (!mobile) months.push(nextMonth(month, 1));
    var canPrev = month > today.slice(0, 7);
    var mn = minNights();
    var html = '<h2 tabindex="-1">' + esc(t.datesTitle) + '</h2><p class="hint">' + esc(t.datesHint) + (mn > 1 ? ' ' + esc(t.minNights(mn)) : '') + '</p>';
    if (loadState === 'loading') html += '<p class="warn" role="status">' + esc(t.loading) + '</p>';
    if (loadState === 'error') html += '<p class="warn" role="status">' + esc(t.loadErr) + '</p>';
    html += '<div class="cal-head"><button class="round" type="button" data-x="prev" aria-label="' + esc(t.prevMonth) + '"' + (canPrev ? '' : ' disabled') + '>‹</button>' +
      '<span class="sr" aria-live="polite">' + months.map(monthName).join(', ') + '</span>' +
      '<button class="round" type="button" data-x="nextm" aria-label="' + esc(t.nextMonth) + '">›</button></div>' +
      '<div class="cal-months">' + months.map(cal).join('') + '</div>' +
      '<div class="cal-legend"><span><s>12</s> ' + esc(t.legendBusy) + '</span><span>● ' + esc(t.legendSel) + '</span></div>';
    if (st.msg) html += '<p class="err" role="alert">' + esc(st.msg) + '</p>';
    if (st.suggestions) {
      html += st.suggestions.length
        ? '<div class="warn"><p style="margin:0 0 10px">' + esc(t.tryThese) + '</p><div style="display:flex;gap:8px;flex-wrap:wrap">' + st.suggestions.map(function (s) {
          return '<button class="btn ghost plain" type="button" data-x="suggest" data-in="' + s.checkIn + '" data-out="' + s.checkOut + '">' + esc(fmt(s.checkIn) + ' – ' + fmt(s.checkOut)) + '</button>';
        }).join('') + '</div></div>'
        : '<p class="warn">' + esc(t.noSuggest) + '</p>';
    }
    html += '<div class="guests" id="bk-guests">' +
      '<div class="g-row"><div>' + esc(t.adults) + '<small>' + esc(t.adultsHint) + '</small></div>' + stepper('adults', st.adults, 1, 30) + '</div>' +
      '<div class="g-row"><div>' + esc(t.children) + '<small>' + esc(t.childrenHint) + '</small></div>' + stepper('children', st.children.length, 0, 10) + '</div>' +
      (st.children.length ? '<div class="ages">' + st.children.map(function (age, i) {
        return '<label>' + esc(t.childAge(i + 1)) + '<select data-age="' + i + '">' + ages(age) + '</select></label>';
      }).join('') + '</div>' : '') + '</div>';
    return html;
  }
  function ages(sel) {
    var o = '';
    for (var a = 0; a <= 17; a++) o += '<option value="' + a + '"' + (a === sel ? ' selected' : '') + '>' + esc(a === 0 ? t.under1 : t.years(a)) + '</option>';
    return o;
  }
  function stepper(name, val, min, max) {
    return '<div class="stepper"><button type="button" data-step="' + name + '" data-d="-1" aria-label="−"' + (val <= min ? ' disabled' : '') + '>−</button>' +
      '<output aria-live="polite">' + val + '</output>' +
      '<button type="button" data-step="' + name + '" data-d="1" aria-label="+"' + (val >= max ? ' disabled' : '') + '>+</button></div>';
  }
  function nextMonth(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + String(m + 1).padStart(2, '0');
  }
  function monthName(ym) { return new Date(ym + '-15T12:00:00Z').toLocaleDateString(A.lang + '-RO', { month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  function cal(ym) {
    var first = ym + '-01';
    var dow = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7; // luni = 0
    var days = Core.nightsBetween(first, nextMonth(ym, 1) + '-01');
    var picking = st.checkIn && !st.checkOut;
    var cells = t.dow.map(function (d) { return '<span class="dow" aria-hidden="true">' + esc(d) + '</span>'; }).join('');
    for (var i = 0; i < dow; i++) cells += '<span></span>';
    for (var k = 1; k <= days; k++) {
      var d = ym + '-' + String(k).padStart(2, '0');
      var past = d < today;
      var full = !past && busy && nightFull(d);
      // o zi ocupată poate fi zi de plecare, dacă nopțile dinainte sunt libere
      var asOut = picking && d > st.checkIn && anyFree(st.checkIn, d);
      var disabled = past || (full && !asOut);
      var cls = ['day'];
      if (past) cls.push('past'); else if (full) cls.push('busy');
      if (d === st.checkIn) cls.push('start');
      if (d === st.checkOut) cls.push('end');
      if (st.checkIn && st.checkOut && d > st.checkIn && d < st.checkOut) cls.push('in-range');
      var label = fmt(d, { weekday: 'long', month: 'long', year: 'numeric' }) + (full ? ', ' + t.legendBusy : '');
      cells += '<button type="button" class="' + cls.join(' ') + '" data-day="' + d + '"' + (disabled ? ' disabled' : '') +
        ' aria-label="' + esc(label) + '"' + (d === st.checkIn || d === st.checkOut ? ' aria-pressed="true"' : '') + '><span>' + k + '</span></button>';
    }
    return '<div class="cal"><h4>' + esc(monthName(ym)) + '</h4><div class="cal-grid">' + cells + '</div></div>';
  }

  // ---- pasul 2: camerele libere
  function step2() {
    var list = ROOMS.map(function (r) { return { r: r, free: freeUnits(r, st.checkIn, st.checkOut).length }; }).filter(function (x) { return x.free > 0; });
    return '<h2 tabindex="-1">' + esc(t.roomsTitle) + '</h2><p class="hint">' + esc(t.roomsHint) + '</p>' +
      '<div class="av-list">' + list.map(function (x) {
        var r = x.r, q = (st.sel[r.id] || {}).qty || 0;
        var one = Core.priceStay([{ room: r, qty: 1 }], st.checkIn, st.checkOut, B.discountPercent);
        var maxQ = Math.min(x.free, B.maxRooms || 10);
        var beds = (r.extraBed && r.extraBed.max) || 0;
        return '<article class="av"><div class="av-in">' + A.photo((r.images || [])[0]) +
          '<div><h3>' + T(r.name) + '</h3><p class="meta">' + (r.capacity ? r.capacity + ' ' + esc(t.persons) : '') + (L(r.beds) ? ' · ' + T(r.beds) : '') + (L(r.size) ? ' · ' + T(r.size) : '') + '</p>' +
          (r.amenities && r.amenities.length ? '<p class="meta">' + r.amenities.map(T).join(' · ') + '</p>' : '') +
          '<p class="meta">' + esc(t.free(x.free)) + '</p>' +
          '<div class="foot"><div><div class="total">' + (one.total != null ? esc(money(one.total)) : A.ph(t.priceMissing)) + '</div><small class="meta">' + esc(t.totalFor(A.ui.nightsN(nights()))) + '</small>' +
          (B.discountPercent && one.total != null ? '<div><span class="badge">' + esc(A.ui.directDiscount(B.discountPercent)) + '</span></div>' : '') + '</div>' +
          '<div class="g-row" style="border:0;padding:0;gap:16px"><span>' + esc(t.qty) + '</span>' + stepper('room:' + r.id, q, 0, maxQ) + '</div></div>' +
          (beds && q ? '<div class="g-row" style="border:0;padding:8px 0 0"><span>' + esc(t.extraBeds) + '</span>' + stepper('bed:' + r.id, (st.sel[r.id] || {}).beds || 0, 0, beds * q) + '</div>' : '') +
          terms() + '</div></div></article>';
      }).join('') + '</div>' + (st.msg ? '<p class="err" role="alert">' + esc(st.msg) + '</p>' : '');
  }
  function terms() {
    var out = [];
    if (A.real(B.cancellation)) out.push(esc(t.cancellation) + ': ' + T(B.cancellation)); else if (!A.clean) out.push(esc(t.cancellation) + ': ' + A.ph('POLITICĂ DE ANULARE'));
    if (A.real(B.deposit)) out.push(esc(t.deposit) + ': ' + T(B.deposit)); else if (!A.clean) out.push(esc(t.deposit) + ': ' + A.ph('AVANS'));
    return out.length ? '<p class="terms">' + out.join('<br>') + '</p>' : '';
  }

  // ---- pasul 3: detalii
  function step3() {
    var g = st.guest, bad = function (f) { return st.errors.indexOf(f) >= 0 ? ' bad' : ''; };
    var err = function (f) { return st.errors.indexOf(f) >= 0 ? '<span class="err" style="margin:0">' + esc(t.errors[f]) + '</span>' : ''; };
    var privacy = S.legal && S.legal.privacyUrl
      ? '<a href="' + esc(S.legal.privacyUrl) + '" target="_blank" rel="noopener">' + esc(t.privacy) + '</a>'
      : '<a href="#" data-demo="link">' + esc(t.privacy) + '</a>';
    return '<h2 tabindex="-1">' + esc(t.detailsTitle) + '</h2>' +
      '<form class="form" id="bk-form" novalidate>' +
      '<label class="f' + bad('name') + '">' + esc(t.name) + '<input name="name" autocomplete="name" required value="' + esc(g.name) + '">' + err('name') + '</label>' +
      '<div class="two"><label class="f' + bad('email') + '">' + esc(t.email) + '<input name="email" type="email" inputmode="email" autocomplete="email" required value="' + esc(g.email) + '">' + err('email') + '</label>' +
      '<label class="f' + bad('phone') + '">' + esc(t.phone) + '<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required value="' + esc(g.phone) + '">' + err('phone') + '</label></div>' +
      '<label class="f">' + esc(t.arrival) + ' <small>' + esc(t.optional) + '</small><input name="arrival" type="time" step="900" value="' + esc(g.arrival) + '"></label>' +
      '<label class="f">' + esc(t.notes) + ' <small>' + esc(t.optional) + '</small><textarea name="notes" maxlength="1000" placeholder="' + esc(t.notesPh) + '">' + esc(g.notes) + '</textarea></label>' +
      '<label class="check' + bad('consent') + '"><input type="checkbox" name="consentData"' + (st.consent.data ? ' checked' : '') + '><span>' + esc(t.consentData) + ' ' + privacy + '.</span></label>' + err('consent') +
      '<label class="check"><input type="checkbox" name="consentOffers"' + (st.consent.offers ? ' checked' : '') + '><span>' + esc(t.consentOffers) + '</span></label>' +
      // capcană pentru boți; numele nu seamănă cu nimic ce completează automat browserul (un câmp „website” poate fi umplut de autofill)
      '<input type="text" name="bk_hp_7f" tabindex="-1" autocomplete="off" data-lpignore="true" data-1p-ignore aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">' +
      (st.msg ? '<p class="err" role="alert">' + esc(st.msg) + '</p>' : '') +
      '</form>';
  }

  // ---- pasul 4: confirmare
  function step4() {
    var d = st.done, first = String(d.name || '').trim().split(/\s+/)[0] || d.name;
    var hours = B.confirmHours ? String(B.confirmHours) : (A.clean ? '24' : '[ORE]');
    return '<div class="done"><h2 class="big" tabindex="-1">' + esc(t.doneTitle(first)) + '</h2>' +
      '<p class="lead">' + T(t.doneText(hours)) + '</p>' +
      '<div class="bk-sum" style="display:block;border:0;padding:0;background:none;margin:24px 0">' + summary(true) + '</div>' +
      '<ol><li>' + esc(t.next1) + '</li><li>' + esc(t.next2) + '</li><li>' + esc(t.next3) + '</li></ol>' +
      (d.demo ? '<p class="warn">' + esc(t.demoNote) + '</p><div class="links">' +
        '<button class="btn ghost plain" type="button" data-x="mail" data-tpl="email-confirmare">' + esc(t.seeGuestMail) + '</button>' +
        '<button class="btn ghost plain" type="button" data-x="mail" data-tpl="email-gazda">' + esc(t.seeHostMail) + '</button></div>' : '') +
      '<div class="links"><button class="btn" type="button" data-x="close">' + esc(t.close) + A.btnIco() + '</button></div></div>';
  }

  // ---------------------------------------------------------------- preț și rezumat
  function lines() {
    return Object.keys(st.sel).filter(function (id) { return st.sel[id].qty > 0 && roomById(id); })
      .map(function (id) { return { room: roomById(id), qty: st.sel[id].qty, extraBeds: st.sel[id].beds || 0 }; });
  }
  function price() {
    if (!st.checkIn || !st.checkOut) return null;
    var l = lines();
    if (!l.length) return null;
    return Core.priceStay(l, st.checkIn, st.checkOut, B.discountPercent);
  }
  function guestsText() { return A.ui.adultsN(st.adults) + (st.children.length ? ', ' + A.ui.childrenN(st.children.length) : ''); }
  function summary(final) {
    var p = price(), l = lines();
    var row = function (k, v) { return '<div class="sum-row"><span>' + esc(k) + '</span><span>' + v + '</span></div>'; };
    var h = final ? '' : '<h3>' + esc(t.sumTitle) + '</h3>';
    h += row(t.sumDates, st.checkIn ? esc(fmt(st.checkIn, { weekday: 'short' })) + ' – ' + (st.checkOut ? esc(fmt(st.checkOut, { weekday: 'short', year: 'numeric' })) : '…') : '—');
    if (nights()) h += row(t.sumNights, esc(String(nights())));
    h += row(t.sumGuests, esc(guestsText()));
    if (l.length) h += row(t.sumRoom, l.map(function (x) { return (x.qty > 1 ? x.qty + ' × ' : '') + T(x.room.name); }).join('<br>'));
    if (p) {
      if (p.total != null && B.discountPercent) {
        h += row(t.platformPrice, '<s>' + esc(money(p.platform)) + '</s>');
        h += row(t.directSaves, esc(money(p.discount)));
      }
      h += '<div class="sum-total"><span>' + esc(t.total) + '</span><b>' + (p.total != null ? esc(money(p.total)) : A.ph(t.priceMissing)) + '</b></div>';
      h += '<p class="sum-note">' + esc(t.estimate) + '</p>';
    }
    return h;
  }

  // ---------------------------------------------------------------- acțiuni
  function pickDay(d) {
    st.msg = ''; st.suggestions = null;
    var picking = st.checkIn && !st.checkOut;
    if (picking && d > st.checkIn) {
      if (anyFree(st.checkIn, d)) st.checkOut = d;
      else if (!nightFull(d)) { st.checkIn = d; st.checkOut = null; }
    } else if (!nightFull(d)) { st.checkIn = d; st.checkOut = null; }
    draw();
  }

  function next() {
    st.msg = '';
    if (st.step === 1) {
      if (!st.checkIn || !st.checkOut) { st.msg = t.pickBoth; return draw(); }
      var n = nights(), mn = minNights();
      if (n < mn) { st.msg = t.minNights(mn); return draw(); }
      if (!anyFree(st.checkIn, st.checkOut)) {
        st.msg = t.noneFree;
        st.suggestions = Core.suggestDates(st.checkIn, st.checkOut, anyFree, today);
        return draw();
      }
      st.suggestions = null;
      if (A.units === 1) {
        // o singură unitate (ex. cabana întreagă): pasul 2 se sare
        var r = ROOMS.filter(function (x) { return (x.units || []).length; })[0];
        st.sel = {}; st.sel[r.id] = { qty: 1, beds: 0 };
        if (r.capacity && persons() > r.capacity) { st.msg = t.tooManyOne(r.capacity); return draw(); }
        st.step = 3; return draw();
      }
      // preselectează camera aleasă de pe pagină, dacă e liberă
      if (st.room && !Object.keys(st.sel).length) {
        var pr = roomById(st.room);
        if (pr && freeUnits(pr, st.checkIn, st.checkOut).length) st.sel[pr.id] = { qty: 1, beds: 0 };
      }
      st.step = 2; return draw();
    }
    if (st.step === 2) {
      var l = lines();
      if (!l.length) { st.msg = t.pickRoom; return draw(); }
      var cap = l.reduce(function (s, x) { return s + (x.room.capacity || 0) * x.qty + (x.extraBeds || 0); }, 0);
      if (cap && persons() > cap) { st.msg = t.tooMany(cap); return draw(); }
      st.step = 3; return draw();
    }
    if (st.step === 3) return submit();
  }

  function back() {
    st.msg = ''; st.errors = [];
    st.step = st.step === 3 && A.units === 1 ? 1 : Math.max(1, st.step - 1);
    draw();
  }

  function readForm() {
    var f = document.getElementById('bk-form');
    if (!f) return;
    ['name', 'email', 'phone', 'arrival', 'notes'].forEach(function (k) { st.guest[k] = f.elements[k].value; });
    st.consent.data = f.elements.consentData.checked;
    st.consent.offers = f.elements.consentOffers.checked;
    st.website = f.elements.bk_hp_7f.value;
  }

  function payload() {
    var p = price();
    return {
      action: 'book', lang: A.lang, checkIn: st.checkIn, checkOut: st.checkOut,
      adults: st.adults, children: st.children.slice(),
      rooms: lines().map(function (x) { return { type: x.room.id, qty: x.qty, extraBeds: x.extraBeds }; }),
      total: p ? p.total : null, currency: cur,
      guest: { name: st.guest.name.trim(), email: st.guest.email.trim(), phone: st.guest.phone.trim(), arrival: st.guest.arrival, notes: st.guest.notes.trim() },
      consent: { data: st.consent.data, offers: st.consent.offers }, website: st.website || ''
    };
  }

  function submit() {
    readForm();
    var body = payload();
    var minN = {}; ROOMS.forEach(function (r) { minN[r.id] = r.minNights || 1; });
    st.errors = Core.validateBooking(body, today, minN).filter(function (f) { return t.errors[f]; });
    if (st.errors.length) { st.msg = t.fixFields; draw(); var el = root.querySelector('.bad input'); if (el) el.focus(); return; }
    st.msg = ''; st.sending = true; draw();
    var done = function (res) { st.sending = false; st.done = Object.assign({ name: body.guest.name }, res); st.step = 4; draw(); };
    if (!LIVE) return setTimeout(function () { done({ demo: true, id: 'DEMO-' + Date.now().toString(36).toUpperCase() }); }, 700);
    fetch(S.appsScriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.ok) return done({ id: j.id });
        st.sending = false;
        if (j.error === 'unavailable') {
          // între timp s-a ocupat: înapoi la calendar, cu sugestii de la server
          st.step = 1; st.msg = t.unavailableNow; st.suggestions = j.suggestions || [];
          busy = null; loadState = 'idle'; loadAvailability();
        } else st.msg = (j.message || t.sendErr) + (S.contact && S.contact.phone ? t.callUs(S.contact.phone) : '');
        draw();
      })
      .catch(function () {
        st.sending = false;
        st.msg = t.sendErr + (S.contact && S.contact.phone ? t.callUs(S.contact.phone) : '');
        draw();
      });
  }

  // Mod demo: deschide șablonul de email completat cu datele cererii
  function showMail(tpl) {
    var p = price(), l = lines();
    var data = {
      numeProprietate: L(S.property.name), nume: st.guest.name, prenume: st.guest.name.trim().split(/\s+/)[0],
      checkIn: fmt(st.checkIn, { weekday: 'long', year: 'numeric', month: 'long' }), checkOut: fmt(st.checkOut, { weekday: 'long', year: 'numeric', month: 'long' }),
      nopti: nights(), oaspeti: guestsText(), camere: l.map(function (x) { return (x.qty > 1 ? x.qty + ' × ' : '') + L(x.room.name); }).join(', '),
      total: p && p.total != null ? money(p.total) : '[PREȚ]', avans: L(B.deposit) || '[AVANS]', anulare: L(B.cancellation) || '[POLITICĂ DE ANULARE]',
      oreConfirmare: B.confirmHours || '[ORE]', telefonGazda: (S.contact && S.contact.phone) || '[TELEFON]', emailGazda: (S.contact && S.contact.email) || '[EMAIL]',
      oraSosire: st.guest.arrival || '—', cereri: st.guest.notes || '—', telefon: st.guest.phone, email: st.guest.email, id: st.done.id,
      linkConfirm: '#', linkRefuz: '#', notaBooking: '',
      titlu: 'Am primit cererea ta', mesaj: 'Gazda o verifică și îți răspunde în cel mult ' + (B.confirmHours || '[ORE]') + ' ore. Până atunci, zilele sunt păstrate pentru tine.', culoare: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8a4a2e'
    };
    var w = window.open('', '_blank');
    fetch('apps-script/' + tpl + '.html').then(function (r) { return r.text(); }).then(function (html) {
      var url = URL.createObjectURL(new Blob([Core.fillTemplate(html, data)], { type: 'text/html' }));
      if (w) w.location = url; else location.href = url;
    });
  }

  // ---------------------------------------------------------------- evenimente
  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-x],[data-day],[data-step]');
    if (!el) return;
    if (el.dataset.day) return pickDay(el.dataset.day);
    if (el.dataset.step) return step(el.dataset.step, +el.dataset.d);
    var x = el.dataset.x;
    if (st.step === 3 && x !== 'next') readForm();
    if (x === 'close') close();
    else if (x === 'back') back();
    else if (x === 'next') next();
    else if (x === 'prev') { month = nextMonth(month, -1); draw(); }
    else if (x === 'nextm') { month = nextMonth(month, 1); draw(); }
    else if (x === 'suggest') { st.checkIn = el.dataset.in; st.checkOut = el.dataset.out; st.suggestions = null; st.msg = ''; month = st.checkIn.slice(0, 7); draw(); }
    else if (x === 'mail') showMail(el.dataset.tpl);
  });
  root.addEventListener('change', function (e) {
    if (e.target.dataset.age != null) { st.children[+e.target.dataset.age] = +e.target.value; draw(); }
  });
  document.addEventListener('keydown', function (e) {
    if (root.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') trapFocus(e);
  });
  function trapFocus(e) {
    var f = root.querySelectorAll('button:not([disabled]),input,select,textarea,a[href]');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }

  function step(name, d) {
    if (name === 'adults') st.adults = Math.max(1, st.adults + d);
    else if (name === 'children') { if (d > 0) st.children.push(8); else st.children.pop(); }
    else if (name.indexOf('room:') === 0) {
      var id = name.slice(5); st.sel[id] = st.sel[id] || { qty: 0, beds: 0 };
      st.sel[id].qty = Math.max(0, st.sel[id].qty + d);
      var r = roomById(id), maxB = ((r.extraBed && r.extraBed.max) || 0) * st.sel[id].qty;
      st.sel[id].beds = Math.min(st.sel[id].beds || 0, maxB);
    } else if (name.indexOf('bed:') === 0) {
      var bid = name.slice(4); st.sel[bid].beds = Math.max(0, (st.sel[bid].beds || 0) + d);
    }
    st.msg = '';
    draw();
  }

  window.Booking = { open: open, close: close, state: st };
})();
