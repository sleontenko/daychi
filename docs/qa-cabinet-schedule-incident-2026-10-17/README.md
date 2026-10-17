# Cabinet schedule incident —17October2026

The operator reports the Cabinet schedule unavailable on both physical iPad and
iPhone, including mobile data and VPN on/off. Exact installed builds, OS versions
and the device-side HTTP/transport failure remain unrecorded. Do not mark this
physical incident resolved from simulator or server-only success.

## Independently observed

- Real anonymous staging window17–31October (Asia/Jerusalem midnight, separate
  +03/+02 offsets): HTTP200 application/json,64 rows in674ms; the exact decoder
  passed. Installed iOS27 iPad Debug/Hermes public client:200,64 rows in550ms.
- Original archived build18 Release Simulator app, bytecode SHA256
  `9fb44372c234ac226f8c494b91d4af7000a351909b0955b8c1b168171e4aef7f`, loaded
  the actual Cabinet schedule at cold start and after pull-to-refresh. Its compiled
  hook explicitly enables the pilot at `https://staging.xuanxue.su`.
  This is the historical simulator artifact, not the App Store physical binary.
- A separate deterministic client defect was reproduced: `dayKey` treated
  en-CA display output as an ISO storage/API date. With valid alternate display
  text `10/17/2026`, the public client failed as `configuration` before any fetch;
  the existing UI misleadingly called it a connection error. No observed physical
  OS output has yet connected this defect to the operator's incident.

## Correction and checks

School date keys now assemble year/month/day from `formatToParts`, explicitly
using Gregorian calendar and Latin digits in Asia/Jerusalem. Date identity,
ordinary selection/reminder keys and server wire retain YYYY-MM-DD.
Two regression tests failed on the parent and pass after the correction. They
cover date keys across school midnight/DST and successful actual client request
construction despite a non-ISO display pattern.

**143 app tests, TypeScript and Expo lint pass.** Normal iOS/Hermes export
passes with no diagnostic entry/forced-date markers; the666-file repository
credential/archive guard passes. A5844-instant comparison every
six hours over2024–2027 retains every previously canonical date key. An installed
iPad Debug/Hermes diagnostic forced the alternate en-CA display pattern and read
real staging successfully: HTTP200,64 rows,508ms. Normal full Expo Router iPad
screen also loaded actual Cabinet rows and retained the existing build18 layout;
no screen markup or visual design changed. Private local reference/runtime pairs
and receipts are outside Git in `data/ipad-cabinet-schedule-20261017`.

Temporary diagnostic entry/package changes were removed and the exact original
package.json restored. No dependency/version/native identity/storage-key change,
account/lesson/class mutation, new upload, content activation or deployment.
Existing external build18 remains unchanged and does not contain this correction.

## Open diagnosis

Provider telemetry request is in [Workshop6](https://github.com/dveyarangi/xuanxue-workshop/issues/6#issuecomment-6239950392).
Device Safari reachability, installed versions/OS and provider telemetry remain
needed to establish the actual physical-device failure. Existing schedule6
acceptance obligations and separate native-content/browser/shared-sync work remain.
