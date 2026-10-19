# Synthetic reminder UI fixture

Development only; actual Router/screens, credential owner, reminder transport,
controller, calendar and OS-notification adapter. Account/SecureStore/AsyncStorage
are in memory; all application network except loopback is blocked or rewritten to
the synthetic local provider. It never reads real credentials or private corpus.

Start `DAYCHI_SYNTHETIC_REMINDERS_QA=1 node scripts/qa-cabinet-reminders/server.mjs`
from apps/practice-app. Temporarily set package main to this folder's `entry.js`
and Metro config to `module.exports=require('./scripts/qa-cabinet-reminders/metro.cjs')`.
Back up exact original files first. Start Expo on localhost8115 with
DAYCHI_SYNTHETIC_REMINDERS_QA=1, EXPO_PUBLIC_CABINET_ACCOUNT_ENABLED=1,
EXPO_PUBLIC_CABINET_REMINDERS_ENABLED=1, EXPO_PUBLIC_CABINET_SCHEDULE_PILOT=0,
EXPO_PUBLIC_SCHEDULE_API_URL=https://backend.test. Launch a Debug native container
with expo-network linked and `-RCT_jsLocation localhost:8115`.

Local POST /qa/state takes mode active/blocked/invalid/offline/limited/lost/slow/
malformed; calendar full/empty/offline/move/cancel/capacity/capacity-cancel;
choices:"full" adds a class and lesson absent from the active catalogue/window.
reset:true clears synthetic settings. /qa/journal contains method/path/status only;
/qa/receipt contains synthetic state and actual pending-queue IDs/times, no bearer.
The fixture interval is diagnostic only and is absent from ordinary bundles.

Use dedicated simulators, synthetic data and Device Hub for navigation. OS permission
and delivery are real simulator operations; this is not physical delivery proof.
After testing, disable/remove synthetic pending entries, stop the apps/fixture/Metro,
restore exact package main and Metro files, export ordinary flag-off/on bundles,
and check that no fixture markers remain. Never distribute the QA app or fixture.
