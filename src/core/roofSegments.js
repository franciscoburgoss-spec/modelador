// core/roofSegments.js
// ★ B4.7.8 sesión 2 (B-02) — Segmentos de referencia de techumbre desde la FUENTE ÚNICA.
//
// Antes vivían en core/trussLayout.js leyendo `model.roofSystems` directo. Con la techumbre
// persistida como faldones (`model.roofPlanes`) ese array queda vacío, así que snap y hit-test
// dejaban de ver las cerchas: no se podía seleccionar ni enganchar nada de techumbre.
//
// No se pueden arreglar in-situ porque trussLayout.js es dependencia de roofPlaneAdapter.js
// (computeMonoTrussGeometry) y roofPlaneOutputs.js depende del adaptador: importar
// getRoofSystems desde trussLayout cierra el ciclo. De ahí este módulo intermedio: trussLayout
// expone los helpers puros sobre un array, y aquí se les inyecta la fuente resuelta.

import { getRoofSystems } from './roofPlaneOutputs.js';
import { roofPlanSegmentsOf, roofElevationSegmentsOf } from './trussLayout.js';
import { parseElevationMode } from './viewMode.js';

/** Líneas de referencia de cerchas en planta, espacio de plano (h=x, v=y).
 *  Cada segmento lleva `systemId` (hit-test) y `kind` (render). */
export function computeRoofPlanSegments(model) {
  return roofPlanSegmentsOf(getRoofSystems(model));
}

/** Geometría de cercha visible en el corte de elevación `modeStr`, espacio de plano (h,v). */
export function computeRoofElevationSegments(model, modeStr) {
  const parsed = parseElevationMode(modeStr);
  if (!parsed) return [];
  const axes = parsed.axisType === 'x' ? model?.grid?.xAxes : model?.grid?.yAxes;
  const pos = axes?.find(a => a.id === parsed.axisId)?.position;
  if (pos == null) return [];
  return roofElevationSegmentsOf(getRoofSystems(model), parsed.axisType, pos);
}
