LIFE PLANNER V9.3 - GOOGLE SYNC FIX

Why the old build showed "Sync failed — local data is safe"
-------------------------------------------------------------
The frontend calls these Apps Script actions:
  discover
  connect
  getAll
  upsertMany
  upsertHealth
  upsertMeta

If the deployed Apps Script is an older version that does not contain all of
these actions, the frontend can connect but the final upload step fails.

The V9.3 frontend now:
  - does not attempt Google sync while offline;
  - keeps all local IndexedDB data untouched on any sync failure;
  - uses a 20-second request timeout;
  - reports the exact sync stage that failed when Sync Now is pressed;
  - does not repeatedly show a toast for background-sync failures;
  - keeps the saved connection during temporary discovery failures.

IMPORTANT: DEPLOY THE MATCHING Code.gs
--------------------------------------
1. Open your Google Apps Script project.
2. Replace the deployed project's Code.gs with the Code.gs included in this ZIP.
3. Deploy -> Manage deployments.
4. Edit the existing Web app deployment.
5. Create a new version / deploy the latest version.
6. Execute as: Me.
7. Who has access: Anyone (or the access setting you already use for your app).
8. Keep the same /exec deployment URL if possible.
9. Open the app and press Settings -> Sync now.

DO NOT delete the Google Sheet or clear the browser's IndexedDB.

If Sync Now still fails after deploying the matching Code.gs, the app will now
show the exact failing action instead of the generic error. Send that exact
message and it can be fixed directly.
