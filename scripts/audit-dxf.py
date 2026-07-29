#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path
import sys

import ezdxf
from ezdxf import bbox


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def entity_box(entity):
    try:
        box = bbox.extents([entity], fast=False)
    except Exception:
        return None
    if not box.has_data:
        return None
    return {
        "xMin": float(box.extmin.x),
        "xMax": float(box.extmax.x),
        "yMin": float(box.extmin.y),
        "yMax": float(box.extmax.y),
    }


def viewport_model_box(viewport):
    center = viewport.dxf.view_center_point
    height = float(viewport.dxf.view_height)
    width = height * float(viewport.dxf.width) / float(viewport.dxf.height)
    return {
        "xMin": center.x - width / 2,
        "xMax": center.x + width / 2,
        "yMin": center.y - height / 2,
        "yMax": center.y + height / 2,
    }


def viewport_paper_box(viewport):
    center = viewport.dxf.center
    width = float(viewport.dxf.width)
    height = float(viewport.dxf.height)
    return {
        "xMin": center.x - width / 2,
        "xMax": center.x + width / 2,
        "yMin": center.y - height / 2,
        "yMax": center.y + height / 2,
    }


def outside(inner, outer, tolerance=0.05):
    return (
        inner["xMin"] < outer["xMin"] - tolerance
        or inner["xMax"] > outer["xMax"] + tolerance
        or inner["yMin"] < outer["yMin"] - tolerance
        or inner["yMax"] > outer["yMax"] + tolerance
    )


def sheet_quality(document, source):
    if document.dxfversion != "AC1015" or "Lamina1" not in document.layouts.names():
        return None

    layout = document.layouts.get("Lamina1")
    viewports = sorted(
        [viewport for viewport in layout.query("VIEWPORT") if int(viewport.dxf.id) != 1],
        key=lambda viewport: int(viewport.dxf.id),
    )
    clips = [viewport_model_box(viewport) for viewport in viewports]
    records = []
    for entity in document.modelspace():
        bounds = entity_box(entity)
        if bounds is not None:
            records.append((entity, bounds))

    clipped = []
    for index, clip in enumerate(clips):
        assignment_min = (
            (clips[index - 1]["xMax"] + clip["xMin"]) / 2 if index > 0 else float("-inf")
        )
        assignment_max = (
            (clip["xMax"] + clips[index + 1]["xMin"]) / 2
            if index + 1 < len(clips)
            else float("inf")
        )
        for entity, bounds in records:
            center_x = (bounds["xMin"] + bounds["xMax"]) / 2
            if assignment_min <= center_x <= assignment_max and outside(bounds, clip):
                clipped.append({
                    "viewportId": int(viewports[index].dxf.id),
                    "type": entity.dxftype(),
                    "layer": entity.dxf.layer,
                })

    paper_width = float(layout.dxf_layout.dxf.paper_width)
    paper_height = float(layout.dxf_layout.dxf.paper_height)
    paper = {"xMin": 0, "xMax": paper_width, "yMin": 0, "yMax": paper_height}
    paper_overflow = [
        int(viewport.dxf.id)
        for viewport in viewports
        if outside(viewport_paper_box(viewport), paper)
    ]

    expected_header = {
        "$INSUNITS": 4,
        "$MEASUREMENT": 1,
        "$LTSCALE": 1.0,
        "$CELTSCALE": 1.0,
        "$PSLTSCALE": 1,
        "$MSLTSCALE": 1,
    }
    header_mismatches = {
        key: document.header.get(key)
        for key, expected in expected_header.items()
        if document.header.get(key) != expected
    }

    model_bounds = entity_box_proxy(records)
    extmin = document.header["$EXTMIN"]
    extmax = document.header["$EXTMAX"]
    header_bounds = {
        "xMin": float(extmin[0]),
        "xMax": float(extmax[0]),
        "yMin": float(extmin[1]),
        "yMax": float(extmax[1]),
    }
    extents_contain_model = model_bounds is None or not outside(model_bounds, header_bounds)
    viewport_layer = document.layers.get("VIEWPORTS")

    return {
        "contentViewports": len(viewports),
        "clippedEntities": len(clipped),
        "clippedExamples": clipped[:10],
        "unlockedViewports": [
            int(viewport.dxf.id)
            for viewport in viewports
            if not (int(viewport.dxf.get("flags", 0)) & 16384)
        ],
        "paperOverflowViewports": paper_overflow,
        "headerMismatches": header_mismatches,
        "headerExtentsContainModel": extents_contain_model,
        "viewportLayerPlots": bool(viewport_layer.dxf.get("plot", 1)),
        "blankSubclassMarkers": source.count("\n100\n\n"),
    }


def entity_box_proxy(records):
    if not records:
        return None
    return {
        "xMin": min(bounds["xMin"] for _, bounds in records),
        "xMax": max(bounds["xMax"] for _, bounds in records),
        "yMin": min(bounds["yMin"] for _, bounds in records),
        "yMax": max(bounds["yMax"] for _, bounds in records),
    }


def audit_file(path):
    document = ezdxf.readfile(path)
    auditor = document.audit()
    source = path.read_text(encoding="utf8")
    return {
        "filename": path.name,
        "sha256": sha256(path),
        "dxfVersion": document.dxfversion,
        "layouts": [layout.name for layout in document.layouts],
        "errors": len(auditor.errors),
        "repairs": len(auditor.fixes),
        "quality": sheet_quality(document, source),
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
