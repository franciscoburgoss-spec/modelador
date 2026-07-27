#!/usr/bin/env bash
set -euo pipefail

node scripts/validate-governance.mjs
printf '\nDiagnóstico informativo del entorno:\n'
bash scripts/doctor.sh --advisory

