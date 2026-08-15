import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CONSTRUCTIVE_STRUCTURAL_WORKSPACE_SCHEMA,
  buildConstructiveStructuralWorkspace
} from '../src/core/constructiveStructuralWorkspace.js';

import {
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL_RESISTANCE =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

const EXPECTED_ANALYSIS_CONTEXTS = [
  {
    graph: 'lateral',
    direction: 'x'
  },
  {
    graph: 'lateral',
    direction: 'y'
  }
];

async function realModel() {
  const fx =
    await buildFx008Rev8Short({
      declareEndpointSupports: true
    });

  const model =
    structuredClone(
      fx.model
    );

  model.structuralIntent = {
    ...structuredClone(
      model.structuralIntent
    ),

    roofIntents:
      structuredClone(
        fx.roofStructuralIntent
      )
  };

  return {
    fx,
    model
  };
}

test(
  'SPEC-016-A BUG-022: workspace constructivo usa dominio lateral canónico X luego Y',
  async () => {
    const {
      fx,
      model
    } =
      await realModel();

    const frozenModel =
      structuredClone(
        model
      );

    const workspace =
      buildConstructiveStructuralWorkspace(
        model
      );

    assert.equal(
      workspace.schema,
      CONSTRUCTIVE_STRUCTURAL_WORKSPACE_SCHEMA
    );

    assert.equal(
      workspace.schema,
      'constructive-structural-workspace-v1.0'
    );

    assert.deepEqual(
      Object.keys(
        workspace
      ).sort(),
      [
        'schema',
        'analysisContexts',
        'proposalWorkspace',
        'structuralRequirements',
        'referenceResolutionContext'
      ].sort()
    );

    assert.deepEqual(
      workspace.analysisContexts,
      EXPECTED_ANALYSIS_CONTEXTS
    );

    /*
     * FX-008 declara primaryResistanceDirection=Y.
     * El dominio X+Y productivo no puede derivarse de esa dirección.
     */
    assert.ok(
      fx.roofStructuralIntent.length > 0
    );

    assert.ok(
      fx.roofStructuralIntent.every(
        (intent) =>
          intent
            .primaryResistanceDirection
            ?.x === 0
          &&
          intent
            .primaryResistanceDirection
            ?.y === 1
      )
    );

    assert.equal(
      workspace
        .proposalWorkspace
        .candidateLoadPaths
        .canonicalSha256,
      '414e4007f91bc13786425ce54ee43a3d2e1ab54bc8d1bd22b55e9392a4416b3b'
    );

    assert.equal(
      workspace
        .structuralRequirements
        .canonicalSha256,
      'fe7187463f09730dce031a275b970cf22aae5bc396b97937d27170ec162ad301'
    );

    assert.equal(
      workspace
        .structuralRequirements
        .sourceFingerprints
        .aggregateSha256,
      '7c356ee838f69841b67dee4da4541ff57b86f4982ff40b9102133dfae0c6292a'
    );

    assert.equal(
      workspace
        .structuralRequirements
        .requirements
        .length,
      9
    );

    assert.equal(
      workspace
        .proposalWorkspace
        .candidateLoadPaths
        .lateral
        .paths
        .length,
      1
    );

    const requirementIds =
      workspace
        .structuralRequirements
        .requirements
        .map(
          (requirement) =>
            requirement.id
        );

    assert.ok(
      requirementIds.includes(
        LOAD_TRANSFER
      )
    );

    assert.ok(
      requirementIds.includes(
        LATERAL_RESISTANCE
      )
    );

    assert.deepEqual(
      model,
      frozenModel
    );
  }
);

test(
  'SPEC-016-A BUG-022: composición es determinista y no comparte analysisContexts mutables',
  async () => {
    const {
      model
    } =
      await realModel();

    const first =
      buildConstructiveStructuralWorkspace(
        model
      );

    const second =
      buildConstructiveStructuralWorkspace(
        structuredClone(
          model
        )
      );

    assert.deepEqual(
      second,
      first
    );

    first
      .analysisContexts[0]
      .direction =
        'y';

    const third =
      buildConstructiveStructuralWorkspace(
        model
      );

    assert.deepEqual(
      third.analysisContexts,
      EXPECTED_ANALYSIS_CONTEXTS
    );
  }
);

test(
  'SPEC-016-A BUG-022: assembler puro reutiliza D/E y no depende de store/UI/Metalcon/OSB',
  async () => {
    const source =
      await readFile(
        new URL(
          '../src/core/constructiveStructuralWorkspace.js',
          import.meta.url
        ),
        'utf8'
      );

    assert.doesNotMatch(
      source,
      /(?:React|react|three|useModelStore|components\/|Metalcon|metalcon|OSB)/
    );

    assert.match(
      source,
      /buildStructuralProposalWorkspace/
    );

    assert.match(
      source,
      /buildStructuralRequirementsWithReferenceResolutionContext/
    );
  }
);
