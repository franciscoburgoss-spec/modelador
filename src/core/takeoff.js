// core/takeoff.js
// ★ Metrado automático (Tanda 2, ítem 5). Agrupa elementos por tipo + sección de librería
// (o "Personalizado") y suma ml/m²/m³ según corresponda. Reusa los resolve*Geometry de
// elementGeometry.js (mismos valores ya resueltos: fórmulas de parámetro y referencias
// entre elementos), así que el metrado siempre coincide con lo que se ve en planta/3D.
//
// Unidades del modelo: mm. Se convierte a m/m²/m³ solo al acumular (MM_TO_M, etc.).
// Vanos: se descuenta su área (width×height, ya resuelto) del área bruta del muro para
// el m² y el m³ netos — mismo criterio que usa el CSG en build3d.js, pero en 2D.

import { resolveWallGeometry, resolveColumnGeometry, resolveBeamGeometry } from './elementGeometry.js';
import { resolveValue, buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { confirmIfStale } from './derivedInvalidation.js';
import { resolveFoundation } from './foundationGeometry.js';
import { computeOsbNesting } from './osbNesting.js';
import { edgeChordMembers } from './roofObstructions.js';
import { getRoofSystems, roofPurlinTakeoff } from './roofPlaneOutputs.js';

const MM_TO_M = 1e-3;
const MM2_TO_M2 = 1e-6;
const MM3_TO_M3 = 1e-9;

const TYPE_LABEL = { wall: 'Muro', column: 'Pilar', beam: 'Viga', foundation: 'Fundación', roof: 'Techumbre', osb: 'OSB' };
const LIBRARY_KEY = { wall: 'wallSections', column: 'columnSections', beam: 'beamSections', foundation: 'foundationSections' };

function dist(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/** Offset máximo − mínimo de las posiciones de cercha de un sistema (mm). Es el largo
 *  de cada costanera (corre de la primera a la última cercha). */
function trussRunLength(trussPositions) {
  if (!trussPositions || !trussPositions.length) return 0;
  let min = trussPositions[0].offset, max = trussPositions[0].offset;
  for (const p of trussPositions) {
    if (p.offset < min) min = p.offset;
    if (p.offset > max) max = p.offset;
  }
  return Math.abs(max - min);
}

/** Nombre de la sección de librería del elemento, o "Personalizado" si no tiene libraryId
 *  o si la sección referenciada ya no existe (borrada). */
function sectionLabel(el, library) {
  if (!el.libraryId) return 'Personalizado';
  const items = library[LIBRARY_KEY[el.type]] || [];
  const item = items.find((i) => i.id === el.libraryId);
  return item ? item.name : 'Personalizado';
}

/** Sección de librería de una capa de fundación: el sobrecimiento tiene su propio libraryId. */
function layerSectionLabel(el, layer, library) {
  const id = layer.libraryId;
  if (!id) return 'Personalizado';
  const item = (library.foundationSections || []).find((i) => i.id === id);
  return item ? item.name : 'Personalizado';
}

/**
 * Calcula el metrado del modelo completo.
 * @returns {{rows: Array<{type,typeLabel,section,count,ml,m2,m3,warnings:string[]}>, totalsByType: object}}
 */
export function computeTakeoff(model) {
  const { elements, grid, library } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);

  const groups = {};
  const getGroup = (type, section) => {
    const key = `${type}|${section}`;
    if (!groups[key]) {
      groups[key] = { type, typeLabel: TYPE_LABEL[type], section, count: 0, ml: 0, m2: 0, m3: 0, warnings: 0 };
    }
    return groups[key];
  };

  for (const el of elements) {
    const section = sectionLabel(el, library);

    if (el.type === 'wall') {
      const geo = resolveWallGeometry(el, grid, paramsMap, elementsById);
      const bottom = grid.zLevels.find((l) => l.id === el.bottomZ);
      const top = grid.zLevels.find((l) => l.id === el.topZ);
      const g = getGroup('wall', section);
      g.count += 1;
      if (!geo || !bottom || !top || !Number.isFinite(geo.thickness)) { g.warnings += 1; continue; }

      const length = dist(geo.p1, geo.p2);
      const height = Math.abs(top.elevation - bottom.elevation);
      let openingsArea = 0;
      for (const o of el.openings || []) {
        const w = resolveValue(o.width, paramsMap);
        const h = resolveValue(o.height, paramsMap);
        if (Number.isFinite(w) && Number.isFinite(h)) openingsArea += w * h;
        else g.warnings += 1;
      }
      const netArea = Math.max(0, length * height - openingsArea);
      g.ml += length * MM_TO_M;
      g.m2 += netArea * MM2_TO_M2;
      g.m3 += netArea * geo.thickness * MM3_TO_M3;
    }

    else if (el.type === 'column') {
      const geo = resolveColumnGeometry(el, grid, paramsMap, elementsById);
      const bottom = grid.zLevels.find((l) => l.id === el.bottomZ);
      const top = grid.zLevels.find((l) => l.id === el.topZ);
      const g = getGroup('column', section);
      g.count += 1;
      if (!geo || !bottom || !top || !Number.isFinite(geo.w) || !Number.isFinite(geo.h)) { g.warnings += 1; continue; }

      const height = Math.abs(top.elevation - bottom.elevation);
      g.ml += height * MM_TO_M;
      g.m3 += geo.w * geo.h * height * MM3_TO_M3;
    }

    else if (el.type === 'beam') {
      const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
      const beamHeight = el.height != null ? resolveValue(el.height, paramsMap, elementsById) : 500;
      const g = getGroup('beam', section);
      g.count += 1;
      if (!geo || !Number.isFinite(geo.width) || !Number.isFinite(beamHeight)) { g.warnings += 1; continue; }

      const length = dist(geo.p1, geo.p2);
      g.ml += length * MM_TO_M;
      g.m3 += geo.width * beamHeight * length * MM3_TO_M3;
    }

    else if (el.type === 'foundation') {
      // Una fila por capa: el hormigón de cimiento y de sobrecimiento son partidas distintas
      // (y suelen tener resistencia y moldaje distintos). Además emplantillado, moldaje y
      // excavación como partidas propias.
      const f = resolveFoundation(el, grid, paramsMap, elementsById);
      if (!f) { getGroup('foundation', section).count += 1; getGroup('foundation', section).warnings += 1; continue; }

      for (const l of f.layers) {
        const layerSection = layerSectionLabel(el, l, library);
        const g = getGroup('foundation', `${l.label} — ${layerSection}`);
        g.count += 1;
        if (!Number.isFinite(l.volume) || !Number.isFinite(l.width) || !Number.isFinite(l.height)) { g.warnings += 1; continue; }
        if (f.kind === 'corrida') g.ml += f.length * MM_TO_M;
        g.m3 += l.volume * MM3_TO_M3;
      }

      if (f.formworkArea > 0) {
        const g = getGroup('foundation', f.kind === 'aislada' ? 'Moldaje zapata' : 'Moldaje sobrecimiento');
        g.count += 1;
        g.m2 += f.formworkArea * MM2_TO_M2;
      }

      if (f.emplantillado) {
        const g = getGroup('foundation', 'Emplantillado');
        g.count += 1;
        g.m2 += f.emplantillado.area * MM2_TO_M2;
        g.m3 += f.emplantillado.volume * MM3_TO_M3;
      }

      if (f.excavationLength > 0) {
        const g = getGroup('foundation', 'Excavación (informativo)');
        g.count += 1;
        g.ml += f.excavationLength * MM_TO_M;
      }
    }
  }

  // Techumbre (cerchas): solo sistemas con geometría resuelta y al menos una cercha posicionada.
  // Barras: ml = Σ largos de miembros × n_cerchas (todas las cerchas del sistema son iguales),
  // n piezas = n_miembros × n_cerchas. Costaneras: ml = n_purlins × largo_sistema (offset
  // máximo − mínimo de trussPositions), n piezas = n_purlins.
  for (const system of getRoofSystems(model)) {
    if (!system.trussGeometry?.resolved || !(system.trussPositions?.length > 0)) continue;
    // Sesión 25: las posiciones marcadas `edgeChord` no son cerchas — son la cuerda superior
    // atornillada a la cara del frontón (tope de costaneras). Se cuentan aparte y solo con ese
    // miembro; contarlas como cercha completa infla el metrado con material que no se instala.
    const fullPositions = system.trussPositions.filter(p => p.kind !== 'edgeChord');
    const edgePositions = system.trussPositions.filter(p => p.kind === 'edgeChord');
    const nTrusses = fullPositions.length;

    for (const m of system.trussGeometry.members || []) {
      if (nTrusses === 0) break;
      const g = getGroup('roof', m.profile || 'Personalizado');
      g.count += nTrusses;
      g.ml += dist({ x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 }) * nTrusses * MM_TO_M;
    }

    if (edgePositions.length > 0) {
      for (const m of edgeChordMembers(system.trussGeometry)) {
        const g = getGroup('roof', `${m.profile || 'Personalizado'} — cuerda de borde`);
        g.count += edgePositions.length;
        g.ml += dist({ x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 }) * edgePositions.length * MM_TO_M;
      }
    }

    // Soleras de apoyo lateral (una por muro de apoyo), solo si el sistema es 'lateral'.
    for (const led of system.supportLedgers || []) {
      const g = getGroup('roof', led.profile || 'Personalizado');
      g.count += 1;
      g.ml += (led.length || 0) * MM_TO_M;
    }

    const purlins = system.trussGeometry.purlins || [];
    if (purlins.length) {
      const runLength = trussRunLength(system.trussPositions);
      for (const p of purlins) {
        const g = getGroup('roof', p.profile || system.purlinProfile || 'Personalizado');
        g.count += 1;
        g.ml += runLength * MM_TO_M;
      }
    }
  }

  // Costaneras del faldón (B4.7): continuas por la corrida, no por sistema. Los sistemas expandidos
  // traen purlins=[], así que se cuentan aquí desde la modulación de faldón (una pieza = un troceo).
  for (const [profile, g] of roofPurlinTakeoff(model)) {
    const grp = getGroup('roof', profile);
    grp.count += g.count;
    grp.ml += g.ml * MM_TO_M;
  }

  // Revestimiento OSB: a diferencia del resto, la unidad de compra no es el m² de muro sino la
  // PLACA entera. El nesting (core/osbNesting.js) resuelve de qué placa madre sale cada pieza del
  // despiece reutilizando despuntes entre muros, así que el metrado cuenta placas reales, no m²
  // divididos por el área de una placa (que siempre subestima la compra).
  const hasOsb = elements.some((el) => el.type === 'wall' && el.osbCourses?.length > 0);
  let osbPurchase = null;
  if (hasOsb) {
    const nesting = computeOsbNesting(model);
    osbPurchase = {
      boardCount: nesting.totals.boardCount,
      boughtArea: nesting.totals.boughtArea,
      usedArea: nesting.totals.usedArea,
      wasteArea: nesting.totals.wasteArea,
      wastePct: nesting.totals.wastePct,
      reusableArea: nesting.totals.reusableArea,
      reusableCount: nesting.groups.reduce((a, g) => a + g.summary.reusableOffcuts.length, 0),
      scrapArea: nesting.totals.scrapArea,
      cutoutArea: nesting.totals.cutoutArea,
      baseline: nesting.baseline,
      savings: nesting.savings,
      unplaced: nesting.unplaced,
      groups: nesting.groups.map((g) => ({ key: g.key, boardCount: g.summary.boardCount, baselinePerWall: g.baselinePerWall }))
    };
    for (const g of nesting.groups) {
      const gr = getGroup('osb', `Placa ${g.key} mm`);
      gr.count += g.summary.boardCount;
      gr.m2 += g.summary.boughtArea;
      gr.warnings += g.unplaced.length;
    }
  }

  const rows = Object.values(groups).sort((a, b) =>
    a.type === b.type ? a.section.localeCompare(b.section) : a.type.localeCompare(b.type)
  );

  const totalsByType = {};
  for (const r of rows) {
    totalsByType[r.type] = totalsByType[r.type] || { typeLabel: r.typeLabel, count: 0, ml: 0, m2: 0, m3: 0, warnings: 0 };
    const t = totalsByType[r.type];
    t.count += r.count; t.ml += r.ml; t.m2 += r.m2; t.m3 += r.m3; t.warnings += r.warnings;
  }

  return { rows, totalsByType, osbPurchase };
}

function csvEscape(v) {
  const s = String(v);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta el metrado a CSV (separador coma, decimales con punto) para abrir en Excel/Sheets. */
export function downloadTakeoffCsv(model) {
  if (!confirmIfStale(model, 'all')) return;
  const { rows, osbPurchase } = computeTakeoff(model);
  const header = ['Tipo', 'Sección', 'Cantidad', 'ml', 'm2', 'm3', 'Advertencias'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.typeLabel, r.section, r.count,
      r.ml.toFixed(3), r.m2.toFixed(3), r.m3.toFixed(3), r.warnings
    ].map(csvEscape).join(','));
  }

  // Bloque de compra OSB: no cabe en el esquema por sección (son m² comprados vs usados y una
  // comparativa contra el escenario sin optimizar), así que va como anexo al final del CSV.
  if (osbPurchase) {
    const p = osbPurchase;
    lines.push('');
    lines.push('Reporte de compra OSB');
    lines.push(['Placas a comprar', p.boardCount].map(csvEscape).join(','));
    lines.push(['m2 comprados', p.boughtArea.toFixed(3)].map(csvEscape).join(','));
    lines.push(['m2 usados', p.usedArea.toFixed(3)].map(csvEscape).join(','));
    lines.push(['% de pérdida', p.wastePct.toFixed(2)].map(csvEscape).join(','));
    lines.push(['Despuntes reutilizables', p.reusableCount, `${p.reusableArea.toFixed(3)} m2`].map(csvEscape).join(','));
    lines.push(['Merma no recuperable (m2)', p.scrapArea.toFixed(3)].map(csvEscape).join(','));
    lines.push(['Placas sin optimizar (muro por muro)', p.baseline.perWallBoards].map(csvEscape).join(','));
    lines.push(['Ahorro (placas)', p.savings.boards, `${p.savings.pct.toFixed(1)}%`].map(csvEscape).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'metrado.csv';
  a.click();
  URL.revokeObjectURL(url);
}
