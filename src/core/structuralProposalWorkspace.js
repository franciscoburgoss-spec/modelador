import { projectAgnosticGeometry } from './agnosticGeometry.js';
import { recognizeStructuralTopology } from './recognizedStructuralTopology.js';
import { generateStructuralProposals } from './structuralProposals.js';
import { buildCandidateLoadPaths } from './candidateLoadPaths.js';
import { buildStructuralProposalVisualPresentation } from './structuralProposalVisualPresentation.js';
import { materializeStructuralProposalReviews } from './structuralProposalReviews.js';
import { canonicalizeValue } from './structuralProposalCommon.js';

export const STRUCTURAL_PROPOSAL_WORKSPACE_SCHEMA = 'structural-proposal-workspace-v1.0';

const RESISTANT_ROOF_BOUNDARY_FUNCTIONS = new Set([
  'gravitySupport',
  'lateralSupport',
  'gravityAndLateralSupport'
]);

function buildProposalReadiness(geometry, roofStructuralIntent, structuralProposals) {
  const roofCount = Array.isArray(geometry?.roofGeometry) ? geometry.roofGeometry.length : 0;
  const roofIntents = Array.isArray(roofStructuralIntent) ? roofStructuralIntent : [];
  const resistantBoundaryCount = roofIntents.reduce((sum, intent) => (
    sum + (intent.boundaryIntents || []).filter((boundary) => (
      RESISTANT_ROOF_BOUNDARY_FUNCTIONS.has(boundary.function)
    )).length
  ), 0);
  const proposalCount = structuralProposals?.proposals?.length || 0;

  if (roofCount === 0) {
    return {
      state: 'noRoofGeometry',
      title: 'No hay cubiertas geométricas disponibles.',
      message: 'SPEC-015-D necesita geometría de cubierta antes de poder buscar receptores candidatos.',
      action: null,
      counts: { roofCount, roofIntentCount: roofIntents.length, resistantBoundaryCount, proposalCount }
    };
  }
  if (roofIntents.length === 0) {
    return {
      state: 'noRoofIntent',
      title: 'Falta declarar intención estructural de techumbre.',
      message: 'Las cubiertas existen, pero todavía no hay declaraciones de distribución, diafragma o funciones de borde. El motor no inventa apoyos desde la geometría.',
      action: 'openRoofIntent',
      counts: { roofCount, roofIntentCount: 0, resistantBoundaryCount, proposalCount }
    };
  }
  if (resistantBoundaryCount === 0) {
    return {
      state: 'noResistantBoundary',
      title: 'No hay bordes con función resistente declarada.',
      message: 'Sólo Apoyo gravitacional, Apoyo lateral o Apoyo gravitacional y lateral pueden iniciar propuestas. Los límites geométricos, el soporte local de canaleta y los bordes indeterminados no crean receptores resistentes.',
      action: 'openRoofIntent',
      counts: { roofCount, roofIntentCount: roofIntents.length, resistantBoundaryCount, proposalCount }
    };
  }
  if (proposalCount === 0) {
    return {
      state: 'noCompatibleReceiver',
      title: 'Hay apoyos declarados, pero no se encontraron receptores geométricos compatibles.',
      message: 'Revise la función de los bordes y la evidencia geométrica. SPEC-015-D no selecciona un receptor si no cumple paralelismo, tolerancia y solape mínimos.',
      action: 'openRoofIntent',
      counts: { roofCount, roofIntentCount: roofIntents.length, resistantBoundaryCount, proposalCount }
    };
  }
  return {
    state: 'ready',
    title: 'Hay propuestas candidatas para revisión humana.',
    message: 'Las propuestas son derivadas no autoritativas y no modifican la intención hasta una confirmación explícita.',
    action: null,
    counts: { roofCount, roofIntentCount: roofIntents.length, resistantBoundaryCount, proposalCount }
  };
}

export function buildStructuralProposalWorkspace(model, { config = {}, analysisContexts = [] } = {}) {
  const geometry = projectAgnosticGeometry(model);
  const topology = recognizeStructuralTopology(geometry);
  const roofStructuralIntent = Array.isArray(model?.structuralIntent?.roofIntents)
    ? model.structuralIntent.roofIntents
    : [];
  const structuralProposals = generateStructuralProposals({
    geometry,
    structuralIntent: model.structuralIntent,
    roofStructuralIntent,
    topology,
    config
  });
  const candidateLoadPaths = buildCandidateLoadPaths({
    geometry,
    structuralIntent: model.structuralIntent,
    roofStructuralIntent,
    topology,
    structuralProposals,
    analysisContexts,
    config
  });
  const visualPresentation = buildStructuralProposalVisualPresentation(
    model,
    structuralProposals,
    candidateLoadPaths
  );
  const reviewedProposals = materializeStructuralProposalReviews(
    structuralProposals,
    model.structuralProposalReviews,
    model.structuralIntent
  );
  const proposalReadiness = buildProposalReadiness(geometry, roofStructuralIntent, structuralProposals);
  return canonicalizeValue({
    schema: STRUCTURAL_PROPOSAL_WORKSPACE_SCHEMA,
    geometry,
    topology,
    structuralProposals,
    candidateLoadPaths,
    visualPresentation,
    reviewedProposals,
    proposalReadiness,
    authorities: {
      geometry: 'agnostic-geometry-v1.0',
      intent: 'structural-intent-v1.1',
      roofIntent: 'structural-intent-v1.1/roofIntents',
      topology: 'recognized-structural-topology-v1.0/R0-R5',
      review: 'structural-proposal-review-log-v1.0'
    },
    limitations: [
      'Las propuestas y caminos son derivados no autoritativos.',
      'No verifica capacidad, rigidez, conexión, anclaje, resistencia ni deformaciones.',
      'No incorpora materiales, perfiles ni soluciones constructivas.'
    ]
  });
}
