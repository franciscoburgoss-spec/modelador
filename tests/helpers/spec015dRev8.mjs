import { projectAgnosticGeometry } from '../../src/core/agnosticGeometry.js';
import { buildCandidateLoadPaths } from '../../src/core/candidateLoadPaths.js';
import { canonicalizeRoofBoundaries } from '../../src/core/roofStructuralIntent.js';
import { applyStructuralInterfaceTransaction } from '../../src/core/structuralIntent.js';
import { generateStructuralProposals } from '../../src/core/structuralProposals.js';
import { recognizeStructuralTopology } from '../../src/core/recognizedStructuralTopology.js';
import { buildFx008Spec015dContext } from './spec015d.mjs';

export const FX008_FRONTON_C_6_7 = 1784819708086;
export const FX008_C_7_11A = 1784605101040;
export const FX008_SUPPORT_AT_6 = 1784753322528;
export const FX008_SUPPORT_AT_7 = 1784754251210;
export const FX008_SUPPORT_AT_11A = 1784756700772;
export const FX008_ROOF_SOUTH = 1785030887081;
export const FX008_ROOF_NORTH = 1785161146258;

function boundaryAtC(geometry, roofId, expectedX1, expectedX2) {
  const roof = geometry.roofGeometry.find((item) => item.id === roofId);
  if (!roof) throw new Error(`roof ${roofId} not found`);
  const boundaries = canonicalizeRoofBoundaries(roof);
  const found = boundaries.find((boundary) => {
    const xs = [boundary.start.x, boundary.end.x].sort((a, b) => a - b);
    return Math.abs(boundary.start.y - 2000) <= 0.1
      && Math.abs(boundary.end.y - 2000) <= 0.1
      && Math.abs(xs[0] - expectedX1) <= 0.1
      && Math.abs(xs[1] - expectedX2) <= 0.1;
  });
  if (!found) throw new Error(`C boundary not found for roof ${roofId}`);
  return found;
}

function iface(ownerRef, locator, notes) {
  return { ownerRef, locator, notes };
}

function rel(ports, structuralFunction, carrierRegions = [], notes = null) {
  return { ports, actionFamily: 'gravity', structuralFunction, carrierRegions, notes };
}

function port(interfaceId, interactionRole) {
  return { interfaceRef: interfaceId, interactionRole };
}


async function base() {
  const context = await buildFx008Spec015dContext();
  const geometry = projectAgnosticGeometry(context.model);
  return { ...context, geometry };
}

function buildRoofAndFrontonInterfaces(geometry) {
  const south = boundaryAtC(geometry, FX008_ROOF_SOUTH, 12800, 14500);
  const north = boundaryAtC(geometry, FX008_ROOF_NORTH, 12800, 23200);
  return {
    south,
    north,
    inputs: [
      iface({ kind: 'roofBoundary', roofGeometryId: FX008_ROOF_SOUTH, boundaryId: south.boundaryId }, { kind: 'boundary', sRange: [12800, 14500] }, 'Cubierta y<C entrega acción gravitacional en C/6→7.'),
      iface({ kind: 'roofBoundary', roofGeometryId: FX008_ROOF_NORTH, boundaryId: north.boundaryId }, { kind: 'boundary', sRange: [12800, 14500] }, 'Cubierta y>C entrega acción gravitacional en C/6→7.'),
      iface({ kind: 'element', id: FX008_FRONTON_C_6_7 }, { kind: 'face', side: 'negativeN', sRange: [12800, 14500], zRange: [3250, 4150] }, 'Cara del frontón hacia y<C.'),
      iface({ kind: 'element', id: FX008_FRONTON_C_6_7 }, { kind: 'face', side: 'positiveN', sRange: [12800, 14500], zRange: [3250, 4150] }, 'Cara del frontón hacia y>C.'),
      iface({ kind: 'element', id: FX008_FRONTON_C_6_7 }, { kind: 'end', end: 'lowS', sRange: [12800, 12800.1], zRange: [3250, 4150] }, 'Extremo 6 del frontón.'),
      iface({ kind: 'element', id: FX008_FRONTON_C_6_7 }, { kind: 'end', end: 'highS', sRange: [14499.9, 14500], zRange: [3250, 4150] }, 'Extremo 7 del frontón.')
    ]
  };
}

function byNote(model, note) {
  const found = model.structuralIntent.interfaceIntents.find((item) => item.notes === note);
  if (!found) throw new Error(`interface not found: ${note}`);
  return found.interfaceId;
}

function finalizePaths(model, roofStructuralIntent, analysisContexts = []) {
  const geometry = projectAgnosticGeometry(model);
  const topology = recognizeStructuralTopology(geometry);
  const proposals = generateStructuralProposals({ geometry, structuralIntent: model.structuralIntent, roofStructuralIntent, topology, config: {} });
  const paths = buildCandidateLoadPaths({ geometry, structuralIntent: model.structuralIntent, roofStructuralIntent, topology, structuralProposals: proposals, analysisContexts, config: {} });
  return { geometry, topology, proposals, paths };
}

