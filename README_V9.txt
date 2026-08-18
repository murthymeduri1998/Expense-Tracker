LIFE PLANNER V9 — FULL WORKING PACKAGE

Frontend:
- index.html
- app-v9.js (or existing application JS)
- styles.css
- motion.css / motion.js where present
- manifest.json / icons where present

Backend:
- Code.gs (Google Apps Script)
- Google Sheets is cloud sync only; IndexedDB remains local/offline storage.

Deployment:
1. Upload frontend files to GitHub Pages (or equivalent static hosting).
2. Deploy Code.gs as a Google Apps Script Web App.
3. Use the deployed Apps Script Web App URL in the app's Google Sheets settings.
4. Do not clear existing browser storage when upgrading.

Offline:
- Login/profile and data entry are local-first.
- Data remains in IndexedDB when offline.
- Sync failures must not clear local records.

Important:
- Keep Code.gs out of the static GitHub Pages deployment if you prefer; it is the Apps Script backend.
