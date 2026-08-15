import { useState } from 'react';

import { useModelStore } from '../../store/useModelStore.js';

import {
  buildNeutralConstructiveRuntime
} from '../../core/constructiveNeutralRuntime.js';

import {
  inspectConstructiveScenario
} from '../../core/constructiveScenarioInspection.js';

import {
  buildConstructiveStructuralWorkspace
} from '../../core/constructiveStructuralWorkspace.js';

const DIMENSIONS = [
  {
    label: 'Lifecycle',
    text: 'Estado del escenario constructivo.'
  },
  {
    label: 'Coverage',
    text: 'Cobertura de requirements efectivos.'
  },
  {
    label: 'Freshness',
    text: 'Vigencia respecto de la entrada efectiva.'
  },
  {
    label: 'Verification',
    text: 'Estado independiente: notVerified.'
  },
  {
    label: 'Execution',
    text: 'Disponibilidad y resultado de generación.'
  },
  {
    label: 'Fingerprints',
    text: 'Identidad reproducible de entradas y resultados.'
  }
];


const REQUIREMENT_KIND_LABEL = Object.freeze({
  supportRequired:
    'Apoyo requerido',

  loadTransferRequired:
    'Transferencia de carga requerida',

  collectorActionRequired:
    'Acción de colector requerida',

  diaphragmActionRequired:
    'Acción de diafragma requerida',

  stabilizationRequired:
    'Estabilización requerida',

  gravityResistanceRequired:
    'Resistencia gravitacional requerida',

  inPlaneLateralResistanceRequired:
    'Resistencia lateral en plano requerida'
});

const GRAPH_LABEL = Object.freeze({
  gravity:
    'Gravitacional',

  lateral:
    'Lateral'
});

const STRUCTURAL_FUNCTION_LABEL = Object.freeze({
  support:
    'Apoyo',

  loadTransfer:
    'Transferencia de carga',

  collectorAction:
    'Acción de colector'
});

const INTERACTION_ROLE_LABEL = Object.freeze({
  receives:
    'recibe',

  delivers:
    'entrega',

  carrier:
    'portador'
});

function shortRef(ref) {
  const value =
    String(ref ?? '');

  const token =
    value
      .split(':')
      .at(-1);

  return token
    ? token.slice(0, 8)
    : value;
}

function requirementOriginLabel(
  requirement,
  region,
  visualRelations
) {
  const sourceRefs =
    requirement.sourceRefs ?? [];

  const pathRef =
    sourceRefs.find(
      (ref) =>
        String(ref).startsWith('path:')
    );

  const edgeRef =
    sourceRefs.find(
      (ref) =>
        String(ref).startsWith('edge:')
    );

  if (pathRef || edgeRef) {
    return `Ruta candidata · ${shortRef(pathRef ?? edgeRef)}`;
  }

  if (
    sourceRefs.some(
      (ref) =>
        String(ref).startsWith('intent:element:')
    )
  ) {
    return 'Intención estructural del elemento';
  }

  const relationRef =
    sourceRefs.find(
      (ref) =>
        String(ref).startsWith('rel:')
    );

  if (relationRef) {
    const relationPresentation =
      visualRelations
        ?.get(
          relationRef
        );

    if (
      relationPresentation
        ?.subtitle
    ) {
      return String(
        relationPresentation.subtitle
      ).replace(
        /\s*·\s*(fresh|stale|brokenReference)\s*$/,
        ''
      );
    }

    const interaction =
      (region?.declaredInteractions ?? [])
        .find(
          (item) =>
            item.relationId === relationRef
        );

    if (interaction) {
      const functionLabel =
        STRUCTURAL_FUNCTION_LABEL[
          interaction.structuralFunction
        ]
        ?? interaction.structuralFunction;

      const roleLabel =
        INTERACTION_ROLE_LABEL[
          interaction.interactionRole
        ]
        ?? interaction.interactionRole;

      return `Relación declarada · ${functionLabel} · ${roleLabel} · ${shortRef(relationRef)}`;
    }

    return `Relación declarada · ${shortRef(relationRef)}`;
  }

  return sourceRefs.length > 0
    ? `Origen técnico · ${shortRef(sourceRefs[0])}`
    : 'Origen no resuelto';
}

