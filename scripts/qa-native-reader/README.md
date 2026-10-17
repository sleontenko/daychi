# Synthetic native reader fixture

Local development only. This is an isolated installed-native host for the actual
CabinetWikiScreen, CabinetAccountScreen, session-core, content client and generated
WKWebView reader. FastAPI mounts the actual native aliases over the existing test
fixture. It never reads a corpus, real account, SecureStore key or production URL.

From the repository root, with existing development dependencies:

```sh
DAYCHI_SYNTHETIC_READER_QA=1 PYTHONPATH=. .venv/bin/python scripts/qa-native-reader/server.py
```

Use the root checkout's existing venv by absolute path if a task checkout has none.
For the app, temporarily select `scripts/qa-native-reader/entry.js` as package.json
`main` and create an ignored, temporary `metro.config.js` containing
`module.exports=require('./scripts/qa-native-reader/metro.cjs');`. Preserve the exact
original files first. Then run from apps/practice-app:

```sh
DAYCHI_SYNTHETIC_READER_QA=1 npx expo start --localhost --port 8101
```

Use a development native container with react-native-webview linked, bundle ID
ai.mypraxis.quietpractice, and `-RCT_jsLocation localhost:8101`. The iPad container
must reflect existing app.json supportsTablet/orientation settings. This does not
require a new archive or TestFlight upload. Restore package.json and remove only
the temporary Metro config afterwards; neither override is committed.

The QA toolbar signs in through actual session-core with a synthetic callback,
toggles visibility and independent legacy access, and controls a fake Cabinet
provider: active, invalid401, blocked403, limited429/Retry-After7, offline503.
Content is the existing two-material synthetic backend fixture. The API shim
rewrites backend.test to loopback solely within this explicit QA resolver; ordinary
app code continues to require fixed HTTPS. Account memory is intentionally volatile.
Bookmarks/recent IDs use the ordinary app storage, so use dedicated simulators.
`GET /qa/journal` reports route/status only. No credential or material body is logged.

The fixture does not establish real Cabinet acquisition, HTTPS deployment, capacity,
provider outage behavior or joint conformance. Do not enable it in normal app/Metro
configuration or deploy the fixture. See the [executed evidence](../../docs/qa-native-content-ui-2026-10-17/README.md).
