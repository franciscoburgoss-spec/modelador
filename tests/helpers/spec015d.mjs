import { readFile } from 'node:fs/promises';
import { projectAgnosticGeometry } from '../../src/core/agnosticGeometry.js';
import { recognizeStructuralTopology } from '../../src/core/recognizedStructuralTopology.js';
import { canonicalizeRoofBoundaries } from '../../src/core/roofStructuralIntent.js';
import { setElementIntent } from '../../src/core/structuralIntent.js';
import { generateStructuralProposals } from '../../src/core/structuralProposals.js';
import { buildCandidateLoadPaths } from '../../src/core/candidateLoadPaths.js';

export const FX008_GRAVITY_ROOF_ID = 1785030887081;
export const FX008_LATERAL_ROOF_ID = 1785158713616;
export const FX008_LATERAL_WALL_ID = 1784606313849;
export const FX008_GRAVITY_WALL_ID = 1784604634483;
export const FX008_FRONTON_ID = 1784819708086;

export async function loadFx008Model() {
  return JSON.parse(await readFile(new URL('../fixtures/casa-L-completa-v3.json', import.meta.url), 'utf8'));
}

export function reverseSemanticCollections(value) {
  const clone = structuredClone(value);
  if (clone.grid) {
    for (const key of ['xAxes', 'yAxes', 'zLevels']) clone.grid[key]?.reverse();
  }
  clone.elements?.reverse();
  for (const element of clone.elements || []) element.openings?.reverse();
  clone.roofGeometry?.reverse();
  clone.walls?.reverse();
  clone.openings?.reverse();
  clone.relations?.reverse();
  clone.nodes?.reverse();
  clone.findings?.reverse();
  return clone;
}

export async function buildFx008Spec015dContext() {
  const sourceModel = await loadFx008Model();
  const lateralOutcome = setElementIntent(sourceModel, FX008_LATERAL_WALL_ID, {
    participation: 'resistant',
    functions: ['inPlaneLateralResistance'],
    secondaryInteraction: 'notApplicable',
    notes: null
  });
  const model = lateralOutcome.model;
  const geometry = projectAgnosticGeometry(model);
  const topology = recognizeStructuralTopology(geometry);

  const gravityRoof = geometry.roofGeometry.find((roof) => roof.id === FX008_GRAVITY_ROOF_ID);
  const gravityBoundaries = canonicalizeRoofBoundaries(gravityRoof);
  const lowerBoundary = gravityBoundaries.find((boundary) => (
    Math.abs(boundary.start.y - 1200) <= 0.1
    && Math.abs(boundary.end.y - 1200) <= 0.1
  ));
  const highFrontonBoundary = gravityBoundaries.find((boundary) => (
    Math.abs(boundary.start.y - 2000) <= 0.1
    && Math.abs(boundary.end.y - 2000) <= 0.1
    && Math.abs(boundary.end.x - boundary.start.x) > 1000
  ));
  const roofStructuralIntent = [
    {
      intentId: `intent:roof:${FX008_GRAVITY_ROOF_ID}`,
      roofGeometryId: FX008_GRAVITY_ROOF_ID,
      loadDistribution: 'oneWay',
      primaryResistanceDirection: { x: 0, y: 1 },
      secondaryResistanceDirection: null,
      diaphragmBehavior: 'candidate',
      boundaryIntents: [lowerBoundary, highFrontonBoundary].map((boundary) => ({
        boundaryId: boundary.boundaryId,
        function: 'gravitySupport',
        source: 'userDeclared'
      })),
      status: 'declared',
      source: 'userDeclared',
      notes: null
    },
    {
      intentId: `intent:roof:${FX008_LATERAL_ROOF_ID}`,
      roofGeometryId: FX008_LATERAL_ROOF_ID,
      loadDistribution: 'oneWay',
      primaryResistanceDirection: { x: 0, y: 1 },
      secondaryResistanceDirection: null,
      diaphragmBehavior: 'intended',
      boundaryIntents: [],
      status: 'declared',
      source: 'userDeclared',
      notes: null
    }
  ];
  const proposals = generateStructuralProposals({
    geometry,
    structuralIntent: model.structuralIntent,
    roofStructuralIntent,
    topology,
    config: {}
  });
  const paths = buildCandidateLoadPaths({
    geometry,
    structuralIntent: model.structuralIntent,
    roofStructuralIntent,
    topology,
    structuralProposals: proposals,
    analysisContexts: [{ graph: 'lateral', direction: 'x' }],
    config: {}
  });
  return {
    sourceModel,
    model,
    geometry,
    topology,
    roofStructuralIntent,
    proposals,
    paths,
    lowerBoundary,
    highFrontonBoundary
  };
}
