# Start aici

Folderul ăsta e punctul de pornire pentru template-ul de site cu rezervare directă
pentru pensiuni și hoteluri mici (8–10 camere), construit cu Claude Code + SuperClaude.

## Ce e în folder
- CLAUDE.md: regulile pe care Claude Code le citește automat în fiecare sesiune.
- docs/SPEC.md: specificația completă a site-ului (funcționalități, rezervare,
  Apps Script, stil vizual, date despre proprietate).
- docs/WORKFLOW.md: pașii de lucru cu SuperClaude, fază cu fază, cu comenzile gata
  de copiat.
- docs/PROMPT-SERVICE-AUTO.md: promptul separat pentru demo-urile de service auto.
- .claude/skills/: skill-urile de design (high-end-visual-design,
  design-taste-frontend, web-design-guidelines), deja puse unde le găsește
  Claude Code pentru acest proiect.

## Cum pornești
1. Dezarhivează folderul unde vrei să ții proiectul.
2. Deschide un terminal în folder și rulează: git init
3. Fă primul commit: git add . && git commit -m "spec si reguli"
4. Pornește Claude Code în folder și urmează docs/WORKFLOW.md de la Faza 1.

## Regula de aur
Pentru fiecare client nou NU mai rulezi comenzile din WORKFLOW.md. Copiezi proiectul
terminat, completezi site.config.js, pui pozele în /img și faci setup-ul Google
din README.md. Comenzile SuperClaude sunt doar pentru schimbări la template.
