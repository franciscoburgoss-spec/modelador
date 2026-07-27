// core/batchModulation.js
// ★ "Generar todos" — modulación batch de metalcon y OSB (sesión 09, tarea A).
// Lógica pura: recorre los muros elegibles del modelo y devuelve la lista de patches
// {wallId, patch} lista para pasar a store.applyWallPatchesBatch (un solo undo para todo
// el batch). NO toca el store ni recalcula nada que ya esté persistido en otro muro.
//
// Config por muro: si el muro ya tiene un valor propio guardado (framingStudProfileId,
// studSpacing, osbPanelWidth, etc.) se respeta ese valor; si no, se usa el default pasado
// por parámetro (el que el usuario dejó seleccionado en el modal).

import { computeStudLayout, detectWallCorners } from './metalconModulation.js';
import { computeCourseBreaks, computeOsbPanelLayout } from './osbModulation.js';
import { buildParamsMap, resolveValue } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { getWallDisplayName } from './naming.js';
import { resolveWallTypeConfig } from './wallTypes.js';

function resolveModulationConfig(model, wall, metalconFallback = {}, osbFallback = {}) {
  const resolved = resolveWallTypeConfig(model, wall);
  if (resolved.source === 'wallType') return resolved;

  return {
    ...resolved,
    metalconDefaults: {
      spacing: wall.studSpacing
        ?? metalconFallback.spacing
        ?? resolved.metalconDefaults.spacing,
      studProfileId: wall.framingStudProfileId
        ?? metalconFallback.studProfileId
        ?? resolved.metalconDefaults.studProfileId,
      trackProfileId: wall.framingTrackProfileId
        ?? metalconFallback.trackProfileId
        ?? resolved.metalconDefaults.trackProfileId,
      materialId: wall.framingMaterialId
        ?? metalconFallback.materialId
        ?? resolved.metalconDefaults.materialId
    },
    osbDefaults: {
      panelWidth: wall.osbPanelWidth
        ?? osbFallback.panelWidth
        ?? resolved.osbDefaults.panelWidth,
      panelHeight: wall.osbPanelHeight
        ?? osbFallback.panelHeight
        ?? resolved.osbDefaults.panelHeight,
      minPanelWidth: wall.osbMinPanelWidth
        ?? osbFallback.minPanelWidth
        ?? resolved.osbDefaults.minPanelWidth,
      gap: wall.osbGap
        ?? osbFallback.gap
        ?? resolved.osbDefaults.gap
    }
  };
}

/**
 * Modula metalcon (montantes/dinteles) para todos los muros elegibles del modelo.
 * @param model
 * @param defaults { spacing, studProfileId, trackProfileId, materialId }
 * @param opts { skipExisting } — si true, omite muros que ya tienen wall.studs.
 * @returns { patches: [{wallId, patch}], skipped: [{wallId, name, reason}] }
 */
export function modulateAllWallsMetalcon(model, defaults = {}, opts = {}) {
  const { osb: osbFallback = {}, ...metalconFallback } = defaults;
  const { skipExisting = false } = opts;
  const paramsMap = buildParamsMap(model.projectParams || []);
  const elementsById = buildElementsById(model.elements || []);
  const grid = model.grid;
  const allWalls = (model.elements || []).filter((el) => el.type === 'wall');

  const patches = [];
  const skipped = [];

  for (const wall of allWalls) {
    const effective = resolveModulationConfig(
      model,
      wall,
      metalconFallback,
      osbFallback
    );
    const {
      spacing: wallSpacing,
      studProfileId: wallStudProfileId,
      trackProfileId: wallTrackProfileId,
      materialId: wallMaterialId
    } = effective.metalconDefaults;
    const effectiveOsb = effective.osbDefaults;
    if (!wallStudProfileId || !wallTrackProfileId) {
      skipped.push({ wallId: wall.id, name: getWallDisplayName(wall, grid), reason: 'sin perfil montante/solera' });
      continue;
    }
    const bottom = grid.zLevels.find((level) => level.id === wall.bottomZ);
    const top = grid.zLevels.find((level) => level.id === wall.topZ);
    const wallHeight = bottom && top ? top.elevation - bottom.elevation : 0;
    const panelHeight = resolveValue(
      effectiveOsb.panelHeight,
      paramsMap,
      elementsById
    );
    const minCourseHeight = resolveValue(
      model.osbDefaults?.minCourseHeight ?? 300,
      paramsMap,
      elementsById
    );
    const jointZs = wallHeight > 0 && panelHeight > 0
      ? computeCourseBreaks(
        wallHeight,
        panelHeight,
        minCourseHeight,
        model.osbDefaults?.enforceMinCourse === true
      ).jointZs
      : [];
    const hasCurrentNoggings = jointZs.length === 0
      || wall.studs?.some((piece) => piece.role === 'nogging');
    if (skipExisting && wall.studs?.length > 0 && hasCurrentNoggings) {
      skipped.push({
        wallId: wall.id,
        name: getWallDisplayName(wall, grid),
        reason: 'ya tiene despiece'
      });
      continue;
    }
    const studProfile = (model.library?.metalconProfiles || [])
      .find((profile) => String(profile.id) === String(wallStudProfileId));
    const trackProfile = (model.library?.metalconProfiles || [])
      .find((profile) => String(profile.id) === String(wallTrackProfileId));
    if (jointZs.length > 0 && !(studProfile?.B > 0)) {
      skipped.push({
        wallId: wall.id,
        name: getWallDisplayName(wall, grid),
        reason: 'perfil montante sin ancho B para cadenetas'
      });
      continue;
    }
    const corners = detectWallCorners(wall, allWalls, grid, paramsMap, elementsById);
    const layout = computeStudLayout(wall, grid, paramsMap, elementsById, {
      spacing: wallSpacing,
      corners,
      jointZs,
      flangeWidth: studProfile?.B
    });
    if (!layout.resolved) {
      skipped.push({ wallId: wall.id, name: getWallDisplayName(wall, grid), reason: 'geometría/nivel no resuelto' });
      continue;
    }
    patches.push({
      wallId: wall.id,
      patch: {
        framingStudProfileId: studProfile?.id ?? wallStudProfileId,
        framingTrackProfileId: trackProfile?.id ?? wallTrackProfileId,
        framingMaterialId: wallMaterialId,
        studSpacing: wallSpacing,
        osbGap: effectiveOsb.gap,
        studs: layout.studs,
        headers: layout.headers
      }
    });
  }

  return { patches, skipped };
}

