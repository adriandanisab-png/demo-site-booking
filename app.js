// Randează toată pagina din site.config.js. Nu conține text despre proprietate:
// doar textele de interfață (butoane, titluri generice), pe limbi, în dicționarul UI.
(function () {
  var S = window.SITE;
  var params = new URLSearchParams(location.search);
  var clean = params.has('curat');                       // mod prezentare: fără placeholdere
  var langs = S.languages && S.languages.length ? S.languages : ['ro'];
  var lang = langs[0];
  try { var saved = localStorage.getItem('lang'); if (langs.indexOf(saved) >= 0) lang = saved; } catch (e) {}
  if (langs.indexOf(params.get('lang')) >= 0) lang = params.get('lang');

  // ---------------------------------------------------------------- texte de interfață
  var UI = {
    ro: {
      demoBar: 'Machetă demonstrativă pentru', menu: 'Meniu', close: 'Închide', book: 'Rezervă', bookNow: 'Verifică disponibilitatea', search: 'Verifică',
      call: 'Sună acum', checkIn: 'Sosire', checkOut: 'Plecare', guests: 'Oaspeți', pickDate: 'Alege data',
      adultsN: function (n) { return n === 1 ? '1 adult' : n + ' adulți'; },
      childrenN: function (n) { return n === 1 ? '1 copil' : n + ' copii'; },
      nightsN: function (n) { return n === 1 ? '1 noapte' : n + ' nopți'; },
      rooms: 'Camere', facilities: 'Facilități', surroundings: 'Împrejurimi', direct: 'Rezervare directă', gallery: 'Galerie',
      reviews: 'Recenzii', policies: 'Reguli', faq: 'Întrebări', contact: 'Contact',
      roomsTitle: ['unde', 'dormiți'], facilitiesTitle: ['ce găsiți', 'în casă'], directTitle: ['de ce', 'direct'],
      reviewsTitle: ['ce spun', 'oaspeții'], policiesTitle: ['reguli', 'pe scurt'], faqTitle: ['întrebări', 'frecvente'], contactTitle: ['vă', 'așteptăm'],
      directText: 'Cererea ajunge la gazdă, care o confirmă personal.',
      capacity: 'Capacitate', persons: 'persoane', beds: 'Paturi', size: 'Suprafață', minNights: 'Minim',
      perNight: 'pe noapte', from: 'de la', priceAsk: 'Preț', seeAvailability: 'Vezi disponibilitatea',
      directDiscount: function (p) { return 'Preț direct: -' + p + '% față de platforme'; },
      seeAll: 'Vezi toate pozele', video: 'Video', drone: 'Drona', reviewsCount: function (n, s) { return n + ' recenzii pe ' + s; },
      reviewsPh: 'RECENZII REALE (text, prenume, sursă)', seeReviews: 'Vezi recenziile',
      pol: { checkIn: 'Check-in', checkOut: 'Check-out', cancellation: 'Anulare', deposit: 'Avans', pets: 'Animale', children: 'Copii', smoking: 'Fumat', quiet: 'Liniște', payment: 'Plată' },
      hrs: { reception: 'Recepție', checkIn: 'Check-in', checkOut: 'Check-out', breakfast: 'Mic dejun' },
      phone: 'Telefon', whatsapp: 'WhatsApp', email: 'Email', address: 'Adresă', maps: 'Deschide în Google Maps',
      company: 'Firmă', cui: 'CUI', regCom: 'Nr. Reg. Com.', privacy: 'Politica de confidențialitate', cookies: 'Politica de cookies', anpc: 'ANPC',
      schedule: 'Program', follow: 'Ne găsiți și pe',
      demoLink: 'Machetă: link-ul se completează la lansare.', demoPhone: 'Machetă: aici apare numărul de telefon al gazdei.'
    }
  };
  var ui = Object.assign({}, UI.ro, UI[lang] || {}, (S.ui && (S.ui[lang] || S.ui)) || {});

  // ---------------------------------------------------------------- ajutoare de text
  function esc(s) { return Core.esc(s); }
  function has(v) { return v != null && v !== '' && !(Array.isArray(v) && !v.length); }
  // Textul în limba curentă (șir simplu = română)
  function L(v) {
    if (v == null || typeof v !== 'object' || Array.isArray(v)) return v;
    return v[lang] != null ? v[lang] : v.ro != null ? v.ro : v[Object.keys(v)[0]];
  }
  function ph(label) { return clean ? '' : '<span class="ph">[' + esc(label) + ']</span>'; }
  // Text din config cu [placeholdere] marcate; lipsă → placeholder cu eticheta dată
  function T(v, label) {
    v = L(v);
    if (!has(v)) return label ? ph(label) : '';
    var s = esc(v);
    return s.replace(/\[([^\]]+)\]/g, function (_, x) { return clean ? '' : '<span class="ph">[' + x + ']</span>'; });
  }
  // Textul e real (nu lipsește și nu e doar placeholder)?
  function real(v) { v = L(v); return has(v) && !/^\s*\[[^\]]*\]\s*$/.test(v); }
  function lines(arr) { return (arr || []).map(function (l) { return '<span>' + T(l) + '</span>'; }).join(''); }

  // ---------------------------------------------------------------- iconițe liniare subțiri
  var P = {
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19.2" r=".9"/>',
    fire: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.4 2.6-5.2 3.6-8.4.2-.7 1.1-.8 1.5-.2 1.6 2.3 2 4.2 1.7 5.6 1.2-.6 1.9-1.8 2-3 .1-.6.8-.8 1.2-.4 1.8 1.9 3 4 3 6.4 0 3.5-2.6 6.1-6.5 6.1z"/><path d="M12 21c-1.5 0-2.6-1-2.6-2.5 0-1.6 1.4-2.4 2.1-3.8.9 1 3.1 2.2 3.1 3.8 0 1.5-1.1 2.5-2.6 2.5z"/>',
    kitchen: '<path d="M6 3v7a2 2 0 0 0 2 2v9M10 3v7a2 2 0 0 1-2 2M8 3v6"/><path d="M17 21V3c-2.2 1.3-3.3 4-3.3 7.2V13H17"/>',
    baby: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21c.4-4.4 3.3-7.5 7-7.5s6.6 3.1 7 7.5"/><path d="M10.5 6.6h.01M13.5 6.6h.01"/>',
    music: '<path d="M9 18V5.5l11-2.2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 9h18M3 15h18M7.5 5v14M16.5 5v14"/>',
    grill: '<path d="M4 9h16a8 8 0 0 1-16 0zM8 17l-2 4M16 17l2 4M12 17v4"/><path d="M9 3.5c-.7.8-.7 1.7 0 2.5M12 3c-.7.8-.7 1.7 0 2.5M15 3.5c-.7.8-.7 1.7 0 2.5"/>',
    parking: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M9.5 17V7h3.4a3 3 0 0 1 0 6H9.5"/>',
    breakfast: '<path d="M4 10h13v3.5A5.5 5.5 0 0 1 11.5 19h-2A5.5 5.5 0 0 1 4 13.5z"/><path d="M17 11.5h1.5a2.5 2.5 0 0 1 0 5H16M3 21h16"/>',
    pet: '<circle cx="6" cy="10" r="1.8"/><circle cx="10" cy="6.2" r="1.8"/><circle cx="14" cy="6.2" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12 12c-2.8 0-5 3-5 5.3 0 1.6 1.3 2.2 2.6 2.2 1 0 1.5-.5 2.4-.5s1.4.5 2.4.5c1.3 0 2.6-.6 2.6-2.2C17 15 14.8 12 12 12z"/>',
    mountain: '<path d="M2 20 9 7l4 7 2.5-4L22 20z"/><path d="m7.2 10.4 1.8 1.4 1.6-1.6"/>',
    river: '<path d="M2 8c2.5-1.6 4.5-1.6 7 0s4.5 1.6 7 0 4.5-1.6 6 0M2 13c2.5-1.6 4.5-1.6 7 0s4.5 1.6 7 0 4.5-1.6 6 0M2 18c2.5-1.6 4.5-1.6 7 0s4.5 1.6 7 0 4.5-1.6 6 0"/>',
    bed: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11.5" r="2"/>',
    bath: '<path d="M3 12h18v2.5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V5.5A2.5 2.5 0 0 1 10.5 4M7 19.5 6 21M17 19.5l1 1.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    key: '<circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.3-8.3M16.5 6.5l2.5 2.5M14.5 8.5l2 2"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.4-3.6 2.8-6 6-6s5.6 2.4 6 6"/><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.4c2 .8 3.3 2.8 3.5 5.6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    phone: '<path d="M21 16.4v3a1.9 1.9 0 0 1-2.1 1.9 18.8 18.8 0 0 1-8.2-2.9 18.5 18.5 0 0 1-5.7-5.7A18.8 18.8 0 0 1 2.1 4.5 1.9 1.9 0 0 1 4 2.4h3a1.9 1.9 0 0 1 1.9 1.6c.1.9.4 1.8.7 2.6a1.9 1.9 0 0 1-.4 2L8 9.8a15.2 15.2 0 0 0 5.7 5.7l1.2-1.2a1.9 1.9 0 0 1 2-.4c.8.3 1.7.6 2.6.7a1.9 1.9 0 0 1 1.5 1.8z"/>',
    pin: '<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'
  };
  function icon(name) {
    return '<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || P.key) + '</svg></span>';
  }
  function btnIco(name) { return '<span class="ico">' + icon(name || 'arrow').replace('class="icon"', 'class="icon" style="width:18px;height:18px;color:inherit"') + '</span>'; }

  // Poză sau bloc neutru cu eticheta ce trebuie pusă acolo
  function photo(ref, cls, eager) {
    ref = ref || {};
    cls = 'photo ' + (cls || '');
    if (ref.file) {
      return '<figure class="' + cls + '"><img src="' + esc(ref.file) + '" alt="' + esc(L(ref.alt) || '') + '"' +
        (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async"></figure>';
    }
    return '<div class="' + cls + ' empty" role="img" aria-label="' + esc(L(ref.alt) || L(ref.label) || '') + '">' + (clean ? '' : ph(L(ref.label) || 'FOTO')) + '</div>';
  }

  // Link real sau, dacă lipsește, un link care arată un mesaj (doar în machetă)
  function link(url, label, cls) {
    if (url) return '<a href="' + esc(url) + '" target="_blank" rel="noopener"' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(label) + '</a>';
    return clean ? '' : '<a href="#" data-demo="link"' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(label) + '</a>';
  }

  function telHref(p) { var d = String(p).replace(/[^\d+]/g, ''); if (/^0\d{9}$/.test(d)) d = '+4' + d; return 'tel:' + d; }
  function waHref(p) { var d = String(p).replace(/\D/g, ''); if (/^0\d{9}$/.test(d)) d = '4' + d; return 'https://wa.me/' + d; }

  // Secțiune numerotată; fără conținut → nu apare deloc
  function head(num, label, title) {
    return '<div class="sec-head' + (num ? ' numbered' : '') + ' reveal">' + (num ? '<div class="sec-num" aria-hidden="true">' + num + '</div>' : '') +
      '<span class="eyebrow">' + esc(label) + '</span><h2 class="title">' + lines(title) + '</h2></div>';
  }

  // ---------------------------------------------------------------- <head>
  function setHead() {
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = S.theme === 'cald' ? 'cald' : 'editorial';
    if (S.accent) document.documentElement.style.setProperty('--accent', S.accent);
    document.title = L(S.seo && S.seo.title) || L(S.property.name);
    meta('description', L(S.seo && S.seo.description) || '');
    if (S.demo) meta('robots', 'noindex');
    var fonts = S.theme === 'cald'
      ? 'family=Fraunces:ital,opsz,wght@0,9..144,300..500;1,9..144,300..500&family=Figtree:wght@400;500;600'
      : 'family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Manrope:wght@400;500;600';
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + fonts + '&display=swap';
    document.head.appendChild(l);
    var ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify(jsonLd()).replace(/</g, '\\u003c');
    document.head.appendChild(ld);
  }
  function meta(name, content) {
    var m = document.createElement('meta'); m.name = name; m.content = content; document.head.appendChild(m);
  }
  // Date structurate doar din informațiile reale din config
  function jsonLd() {
    var p = S.property, c = S.contact || {};
    var d = { '@context': 'https://schema.org', '@type': S.schemaType || 'LodgingBusiness', name: L(p.name), url: location.origin + '/' };
    if (real(p.description)) d.description = L(p.description);
    d.address = { '@type': 'PostalAddress', addressCountry: 'RO' };
    if (real(p.address)) d.address.streetAddress = L(p.address);
    if (real(p.locality)) d.address.addressLocality = L(p.locality);
    if (real(p.county)) d.address.addressRegion = L(p.county);
    if (c.phone) d.telephone = c.phone;
    if (c.email) d.email = c.email;
    if (c.mapsUrl) d.hasMap = c.mapsUrl;
    var same = (c.social || []).filter(function (s) { return s.url; }).map(function (s) { return s.url; });
    if (same.length) d.sameAs = same;
    var am = (S.facilities || []).filter(function (f) { return real(f.text); }).map(function (f) { return { '@type': 'LocationFeatureSpecification', name: L(f.text), value: true }; });
    if (am.length) d.amenityFeature = am;
    var imgs = [].concat(S.hero.images || []).filter(function (i) { return i && i.file; }).map(function (i) { return new URL(i.file, location.href).href; });
    if (imgs.length) d.image = imgs;
    var r = S.reviews || {};
    if (r.rating && r.count) d.aggregateRating = { '@type': 'AggregateRating', ratingValue: r.rating, reviewCount: r.count };
    return d;
  }

  // ---------------------------------------------------------------- pagina
  var units = (S.rooms || []).reduce(function (n, r) { return n + (r.units || []).length; }, 0);
  var roomsLabel = units === 1 ? (L(S.property.kind) || ui.rooms) : ui.rooms;
  var c = S.contact || {};
  var b = S.booking || {};

  function render() {
    var nav = [['#camere', roomsLabel], ['#imprejurimi', ui.surroundings], ['#galerie', ui.gallery], ['#intrebari', ui.faq], ['#contact', ui.contact]];
    var langBtns = langs.length > 1 ? '<div class="lang" role="group" aria-label="Limba">' + langs.map(function (l) {
      return '<button type="button" data-lang="' + l + '" aria-pressed="' + (l === lang) + '">' + l + '</button>';
    }).join('') + '</div>' : '';
    var callBtn = c.phone
      ? '<a class="btn ghost" href="' + telHref(c.phone) + '">' + esc(ui.call) + btnIco('phone') + '</a>'
      : (clean ? '' : '<a class="btn ghost" href="#" data-demo="phone">' + esc(ui.call) + btnIco('phone') + '</a>');

    var html = '';
    if (S.demo) html += '<div class="demo-bar">' + esc(ui.demoBar) + ' <b>' + esc(L(S.property.name)) + '</b></div>';
    if (real(S.topBar)) html += '<div class="top-bar">' + T(S.topBar) + '</div>';

    html += '<header class="hdr" id="hdr"><div class="hdr-in">' +
      '<a class="logo" href="#top">' + (S.logo ? '<img src="' + esc(S.logo) + '" alt="' + esc(L(S.property.name)) + '">' : esc(L(S.property.name))) + '</a>' +
      '<nav class="nav" aria-label="' + esc(ui.menu) + '">' + nav.map(function (n) { return '<a href="' + n[0] + '">' + esc(n[1]) + '</a>'; }).join('') + '</nav>' +
      '<div class="hdr-actions">' + langBtns +
      '<button class="btn" type="button" data-book>' + esc(ui.book) + btnIco() + '</button>' +
      '<button class="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="' + esc(ui.menu) + '"><span></span><span></span></button>' +
      '</div></div></header>';

    html += '<nav class="menu" id="menu" aria-label="' + esc(ui.menu) + '">' +
      nav.map(function (n) { return '<a href="' + n[0] + '">' + esc(n[1]) + '</a>'; }).join('') +
      '<div class="menu-meta">' + (c.phone ? '<a href="' + telHref(c.phone) + '">' + esc(c.phone) + '</a>' : ph('TELEFON')) + '</div></nav>';

    html += '<main id="top">' + hero() + roomsSec() + facilitiesSec() + surroundingsSec() + directSec() + gallerySec() +
      reviewsSec() + policiesSec() + faqSec() + contactSec() + '</main>' + footer();

    html += '<div class="mobile-book">' + (c.phone ? '<a class="call" href="' + telHref(c.phone) + '" aria-label="' + esc(ui.call) + '">' + icon('phone') + '</a>' : '') +
      '<button class="btn" type="button" data-book>' + esc(ui.bookNow) + btnIco() + '</button></div>';
    html += '<div class="toast" id="toast" role="status" aria-live="polite"></div>';
    document.getElementById('app').innerHTML = html;
  }

  function hero() {
    var h = S.hero || {};
    var imgs = (h.images || []).slice(0, 4);
    return '<section class="hero"><div class="wrap hero-grid">' +
      '<div class="reveal"><span class="eyebrow">' + T(h.label) + '</span>' +
      '<h1>' + lines(h.title && h.title.length ? h.title : [L(S.property.name)]) + '</h1>' +
      '<p class="lead">' + T(h.text) + '</p>' +
      '<div class="search" role="group" aria-label="' + esc(ui.bookNow) + '">' +
        '<button type="button" class="field" data-book="dates"><span class="k">' + esc(ui.checkIn) + '</span><span class="v" data-search="in">' + esc(ui.pickDate) + '</span></button>' +
        '<button type="button" class="field" data-book="dates"><span class="k">' + esc(ui.checkOut) + '</span><span class="v" data-search="out">' + esc(ui.pickDate) + '</span></button>' +
        '<button type="button" class="field wide" data-book="guests"><span class="k">' + esc(ui.guests) + '</span><span class="v" data-search="guests">' + esc(ui.adultsN(2)) + '</span></button>' +
        '<button type="button" class="btn" data-book>' + esc(ui.search) + btnIco() + '</button>' +
      '</div>' +
      (c.phone ? '<p class="hero-call"><a href="' + telHref(c.phone) + '">' + esc(ui.call) + ': ' + esc(c.phone) + '</a></p>'
        : (clean ? '' : '<p class="hero-call">' + esc(ui.call) + ': ' + ph('TELEFON') + '</p>')) +
      benefits() + '</div>' +
      '<div class="collage">' + imgs.map(function (im, i) { return photo(im, '', i === 0); }).join('') + '</div>' +
      '</div></section>';
  }

  function benefits() {
    var list = (S.benefits || []).filter(function (x) { return !clean || real(x.text); });
    if (!list.length) return '';
    return '<ul class="benefits">' + list.slice(0, 5).map(function (x) { return '<li>' + icon(x.icon) + T(x.text, 'BENEFICIU') + '</li>'; }).join('') + '</ul>';
  }

  function roomsSec() {
    var rooms = S.rooms || [];
    if (!rooms.length) return '';
    return '<section id="camere"><div class="wrap">' + head('01', roomsLabel, ui.roomsTitle) +
      '<div class="rooms">' + rooms.map(roomCard).join('') + '</div></div></section>';
  }

  function roomCard(r) {
    var facts = [
      [ui.capacity, r.capacity ? r.capacity + ' ' + ui.persons : null, 'CAPACITATE'],
      [ui.beds, L(r.beds), 'PATURI'],
      [ui.size, L(r.size), 'SUPRAFAȚĂ'],
      [ui.minNights, r.minNights ? ui.nightsN(r.minNights) : null, 'MINIM DE NOPȚI']
    ].filter(function (f) { return !clean || f[1]; });
    var prices = [r.price].concat((r.seasons || []).map(function (s) { return s.price; })).filter(function (p) { return p != null; });
    var price = prices.length
      ? '<div class="price-line"><span>' + esc(ui.from) + '</span><b>' + Math.min.apply(null, prices) + ' ' + esc(b.currency || 'lei') + '</b><span>' + esc(ui.perNight) + '</span></div>'
      : (clean ? '' : '<div class="price-line">' + ph('PREȚ PE NOAPTE') + '</div>');
    return '<article class="room reveal"><div class="room-photos">' + (r.images || []).slice(0, 2).map(function (im) { return photo(im); }).join('') + '</div>' +
      '<div><h3>' + T(r.name) + '</h3><p class="lead">' + T(r.description) + '</p>' +
      (facts.length ? '<dl class="facts">' + facts.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + (f[1] ? esc(f[1]) : ph(f[2])) + '</dd></div>'; }).join('') + '</dl>' : '') +
      (r.amenities && r.amenities.length ? '<ul class="tags">' + r.amenities.map(function (a) { return '<li>' + T(a) + '</li>'; }).join('') + '</ul>' : '') +
      price + (b.discountPercent ? '<p><span class="badge">' + esc(ui.directDiscount(b.discountPercent)) + '</span></p>' : '') +
      '<button class="btn" type="button" data-book="room" data-room="' + esc(r.id) + '">' + esc(ui.seeAvailability) + btnIco() + '</button></div></article>';
  }

  function facilitiesSec() {
    var list = (S.facilities || []).filter(function (f) { return !clean || real(f.text); });
    if (!list.length) return '';
    return '<section id="facilitati" style="padding-top:0"><div class="wrap">' + head('', ui.facilities, ui.facilitiesTitle) +
      '<ul class="fac reveal">' + list.map(function (f) { return '<li>' + icon(f.icon) + '<span>' + T(f.text, 'FACILITATE') + '</span></li>'; }).join('') + '</ul></div></section>';
  }

  function surroundingsSec() {
    var e = S.experiences;
    if (!e) return '';
    var items = (e.items || []).filter(function (i) { return real(i.name); });
    return '<section id="imprejurimi" style="background:var(--bg-2)"><div class="wrap split">' +
      '<div class="reveal">' + head('02', ui.surroundings, e.title) + '<p class="lead">' + T(e.text) + '</p>' +
      (items.length ? '<ul class="near">' + items.map(function (i) {
        return '<li><b>' + T(i.name) + '</b><span class="d">' + (real(i.distance) ? T(i.distance) : '') + '</span>' + (real(i.text) ? '<span class="t">' + T(i.text) + '</span>' : '') + '</li>';
      }).join('') + '</ul>' : '') + '</div>' +
      '<div class="reveal">' + photo(e.image, 'r-45') + '</div></div></section>';
  }

  function directSec() {
    var list = (S.whyDirect || []).filter(function (w) { return !clean || real(w.text); });
    return '<section class="direct" id="rezervare"><div class="wrap">' + head('03', ui.direct, ui.directTitle) +
      '<p class="lead reveal" style="margin-bottom:48px">' + esc(ui.directText) + (b.confirmHours ? '' : '') + '</p>' +
      (list.length ? '<div class="direct-list reveal">' + list.map(function (w) { return '<div><h3>' + T(w.title) + '</h3><p>' + T(w.text) + '</p></div>'; }).join('') + '</div>' : '') +
      '<button class="btn light reveal" type="button" data-book>' + esc(ui.bookNow) + btnIco() + '</button></div></section>';
  }

  function gallerySec() {
    var g = S.gallery || {};
    var imgs = (g.images || []).filter(function (i) { return !clean || i.file; });
    if (!imgs.length && clean) return '';
    var tiles = imgs.map(function (im, i) { return '<button type="button" class="photo-btn" data-zoom="' + i + '" style="all:unset;cursor:zoom-in">' + photo(im) + '</button>'; }).join('');
    var media = [];
    if (g.video && (g.video.file || g.video.url || !clean)) media.push(g.video.url
      ? '<a class="photo empty r-169" href="' + esc(g.video.url) + '" target="_blank" rel="noopener" style="text-decoration:none"><span class="btn plain">▶ ' + esc(ui.video) + '</span></a>'
      : photo(g.video, 'r-169'));
    if (g.drone && (g.drone.file || !clean)) media.push(photo(g.drone, 'r-169'));
    return '<section id="galerie" style="padding-bottom:calc(var(--space) * .6)"><div class="wrap">' + head('', ui.gallery, g.title) + '</div>' +
      '<div class="marquee reveal" aria-label="' + esc(ui.gallery) + '"><div class="marquee-track">' + tiles + tiles.replace(/data-zoom/g, 'aria-hidden="true" tabindex="-1" data-zoom') + '</div></div>' +
      '<div class="wrap"><div class="gallery-actions"><button class="btn ghost" type="button" data-gallery>' + esc(ui.seeAll) + btnIco() + '</button></div>' +
      (media.length ? '<div class="media-ph reveal">' + media.join('') + '</div>' : '') + '</div>' +
      '<div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="' + esc(ui.gallery) + '">' +
      '<button class="round close" type="button" data-gallery-close aria-label="' + esc(ui.close) + '">×</button>' +
      '<div class="grid">' + imgs.map(function (im) { return photo(im, 'r-45'); }).join('') + '</div></div></section>';
  }

  function reviewsSec() {
    var r = S.reviews || {};
    var items = (r.items || []).filter(function (i) { return real(i.text); });
    if (clean && !items.length && !r.rating) return '';
    return '<section id="recenzii" style="padding-top:calc(var(--space) * .6)"><div class="wrap">' + head('', ui.reviews, ui.reviewsTitle) +
      (r.rating ? '<div class="rating reveal"><b>' + esc(r.rating) + '</b><span>' + (r.count && r.source ? esc(ui.reviewsCount(r.count, r.source)) : '') + '</span></div>' : '') +
      (items.length
        ? '<div class="quotes">' + items.map(function (q) { return '<blockquote class="reveal">„' + T(q.text) + '”<cite>' + T(q.author) + (q.source ? ' · ' + esc(q.source) : '') + '</cite></blockquote>'; }).join('') + '</div>'
        : '<div class="reviews-ph reveal">' + ph(ui.reviewsPh) + '</div>') +
      (r.url ? '<p style="margin-top:32px">' + link(r.url, ui.seeReviews, 'link-arrow') + '</p>' : '') + '</div></section>';
  }

  function policiesSec() {
    var p = S.policies || {};
    var keys = Object.keys(ui.pol).filter(function (k) { return k in p && (!clean || real(p[k])); });
    if (!keys.length) return '';
    return '<section id="reguli" style="background:var(--bg-2)"><div class="wrap">' + head('', ui.policies, ui.policiesTitle) +
      '<dl class="policies reveal">' + keys.map(function (k) { return '<div><dt>' + esc(ui.pol[k]) + '</dt><dd>' + T(p[k], ui.pol[k].toUpperCase()) + '</dd></div>'; }).join('') + '</dl></div></section>';
  }

  function faqSec() {
    var list = (S.faq || []).filter(function (f) { return real(f.q) && (!clean || real(f.a)); });
    if (!list.length) return '';
    return '<section id="intrebari"><div class="wrap split" style="align-items:start">' + head('', ui.faq, ui.faqTitle) +
      '<div class="faq reveal">' + list.map(function (f) { return '<details><summary>' + T(f.q) + '</summary><p>' + T(f.a, 'RĂSPUNS') + '</p></details>'; }).join('') + '</div></div></section>';
  }

  function contactSec() {
    var p = S.property;
    var addr = [L(p.address), L(p.locality), L(p.county)].filter(real).join(', ');
    var rows = [
      c.phone ? '<li><a href="' + telHref(c.phone) + '">' + esc(c.phone) + '</a></li>' : (clean ? '' : '<li>' + ph('TELEFON') + '</li>'),
      c.whatsapp ? '<li><a href="' + waHref(c.whatsapp) + '" target="_blank" rel="noopener">' + esc(ui.whatsapp) + ': ' + esc(c.whatsapp) + '</a></li>' : '',
      c.email ? '<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>' : (clean ? '' : '<li>' + ph('EMAIL') + '</li>'),
      '<li>' + esc(addr) + (real(p.address) ? '' : ' ' + ph('STRADA ȘI NUMĂRUL')) + '</li>'
    ].join('');
    return '<section id="contact" style="background:var(--bg-2)"><div class="wrap split">' +
      '<div>' + head('', ui.contact, ui.contactTitle) + '<ul class="contact-list reveal">' + rows + '</ul>' +
      '<div class="contact-actions reveal">' + (c.mapsUrl ? '<a class="btn" href="' + esc(c.mapsUrl) + '" target="_blank" rel="noopener">' + esc(ui.maps) + btnIco('pin') + '</a>' : (clean ? '' : '<a class="btn" href="#" data-demo="link">' + esc(ui.maps) + btnIco('pin') + '</a>')) +
      '<button class="btn ghost" type="button" data-book>' + esc(ui.book) + btnIco() + '</button></div></div>' +
      '<div class="reveal">' + photo((S.hero.images || [])[0], 'r-45') + '</div></div></section>';
  }

  function footer() {
    var h = S.hours || {}, l = S.legal || {};
    var hrs = Object.keys(ui.hrs).filter(function (k) { return !clean || real(h[k]); });
    var social = (c.social || []).filter(function (s) { return s.url || !clean; });
    var yr = new Date().getFullYear();
    return '<footer><div class="wrap"><p class="foot-name">' + esc(L(S.property.name)) + '</p><div class="foot-grid">' +
      (hrs.length ? '<div><h4>' + esc(ui.schedule) + '</h4><ul>' + hrs.map(function (k) { return '<li>' + esc(ui.hrs[k]) + ': ' + T(h[k], ui.hrs[k].toUpperCase()) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div><h4>' + esc(ui.contact) + '</h4><ul>' +
        (c.phone ? '<li><a href="' + telHref(c.phone) + '">' + esc(c.phone) + '</a></li>' : (clean ? '' : '<li>' + ph('TELEFON') + '</li>')) +
        (c.email ? '<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>' : (clean ? '' : '<li>' + ph('EMAIL') + '</li>')) +
        '<li>' + esc([L(S.property.locality), L(S.property.county)].filter(real).join(', ')) + '</li>' +
        (c.mapsUrl ? '<li><a href="' + esc(c.mapsUrl) + '" target="_blank" rel="noopener">Google Maps</a></li>' : '') + '</ul></div>' +
      (social.length ? '<div><h4>' + esc(ui.follow) + '</h4><ul>' + social.map(function (s) { return '<li>' + link(s.url, s.label) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div><h4>' + esc(ui.company) + '</h4><ul>' +
        '<li>' + T(l.company, 'DENUMIRE FIRMĂ') + '</li>' +
        ((l.cui || !clean) ? '<li>' + esc(ui.cui) + ' ' + T(l.cui, 'CUI') + '</li>' : '') +
        ((l.regCom || !clean) ? '<li>' + esc(ui.regCom) + ' ' + T(l.regCom, 'NR. REG. COM.') + '</li>' : '') + '</ul></div>' +
      '</div><div class="foot-bottom"><span>© ' + yr + ' ' + esc(L(l.company) || L(S.property.name)) + '</span>' +
      '<span style="display:flex;gap:20px;flex-wrap:wrap">' + link(l.privacyUrl, ui.privacy) + link(l.cookiesUrl, ui.cookies) + link(l.anpcUrl, ui.anpc) + '</span></div></div></footer>';
  }

  // ---------------------------------------------------------------- comportament
  function toast(text) {
    var t = document.getElementById('toast');
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function bind() {
    var body = document.body;
    // header cu fundal după primul scroll (fără ascultător de scroll)
    var hdr = document.getElementById('hdr');
    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;height:80px;width:1px;pointer-events:none';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (e) { hdr.classList.toggle('scrolled', !e[0].isIntersecting); }).observe(sentinel);

    // meniul de pe mobil
    var burger = document.querySelector('.burger');
    function setMenu(open) {
      body.classList.toggle('menu-open', open); body.classList.toggle('locked', open);
      burger.setAttribute('aria-expanded', open);
    }
    burger.addEventListener('click', function () { setMenu(!body.classList.contains('menu-open')); });
    document.querySelectorAll('.menu a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });

    // apariție la scroll
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-demo],[data-book],[data-gallery],[data-gallery-close],[data-zoom],[data-lang]');
      if (!t) return;
      if (t.dataset.demo != null) { e.preventDefault(); toast(t.dataset.demo === 'phone' ? ui.demoPhone : ui.demoLink); }
      else if (t.dataset.book != null) { setMenu(false); if (window.Booking) Booking.open({ room: t.dataset.room, focus: t.dataset.book }); }
      else if (t.dataset.gallery != null || t.dataset.zoom != null) openGallery(true);
      else if (t.dataset.galleryClose != null) openGallery(false);
      else if (t.dataset.lang) { try { localStorage.setItem('lang', t.dataset.lang); } catch (x) {} var u = new URL(location.href); u.searchParams.set('lang', t.dataset.lang); location.href = u; }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { openGallery(false); setMenu(false); } });
  }

  function openGallery(open) {
    var lb = document.getElementById('lightbox');
    if (!lb) return;
    lb.hidden = !open;
    document.body.classList.toggle('locked', open);
    if (open) lb.querySelector('.close').focus();
  }

  // Valorile din căutarea din hero, actualizate de booking.js
  function updateSearch(st) {
    var f = function (iso) { return iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString(lang + '-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ui.pickDate; };
    var set = function (k, v) { var el = document.querySelector('[data-search="' + k + '"]'); if (el) el.textContent = v; };
    set('in', f(st.checkIn)); set('out', f(st.checkOut));
    set('guests', ui.adultsN(st.adults) + (st.children.length ? ', ' + ui.childrenN(st.children.length) : ''));
  }

  setHead();
  render();
  bind();
  window.App = { S: S, ui: ui, lang: lang, clean: clean, L: L, T: T, ph: ph, real: real, esc: esc, photo: photo, icon: icon, btnIco: btnIco, toast: toast, updateSearch: updateSearch, units: units };
})();
