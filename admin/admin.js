// Panoul gazdei: cereri (confirmare, refuz, anulare, avans, notițe) și calendarul ocupării
// (cu blocare manuală de zile). Datele vin din Apps Script; parola se cere la fiecare sesiune.
(function () {
  var S = window.SITE, esc = Core.esc, root = document.getElementById('admin');
  var L = function (v) { return v && typeof v === 'object' ? (v.ro || v[Object.keys(v)[0]]) : v; };
  var URL_API = S.appsScriptUrl;
  var STATUS = { asteptare: 'În așteptare', confirmata: 'Confirmată', refuzata: 'Refuzată', anulata: 'Anulată', expirata: 'Expirată' };
  var st = { pass: null, data: null, tab: 'cereri', filter: 'asteptare', q: '', month: null, sel: null, info: null, busy: false };

  // tema și fonturile site-ului
  document.documentElement.dataset.theme = S.theme === 'cald' ? 'cald' : 'editorial';
  if (S.accent) document.documentElement.style.setProperty('--accent', S.accent);
  document.title = 'Admin · ' + L(S.property.name);
  var fl = document.createElement('link');
  fl.rel = 'stylesheet';
  fl.href = 'https://fonts.googleapis.com/css2?' + (S.theme === 'cald'
    ? 'family=Fraunces:opsz,wght@9..144,400&family=Figtree:wght@400;600'
    : 'family=Cormorant+Garamond:wght@400;500&family=Manrope:wght@400;600') + '&display=swap';
  document.head.appendChild(fl);

  try { st.pass = sessionStorage.getItem('admin-pass'); } catch (e) {}

  // ---------------------------------------------------------------- comunicare cu Apps Script
  function api(op, extra) {
    var body = Object.assign({ action: 'admin', op: op, password: st.pass }, extra || {});
    return fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok && (j.error === 'auth' || j.error === 'blocat' || j.error === 'setup')) { logout(j.message); throw new Error(j.message); }
        if (!j.ok) throw new Error(j.message || 'Eroare');
        return j;
      });
  }
  function load() {
    return api('list').then(function (j) { st.data = j; if (!st.month) st.month = j.azi.slice(0, 7); draw(); });
  }
  function act(op, extra, okMsg) {
    if (st.busy) return;
    st.busy = true;
    return api(op, extra).then(function () { if (okMsg) toast(okMsg); return load(); })
      .catch(function (e) { toast(e.message); })
      .then(function () { st.busy = false; });
  }

  // ---------------------------------------------------------------- utilitare
  function toast(t) {
    var el = document.getElementById('toast');
    el.textContent = t; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }
  function fmt(iso, o) { return new Date(iso + 'T12:00:00Z').toLocaleDateString('ro-RO', Object.assign({ timeZone: 'UTC', day: 'numeric', month: 'short' }, o || {})); }
  function dt(iso) { return iso ? new Date(iso).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }
  function nights(r) { return Core.nightsBetween(r.checkIn, r.checkOut); }
  function tel(p) { var d = String(p).replace(/[^\d+]/g, ''); return /^0\d{9}$/.test(d) ? '+4' + d : d; }
  function wa(p) { var d = String(p).replace(/\D/g, ''); return 'https://wa.me/' + (/^0\d{9}$/.test(d) ? '4' + d : d); }
  function roomName(unit) {
    var r = (S.rooms || []).filter(function (x) { return (x.units || []).indexOf(unit) >= 0; })[0];
    return r ? L(r.name) + ((r.units || []).length > 1 ? ' · ' + unit : '') : unit;
  }

  // ---------------------------------------------------------------- autentificare
  function logout(msg) {
    st.pass = null; st.data = null;
    try { sessionStorage.removeItem('admin-pass'); } catch (e) {}
    drawLogin(msg);
  }
  function drawLogin(msg) {
    root.innerHTML = '<div class="login"><span class="eyebrow">' + esc(L(S.property.name)) + '</span><h1>panoul gazdei</h1>' +
      (URL_API ? '<form id="login"><label class="f">Parola<input type="password" name="p" autocomplete="current-password" required autofocus></label>' +
        '<button class="btn" type="submit">Intră<span class="ico">→</span></button>' + (msg ? '<p class="err" style="color:#a3261b">' + esc(msg) + '</p>' : '') + '</form>'
        : '<p class="hint">Site-ul e în mod demo: completează appsScriptUrl în site.config.js.</p>') + '</div>';
    var f = document.getElementById('login');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      st.pass = f.elements.p.value;
      f.querySelector('button').disabled = true;
      load().then(function () { try { sessionStorage.setItem('admin-pass', st.pass); } catch (x) {} }).catch(function () {});
    });
  }

  // ---------------------------------------------------------------- randare
  function draw() {
    var d = st.data;
    var pending = d.rezervari.filter(function (r) { return r.status === 'asteptare'; });
    var upcoming = d.rezervari.filter(function (r) { return r.status === 'confirmata' && r.checkOut >= d.azi; });
    var unpaid = upcoming.filter(function (r) { return !r.avansPlatit; });
    var arriving = upcoming.filter(function (r) { return r.checkIn >= d.azi && r.checkIn <= Core.addDays(d.azi, 7); });
    root.innerHTML = '<header class="a-top"><div class="wrap">' +
      '<div class="a-name">' + esc(L(S.property.name)) + '<small>admin</small></div>' +
      '<div class="tabs" role="tablist">' + [['cereri', 'Cereri'], ['calendar', 'Calendar']].map(function (t) {
        return '<button role="tab" aria-selected="' + (st.tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + (t[0] === 'cereri' && pending.length ? ' · ' + pending.length : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="a-actions"><button data-x="reload">Reîncarcă</button><a href="../" target="_blank">Site</a><button data-x="logout">Ieșire</button></div>' +
      '</div></header><main class="wrap">' +
      '<div class="stats">' +
        stat(pending.length, 'de confirmat') + stat(arriving.length, 'sosiri în 7 zile') +
        stat(upcoming.length, 'confirmate viitoare') + stat(unpaid.length, 'fără avans') + stat(d.emailuriRamase, 'emailuri azi') +
      '</div>' + (st.tab === 'cereri' ? cereri() : calendar()) + '</main>';
  }
  function stat(n, label) { return '<div><b>' + esc(n) + '</b><span>' + esc(label) + '</span></div>'; }

  // ---- cereri
  function cereri() {
    var d = st.data, q = st.q.trim().toLowerCase();
    var list = d.rezervari.filter(function (r) {
      if (st.filter === 'asteptare' && r.status !== 'asteptare') return false;
      if (st.filter === 'viitoare' && !(r.status === 'confirmata' && r.checkOut >= d.azi)) return false;
      if (st.filter === 'inchise' && ['refuzata', 'anulata', 'expirata'].indexOf(r.status) < 0) return false;
      if (q && (r.nume + ' ' + r.email + ' ' + r.telefon + ' ' + r.id).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      return st.filter === 'asteptare' ? (a.creat < b.creat ? -1 : 1) : (a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0);
    });
    var chips = [['asteptare', 'În așteptare'], ['viitoare', 'Confirmate viitoare'], ['toate', 'Toate'], ['inchise', 'Refuzate / anulate / expirate']];
    return '<div class="filters">' + chips.map(function (c) {
      return '<button class="chip" data-filter="' + c[0] + '" aria-pressed="' + (st.filter === c[0]) + '">' + c[1] + '</button>';
    }).join('') + '<input type="search" placeholder="Caută nume, telefon, email, nr. cerere" value="' + esc(st.q) + '" data-x="search" aria-label="Caută"></div>' +
      (list.length ? '<div class="list">' + list.map(card).join('') + '</div>' : '<p class="empty">Nicio cerere aici.</p>');
  }

  function card(r) {
    var n = nights(r);
    var left = r.status === 'asteptare' && r.expiraLa ? Math.max(0, Math.round((new Date(r.expiraLa) - Date.now()) / 3600000)) : null;
    var units = String(r.unitati).split(',').filter(Boolean).map(function (u) { return roomName(u.trim()); }).join(', ');
    var actions = '';
    if (r.status === 'asteptare' || r.status === 'expirata') {
      actions += '<button class="btn" data-status="confirmata" data-id="' + esc(r.id) + '">Confirmă</button>' +
        '<button class="btn ghost" data-status="refuzata" data-id="' + esc(r.id) + '">Refuză</button>';
    }
    if (r.status === 'confirmata') actions += '<button class="btn ghost" data-status="anulata" data-id="' + esc(r.id) + '">Anulează</button>';
    return '<article class="card' + (r.status === 'asteptare' ? ' pending' : '') + '" id="r-' + esc(r.id) + '">' +
      '<div class="c-head"><div><div class="c-name">' + esc(r.nume) + '</div>' +
        '<div class="c-dates">' + esc(fmt(r.checkIn, { weekday: 'short' })) + ' – ' + esc(fmt(r.checkOut, { weekday: 'short', year: 'numeric' })) + ' · ' + n + (n === 1 ? ' noapte' : ' nopți') + '</div></div>' +
        '<div style="text-align:right"><span class="pill st-' + esc(r.status) + '">' + esc(STATUS[r.status] || r.status) + '</span>' +
        (left != null ? '<div class="hint">expiră în ' + left + ' h</div>' : '') + '</div></div>' +
      '<div class="c-meta"><span>' + esc(units) + '</span><span>' + esc(r.adulti) + ' adulți' + (r.copii ? ' · copii: ' + esc(r.copii) + ' ani' : '') + '</span>' +
        (r.total ? '<span><b>' + esc(Number(r.total).toLocaleString('ro-RO')) + ' ' + esc(r.moneda) + '</b> estimat</span>' : '') +
        (r.oraSosire ? '<span>sosire ~' + esc(r.oraSosire) + '</span>' : '') + '</div>' +
      '<div class="c-meta"><a href="tel:' + esc(tel(r.telefon)) + '">' + esc(r.telefon) + '</a><a href="' + esc(wa(r.telefon)) + '" target="_blank" rel="noopener">WhatsApp</a>' +
        '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a><span>' + esc(r.id) + ' · trimisă ' + esc(dt(r.creat)) + '</span>' +
        (r.acordOferte === 'da' ? '<span>vrea oferte</span>' : '') + '</div>' +
      (r.cereri ? '<div class="c-notes">' + esc(r.cereri) + '</div>' : '') +
      (r.notaBooking ? '<div class="c-warn">' + esc(r.notaBooking) + '</div>' : '') +
      (actions ? '<div class="c-actions">' + actions + '</div>' : '') +
      (r.status === 'confirmata' || r.status === 'asteptare' ? '<div class="c-foot"><label class="check"><input type="checkbox" data-paid="' + esc(r.id) + '"' + (r.avansPlatit ? ' checked' : '') + '> Avans primit' + (r.avansPlatit ? ' <span class="hint">(' + esc(dt(r.avansPlatit)) + ')</span>' : '') + '</label>' +
        '<textarea data-note="' + esc(r.id) + '" placeholder="Notițe pentru tine (nu le vede oaspetele)">' + esc(r.notaGazda) + '</textarea></div>' : '') +
      '</article>';
  }

  // ---- calendar: un rând pe cameră, o coloană pe noapte
  function occupancy() {
    var d = st.data, map = {};
    var put = function (u, from, to, info) {
      map[u] = map[u] || {};
      Core.eachNight(from, to).forEach(function (n) {
        var cur = map[u][n];
        if (!cur || info.prio > cur.prio) map[u][n] = info;
      });
    };
    d.booking.forEach(function (b) { put(b.unitate, b.deLa, b.panaLa, { kind: 'booking', prio: 1, b: b }); });
    d.manuale.forEach(function (b) { put(b.unitate, b.deLa, b.panaLa, { kind: 'manual', prio: 2, b: b }); });
    d.rezervari.filter(function (r) { return r.status === 'confirmata' || r.status === 'asteptare'; }).forEach(function (r) {
      String(r.unitati).split(',').forEach(function (u) { if (u) put(u.trim(), r.checkIn, r.checkOut, { kind: r.status, prio: 3, r: r }); });
    });
    return map;
  }
  function nextMonth(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + String(m + 1).padStart(2, '0');
  }
  function calendar() {
    var d = st.data, ym = st.month, map = occupancy();
    var first = ym + '-01', days = Core.eachNight(first, nextMonth(ym, 1) + '-01');
    var title = new Date(first + 'T12:00:00Z').toLocaleDateString('ro-RO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    var head = '<tr><th></th>' + days.map(function (n) {
      var w = new Date(n + 'T12:00:00Z').getUTCDay();
      return '<th class="' + (w === 0 || w === 6 ? 'we' : '') + (n === d.azi ? ' today' : '') + '">' + 'DLMMJVS'.charAt(w) + '<br>' + (+n.slice(8)) + '</th>';
    }).join('') + '</tr>';
    var body = d.camere.map(function (c) {
      return '<tr><th>' + esc(roomName(c.unit)) + '</th>' + days.map(function (n) {
        var o = (map[c.unit] || {})[n];
        var sel = st.sel && st.sel.unit === c.unit && n >= st.sel.from && n <= (st.sel.to || st.sel.from);
        var cls = (n < d.azi ? 'past ' : '') + (o ? 'd-' + o.kind + ' ' : '') + (sel ? 'sel' : '');
        var label = fmt(n, { weekday: 'long' }) + (o ? ', ' + (o.r ? o.r.nume : o.kind === 'manual' ? 'blocat' : 'Booking.com') : ', liber');
        return '<td class="' + cls + '"><button type="button" data-cell="' + esc(c.unit) + '|' + n + '" aria-label="' + esc(label) + '"></button></td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="cal-nav"><button class="round" data-x="prev" aria-label="Luna anterioară">‹</button><h2>' + esc(title) + '</h2>' +
      '<button class="round" data-x="next" aria-label="Luna următoare">›</button></div>' +
      '<div class="tl"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="legend"><span><i style="background:#2f5240"></i>confirmată</span><span><i style="background:var(--accent)"></i>în așteptare</span>' +
      '<span><i style="background:#1b3a6b"></i>Booking.com</span><span><i style="background:var(--muted)"></i>blocat de tine</span></div>' +
      panel();
  }
  function panel() {
    if (st.info) {
      var o = st.info;
      if (o.r) return '<div class="panel"><h3>' + esc(o.r.nume) + '</h3><p class="hint">' + esc(fmt(o.r.checkIn)) + ' – ' + esc(fmt(o.r.checkOut)) + ' · ' + esc(STATUS[o.r.status]) + ' · ' + esc(o.r.telefon) + '</p>' +
        '<div class="row"><button class="btn" data-open="' + esc(o.r.id) + '">Vezi cererea</button></div></div>';
      if (o.kind === 'manual') return '<div class="panel"><h3>Blocat de tine</h3><p class="hint">' + esc(fmt(o.b.deLa)) + ' – ' + esc(fmt(o.b.panaLa)) + (o.b.motiv ? ' · ' + esc(o.b.motiv) : '') + '</p>' +
        '<div class="row"><button class="btn danger" data-unblock="' + esc(o.b.id) + '">Deblochează</button></div></div>';
      return '<div class="panel"><h3>Ocupat pe Booking.com</h3><p class="hint">' + esc(fmt(o.b.deLa)) + ' – ' + esc(fmt(o.b.panaLa)) + '. Se modifică din extranetul Booking.com; aici se actualizează la 15 minute.</p></div>';
    }
    if (st.sel && st.sel.to) {
      var to = Core.addDays(st.sel.to, 1), n = Core.nightsBetween(st.sel.from, to);
      return '<div class="panel"><h3>Blochează ' + esc(fmt(st.sel.from)) + ' – ' + esc(fmt(to)) + '</h3>' +
        '<p class="hint">' + esc(roomName(st.sel.unit)) + ' · ' + n + (n === 1 ? ' noapte' : ' nopți') + '. Zilele dispar de pe site și ajung blocate și pe Booking.com la următorul import.</p>' +
        '<div class="row"><input id="reason" placeholder="Motiv (opțional): familia, rezervare la telefon…"><button class="btn" data-x="block">Blochează</button><button class="btn ghost" data-x="cancelsel">Renunță</button></div></div>';
    }
    return '<p class="hint" style="margin-top:16px">Ca să blochezi zile: apasă pe prima noapte, apoi pe ultima, pe rândul camerei. Apasă pe o zi ocupată ca să vezi detaliile.</p>';
  }

  // ---------------------------------------------------------------- evenimente
  root.addEventListener('click', function (e) {
    var el = e.target.closest('button,[data-x]');
    if (!el) return;
    var ds = el.dataset;
    if (ds.tab) { st.tab = ds.tab; st.sel = null; st.info = null; draw(); }
    else if (ds.filter) { st.filter = ds.filter; draw(); }
    else if (ds.status) {
      var msg = { confirmata: 'Confirmi rezervarea? Oaspetele primește email.', refuzata: 'Refuzi cererea? Zilele se eliberează și oaspetele primește email.', anulata: 'Anulezi rezervarea confirmată? Zilele se eliberează și oaspetele primește email.' }[ds.status];
      if (confirm(msg)) act('status', { id: ds.id, status: ds.status }, 'Gata.');
    }
    else if (ds.cell) cellClick(ds.cell.split('|')[0], ds.cell.split('|')[1]);
    else if (ds.open) { st.tab = 'cereri'; st.filter = 'toate'; st.q = ds.open; st.info = null; draw(); }
    else if (ds.unblock) { if (confirm('Deblochezi aceste zile?')) { st.info = null; act('unblock', { id: ds.unblock }, 'Zilele sunt libere.'); } }
    else if (ds.x === 'reload') load().then(function () { toast('Actualizat.'); }).catch(function () {});
    else if (ds.x === 'logout') logout();
    else if (ds.x === 'prev' || ds.x === 'next') { st.month = nextMonth(st.month, ds.x === 'prev' ? -1 : 1); st.sel = null; st.info = null; draw(); }
    else if (ds.x === 'cancelsel') { st.sel = null; draw(); }
    else if (ds.x === 'block') {
      var s = st.sel, reason = (document.getElementById('reason') || {}).value || '';
      st.sel = null;
      act('block', { unit: s.unit, from: s.from, to: Core.addDays(s.to, 1), reason: reason }, 'Zilele sunt blocate.');
    }
  });
  function cellClick(unit, n) {
    var o = (occupancy()[unit] || {})[n];
    st.info = null;
    if (o) { st.sel = null; st.info = o; return draw(); }
    if (n < st.data.azi) return;
    if (!st.sel || st.sel.unit !== unit || st.sel.to || n < st.sel.from) st.sel = { unit: unit, from: n, to: null };
    else {
      // intervalul nu poate trece peste zile ocupate
      var range = Core.eachNight(st.sel.from, Core.addDays(n, 1)), m = occupancy()[unit] || {};
      if (range.some(function (x) { return m[x]; })) { toast('Intervalul trece peste zile ocupate.'); st.sel = { unit: unit, from: n, to: null }; }
      else st.sel.to = n;
    }
    draw();
  }
  root.addEventListener('input', function (e) {
    if (e.target.dataset.x === 'search') {
      st.q = e.target.value;
      clearTimeout(cellClick.t);
      cellClick.t = setTimeout(function () { var pos = e.target.selectionStart; draw(); var i = root.querySelector('[data-x="search"]'); i.focus(); i.setSelectionRange(pos, pos); }, 250);
    }
  });
  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.paid) act('paid', { id: t.dataset.paid, value: t.checked }, t.checked ? 'Avans marcat ca primit.' : 'Avans demarcat.');
    if (t.dataset.note != null) api('note', { id: t.dataset.note, text: t.value }).then(function () {
      var r = st.data.rezervari.filter(function (x) { return x.id === t.dataset.note; })[0]; if (r) r.notaGazda = t.value; toast('Notița e salvată.');
    }).catch(function (x) { toast(x.message); });
  });

  if (st.pass && URL_API) load().catch(function () {}); else drawLogin();
})();