/**
 * Modula placas OSB para todos los muros elegibles (deben tener wall.studs ya generado).
 * @param model
 * @param defaults { panelWidth, panelHeight, minPanelWidth }
 * @param opts { skipExisting }
 * @returns { patches: [{wallId, patch}], skipped: [{wallId, name, reason}] }
 */
export function modulateAllWallsOsb(model, defaults = {}, opts = {}) {
  const { skipExisting = false } = opts;
  const paramsMap = buildParamsMap(model.projectParams || []);
  const elementsById = buildElementsById(model.elements || []);
  const grid = model.grid;
  const eligible = (model.elements || []).filter((el) => el.type === 'wall' && el.studs?.length > 0);

  const patches = [];
  const skipped = [];

  for (const wall of eligible) {
    if (skipExisting && wall.osbCourses?.length > 0) {
      skipped.push({ wallId: wall.id, name: getWallDisplayName(wall, grid), reason: 'ya tiene despiece OSB' });
      continue;
    }
    const effective = resolveModulationConfig(model, wall, {}, defaults);
    const {
      panelWidth: wPanelWidth,
      panelHeight: wPanelHeight,
      minPanelWidth: wMinPanelWidth,
      gap: wGap
    } = effective.osbDefaults;
    const layout = computeOsbPanelLayout(wall, grid, paramsMap, elementsById, wall.studs, {
      panelWidth: wPanelWidth, panelHeight: wPanelHeight, minPanelWidth: wMinPanelWidth
    });
    if (!layout.resolved) {
      skipped.push({ wallId: wall.id, name: getWallDisplayName(wall, grid), reason: layout.warnings?.[0] || 'geometría/nivel no resuelto' });
      continue;
    }
    patches.push({
      wallId: wall.id,
      patch: {
        osbPanelWidth: wPanelWidth,
        osbPanelHeight: wPanelHeight,
        osbMinPanelWidth: wMinPanelWidth,
        osbGap: wGap,
        osbCourses: layout.courses,
        osbNoggings: []
      }
    });
  }

  return { patches, skipped };
}

/**
 * "Generar todos" combinado (sesión 20b): corre metalcon y luego OSB sobre el modelo resultante
 * — OSB solo modula muros con `wall.studs`, así que si un muro recibe montantes recién ahora,
 * tiene que verlos antes de intentar sus placas. NO toca el store: arma un modelo intermedio en
 * memoria solo para que `modulateAllWallsOsb` vea los `studs` que acaba de generar metalcon.
 * @param model
 * @param defaults { metalcon: {...}, osb: {...} } — ver defaults de cada función arriba.
 * @param opts { skipExisting } — mismo criterio para ambos subsistemas.
 * @returns { patches: [{wallId, patch}], skippedMetalcon, skippedOsb }
 */
export function modulateAllWallsFull(model, defaults = {}, opts = {}) {
  const { metalcon: metalconDefaults = {}, osb: osbDefaults = {} } = defaults;
  const { skipExisting = false } = opts;

  const metalconResult = modulateAllWallsMetalcon(
    model,
    { ...metalconDefaults, osb: osbDefaults },
    { skipExisting }
  );

  const metalconPatchMap = new Map(metalconResult.patches.map((p) => [p.wallId, p.patch]));
  const intermediateModel = {
    ...model,
    elements: model.elements.map((el) => (metalconPatchMap.has(el.id) ? { ...el, ...metalconPatchMap.get(el.id) } : el))
  };

  const osbResult = modulateAllWallsOsb(intermediateModel, osbDefaults, { skipExisting });

  // Un muro puede recibir patch de metalcon y de OSB a la vez: se fusionan por wallId para que
  // salga un solo applyWallPatchesBatch (un solo undo para todo el batch combinado).
  const merged = new Map();
  for (const { wallId, patch } of metalconResult.patches) merged.set(wallId, { ...merged.get(wallId), ...patch });
  for (const { wallId, patch } of osbResult.patches) merged.set(wallId, { ...merged.get(wallId), ...patch });

  return {
    patches: [...merged.entries()].map(([wallId, patch]) => ({ wallId, patch })),
    skippedMetalcon: metalconResult.skipped,
    skippedOsb: osbResult.skipped
  };
}
