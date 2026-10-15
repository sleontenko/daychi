#!/usr/bin/env bash
set -euo pipefail

daychi_app_dir="$(cd "$(dirname "$0")/.." && pwd)"
daychi_repo_dir="$(cd "$daychi_app_dir/../.." && pwd)"
daychi_tool_dir="$daychi_repo_dir/data/maestro-toolchain"
daychi_maestro="${DAYCHI_MAESTRO_BIN:-$daychi_tool_dir/maestro/bin/maestro}"
if [[ ! -x "$daychi_maestro" ]]; then
  daychi_maestro="$(command -v maestro || true)"
fi
if [[ -z "$daychi_maestro" || ! -x "$daychi_maestro" ]]; then
  echo 'Install Maestro CLI first; see .maestro/README.md.' >&2
  exit 1
fi
if [[ -z "${JAVA_HOME:-}" ]]; then
  for daychi_java in "$daychi_repo_dir"/data/android-toolchain/jdk-*/Contents/Home; do
    if [[ -x "$daychi_java/bin/java" ]]; then
      export JAVA_HOME="$daychi_java"
      break
    fi
  done
fi
if [[ -z "${JAVA_HOME:-}" ]]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
fi
if [[ ! -x "${JAVA_HOME:-}/bin/java" ]]; then
  echo 'Set JAVA_HOME to an installed JDK 17 or newer.' >&2
  exit 1
fi

# Keep tool state, logs and screenshots in the ignored data directory.
mkdir -p "$daychi_tool_dir/state/.maestro"
export MAESTRO_OPTS="${MAESTRO_OPTS:-} -Duser.home=$daychi_tool_dir/state"
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
daychi_command="${1:-test}"
if [[ $# -gt 0 ]]; then shift; fi
cd "$daychi_app_dir"
case "$daychi_command" in
  version) exec "$daychi_maestro" --version ;;
  check-syntax)
    for daychi_flow in .maestro/[0-9]*.yaml; do
      "$daychi_maestro" check-syntax "$daychi_flow"
    done
    ;;
  hierarchy|mcp|list-devices)
    if [[ -n "${DAYCHI_MAESTRO_DEVICE:-}" ]]; then
      exec "$daychi_maestro" --device "$DAYCHI_MAESTRO_DEVICE" "$daychi_command" "$@"
    fi
    exec "$daychi_maestro" "$daychi_command" "$@" ;;
  test)
    daychi_app_id="${DAYCHI_MAESTRO_APP_ID:-ai.mypraxis.quietpractice.wikidesignqa}"
    if [[ "$daychi_app_id" != 'ai.mypraxis.quietpractice.wikidesignqa' ]]; then
      echo 'These flows require the isolated wikidesignqa synthetic fixture app.' >&2
      exit 1
    fi
    if [[ -z "${DAYCHI_MAESTRO_DEVICE:-}" ]]; then
      echo 'Set DAYCHI_MAESTRO_DEVICE to the simulator/emulator ID to test.' >&2
      exit 1
    fi
    daychi_run_dir="$(mktemp -d "$daychi_repo_dir/data/maestro-run-XXXXXXXX")"
    echo "Maestro artifacts: $daychi_run_dir"
    if [[ $# -eq 0 ]]; then set -- .maestro; fi
    exec "$daychi_maestro" --device "$DAYCHI_MAESTRO_DEVICE" test \
      -e "APP_ID=$daychi_app_id" --format JUNIT --output "$daychi_run_dir/junit.xml" \
      --debug-output "$daychi_run_dir/debug" --test-output-dir "$daychi_run_dir/artifacts" "$@"
    ;;
  *) echo 'Usage: bash scripts/maestro.sh [test [flow.yaml]|check-syntax|version|hierarchy|list-devices|mcp]' >&2; exit 1 ;;
esac
