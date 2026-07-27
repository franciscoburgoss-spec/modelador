#!/usr/bin/env bash
set -u

advisory=0
if [[ "${1:-}" == "--advisory" ]]; then
  advisory=1
fi

failures=0
warnings=0

pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }

check_command() {
  local command_name="$1"
  local label="$2"
  if command -v "$command_name" >/dev/null 2>&1; then
    pass "$label: $(command -v "$command_name")"
  else
    fail "$label no está instalado"
  fi
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  pass "Sistema macOS $(sw_vers -productVersion)"
else
  fail "Este perfil de producción requiere macOS"
fi

if [[ "$(uname -m)" == "x86_64" ]]; then
  pass "Arquitectura x86_64"
else
  warn "Arquitectura $(uname -m); revisar target de release"
fi

check_command git "Git"
check_command npm "npm"
check_command ccx "CalculiX"
check_command clang "Apple Clang"

if command -v node >/dev/null 2>&1; then
  node_version="$(node -p 'process.versions.node')"
  node_major="${node_version%%.*}"
  if [[ "$node_major" == "22" ]]; then
    pass "Node $node_version"
  else
    fail "Node $node_version; se requiere la rama 22 LTS"
  fi
else
  fail "Node no está instalado"
fi

if command -v rustc >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
  pass "Rust $(rustc --version)"
else
  fail "Rust/Cargo no están instalados"
fi

if python3 -c 'import ezdxf' >/dev/null 2>&1; then
  pass "Python ezdxf disponible"
else
  fail "Python ezdxf no está disponible en el entorno activo"
fi

if xcode-select -p >/dev/null 2>&1; then
  pass "Xcode Command Line Tools: $(xcode-select -p)"
else
  fail "Xcode Command Line Tools no están instaladas"
fi

printf '\nResumen: %d fallos, %d advertencias\n' "$failures" "$warnings"

if [[ "$failures" -gt 0 && "$advisory" -eq 0 ]]; then
  exit 1
fi

