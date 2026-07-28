// core/exportCalculix.js
import { resolveColumnGeometry, resolveBeamGeometry, resolveWallGeometry, wallOffsetToWorldPoint, isWallXRun } from './elementGeometry.js';
import { resolveFoundation } from './foundationGeometry.js';
import { resolveValue, buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { guardExport } from './exportPolicy.js';
import {
  calculixIdSetName,
  compactCalculixName,
  makeNodeRegistry,
  cm2ToMm2,
  cm4ToMm4,
  rectangularGeneralProperties,
  safeName
} from './calculixCommon.js';
import { collectTypicalTruss } from './exportCalculixTruss.js';
import { getRoofSystems } from './roofPlaneOutputs.js';

/** Busca un perfil metalcon cargado en la librería del PROYECTO (model.library.metalconProfiles)
 * por su `id` generado — NO por `code` del catálogo estático. ★ Fix: antes se usaba
 * findMetalconProfile(code) de core/metalconCatalog.js, pero tanto MetalconModulationModal
 * (muros) como la selección de material+perfil en pilares/vigas guardan el `id` de la librería
 * del proyecto, nunca el `code` — la búsqueda anterior nunca calzaba con datos reales. */
export function findProjectMetalconProfile(metalconProfiles, id) {
  if (id == null) return null;
  return metalconProfiles.find(p => p.id === id) || null;
}

/** Material real de una sección de librería (pilar/viga), si tiene materialId asignado.
 * Devuelve null si no hay material asignado o no se encuentra (fallback a genérico). */
function resolveSectionMaterial(section, materials) {
  if (!section || section.materialId == null) return null;
  return materials.find(m => m.id === section.materialId) || null;
}

/** Vector de orientación (normal al eje de la barra) para *BEAM GENERAL SECTION, según la
 * dirección real del elemento — mismo criterio que usan los montantes/soleras de muro. */
function columnOrientVec() { return { x: 1, y: 0, z: 0 }; }
function beamOrientVec(geo) {
  const alongX = Math.abs(geo.p2.y - geo.p1.y) < 0.01;
  const alongY = Math.abs(geo.p2.x - geo.p1.x) < 0.01;
  if (alongX) return { x: 0, y: 1, z: 0 };
  if (alongY) return { x: 1, y: 0, z: 0 };
  return { x: 0, y: 0, z: 1 }; // diagonal: normal vertical como fallback razonable
}

/** Genera un .inp (CalculiX) con nodos + elementos de barra (B31) para columnas, vigas,
 *  fundaciones, y montantes/soleras de metalcon (wall.studs, ver core/metalconModulation.js).
 *  ★ Pilares/vigas cuya sección de librería tiene material+perfil metalcon asignado (ver
 *  LibraryModal) usan *BEAM GENERAL SECTION con área/inercias reales y el material real (E,
 *  densidad); el resto sigue el fallback genérico previo (SECTION=RECT, hormigón genérico).
 *  NO incluye: cargas, condiciones de borde, combinaciones, ni verificación de secciones. Es un
 *  punto de partida geométrico — requiere completarse en CalculiX/PrePoMax antes de analizar. */
export function generateCalculix(model) {
  const { grid, elements, library } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);
  const metalconProfiles = library?.metalconProfiles || [];
  const materials = library?.materials || [];
  const columnSections = library?.columnSections || [];
  const beamSections = library?.beamSections || [];
  const reg = makeNodeRegistry();

  const columnEls = []; // fallback genérico (sin sección de librería o sin material asignado)
  const beamEls = [];
  const foundationGroups = [];
  /** Un grupo por sección de librería (family) con material/perfil real asignado. */
  const columnGroups = new Map(); // libraryId -> { elsetName, els, section, material }
  const beamGroups = new Map();
  const framingGroups = []; // montantes/soleras de muro — un ELSET por muro (ver collectWallFraming)
  const skippedWalls = [];

  for (const el of elements) {
    if (el.type === 'column') {
      const geo = resolveColumnGeometry(el, grid, paramsMap, elementsById);
      const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
      const top = grid.zLevels.find(l => l.id === el.topZ);
      if (!geo || !bottom || !top) continue;
      const n1 = reg.getNode(geo.center.x, geo.center.y, bottom.elevation);
      const n2 = reg.getNode(geo.center.x, geo.center.y, top.elevation);
      const section = el.libraryId != null ? columnSections.find(s => s.id === el.libraryId) : null;
      const material = resolveSectionMaterial(section, materials);
      if (material) {
        const key = `col_${el.libraryId}`;
        if (!columnGroups.has(key)) columnGroups.set(key, { elsetName: compactCalculixName(`PILARES_L${safeName(el.libraryId)}`), els: [], section, material });
        columnGroups.get(key).els.push({ n1, n2 });
      } else {
        columnEls.push({ n1, n2, widthX: geo.w, widthY: geo.h });
      }
    } else if (el.type === 'beam') {
      const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
      const level = grid.zLevels.find(l => l.id === el.levelZ);
      if (!geo || !level) continue;
      const n1 = reg.getNode(geo.p1.x, geo.p1.y, level.elevation);
      const n2 = reg.getNode(geo.p2.x, geo.p2.y, level.elevation);
      const height = el.height != null ? resolveValue(el.height, paramsMap, elementsById) : geo.width;
      const section = el.libraryId != null ? beamSections.find(s => s.id === el.libraryId) : null;
      const material = resolveSectionMaterial(section, materials);
      if (material) {
        const key = `beam_${el.libraryId}`;
        if (!beamGroups.has(key)) beamGroups.set(key, { elsetName: compactCalculixName(`VIGAS_L${safeName(el.libraryId)}`), els: [], section, material, orientVec: beamOrientVec(geo) });
        beamGroups.get(key).els.push({ n1, n2 });
      } else {
        beamEls.push({ n1, n2, width: geo.width, height });
      }
    } else if (el.type === 'foundation') {
      // Las zapatas aisladas no son barras: se omiten del modelo de líneas (irían como apoyo).
      const f = resolveFoundation(el, grid, paramsMap, elementsById);
      if (!f || f.kind !== 'corrida') continue;
      const z = f.topElevation;
      const n1 = reg.getNode(f.p1.x, f.p1.y, z);
      const n2 = reg.getNode(f.p2.x, f.p2.y, z);
      foundationGroups.push({
        elsetName: calculixIdSetName('F', el.id),
        elementId: el.id,
        n1,
        n2,
        width: f.width,
        depth: f.topElevation - f.sealElevation
      });
    } else if (el.type === 'wall') {
      collectWallFraming(el, grid, paramsMap, elementsById, reg, metalconProfiles, materials, framingGroups, skippedWalls);
    }
  }

  // ★ Cerchas de techumbre: se integran al MISMO .inp para que el modelo quede completo.
  // Solo geometría + secciones (sin apoyos/cargas, igual que el resto de este export);
  // el .inp CORRIBLE de la cercha tipo lo genera core/exportCalculixTruss.js.
  const trussGroups = [];
  const trussWarnings = [];
  // ★ B4.7.8-s2 (B-03) — fuente única: el .inp global era el último consumidor que leía
  // model.roofSystems directo, así que un proyecto con faldones exportaba muros sin cerchas.
  for (const system of getRoofSystems(model)) {
    const res = collectTypicalTruss(system, library, reg);
    trussWarnings.push(...(res.warnings || []).map(w => `techumbre ${system.id}: ${w}`));
    if (res.resolved) {
      for (const g of res.groups) {
        trussGroups.push({
          ...g,
          elsetName: compactCalculixName(g.elsetName),
          runAxis: system.runAxis
        });
      }
    }
  }

  const lines = [];
  lines.push('** Generado por el modelador estructural — punto de partida geométrico.');
  lines.push('** NO incluye cargas, condiciones de borde, ni combinaciones. Revisar y completar antes de analizar.');
  lines.push('** Unidades: mm (coordenadas), consistentes con Newtons/MPa si se agregan cargas/materiales en esas unidades.');
  if (skippedWalls.length) {
    lines.push('** ADVERTENCIA: los siguientes muros NO se exportaron completos como montantes/soleras:');
    for (const s of skippedWalls) lines.push(`**   muro ${s.wallId}: ${s.reason}`);
  }
  for (const w of trussWarnings) lines.push(`** ADVERTENCIA: ${w}`);
  lines.push('*NODE');
  for (const n of reg.list) lines.push(`${n.id}, ${n.x.toFixed(1)}, ${n.y.toFixed(1)}, ${n.z.toFixed(1)}`);

  // ★ ccx 2.21 RECHAZA `SECTION=GENERAL` sobre B31 ("can only be used for U1 elements"):
  // todo ELSET con sección GENERAL (perfil metalcon real) debe declararse como U1, la viga de
  // 2 nodos de CalculiX. Los ELSET con sección RECT (fallback genérico) siguen en B31.
  const usesGeneral = (g) => !!(g.profile || (g.material?.category === 'metalcon' && findProjectMetalconProfile(metalconProfiles, g.section?.metalconProfileId)));
  const anyU1 = framingGroups.length > 0 || trussGroups.length > 0
    || [...columnGroups.values(), ...beamGroups.values()].some(usesGeneral);
  if (anyU1) lines.push('*USER ELEMENT, TYPE=U1, NODES=2, INTEGRATION POINTS=2, MAXDOF=6');

  let elId = 1;
  if (columnEls.length) {
    lines.push('*ELEMENT, TYPE=B31, ELSET=PILARES');
    for (const e of columnEls) lines.push(`${elId++}, ${e.n1}, ${e.n2}`);
  }
  if (beamEls.length) {
    lines.push('*ELEMENT, TYPE=B31, ELSET=VIGAS');
    for (const e of beamEls) lines.push(`${elId++}, ${e.n1}, ${e.n2}`);
  }
  for (const g of foundationGroups) {
    lines.push(`*ELEMENT, TYPE=${anyU1 ? 'U1' : 'B31'}, ELSET=${g.elsetName}`);
    lines.push(`${elId++}, ${g.n1}, ${g.n2}`);
  }
  for (const g of columnGroups.values()) {
    lines.push(`*ELEMENT, TYPE=${usesGeneral(g) ? 'U1' : 'B31'}, ELSET=${g.elsetName}`);
    for (const e of g.els) lines.push(`${elId++}, ${e.n1}, ${e.n2}`);
  }
  for (const g of beamGroups.values()) {
    lines.push(`*ELEMENT, TYPE=${usesGeneral(g) ? 'U1' : 'B31'}, ELSET=${g.elsetName}`);
    for (const e of g.els) lines.push(`${elId++}, ${e.n1}, ${e.n2}`);
  }
  for (const g of framingGroups) {
    lines.push(`*ELEMENT, TYPE=U1, ELSET=${g.elsetName}`);
    for (const e of g.els) lines.push(`${elId++}, ${e.n1}, ${e.n2}`);
  }
  for (const g of trussGroups) {
    lines.push(`*ELEMENT, TYPE=U1, ELSET=${g.elsetName}`);
    for (const e of g.els) lines.push(`${elId++}, ${e.n1}, ${e.n2}`);
  }

  if (columnEls.length || beamEls.length || foundationGroups.length) {
    lines.push('** Material y secciones de ejemplo (hormigón genérico) — AJUSTAR según especificación real.');
    lines.push('** Se usa este material genérico para fundaciones y pilares/vigas SIN material asignado en su sección de librería.');
    lines.push('*MATERIAL, NAME=HORMIGON_GENERICO');
    lines.push('*ELASTIC');
    lines.push('25000, 0.2');
    if (columnEls.length) {
      lines.push('*BEAM SECTION, ELSET=PILARES, MATERIAL=HORMIGON_GENERICO, SECTION=RECT');
      const ref = columnEls[0];
      lines.push(`${ref.widthX.toFixed(1)}, ${ref.widthY.toFixed(1)}`);
    }
    if (beamEls.length) {
      lines.push('*BEAM SECTION, ELSET=VIGAS, MATERIAL=HORMIGON_GENERICO, SECTION=RECT');
      const ref = beamEls[0];
      lines.push(`${ref.width.toFixed(1)}, ${ref.height.toFixed(1)}`);
    }
    for (const g of foundationGroups) {
      if (anyU1) {
        const section = rectangularGeneralProperties(g.width, g.depth);
        lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=HORMIGON_GENERICO, SECTION=GENERAL`);
        lines.push(`${section.area.toFixed(1)}, ${section.i11.toFixed(1)}, 0.0, ${section.i22.toFixed(1)}, ${section.torsion.toFixed(1)}`);
      } else {
        lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=HORMIGON_GENERICO, SECTION=RECT`);
        lines.push(`${g.depth.toFixed(1)}, ${g.width.toFixed(1)}`);
      }
      lines.push('0.0, 0.0, 1.0');
    }
  }

  // ★ Pilares/vigas con material real asignado (y, opcionalmente, perfil metalcon real).
  const materialBlocksEmitted = new Set();
  function emitMaterialBlock(material) {
    const matName = `MAT_${safeName(material.name)}_${material.id}`;
    if (!materialBlocksEmitted.has(matName)) {
      materialBlocksEmitted.add(matName);
      lines.push(`*MATERIAL, NAME=${matName}`);
      lines.push('*ELASTIC');
      lines.push(`${material.elasticModulus}, 0.3`);
    }
    return matName;
  }

  for (const g of columnGroups.values()) {
    const matName = emitMaterialBlock(g.material);
    const profile = g.material.category === 'metalcon' ? findProjectMetalconProfile(metalconProfiles, g.section.metalconProfileId) : null;
    if (profile) {
      lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=${matName}, SECTION=GENERAL`);
      lines.push(`${cm2ToMm2(profile.areaCm2).toFixed(2)}, ${cm4ToMm4(profile.ixCm4).toFixed(1)}, 0.0, ${cm4ToMm4(profile.iyCm4).toFixed(1)}, ${cm4ToMm4(profile.ixCm4 + profile.iyCm4).toFixed(1)}`);
      const ov = columnOrientVec();
      lines.push(`${ov.x.toFixed(3)}, ${ov.y.toFixed(3)}, ${ov.z.toFixed(3)}`);
    } else {
      lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=${matName}, SECTION=RECT`);
      lines.push(`${resolveValue(g.section.widthX, paramsMap, elementsById).toFixed(1)}, ${resolveValue(g.section.widthY, paramsMap, elementsById).toFixed(1)}`);
    }
  }
  for (const g of beamGroups.values()) {
    const matName = emitMaterialBlock(g.material);
    const profile = g.material.category === 'metalcon' ? findProjectMetalconProfile(metalconProfiles, g.section.metalconProfileId) : null;
    if (profile) {
      lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=${matName}, SECTION=GENERAL`);
      lines.push(`${cm2ToMm2(profile.areaCm2).toFixed(2)}, ${cm4ToMm4(profile.ixCm4).toFixed(1)}, 0.0, ${cm4ToMm4(profile.iyCm4).toFixed(1)}, ${cm4ToMm4(profile.ixCm4 + profile.iyCm4).toFixed(1)}`);
      lines.push(`${g.orientVec.x.toFixed(3)}, ${g.orientVec.y.toFixed(3)}, ${g.orientVec.z.toFixed(3)}`);
    } else {
      lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=${matName}, SECTION=RECT`);
      lines.push(`${resolveValue(g.section.width, paramsMap, elementsById).toFixed(1)}, ${resolveValue(g.section.height, paramsMap, elementsById).toFixed(1)}`);
    }
  }

  if (framingGroups.length) {
    const genericUsed = framingGroups.some(g => !g.material);
    if (genericUsed) {
      lines.push('** Metalcon (muros) sin material asignado: acero galvanizado genérico — AJUSTAR según especificación real, o asigna un material real en Modulación de metalcon.');
      lines.push('*MATERIAL, NAME=ACERO_GALVANIZADO');
      lines.push('*ELASTIC');
      lines.push('200000, 0.3');
    }
    for (const g of framingGroups) {
      const matName = g.material ? emitMaterialBlock(g.material) : 'ACERO_GALVANIZADO';
      // BEAM GENERAL SECTION: area, I11, I12(=0, ejes principales), I22, J(torsión, aprox=I11+I22).
      lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=${matName}, SECTION=GENERAL`);
      lines.push(`${cm2ToMm2(g.profile.areaCm2).toFixed(2)}, ${cm4ToMm4(g.profile.ixCm4).toFixed(1)}, 0.0, ${cm4ToMm4(g.profile.iyCm4).toFixed(1)}, ${cm4ToMm4(g.profile.ixCm4 + g.profile.iyCm4).toFixed(1)}`);
      lines.push(`${g.orientVec.x.toFixed(3)}, ${g.orientVec.y.toFixed(3)}, ${g.orientVec.z.toFixed(3)}`);
    }
  }

  if (trussGroups.length) {
    const genericMat = framingGroups.some(g => !g.material);
    if (!genericMat) {
      lines.push('*MATERIAL, NAME=ACERO_GALVANIZADO');
      lines.push('*ELASTIC');
      lines.push('200000, 0.3');
    }
    for (const g of trussGroups) {
      // eje local 1 normal al plano de la cercha -> I11 (Ix) resiste la flexión en el plano
      const ov = g.runAxis === 'x' ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
      if (g.profile) {
        lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=ACERO_GALVANIZADO, SECTION=GENERAL`);
        lines.push(`${cm2ToMm2(g.profile.areaCm2).toFixed(2)}, ${cm4ToMm4(g.profile.iyCm4).toFixed(1)}, 0.0, ${cm4ToMm4(g.profile.ixCm4).toFixed(1)}, ${cm4ToMm4(g.profile.ixCm4 + g.profile.iyCm4).toFixed(1)}`);
        lines.push(`${ov.x.toFixed(3)}, ${ov.y.toFixed(3)}, ${ov.z.toFixed(3)}`);
      } else {
        lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=ACERO_GALVANIZADO, SECTION=GENERAL`);
        lines.push('107.00, 21200.0, 0.0, 31000.0, 52200.0');
        lines.push(`${ov.x.toFixed(3)}, ${ov.y.toFixed(3)}, ${ov.z.toFixed(3)}`);
      }
    }
  }

  return lines.join('\n');
}

/** Traduce wall.studs (montantes) + soleras sup/inf a nodos + un ELSET por muro (uno para
 * montantes, uno para soleras). Si el muro no tiene despiece vigente lo omite y registra la
 * razón en skippedWalls (mismo patrón de advertencia que AuditModal/ValidationModal).
 * ★ Si el muro tiene framingMaterialId (asignado en Modulación de metalcon), cada grupo lleva
 * su material real; si no, queda `material: null` y el llamador usa el genérico compartido. */
function collectWallFraming(wall, grid, paramsMap, elementsById, reg, metalconProfiles, materials, framingGroups, skippedWalls) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  if (!geo) { skippedWalls.push({ wallId: wall.id, reason: 'geometría no resuelta (ejes faltantes)' }); return; }

  // Las cadenetas son piezas constructivas horizontales, no barras del modelo de análisis.
  const studs = wall.studs?.filter((piece) => piece.role !== 'nogging');
  if (!studs || !studs.length) {
    if (wall.framingStudProfileId || wall.framingTrackProfileId) {
      skippedWalls.push({ wallId: wall.id, reason: 'perfiles asignados pero sin despiece generado (studs vacío) — regenerar en Modulación de metalcon' });
    }
    return;
  }

  const studProfile = findProjectMetalconProfile(metalconProfiles, wall.framingStudProfileId);
  const trackProfile = findProjectMetalconProfile(metalconProfiles, wall.framingTrackProfileId);
  if (!studProfile) { skippedWalls.push({ wallId: wall.id, reason: `perfil de montante no encontrado en la librería del proyecto (cárgalo en Modulación de metalcon)` }); return; }
  const wallMaterial = wall.framingMaterialId != null ? (materials.find(m => m.id === wall.framingMaterialId) || null) : null;

  const bottomLevel = grid.zLevels.find(l => l.id === wall.bottomZ);
  const topLevel = grid.zLevels.find(l => l.id === wall.topZ);
  if (!bottomLevel || !topLevel) { skippedWalls.push({ wallId: wall.id, reason: 'nivel inferior/superior no resuelto' }); return; }
  const baseZ = bottomLevel.elevation;

  const runX = isWallXRun(wall);
  const studOrient = { x: runX ? 0 : 1, y: runX ? 1 : 0, z: 0 };
  const trackOrient = { x: 0, y: 0, z: 1 };

  const wallId = wall.id;
  const studEls = [];
  for (const s of studs) {
    const p = wallOffsetToWorldPoint(wall, geo, s.offset);
    const n1 = reg.getNode(p.x, p.y, baseZ + s.zMin);
    const n2 = reg.getNode(p.x, p.y, baseZ + s.zMax);
    studEls.push({ n1, n2 });
  }
  framingGroups.push({ elsetName: calculixIdSetName('WM', wallId), wallId, profile: studProfile, orientVec: studOrient, material: wallMaterial, els: studEls });

  if (trackProfile) {
    const maxOffset = Math.max(...studs.map(s => s.offset), 0);
    const pStart = wallOffsetToWorldPoint(wall, geo, 0);
    const pEnd = wallOffsetToWorldPoint(wall, geo, maxOffset);
    const topZ = baseZ + (topLevel.elevation - bottomLevel.elevation);
    const nBottomStart = reg.getNode(pStart.x, pStart.y, baseZ);
    const nBottomEnd = reg.getNode(pEnd.x, pEnd.y, baseZ);
    const nTopStart = reg.getNode(pStart.x, pStart.y, topZ);
    const nTopEnd = reg.getNode(pEnd.x, pEnd.y, topZ);
    framingGroups.push({
      elsetName: calculixIdSetName('WS', wallId),
      wallId,
      profile: trackProfile,
      orientVec: trackOrient,
      material: wallMaterial,
      els: [{ n1: nBottomStart, n2: nBottomEnd }, { n1: nTopStart, n2: nTopEnd }]
    });
  } else if (wall.framingTrackProfileId) {
    skippedWalls.push({ wallId: wall.id, reason: `perfil de solera no encontrado en la librería del proyecto — solo se exportaron montantes` });
  }

  if (wall.headers?.length && trackProfile) {
    const toEl = (hdr) => {
      const pMin = wallOffsetToWorldPoint(wall, geo, hdr.oMin);
      const pMax = wallOffsetToWorldPoint(wall, geo, hdr.oMax);
      const z = baseZ + hdr.z;
      return { n1: reg.getNode(pMin.x, pMin.y, z), n2: reg.getNode(pMax.x, pMax.y, z) };
    };
    const headerEls = wall.headers.filter(h => h.role === 'header').map(toEl);
    const sillEls = wall.headers.filter(h => h.role === 'sill').map(toEl);
    if (headerEls.length) framingGroups.push({ elsetName: calculixIdSetName('WD', wallId), wallId, profile: trackProfile, orientVec: trackOrient, material: wallMaterial, els: headerEls });
    if (sillEls.length) framingGroups.push({ elsetName: calculixIdSetName('WA', wallId), wallId, profile: trackProfile, orientVec: trackOrient, material: wallMaterial, els: sillEls });
  }
}

export function downloadCalculix(model) {
  const policy = guardExport(model, 'calculix-global');
  if (!policy.allowed) return false;
  const content = generateCalculix(model);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo.inp';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
