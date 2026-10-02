# Proiect: template site pensiune cu rezervare directă

Specificația completă e în docs/SPEC.md. Citește-o înainte de orice modificare.
Arhitectura aprobată e în docs/ARCHITECTURE.md (după Faza 2 din docs/WORKFLOW.md).

## Reguli care nu se negociază
- Site static: HTML, CSS, JavaScript simplu. Fără framework, fără pas de build,
  fără librării externe (inclusiv fără librării de animație precum GSAP).
  Animațiile doar cu CSS și JavaScript simplu. Fonturile din Google Fonts sunt permise.
- Tot conținutul vine din site.config.js. Niciun text de conținut scris în HTML.
- Un client nou = editez doar site.config.js și /img. Zero modificări de cod.
- Backend doar Google Apps Script + Google Sheet, în apps-script/.
- Nu inventa date despre proprietate: câmpurile goale rămân goale, cu placeholder.
- Nu copia designul, textele sau elementele de brand ale site-urilor de referință
  sau ale platformelor de rezervări (Booking.com etc.); copiem doar fluxul și claritatea.
- Textele vizibile în română cu diacritice; comentariile din cod în română.
- Skill-urile de design (high-end-visual-design, design-taste-frontend) se aplică
  pentru aspect, dar regulile de mai sus au prioritate când sunt în conflict.

## Mod de lucru
- Modifici doar fișierele cerute în sarcina curentă.
- La final de sarcină: rezumat scurt cu ce ai schimbat și ce a rămas de făcut.
