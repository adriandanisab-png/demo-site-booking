// ============================================================================
//  CONȚINUTUL SITE-ULUI. Pentru un client nou se editează DOAR acest fișier și /img.
//
//  Reguli:
//  - null sau "" = informație lipsă → pe site apare un placeholder galben [ETICHETĂ].
//    Cu ?curat în adresă, placeholderele și secțiunile goale dispar (pentru prezentări).
//  - Orice text scris între [paranteze drepte] e tot placeholder.
//  - Un text poate fi "simplu" (română) sau { ro: "...", hu: "...", en: "..." }.
//  - Nu se inventează nimic: prețuri, recenzii, distanțe, facilități doar de la proprietar
//    sau din surse publice verificate.
//  - Poze: { file: "img/nume.webp", alt: "descriere", label: "FOTO: ce trebuie pus aici" }.
//    Cât timp file e null, apare un bloc neutru cu label.
//
//  Date demo pentru Cabana Șapte, luate din informațiile publice ale cabanei
//  (site-ul cabanasapte.com, pagina de Facebook). De verificat cu proprietarul.
// ============================================================================

window.SITE = {
  demo: true,                 // bandă „Machetă demonstrativă” + noindex. La lansare: false.
  appsScriptUrl: "https://script.google.com/macros/s/AKfycby3nrVLHrQOFDeaqn1Kt4FKPPn0GJGIHUwM7Sdzq9oFXMamb2ZfdccG9fPhleUB3ujM/exec", // URL-ul Web App (…/exec). Gol = MOD DEMO.
  languages: ["ro"],          // prima e implicită. Ex. ["ro", "hu", "en"] afișează butonul de limbă.
  theme: "editorial",         // "editorial" (modern, sobru) sau "cald" (rustic, de munte)
  accent: null,               // culoare de accent proprie, ex. "#8a4b2a"; null = cea a temei
  schemaType: "LodgingBusiness", // sau "Hotel"

  // ---------------------------------------------------------------- identitate
  property: {
    name: "Cabana Șapte",
    kind: "Cabană",
    locality: "Breaza",
    county: "jud. Brașov",
    address: null,            // strada și numărul, pentru hartă și Google
    classification: null,     // ex. „3 margarete” – doar clasificarea reală
    description: "O casă în stil scandinav, între un râu de munte și pădure, la poalele Munților Făgăraș. Se închiriază întreagă, pentru cel mult 9 persoane.",
    different: null           // ce o face diferită, în cuvintele proprietarului
  },

  seo: {
    title: "Cabana Șapte – cabană de închiriat în Breaza, Munții Făgăraș",
    description: "Cabană în stil scandinav pentru cel mult 9 persoane, între râu și pădure, la poalele Munților Făgăraș. Rezervă direct cu gazda."
  },

  topBar: "Rezervi direct: cererea ajunge la gazdă, fără intermediari.",

  hero: {
    label: "Cabană · Breaza, jud. Brașov",
    title: ["o casă", "între râu", "și pădure"],   // titlul rupt pe rânduri, cu litere mici
    text: "Patru dormitoare, un șemineu și Munții Făgăraș la poartă. Toată casa e a voastră.",
    images: [
      { file: null, alt: "Cabana văzută din curte", label: "FOTO: cabana văzută din curte" },
      { file: null, alt: "Livingul cu șemineu", label: "FOTO: livingul cu șemineul" },
      { file: null, alt: "Râul de lângă cabană", label: "FOTO: râul de lângă casă" }
    ]
  },

  contact: {
    phone: null,              // ex. "0722 123 456"
    whatsapp: null,           // număr sau null
    email: null,
    mapsUrl: null,            // link Google Maps
    social: [
      { label: "Facebook", url: "https://www.facebook.com/cabanasapte/" },
      { label: "YouTube", url: "https://www.youtube.com/watch?v=kUARu66d3-s" },
      { label: "Pinterest", url: "https://ro.pinterest.com/cabanasapte/" },
      { label: "Instagram", url: null }
    ]
  },

  // ---------------------------------------------------------------- rezervare directă
  booking: {
    currency: "lei",
    discountPercent: null,    // ex. 10 → „Preț direct: -10% față de platforme”
    deposit: null,            // ex. „Avans 30%, prin transfer bancar, în 48 de ore de la confirmare.”
    cancellation: null,       // ex. „Anulare gratuită cu 14 zile înainte de sosire.”
    confirmHours: null,       // în câte ore confirmă gazda, ex. 12
    childFreeUnderAge: null,  // copiii sub această vârstă stau gratuit (fără pat separat)
    maxRooms: 1,
    // Doar în MOD DEMO: zile ocupate de probă, relativ la ziua de azi
    demoBusy: [
      { unit: "cabana", inDays: 4, nights: 3 },
      { unit: "cabana", inDays: 12, nights: 2 },
      { unit: "cabana", inDays: 20, nights: 5 }
    ]
  },

  // ---------------------------------------------------------------- camere
  // Fiecare tip are lista camerelor fizice (units). Dacă există o singură unitate în total,
  // pasul „Alege camera” se sare automat (cum e aici: se închiriază toată cabana).
  rooms: [
    {
      id: "cabana",
      name: "Cabana întreagă",
      description: "Două dormitoare la parter, două la etaj. Două băi cu duș la parter și una la etaj.",
      units: ["cabana"],
      capacity: 9,
      beds: null,             // ex. „3 paturi duble, 1 pat dublu + 1 single”
      size: null,             // ex. „180 m²”
      amenities: ["4 dormitoare", "3 băi cu duș", "Bucătărie complet utilată", "Șemineu", "Home cinema"],
      price: null,            // preț pe noapte pentru toată cabana
      seasons: [],            // ex. { name: "Sărbători", from: "12-20", to: "01-05", price: 2500 }
      extraBed: { max: 0, price: null },
      minNights: null,        // minim de nopți (null = 1)
      images: [
        { file: null, alt: "Dormitor de la etaj", label: "FOTO: dormitor de la etaj" },
        { file: null, alt: "Bucătăria", label: "FOTO: bucătăria" }
      ]
    }
  ],

  // Rânduri scurte sub hero. Iconițe: wifi, fire, kitchen, baby, music, film, grill, parking,
  // breakfast, pet, mountain, river, bed, bath, clock, key, people
  benefits: [
    { icon: "people", text: "Până la 9 persoane" },
    { icon: "fire", text: "Șemineu în living" },
    { icon: "river", text: "Râu de munte lângă casă" }
  ],

  facilities: [
    { icon: "wifi", text: "Wi-Fi" },
    { icon: "kitchen", text: "Bucătărie complet utilată, cu mașină de spălat vase" },
    { icon: "fire", text: "Șemineu" },
    { icon: "film", text: "Home cinema" },
    { icon: "music", text: "Sistem audio Bluetooth" },
    { icon: "grill", text: "Grătar în curte" },
    { icon: "baby", text: "Pătuț și scaun de masă pentru bebeluși" },
    { icon: "parking", text: null }   // parcare: de confirmat
  ],

  whyDirect: [
    { title: "Vorbești direct cu gazda", text: "Cererea ta ajunge la cei care te primesc, nu la un call center." },
    { title: "Întrebi înainte să rezervi", text: "Ai un câine, sosești târziu, vrei pătuțul pregătit? Scrie la cereri speciale." },
    { title: "Prețul direct", text: "[DE CE E MAI AVANTAJOS DIRECT: reducere, fără comision, mic dejun etc.]" }
  ],

  experiences: {
    title: ["la poalele", "Făgărașului"],
    text: "Casa stă între râu și pădure. Restul îl alegeți voi: drumeție, foc în curte sau o zi întreagă fără program.",
    items: [
      { name: "Munții Făgăraș", text: "Cabana e la poalele lor.", distance: null },
      { name: "Râul de munte", text: "Curge chiar lângă casă.", distance: null },
      { name: "Făgăraș", text: "Cel mai apropiat oraș.", distance: "~30 min cu mașina" },
      { name: "Brașov", text: null, distance: "~1 h 30 min cu mașina" },
      { name: "Aeroportul Sibiu", text: null, distance: "~1 h 30 min cu mașina" }
    ],
    image: { file: null, alt: "Munții Făgăraș", label: "FOTO: peisaj cu Munții Făgăraș" }
  },

  gallery: {
    title: ["cum arată", "o zi aici"],
    images: [
      { file: null, alt: "Fațada", label: "FOTO: fațada" },
      { file: null, alt: "Livingul", label: "FOTO: livingul" },
      { file: null, alt: "Dormitor", label: "FOTO: dormitor" },
      { file: null, alt: "Baie", label: "FOTO: baia" },
      { file: null, alt: "Curtea cu grătarul", label: "FOTO: curtea cu grătarul" },
      { file: null, alt: "Râul", label: "FOTO: râul" },
      { file: null, alt: "Iarna", label: "FOTO: cabana iarna" }
    ],
    video: { file: null, url: "https://www.youtube.com/watch?v=kUARu66d3-s", label: "VIDEO: tur al cabanei" },
    drone: { file: null, label: "FOTO/VIDEO: cadre cu drona" }
  },

  // Doar recenzii reale, cu sursa. rating/count = nota și numărul de pe o platformă.
  reviews: {
    rating: null, count: null, source: null, url: null,
    items: []                 // { text: "...", author: "Prenume", source: "Booking.com" }
  },

  policies: {
    checkIn: null,            // ex. „după 15:00”
    checkOut: null,           // ex. „până la 11:00”
    cancellation: null,
    deposit: null,
    pets: null,
    children: "Copiii sunt bineveniți. Avem pătuț și scaun de masă pentru bebeluși.",
    smoking: null,
    quiet: null,
    payment: null
  },

  hours: {
    reception: null,          // ex. „09:00 – 21:00, la telefon”
    checkIn: null,
    checkOut: null,
    breakfast: null           // null dacă nu se servește
  },

  faq: [
    { q: "Câte persoane încap?", a: "Cel mult 9 persoane, în 4 dormitoare." },
    { q: "Se închiriază pe camere?", a: "Nu, cabana se închiriază întreagă." },
    { q: "Pot veni cu un copil mic?", a: "Da. Avem pătuț și scaun de masă pentru bebeluși." },
    { q: "Pot veni cu animalul de companie?", a: null },
    { q: "Cât de departe e de Brașov?", a: "Cam o oră și jumătate cu mașina. Până în Făgăraș faceți circa 30 de minute." },
    { q: "Cum se plătește?", a: null }
  ],

  legal: {
    company: null, cui: null, regCom: null,
    privacyUrl: null, cookiesUrl: null,
    anpcUrl: "https://anpc.ro/"
  }
};
