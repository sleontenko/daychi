# Тихая практика — universal client

Expo SDK 57 application for iOS, Android and web. It is a thin client over the
server-side `practice_api`; corpus data and AI credentials are never bundled
into the app.

## Schedule-first iOS build

The root screen uses the approved organic prototype tokens and a real schedule.
Native iOS races the isolated schedule service with a direct, validated import of
the school's public timetable; web uses the service. No external browser or code
entry is required. Attendance and notification preferences persist on-device.
iOS schedules one local notification per selected date (0/15/30/60 minutes before),
with cancellation/rescheduling when choices or refreshed source data change.
No server, APNs enrollment, or internet is needed at delivery time. The schedule
covers 14 days and refreshes on foreground / every five foreground minutes.
Telegram changes and background timetable reconciliation are not implemented;
the UI states this limitation. Current UX, verification and release status:
[`docs/schedule-build3.md`](../../docs/schedule-build3.md).
Earlier server/APNs work: [`docs/testflight-schedule-mvp.md`](../../docs/testflight-schedule-mvp.md).

## Organic iOS prototype

The `/prototype` screen preserves the interactive prototype from
`Форма карты практики.zip`: Today, Schedule, Practice Map, Wiki, lesson detail,
notes, player, reminders, and article detail. Prototype content is local mock
data by design; the existing API-backed library screen remains available at
`/explore` for the next integration pass.

The visual comparison and verification record live in `design-qa.md`.

```bash
npm install
npm run web
npm run ios
npm run android
```

The local API defaults are:

- web and iOS Simulator: `http://127.0.0.1:8000`;
- Android Emulator: `http://10.0.2.2:8000`.

For a physical device or remote environment, copy `.env.example` to
`.env.local` and set `EXPO_PUBLIC_API_URL` to a reachable backend address.

Verification:

```bash
npx tsc --noEmit
npx expo-doctor
npm audit --omit=dev
npx expo export --platform web
```
