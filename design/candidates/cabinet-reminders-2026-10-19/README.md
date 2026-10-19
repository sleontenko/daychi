# Cabinet account schedule and reminders — development candidate

Authority: Workshop reminder-sync c270a198, original issue17. Operator requested
implementation on19October. This candidate retains schedule build5 typography,
day groups, time column, cream/terracotta/sage palette, existing parent navigation,
phone safe areas and iPad split view. It is not a replacement approved reference.
Use synthetic classes/lessons/accounts for all screenshots and fixtures.

## Entry, ownership and presentation

The native feature is explicitly enabled by EXPO_PUBLIC_CABINET_REMINDERS_ENABLED=1.
A Cabinet session selects the account schedule and My Classes; signed-out use
retains the existing guest schedule/choices. Sign-in reads Cabinet without guest
upload. Explicit logout cancels account-owned notifications and restores guest
choices. Guest notifications pause during account use. Cabinet source/class/lesson
IDs never come from HTML labels or catalogue recurrence reconstruction.

Keep parent tabs, nested Settings/Back, direct account entry and scroll/filter/
detail restoration. Schedule shows the existing day/week/calendar view and format
filters. A lesson opens in the existing detail pane. Selection controls distinguish
the whole class from this lesson; no per-date skip exists for account selections.
Removing an individually selected lesson does not suppress a selected class.
My Classes keeps selected classes and individual IDs outside the loaded window;
missing labels read “Занятие вне текущего расписания” and remain removable.
Reminder timing offers school default (show its current minutes),0/15/30/60/120.
Device delivery toggle/permission remains local. Selection is not attendance or
reservation. Legacy Zoom access is not inferred from public Cabinet rows.

## States and transitions

| State | Presentation and allowed transitions |
| --- | --- |
| Initial read | Progress plus retained cache when available; shared edits disabled. Success → confirmed; failure → cached/offline or error. |
| Confirmed online | Only confirmed selections are highlighted; deliberate change → saving. Refresh/foreground refreshes calendar and settings. |
| Saving | Keep confirmed selection/reminder plan; disable all shared edits. Valid response → confirmed and reconcile. Back/tab navigation remains available. |
| Offline | Cached calendar/choices visible, shared edits disabled; existing local reminders retained. Reconnect refreshes authoritative state before editing. No edit queue. |
| Uncertain save | “Проверяем, сохранилось ли изменение”; keep confirmed state and reminders. Refresh reads current settings; no automatic PATCH replay. |
| Rate limited | Retain cache; show retry time and disable read/save until supplied Retry-After. No new retry timers/polling. |
| Rejected input/bound | Keep confirmed state, explain unsaved operation; allow another deliberate corrected choice. |
| Auth/refusal | Read-only cache with sign-in/account action; retain credential on403 and transient failures. Explicit logout returns guest mode. |
| Empty | Explain no chosen lessons; schedule navigation stays available. Empty calendar removes pending window reminders without deselecting saved IDs. |
| Queue pressure | Show scheduled count and bounded future coverage. Full choices remain stored; removals/moves/cancellations apply before replenishment. |

## Verification required

Reference/runtime pairs for schedule, detail, My Classes and reminders on phone/
iPad; empty, regular class, individual, out-of-window, cancelled/restored, initial,
offline, saving, uncertainty, rejected/rate-limited and recovery. Back/Android Back,
direct entry, nested Settings, tabs, scroll/filter retention and safe areas. Device
queue measurements and physical delivery are separate from synthetic UI proof.
