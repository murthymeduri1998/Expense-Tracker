Expense Planner V9 - Offline-first

Key changes:
- Offline-first local IndexedDB data entry. Existing DB is upgraded without clearing records.
- Local profile/PIN login can be enabled by the V9 frontend (see Offline Login in Settings).
- Mobile bottom navigation removed. Mobile uses the side drawer only.
- Reports stay inside Reports. Finance/Gym/Cardio/Food/Water/Body/Health report tabs render charts in-place.
- Savings is calculated as max(income-expenses, 0); deficit is shown separately. Signed input reverses transaction type.
- Categories are free-hand: type a new category in Expense or add it from Categories/Budget.
- Weekly weight logs + week-over-week comparison and insights.
- Smart suggestions are generated locally from finance, water, workout and weight data.
- All existing finance/health logs remain local and are sync-ready.

Google Sheets:
- The existing Apps Script endpoint is retained by the frontend.
- The frontend sends transactions, health logs and metadata through the existing API.
- Separate Google Sheet tabs require the matching V9 Code.gs backend. Do not replace a working production Code.gs until it has been tested against your current sheet.

Deployment:
- Upload index.html, app-v9.js, styles.css, manifest.json and icon.svg to GitHub Pages.
- Do not delete IndexedDB or clear Safari website data.