export async function buildFx008Rev8Short({ declareEndpointSupports = true } = {}) {
  const context = await base();
  const baseInterfaces = buildRoofAndFrontonInterfaces(context.geometry);
  let tx = applyStructuralInterfaceTransaction(context.model, { interfaces: baseInterfaces.inputs }, { recordUserAction: true });
  let model = tx.model;

  const roofSouth = byNote(model, 'Cubierta y<C entrega acción gravitacional en C/6→7.');
  const roofNorth = byNote(model, 'Cubierta y>C entrega acción gravitacional en C/6→7.');
  const faceSouth = byNote(model, 'Cara del frontón hacia y<C.');
  const faceNorth = byNote(model, 'Cara del frontón hacia y>C.');
  const end6 = byNote(model, 'Extremo 6 del frontón.');
  const end7 = byNote(model, 'Extremo 7 del frontón.');

  const supportInterfaces = declareEndpointSupports ? [
    iface({ kind: 'element', id: FX008_SUPPORT_AT_6 }, { kind: 'face', side: 'negativeN', sRange: [1949.45, 2050.55], zRange: [3250, 4150] }, 'Receptor declarado en apoyo 6.'),
    iface({ kind: 'element', id: FX008_SUPPORT_AT_7 }, { kind: 'end', end: 'highS', sRange: [1999.9, 2000], zRange: [3250, 4150] }, 'Receptor declarado en apoyo 7.')
  ] : [];
  if (supportInterfaces.length) model = applyStructuralInterfaceTransaction(model, { interfaces: supportInterfaces }, { recordUserAction: true }).model;

  const relations = [
    rel([port(roofSouth, 'delivers'), port(faceSouth, 'receives')], 'support', [], 'Cubierta sur→cara −N.'),
    rel([port(roofNorth, 'delivers'), port(faceNorth, 'receives')], 'support', [], 'Cubierta norte→cara +N.'),
    rel([
      port(faceSouth, 'receives'), port(faceNorth, 'receives'),
      port(end6, 'delivers'), port(end7, 'delivers')
    ], 'loadTransfer', [
      { ownerRef: { kind: 'element', id: FX008_FRONTON_C_6_7 }, sRange: [12800, 14500], zRange: [3250, 4150] }
    ], 'Transferencia interna C/6→7 hacia extremos declarados.')
  ];
  if (declareEndpointSupports) {
    relations.push(
      rel([port(end6, 'delivers'), port(byNote(model, 'Receptor declarado en apoyo 6.'), 'receives')], 'support', [], 'Extremo 6→apoyo declarado.'),
      rel([port(end7, 'delivers'), port(byNote(model, 'Receptor declarado en apoyo 7.'), 'receives')], 'support', [], 'Extremo 7→apoyo declarado.')
    );
  }
  model = applyStructuralInterfaceTransaction(model, { relations }, { recordUserAction: true }).model;
  const generated = finalizePaths(model, context.roofStructuralIntent, [{ graph: 'lateral', direction: 'x' }]);
  return { ...context, ...baseInterfaces, model, ...generated };
}

export async function buildFx008Rev8Continuous() {
  const context = await base();
  const baseInterfaces = buildRoofAndFrontonInterfaces(context.geometry);
  // For the continuous option the fronton endpoint interfaces are harmless but not used; keeping
  // the same source/face definitions makes the short and continuous alternatives directly comparable.
  let model = applyStructuralInterfaceTransaction(context.model, { interfaces: baseInterfaces.inputs }, { recordUserAction: true }).model;
  model = applyStructuralInterfaceTransaction(model, { interfaces: [
    iface({ kind: 'element', id: FX008_C_7_11A }, { kind: 'end', end: 'highS', sRange: [23199.9, 23200], zRange: [3250, 4150] }, 'Salida continua en 11A.'),
    iface({ kind: 'element', id: FX008_SUPPORT_AT_11A }, { kind: 'end', end: 'lowS', sRange: [2000, 2000.1], zRange: [3250, 4150] }, 'Receptor declarado en apoyo 11A.')
  ] }, { recordUserAction: true }).model;

  const roofSouth = byNote(model, 'Cubierta y<C entrega acción gravitacional en C/6→7.');
  const roofNorth = byNote(model, 'Cubierta y>C entrega acción gravitacional en C/6→7.');
  const faceSouth = byNote(model, 'Cara del frontón hacia y<C.');
  const faceNorth = byNote(model, 'Cara del frontón hacia y>C.');
  const end11A = byNote(model, 'Salida continua en 11A.');
  const receiver11A = byNote(model, 'Receptor declarado en apoyo 11A.');

  model = applyStructuralInterfaceTransaction(model, { relations: [
    rel([port(roofSouth, 'delivers'), port(faceSouth, 'receives')], 'support', [], 'Cubierta sur→cara −N.'),
    rel([port(roofNorth, 'delivers'), port(faceNorth, 'receives')], 'support', [], 'Cubierta norte→cara +N.'),
    rel([
      port(faceSouth, 'receives'), port(faceNorth, 'receives'), port(end11A, 'delivers')
    ], 'loadTransfer', [
      { ownerRef: { kind: 'element', id: FX008_FRONTON_C_6_7 }, sRange: [12800, 14500], zRange: [3250, 4150] },
      { ownerRef: { kind: 'element', id: FX008_C_7_11A }, sRange: [14500, 23200], zRange: [3250, 4150] }
    ], 'Mecanismo continuo C/6→11A en banda superior.'),
    rel([port(end11A, 'delivers'), port(receiver11A, 'receives')], 'support', [], '11A→apoyo declarado.')
  ] }, { recordUserAction: true }).model;

  const generated = finalizePaths(model, context.roofStructuralIntent, [{ graph: 'lateral', direction: 'x' }]);
  return { ...context, ...baseInterfaces, model, ...generated };
}
