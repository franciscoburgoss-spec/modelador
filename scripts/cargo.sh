#!/usr/bin/env bash
set -euo pipefail

if [[ -f "$HOME/.cargo/env" ]]; then
  # rustup se instala sin modificar los perfiles interactivos del usuario.
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi

exec cargo "$@"
