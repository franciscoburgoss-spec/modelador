#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path
import sys

import ezdxf


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit_file(path):
    document = ezdxf.readfile(path)
    auditor = document.audit()
    return {
        "filename": path.name,
        "sha256": sha256(path),
        "dxfVersion": document.dxfversion,
        "layouts": [layout.name for layout in document.layouts],
        "errors": len(auditor.errors),
        "repairs": len(auditor.fixes),
    }


def main():
    paths = [Path(argument).resolve() for argument in sys.argv[1:]]
    if not paths:
        raise SystemExit("Uso: audit-dxf.py <archivo.dxf> [...]")
    if any(path.suffix.lower() != ".dxf" or not path.is_file() for path in paths):
        raise SystemExit("Cada argumento debe ser un archivo DXF existente.")

    report = {
        "ezdxfVersion": ezdxf.__version__,
        "files": [audit_file(path) for path in paths],
    }
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