function regionLocationLabel(region) {
  if (!region) {
    return 'Destino no resuelto';
  }

  const location =
    region.longitudinalLocation;

  const zRange =
    region.zRange ?? [];

  const zText =
    zRange.length === 2
      ? `z=${zRange[0]}→${zRange[1]}`
      : 'z no resuelto';

  if (location?.kind === 'end') {
    const endLabel =
      location.end === 'lowS'
        ? 'Extremo inicial'
        : location.end === 'highS'
          ? 'Extremo final'
          : `Extremo ${String(location.end)}`;

    return `${endLabel} · ${zText}`;
  }

  if (
    location?.kind === 'range'
    && Array.isArray(location.sRange)
    && location.sRange.length === 2
  ) {
    return `s=${location.sRange[0]}→${location.sRange[1]} · ${zText}`;
  }

  return zText;
}

export default function ConstructiveScenariosWorkspaceDialog({
  open,
  onClose
}) {
  const [creating, setCreating] =
    useState(false);

  const [scenarioName, setScenarioName] =
    useState('');

  const [scenarioDescription, setScenarioDescription] =
    useState('');

  const [scopeMode, setScopeMode] =
    useState(null);

  const [
    selectedRequirementIds,
    setSelectedRequirementIds
  ] =
    useState([]);

  const model =
    useModelStore(
      (state) =>
        state.model
    );

  const generateConstructiveScenario =
    useModelStore(
      (state) =>
        state.generateConstructiveScenario
    );

  const createNeutralConstructiveScenario =
    useModelStore(
      (state) =>
        state.createNeutralConstructiveScenario
    );

  const constructiveSolutions =
    model.constructiveSolutions;

  const scenarios =
    constructiveSolutions
      ?.scenarios ?? [];

  if (!open) {
    return null;
  }

  const runtime =
    buildNeutralConstructiveRuntime();

  const inspections =
    scenarios.map(
      (scenario) =>
        inspectConstructiveScenario({
          model,

          constructiveSolutions,

          scenarioId:
            scenario.scenarioId,

          runtime
        })
    );

  const requirementWorkspace =
    creating
    && scopeMode === 'requirements'
      ? buildConstructiveStructuralWorkspace(
          model
        )
      : null;

  const structuralRequirements =
    requirementWorkspace
      ?.structuralRequirements;

  const requirementRegions =
    new Map(
      (
        structuralRequirements
          ?.regions
        ?? []
      ).map(
        (region) => [
          region.regionId,
          region
        ]
      )
    );

  const visualPresentation =
    requirementWorkspace
      ?.proposalWorkspace
      ?.visualPresentation
    ?? null;

  const visualElements =
    new Map(
      (
        visualPresentation
          ?.entities
          ?.elements
        ?? []
      ).map(
        (target) => [
          String(target.entityId),
          target
        ]
      )
    );

  const visualRelations =
    new Map(
      (
        visualPresentation
          ?.entities
          ?.relations
        ?? []
      ).map(
        (relation) => [
          relation.entityId,
          relation
        ]
      )
    );

  const requirements =
    structuralRequirements
      ?.requirements
    ?? [];

  const currentRequirementIds =
    new Set(
      requirements.map(
        (requirement) =>
          requirement.id
      )
    );

  const effectiveSelectedRequirementIds =
    selectedRequirementIds
      .filter(
        (requirementId) =>
          currentRequirementIds.has(
            requirementId
          )
      )
      .sort(
        (left, right) =>
          left.localeCompare(right)
      );

  const canCreateScenario =
    scenarioName.trim().length > 0
    && (
      scopeMode === 'all'
      || (
        scopeMode === 'requirements'
        && effectiveSelectedRequirementIds.length > 0
      )
    );

  const toggleRequirement =
    (requirementId) => {
      setSelectedRequirementIds(
        (current) =>
          current.includes(
            requirementId
          )
            ? current.filter(
                (item) =>
                  item !== requirementId
              )
            : [
                ...current,
                requirementId
              ]
      );
    };

  const resetCreationForm = () => {
    setCreating(false);
    setScenarioName('');
    setScenarioDescription('');
    setScopeMode(null);
    setSelectedRequirementIds([]);
  };

  const handleCreateScenario = () => {
    if (!canCreateScenario) {
      return;
    }

    createNeutralConstructiveScenario({
      metadata: {
        name:
          scenarioName.trim(),

        description:
          scenarioDescription
      },

      scope:
        scopeMode === 'requirements'
          ? {
              mode:
                'requirements',

              requirementIds:
                effectiveSelectedRequirementIds
            }
          : {
              mode:
                'all'
            }
    });

    resetCreationForm();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Escenarios de soluciones constructivas"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[#d7d7d1] bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#e4e4e0] px-4 py-3">
          <div>
            <h2 className="font-semibold">
              Escenarios de soluciones constructivas
            </h2>

            <p className="mt-1 text-xs text-[#6b6b66]">
              Decisiones constructivas separadas de la intención y
              topología estructural.
            </p>
          </div>

          <button
            type="button"
            aria-label="Cerrar soluciones constructivas"
            className="h-8 w-8 rounded hover:bg-[#f2f2ee]"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="overflow-y-auto p-4">
          <section
            aria-label="Dimensiones de estado constructivo"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {DIMENSIONS.map((dimension) => (
              <div
                key={dimension.label}
                className="rounded border border-[#e4e4e0] bg-[#fafaf7] p-3"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-[#55554f]">
                  {dimension.label}
                </div>

                <p className="mt-1 text-xs text-[#6b6b66]">
                  {dimension.text}
                </p>
              </div>
            ))}
          </section>

          <p className="mt-4 rounded border border-[#e4e4e0] bg-white p-3 text-xs text-[#55554f]">
            Un requirement <strong>resolved</strong> ≠{' '}
            <strong>verified</strong>. La generación constructiva no
            constituye verificación estructural.
          </p>

          <section
            aria-label="Escenarios constructivos"
            className="mt-4"
          >
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                aria-label="Nuevo escenario"
                className="rounded border border-[#c8c8c1] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3d38] hover:bg-[#f2f2ee]"
                onClick={() => setCreating(true)}
              >
                Nuevo escenario
              </button>
            </div>

            {creating ? (
              <section
                aria-label="Crear escenario constructivo"
                className="mb-4 rounded border border-[#d7d7d1] bg-[#fafaf7] p-4"
              >
                <h3 className="font-semibold text-[#3d3d38]">
                  Nuevo escenario constructivo
                </h3>

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-xs text-[#55554f]">
                    <span className="font-medium">
                      Nombre
                    </span>

                    <input
                      type="text"
                      aria-label="Nombre del escenario"
                      value={scenarioName}
                      className="rounded border border-[#c8c8c1] bg-white px-3 py-2 text-sm text-[#3d3d38]"
                      onChange={(event) =>
                        setScenarioName(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="grid gap-1 text-xs text-[#55554f]">
                    <span className="font-medium">
                      Descripción
                    </span>

                    <textarea
                      aria-label="Descripción"
                      value={scenarioDescription}
                      className="min-h-20 rounded border border-[#c8c8c1] bg-white px-3 py-2 text-sm text-[#3d3d38]"
                      onChange={(event) =>
                        setScenarioDescription(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <fieldset className="rounded border border-[#e4e4e0] bg-white p-3">
                    <legend className="px-1 text-xs font-semibold text-[#55554f]">
                      Alcance
                    </legend>

                    <div className="grid gap-2 text-xs text-[#3d3d38]">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="constructive-scenario-scope"
                          aria-label="Todo el alcance"
                          checked={scopeMode === 'all'}
                          onChange={() =>
                            setScopeMode('all')
                          }
                        />

                        <span>
                          Todo el alcance
                        </span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="constructive-scenario-scope"
                          aria-label="Requirements seleccionados"
                          checked={scopeMode === 'requirements'}
                          onChange={() =>
                            setScopeMode('requirements')
                          }
                        />

                        <span>
                          Requirements seleccionados
                        </span>
                      </label>
                    </div>

                    {scopeMode === 'requirements' ? (
                      <div className="mt-3 grid gap-2">
                        <p className="text-xs text-[#777770]">
                          Debe seleccionarse al menos un requirement antes
                          de crear el escenario.
                        </p>

                        {requirements.length === 0 ? (
                          <p className="rounded border border-dashed border-[#cfcfc8] p-3 text-xs text-[#777770]">
                            No existen requirements estructurales vigentes
                            para seleccionar.
                          </p>
                        ) : (
                          <div
                            className="grid max-h-72 gap-2 overflow-y-auto rounded border border-[#e4e4e0] bg-[#fafaf7] p-2"
                            aria-label="Requirements estructurales disponibles"
                          >
                            {requirements.map((requirement) => {
                              const region =
                                requirement.targetRegionRef
                                  ? requirementRegions.get(
                                      requirement.targetRegionRef
                                    )
                                  : null;

                              const target =
                                region?.ownerRef?.kind === 'element'
                                  ? visualElements.get(
                                      String(
                                        region.ownerRef.id
                                      )
                                    )
                                  : null;

                              const destination =
                                target
                                  ?.title
                                ?? 'Destino no resuelto';

                              const kindLabel =
                                REQUIREMENT_KIND_LABEL[
                                  requirement.kind
                                ]
                                ?? requirement.code
                                ?? requirement.kind;

                              const graphLabel =
                                GRAPH_LABEL[
                                  requirement.graph
                                ]
                                ?? requirement.graph;

                              const originLabel =
                                requirementOriginLabel(
                                  requirement,
                                  region,
                                  visualRelations
                                );

                              return (
                                <label
                                  key={requirement.id}
                                  className="flex items-start gap-2 rounded border border-[#deded8] bg-white p-2"
                                >
                                  <input
                                    type="checkbox"
                                    value={requirement.id}
                                    checked={
                                      selectedRequirementIds.includes(
                                        requirement.id
                                      )
                                    }
                                    className="mt-0.5"
                                    onChange={() =>
                                      toggleRequirement(
                                        requirement.id
                                      )
                                    }
                                  />

                                  <span className="min-w-0">
                                    <span className="block text-xs font-semibold text-[#3d3d38]">
                                      {kindLabel}
                                      {' · '}
                                      {graphLabel}
                                    </span>

                                    <span className="mt-0.5 block text-xs text-[#55554f]">
                                      {destination}
                                    </span>

                                    <span className="mt-0.5 block text-[11px] text-[#777770]">
                                      {regionLocationLabel(
                                        region
                                      )}
                                    </span>

                                    <span className="mt-0.5 block text-[11px] text-[#777770]">
                                      {originLabel}
                                    </span>

                                    {Number.isFinite(
                                      requirement
                                        .evidence
                                        ?.gapMm
                                    ) ? (
                                      <span className="mt-0.5 block text-[11px] text-[#777770]">
                                        Gap candidato:{' '}
                                        {
                                          requirement
                                            .evidence
                                            .gapMm
                                        } mm
                                      </span>
                                    ) : null}

                                    <span
                                      className="mt-0.5 block font-mono text-[10px] text-[#92928b]"
                                      title={requirement.id}
                                    >
                                      Req · {shortRef(requirement.id)}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </fieldset>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-[#c8c8c1] bg-white px-3 py-1.5 text-xs text-[#55554f] hover:bg-[#f2f2ee]"
                    onClick={resetCreationForm}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    aria-label="Crear escenario"
                    disabled={!canCreateScenario}
                    className="rounded border border-[#c8c8c1] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3d38] disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={handleCreateScenario}
                  >
                    Crear escenario
                  </button>
                </div>
              </section>
            ) : null}

            {scenarios.length === 0 ? (
              <p className="rounded border border-dashed border-[#cfcfc8] p-4 text-sm text-[#66665f]">
                Sin escenarios constructivos.
              </p>
            ) : (
              <div className="space-y-3">
                {inspections.map((inspection) => (
                  <article
                    key={inspection.scenarioId}
                    className="rounded border border-[#d7d7d1] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[#3d3d38]">
                          {inspection.name}
                        </h3>

                        {inspection.description ? (
                          <p className="mt-1 text-xs text-[#6b6b66]">
                            {inspection.description}
                          </p>
                        ) : null}

                        <p className="mt-1 font-mono text-[11px] text-[#777770]">
                          {inspection.scenarioId}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right text-xs text-[#55554f]">
                          {inspection.assignmentCount}{' '}
                          assignment
                          {inspection.assignmentCount === 1 ? '' : 's'}
                        </div>

                        {inspection.lifecycle === 'active'
                          && inspection
                            .eligibility
                            .eligibleForEffectiveProjection
                          && inspection.availability === 'available'
                          ? (
                            <button
                              type="button"
                              aria-label={`Generar ${inspection.name}`}
                              className="rounded border border-[#c8c8c1] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3d38] hover:bg-[#f2f2ee]"
                              onClick={() =>
                                generateConstructiveScenario(
                                  inspection.scenarioId
                                )
                              }
                            >
                              Generar
                            </button>
                          )
                          : null}
                      </div>
                    </div>

                    <div
                      className="mt-4 rounded border border-[#e4e4e0] bg-[#fafaf7] p-3 text-xs"
                      aria-label={`Elegibilidad ${inspection.name}`}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#777770]">
                        Eligibility
                      </div>

                      <div className="mt-1 font-medium text-[#3d3d38]">
                        eligibleForEffectiveProjection: {String(
                          inspection
                            .eligibility
                            .eligibleForEffectiveProjection
                        )}
                      </div>

                      {inspection
                        .eligibility
                        .reasonCodes
                        .length > 0 ? (
                          <div className="mt-2">
                            <div className="text-[10px] uppercase tracking-wide text-[#777770]">
                              Reason codes
                            </div>

                            <ul className="mt-1 space-y-1">
                              {inspection
                                .eligibility
                                .reasonCodes
                                .map((reasonCode) => (
                                  <li
                                    key={reasonCode}
                                    className="font-mono text-[11px] text-[#3d3d38]"
                                  >
                                    {reasonCode}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}
                    </div>

                    <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ['Lifecycle', inspection.lifecycle],
                        [
                          'Availability',
                          inspection.availability
                            ?? 'Availability no evaluada'
                        ],
                        ['Execution', inspection.execution],
                        ['Coverage', inspection.coverage],
                        ['Freshness', inspection.freshness],
                        ['Verification', inspection.verification]
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded border border-[#e4e4e0] bg-[#fafaf7] px-3 py-2"
                        >
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#777770]">
                            {label}
                          </dt>

                          <dd className="mt-1 font-medium text-[#3d3d38]">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-4 rounded border border-[#e4e4e0] bg-[#fafaf7] p-3 text-xs">
                      <div className="font-semibold text-[#55554f]">
                        Fingerprints
                      </div>

                      <div className="mt-2 grid gap-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-[#777770]">
                            Entrada efectiva vigente
                          </div>

                          <code className="mt-1 block break-all text-[11px] text-[#3d3d38]">
                            {inspection.fingerprints
                              .currentEffectiveGenerationInputSha256}
                          </code>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-[#777770]">
                            Última generación
                          </div>

                          {inspection.fingerprints
                            .lastGenerationEffectiveGenerationInputSha256
                            ? (
                              <code className="mt-1 block break-all text-[11px] text-[#3d3d38]">
                                {inspection.fingerprints
                                  .lastGenerationEffectiveGenerationInputSha256}
                              </code>
                            )
                            : (
                              <span className="mt-1 block text-[#777770]">
                                Sin generación persistida.
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
