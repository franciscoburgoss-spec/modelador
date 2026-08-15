import {
  buildStructuralProposalWorkspace
} from './structuralProposalWorkspace.js';

import {
  buildStructuralRequirementsWithReferenceResolutionContext
} from './structuralRequirements.js';

import {
  canonicalizeValue
} from './structuralProposalCommon.js';

export const CONSTRUCTIVE_STRUCTURAL_WORKSPACE_SCHEMA =
  'constructive-structural-workspace-v1.0';

const PRODUCTIVE_ANALYSIS_CONTEXTS = Object.freeze([
  Object.freeze({
    graph: 'lateral',
    direction: 'x'
  }),
  Object.freeze({
    graph: 'lateral',
    direction: 'y'
  })
]);

function buildProductiveAnalysisContexts() {
  return PRODUCTIVE_ANALYSIS_CONTEXTS.map(
    (context) => ({
      graph: context.graph,
      direction: context.direction
    })
  );
}

export function buildConstructiveStructuralWorkspace(
  model
) {
  const analysisContexts =
    buildProductiveAnalysisContexts();

  const proposalWorkspace =
    buildStructuralProposalWorkspace(
      model,
      {
        analysisContexts
      }
    );

  const roofStructuralIntent =
    Array.isArray(
      model
        ?.structuralIntent
        ?.roofIntents
    )
      ? model.structuralIntent.roofIntents
      : [];

  const {
    structuralRequirements,
    referenceResolutionContext
  } =
    buildStructuralRequirementsWithReferenceResolutionContext({
      geometry:
        proposalWorkspace.geometry,

      topology:
        proposalWorkspace.topology,

      structuralIntent:
        model.structuralIntent,

      roofStructuralIntent,

      structuralProposals:
        proposalWorkspace.structuralProposals,

      structuralProposalReviews:
        model.structuralProposalReviews,

      candidateLoadPaths:
        proposalWorkspace.candidateLoadPaths
    });

  return canonicalizeValue({
    schema:
      CONSTRUCTIVE_STRUCTURAL_WORKSPACE_SCHEMA,

    analysisContexts,

    proposalWorkspace,

    structuralRequirements,

    referenceResolutionContext
  });
}
