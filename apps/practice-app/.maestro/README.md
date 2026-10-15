# Maestro UI tests

Daychi uses local Maestro flows for native UI regression checks. Start with the
isolated `ai.mypraxis.quietpractice.wikidesignqa` app, whose entry is
`scripts/wiki-design-qa-entry.js` and whose synthetic content is
`../wiki-graph/qa/content-v1.json`. The normal app, release configuration,
bundle ID, URL scheme and API contracts are unchanged.

## Local setup

Requires Java 17+ and a running iOS Simulator or Android emulator. The pilot was
run with Maestro **2.11.0** on iOS. CLI documentation:
https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli.md

From the repository root, install the pinned CLI into the ignored tool directory:

```sh
mkdir -p data/maestro-toolchain
curl -fL https://github.com/mobile-dev-inc/maestro/releases/download/cli-2.11.0/maestro.zip \
  -o data/maestro-toolchain/maestro.zip
unzip -qt data/maestro-toolchain/maestro.zip
unzip -n data/maestro-toolchain/maestro.zip -d data/maestro-toolchain
bash apps/practice-app/scripts/maestro.sh version
bash apps/practice-app/scripts/maestro.sh check-syntax
```

The wrapper also accepts an existing CLI on PATH or `DAYCHI_MAESTRO_BIN` and
uses `JAVA_HOME`, the existing ignored Android JDK, or macOS Java discovery.
It disables CLI analytics and stores tool state and all run artifacts under
ignored `data/`. It does not edit shell profiles or use Maestro Cloud.

Install the synthetic QA app separately, then list devices and run:

```sh
bash apps/practice-app/scripts/maestro.sh list-devices
DAYCHI_MAESTRO_DEVICE='<simulator-or-emulator-id>' \
  bash apps/practice-app/scripts/maestro.sh test
# Run only the persistence check:
DAYCHI_MAESTRO_DEVICE='<simulator-or-emulator-id>' \
  bash apps/practice-app/scripts/maestro.sh test .maestro/03-wiki-bookmark.yaml
```

Tests begin by clearing **only the fixture app's** data. Do not run these flows
directly against the normal application. The wrapper requires an explicit device
and rejects other app IDs. It never clears the iOS keychain. The existing fixture
entry itself rejects physical devices and normal bundle IDs.

The synthetic binary is not generated or installed by this wrapper. The initial
pilot reused the existing simulator-only binary with embedded QA JavaScript,
described in `../../../docs/qa-wiki-claude-2026-10-09/README.md`. Rebuilding and
installing a fresh native binary is a separate prerequisite after native changes.
Android needs its own guarded synthetic build; iOS results do not establish Android
results. This fixture blocks unexpected network requests and does not supply
schedule lessons, so its schedule screen exercises the load-error state.

## Coverage

- `01-navigation.yaml`: empty My Classes, settings → About → Privacy → Back,
  return to My Classes, schedule, then native Wiki tab. Android Back is exercised
  for the Privacy return when running on Android.
- `02-wiki-search.yaml`: search, open reader, Back with query retained, native
  tab switch with the same query retained. Uses a real filter button to dismiss
  the WebView keyboard without a coordinate-based fallback tap.
- `03-wiki-bookmark.yaml`: save a material, restart without resetting data,
  open saved pages, verify the material still shows Saved.

Each run prints its private artifact path. It contains JUnit, command logs,
failure hierarchy/screenshots and named screenshots. Keep raw artifacts out of
Git and never upload private content, invitations, sessions or Zoom details.
Screenshots support comparison with `../../../docs/DESIGN.md`; these flows do not
perform a pixel comparison or replace design acceptance, unit/API tests or
physical notification/installation QA.

Next coverage: deterministic schedule fixtures for regular series, next date,
skip/restore, one-off dates and series outside the loaded window; graph/camera and
reader-scroll restoration; offline/error/retry and real Android Back. None of
these are claimed by the initial smoke suite.

For agent-driven inspection, the same local CLI exposes `hierarchy` and `mcp`:

```sh
DAYCHI_MAESTRO_DEVICE='<simulator-id>' \
  bash apps/practice-app/scripts/maestro.sh hierarchy
bash apps/practice-app/scripts/maestro.sh mcp
```

MCP registration in the agent's settings is not performed by these files.
