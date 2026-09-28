# Daychee exact alarms (Android only)

Local Expo module, autolinked from `modules/`. Exposes only the current
`AlarmManager.canScheduleExactAlarms()` status and the system permission screen.
No permission is enabled automatically. API <31 needs no separate exact-alarm
permission. There is no iOS module or extra iOS build configuration.

The JS reminder adapter records permission precision in notification metadata;
returning from system settings reconciles existing alarms when it changes.
Android may cancel exact alarms and kill the process on revocation, so startup
reconciliation handles that transition too. Expo's inexact fallback remains
available with a visible warning when permission is absent.
