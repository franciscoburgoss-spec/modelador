#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
environment_dir="$repository_root/.venv-verification"
requirements="$repository_root/harness/python/requirements-dxf.txt"

python3 -m venv "$environment_dir"
"$environment_dir/bin/python" -m pip install --disable-pip-version-check --requirement "$requirements"
"$environment_dir/bin/python" -c \
  'import ezdxf, sys; print(f"Python {sys.version.split()[0]}; ezdxf {ezdxf.__version__}")'
