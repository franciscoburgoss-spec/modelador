import test, {
  after,
  afterEach,
  before,
  beforeEach
} from 'node:test';

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  createConstructiveAssignment,
  createConstructiveScenario,
  createEmptyConstructiveSolutions
} from '../src/core/constructiveSolutionScenarios.js';

import {
  buildNeutralConstructiveRuntime
} from '../src/core/constructiveNeutralRuntime.js';

import {
  runConstructiveScenarioGeneration
} from '../src/core/constructiveGenerationPipeline.js';

import {
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

let cleanup;
let fireEvent;
let render;
let screen;
let useModelStore;
let ConstructiveScenariosWorkspaceDialog;
let dom;
let generatedModel;
let generatedFingerprint;
let ungeneratedModel;

const LOAD_TRANSFER =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL_RESISTANCE =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

async function buildGeneratedFixture() {
  const runtime =
    buildNeutralConstructiveRuntime();

  const fx =
    await buildFx008Rev8Short({
      declareEndpointSupports: true
    });

  const model =
    structuredClone(fx.model);

  model.structuralIntent = {
    ...structuredClone(
      model.structuralIntent
    ),

    roofIntents:
      structuredClone(
        fx.roofStructuralIntent
      )
  };

  let constructiveSolutions =
    createEmptyConstructiveSolutions();

  constructiveSolutions =
    createConstructiveScenario(
      constructiveSolutions,
      {
        metadata: {
          name: 'FX-008 UI',
          description: 'Escenario generado para inspección visual'
        },

        adapterRef:
          structuredClone(
            runtime.adapterRef
          ),

        libraryRef:
          structuredClone(
            runtime.libraryRef
          ),

        configuration: {
          schema:
            'neutral-contract-configuration-v1.0'
        },

        scope: {
          mode: 'requirements',

          requirementIds: [
            LOAD_TRANSFER,
            LATERAL_RESISTANCE
          ]
        }
      }
    ).constructiveSolutions;

  constructiveSolutions =
    createConstructiveAssignment(
      constructiveSolutions,
      'scenario:000001',
      {
        requirementRef:
          LOAD_TRANSFER,

        targetRef: {
          kind: 'requirement',
          ref: LOAD_TRANSFER
        },

        choiceRef: {
          libraryId:
            runtime.libraryRef.libraryId,

          libraryVersion:
            runtime.libraryRef.libraryVersion,

          componentTypeId:
            'abstract-load-transfer-response'
        },

        parameters: {}
      }
    ).constructiveSolutions;

  const run =
    runConstructiveScenarioGeneration({
      model,
      constructiveSolutions,
      scenarioId:
        'scenario:000001',
      runtime
    });

  model.constructiveSolutions =
    run.constructiveSolutions;

  return {
    generatedModel:
      {
        ...structuredClone(model),

        constructiveSolutions:
          run.constructiveSolutions
      },

    ungeneratedModel:
      {
        ...structuredClone(model),

        constructiveSolutions:
          structuredClone(
            constructiveSolutions
          )
      },

    fingerprint:
      run.receipt
        .effectiveGenerationInputSha256
  };
}

function installDom() {
  dom = new JSDOM(
    '<!doctype html><html><body></body></html>',
    {
      pretendToBeVisual: true,
      url: 'http://localhost/'
    }
  );

  for (const name of [
    'document',
    'Element',
    'Event',
    'HTMLElement',
    'HTMLButtonElement',
    'KeyboardEvent',
    'MouseEvent',
    'MutationObserver',
    'Node',
    'navigator',
    'window'
  ]) {
    Object.defineProperty(
      globalThis,
      name,
      {
        configurable: true,

        value:
          name === 'document'
            ? dom.window.document
            : name === 'navigator'
              ? dom.window.navigator
              : name === 'window'
                ? dom.window
                : dom.window[name],

        writable: true
      }
    );
  }

  globalThis.IS_REACT_ACT_ENVIRONMENT =
    true;
}

function resetStore() {
  const current =
    useModelStore.getState().model;

  useModelStore.setState({
    model: {
      ...current,

      constructiveSolutions:
        createEmptyConstructiveSolutions()
    },

    past: [],
    future: []
  });
}

before(async () => {
  installDom();

  ({
    cleanup,
    fireEvent,
    render,
    screen
  } =
    await import(
      '@testing-library/react'
    ));

  ({
    useModelStore
  } =
    await import(
      '../src/store/useModelStore.js'
    ));

  ({
    generatedModel,
    ungeneratedModel,
    fingerprint: generatedFingerprint
  } =
    await buildGeneratedFixture());

  ({
    default:
      ConstructiveScenariosWorkspaceDialog
  } =
    await import(
      '../src/components/modals/ConstructiveScenariosWorkspaceDialog.jsx'
    ));
});

beforeEach(resetStore);

afterEach(() => {
  cleanup();
});

after(() => {
  dom.window.close();

  delete globalThis
    .IS_REACT_ACT_ENVIRONMENT;
});

test(
  'SPEC-016-A UI: cerrado no renderiza y abierto expone diálogo accesible independiente',
  () => {
    const view =
      render(
        <ConstructiveScenariosWorkspaceDialog
          open={false}
          onClose={() => {}}
        />
      );

    assert.equal(
      screen.queryByRole(
        'dialog',
        {
          name:
            'Escenarios de soluciones constructivas'
        }
      ),
      null
    );

    view.rerender(
      <ConstructiveScenariosWorkspaceDialog
        open
        onClose={() => {}}
      />
    );

    assert.ok(
      screen.getByRole(
        'dialog',
        {
          name:
            'Escenarios de soluciones constructivas'
        }
      )
    );

    assert.ok(
      screen.getByRole(
        'button',
        {
          name:
            'Cerrar soluciones constructivas'
        }
      )
    );
  }
);

test(
  'REQ-UX-005: workspace vacío separa las seis dimensiones y no confunde respuesta con verificación',
  () => {
    render(
      <ConstructiveScenariosWorkspaceDialog
        open
        onClose={() => {}}
      />
    );

    assert.ok(
      screen.getByText(
        'Sin escenarios constructivos.'
      )
    );

    for (const label of [
      'Lifecycle',
      'Coverage',
      'Freshness',
      'Verification',
      'Execution',
      'Fingerprints'
    ]) {
      assert.ok(
        screen.getByText(label)
      );
    }

    assert.match(
      document.body.textContent,
      /notVerified/
    );

    assert.match(
      document.body.textContent,
      /resolved.*no.*verified|resolved.*≠.*verified/i
    );
  }
);

test(
  'BUG-016-A-020: workspace no incorpora controles Metalcon, OSB ni herramientas SPEC-015',
  () => {
    render(
      <ConstructiveScenariosWorkspaceDialog
        open
        onClose={() => {}}
      />
    );

    assert.equal(
      screen.queryByRole(
        'button',
        {
          name:
            /Metalcon|OSB/i
        }
      ),
      null
    );

    assert.equal(
      screen.queryByRole(
        'button',
        {
          name:
            /Intención estructural|Propuestas y caminos candidatos/i
        }
      ),
      null
    );
  }
);


test(
  'SPEC-016-A UI: escenario real muestra estado derivado y fingerprints persistidos',
  () => {
    useModelStore.setState({
      model:
        structuredClone(
          generatedModel
        ),

      past: [],
      future: []
    });

    render(
      <ConstructiveScenariosWorkspaceDialog
        open
        onClose={() => {}}
      />
    );

    assert.ok(
      screen.getByText(
        'FX-008 UI'
      )
    );

    assert.ok(
      screen.getByText(
        'Escenario generado para inspección visual'
      )
    );

    for (const value of [
      'active',
      'available',
      'idle',
      'partial',
      'fresh',
      'notVerified'
    ]) {
      assert.ok(
        screen.getByText(
          value
        )
      );
    }

    assert.match(
      document.body.textContent,
      /1 assignment/i
    );

    assert.equal(
      screen.getAllByText(
        generatedFingerprint
      ).length,
      2
    );
  }
);


test(
  'SPEC-016-A UI: Generar usa una mutación del store, persiste sólo receipt y refresca estado real',
  () => {
    useModelStore.setState({
      model:
        structuredClone(
          ungeneratedModel
        ),

      past: [],
      future: []
    });

    render(
      <ConstructiveScenariosWorkspaceDialog
        open
        onClose={() => {}}
      />
    );

    assert.equal(
      screen.getAllByText(
        'notGenerated'
      ).length,
      2
    );

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            'Generar FX-008 UI'
        }
      )
    );

    const state =
      useModelStore.getState();

    assert.equal(
      state.past.length,
      1
    );

    assert.equal(
      state.future.length,
      0
    );

    assert.ok(
      state.model
        .constructiveSolutions
        .scenarios[0]
        .lastGeneration
    );

    assert.equal(
      JSON.stringify(
        state.model
      ).includes(
        '"requirementResolutions"'
      ),
      false
    );

    assert.ok(
      screen.getByText(
        'idle'
      )
    );

    assert.ok(
      screen.getByText(
        'partial'
      )
    );

    assert.ok(
      screen.getByText(
        'fresh'
      )
    );

    assert.ok(
      screen.getByText(
        'notVerified'
      )
    );
  }
);


test(
  'SPEC-016-A UI: crear escenario exige scope explícito y persiste una sola transacción',
  () => {
    const model =
      structuredClone(
        ungeneratedModel
      );

    model.constructiveSolutions =
      createEmptyConstructiveSolutions();

    useModelStore.setState({
      model,
      past: [],
      future: []
    });

    render(
      <ConstructiveScenariosWorkspaceDialog
        open
        onClose={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            'Nuevo escenario'
        }
      )
    );

    const nameInput =
      screen.getByRole(
        'textbox',
        {
          name:
            'Nombre del escenario'
        }
      );

    const descriptionInput =
      screen.getByRole(
        'textbox',
        {
          name:
            'Descripción'
        }
      );

    const allScope =
      screen.getByRole(
        'radio',
        {
          name:
            'Todo el alcance'
        }
      );

    const requirementsScope =
      screen.getByRole(
        'radio',
        {
          name:
            'Requirements seleccionados'
        }
      );

    const createButton =
      screen.getByRole(
        'button',
        {
          name:
            'Crear escenario'
        }
      );

    assert.equal(
      allScope.checked,
      false
    );

    assert.equal(
      requirementsScope.checked,
      false
    );

    assert.equal(
      createButton.disabled,
      true
    );

    fireEvent.change(
      nameInput,
      {
        target: {
          value:
            'Alternativa UI'
        }
      }
    );

    fireEvent.change(
      descriptionInput,
      {
        target: {
          value:
            'Scope elegido por el usuario'
        }
      }
    );

    assert.equal(
      createButton.disabled,
      true
    );

    fireEvent.click(
      allScope
    );

    assert.equal(
      allScope.checked,
      true
    );

    assert.equal(
      createButton.disabled,
      false
    );

    fireEvent.click(
      createButton
    );

    const state =
      useModelStore.getState();

    assert.equal(
      state.past.length,
      1
    );

    assert.equal(
      state.future.length,
      0
    );

    assert.equal(
      state.model
        .constructiveSolutions
        .scenarios.length,
      1
    );

    const scenario =
      state.model
        .constructiveSolutions
        .scenarios[0];

    assert.equal(
      scenario.metadata.name,
      'Alternativa UI'
    );

    assert.equal(
      scenario.metadata.description,
      'Scope elegido por el usuario'
    );

    assert.deepEqual(
      scenario.scope,
      {
        mode:
          'all'
      }
    );

    assert.deepEqual(
      scenario.assignments,
      []
    );

    assert.equal(
      scenario.lastGeneration,
      null
    );

    assert.ok(
      screen.getByText(
        'Alternativa UI'
      )
    );

    assert.equal(
      screen.getAllByText(
        'notGenerated'
      ).length,
      2
    );
  }
);


test(
  'BUG-016-A-038 UI: escenario inelegible muestra eligibility y reasonCodes sin confundir availability',
  () => {
    const model =
      structuredClone(
        ungeneratedModel
      );

    model.constructiveSolutions =
      createEmptyConstructiveSolutions();

    useModelStore.setState({
      model,
      past: [],
      future: []
    });

    render(
      <ConstructiveScenariosWorkspaceDialog
        open
        onClose={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            'Nuevo escenario'
        }
      )
    );

    fireEvent.change(
      screen.getByRole(
        'textbox',
        {
          name:
            'Nombre del escenario'
        }
      ),
      {
        target: {
          value:
            'Escenario bloqueado UI'
        }
      }
    );

    fireEvent.click(
      screen.getByRole(
        'radio',
        {
          name:
            'Todo el alcance'
        }
      )
    );

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            'Crear escenario'
        }
      )
    );

    assert.ok(
      screen.getByText(
        'Escenario bloqueado UI'
      )
    );

    assert.ok(
      screen.getByText(
        'eligibleForEffectiveProjection: false'
      )
    );

    assert.ok(
      screen.getByText(
        'BLOCKING_DECISION_RELEVANT'
      )
    );

    assert.ok(
      screen.getByText(
        'Availability no evaluada'
      )
    );

    assert.equal(
      screen.queryByText(
        'unavailable'
      ),
      null
    );
  }
);


test(
  'BUG-016-A-020 UI requirements: selector deriva requirements vigentes y persiste IDs canónicos',
  () => {
    const SUPPORT_SHARED_FIRST =
      'sr-requirement:sha256:598ce6352df929eb0893c315eb2e3f90c7f3f8d51f3bb1f6b5b6319f8cf446f6';

    const SUPPORT_SHARED_SECOND =
      'sr-requirement:sha256:a78e8cc91e398a961d874229b1da38816a957c70bb71a743e23984a8b100411a';

    const model =
      structuredClone(
        ungeneratedModel
      );

    model.constructiveSolutions =
      createEmptyConstructiveSolutions();

    useModelStore.setState({
      model,
      past: [],
      future: []
    });

    render(
      <ConstructiveScenariosWorkspaceDialog
        open
        onClose={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            'Nuevo escenario'
        }
      )
    );

    fireEvent.change(
      screen.getByRole(
        'textbox',
        {
          name:
            'Nombre del escenario'
        }
      ),
      {
        target: {
          value:
            'Scope requirements UI'
        }
      }
    );

    const requirementsScope =
      screen.getByRole(
        'radio',
        {
          name:
            'Requirements seleccionados'
        }
      );

    const createButton =
      screen.getByRole(
        'button',
        {
          name:
            'Crear escenario'
        }
      );

    fireEvent.click(
      requirementsScope
    );

    assert.equal(
      requirementsScope.checked,
      true
    );

    assert.equal(
      createButton.disabled,
      true
    );

    const checkboxes =
      screen.getAllByRole(
        'checkbox'
      );

    assert.equal(
      checkboxes.length,
      9
    );

    const visibleText =
      document.body.textContent;

    assert.match(
      visibleText,
      /Apoyo requerido/
    );

    assert.match(
      visibleText,
      /Transferencia de carga requerida/
    );

    assert.match(
      visibleText,
      /Resistencia lateral en plano requerida/
    );

    assert.match(
      visibleText,
      /Gravitacional/
    );

    assert.match(
      visibleText,
      /Lateral/
    );

    assert.match(
      visibleText,
      /Muro/
    );

    assert.match(
      visibleText,
      /Ruta candidata/
    );

    assert.match(
      visibleText,
      /Intención estructural del elemento/
    );

    /*
     * Ambos requirements corresponden al mismo owner/target region
     * en FX-008, pero son requirements canónicos diferentes.
     *
     * La UI debe mantenerlos seleccionables de forma independiente.
     */
    const second =
      document.querySelector(
        `input[type="checkbox"][value="${SUPPORT_SHARED_SECOND}"]`
      );

    const first =
      document.querySelector(
        `input[type="checkbox"][value="${SUPPORT_SHARED_FIRST}"]`
      );

    assert.ok(
      second,
      'Debe existir checkbox para a78e8cc9.'
    );

    assert.ok(
      first,
      'Debe existir checkbox para 598ce635.'
    );

    assert.notEqual(
      first,
      second
    );

    /*
     * Selección intencionalmente invertida:
     * B1/store deben conservar el scope canónico por ID.
     */
    fireEvent.click(
      second
    );

    assert.equal(
      createButton.disabled,
      false
    );

    fireEvent.click(
      first
    );

    assert.equal(
      createButton.disabled,
      false
    );

    fireEvent.click(
      createButton
    );

    const state =
      useModelStore.getState();

    assert.equal(
      state.past.length,
      1
    );

    assert.equal(
      state.future.length,
      0
    );

    assert.equal(
      state.model
        .constructiveSolutions
        .scenarios.length,
      1
    );

    const scenario =
      state.model
        .constructiveSolutions
        .scenarios[0];

    assert.deepEqual(
      scenario.scope,
      {
        mode:
          'requirements',

        requirementIds: [
          SUPPORT_SHARED_FIRST,
          SUPPORT_SHARED_SECOND
        ]
      }
    );

    assert.equal(
      Object.hasOwn(
        scenario.scope,
        'regions'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        scenario.scope,
        'sourceRefs'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        scenario.scope,
        'descriptors'
      ),
      false
    );
  }
);

test(
  'BUG-016-A-020 UI requirements: volver a todo el alcance no persiste requirementIds',
  () => {
    const SELECTED_REQUIREMENT =
      'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

    const model =
      structuredClone(
        ungeneratedModel
      );

    model.constructiveSolutions =
      createEmptyConstructiveSolutions();

    useModelStore.setState({
      model,
      past: [],
      future: []
    });

    render(
      <ConstructiveScenariosWorkspaceDialog
        open
        onClose={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            'Nuevo escenario'
        }
      )
    );

    fireEvent.change(
      screen.getByRole(
        'textbox',
        {
          name:
            'Nombre del escenario'
        }
      ),
      {
        target: {
          value:
            'Scope all después de requirements'
        }
      }
    );

    const requirementsScope =
      screen.getByRole(
        'radio',
        {
          name:
            'Requirements seleccionados'
        }
      );

    const allScope =
      screen.getByRole(
        'radio',
        {
          name:
            'Todo el alcance'
        }
      );

    const createButton =
      screen.getByRole(
        'button',
        {
          name:
            'Crear escenario'
        }
      );

    fireEvent.click(
      requirementsScope
    );

    const selected =
      document.querySelector(
        `input[type="checkbox"][value="${SELECTED_REQUIREMENT}"]`
      );

    assert.ok(
      selected,
      'Debe existir el requirement lateral 21de8089.'
    );

    fireEvent.click(
      selected
    );

    assert.equal(
      createButton.disabled,
      false
    );

    fireEvent.click(
      allScope
    );

    assert.equal(
      allScope.checked,
      true
    );

    assert.equal(
      createButton.disabled,
      false
    );

    fireEvent.click(
      createButton
    );

    const scenario =
      useModelStore
        .getState()
        .model
        .constructiveSolutions
        .scenarios[0];

    assert.deepEqual(
      scenario.scope,
      {
        mode:
          'all'
      }
    );

    assert.equal(
      Object.hasOwn(
        scenario.scope,
        'requirementIds'
      ),
      false
    );
  }
);


test(
  'BUG-016-A-020 UI visual: requirement usa contexto humano de interfaz y referencia técnica subordinada',
  () => {
    /*
     * FX-008 fixture:
     *
     * Este requirement de apoyo corresponde a una relación declarada
     * que llega al muro C / 6→7 por una cara física canónica.
     *
     * La persona debe poder distinguirlo por la presentación humana
     * de la interfaz/borde, no por el hash de la relación.
     */
    const REQUIREMENT =
      'sr-requirement:sha256:a78e8cc91e398a961d874229b1da38816a957c70bb71a743e23984a8b100411a';

    const model =
      structuredClone(
        ungeneratedModel
      );

    model.constructiveSolutions =
      createEmptyConstructiveSolutions();

    useModelStore.setState({
      model,
      past: [],
      future: []
    });

    render(
      <ConstructiveScenariosWorkspaceDialog
        open
        onClose={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            'Nuevo escenario'
        }
      )
    );

    fireEvent.change(
      screen.getByRole(
        'textbox',
        {
          name:
            'Nombre del escenario'
        }
      ),
      {
        target: {
          value:
            'Validación visual humana'
        }
      }
    );

    fireEvent.click(
      screen.getByRole(
        'radio',
        {
          name:
            'Requirements seleccionados'
        }
      )
    );

    const checkbox =
      document.querySelector(
        `input[type="checkbox"][value="${REQUIREMENT}"]`
      );

    assert.ok(
      checkbox,
      'Debe existir el requirement a78e8cc9.'
    );

    const card =
      checkbox.closest(
        'label'
      );

    assert.ok(
      card,
      'El checkbox debe pertenecer a una tarjeta humana.'
    );

    const cardText =
      card.textContent;

    /*
     * El contexto humano de la interacción debe sustituir al hash
     * como mecanismo principal para distinguir requirements.
     */
    assert.match(
      cardText,
      /Cara \+N/
    );

    assert.match(
      cardText,
      /\bB\d+\b/
    );

    /*
     * La identidad técnica sigue disponible, pero subordinada
     * a un token corto.
     */
    assert.match(
      cardText,
      /Req\s*·\s*a78e8cc9/
    );

    assert.doesNotMatch(
      cardText,
      /sr-requirement:sha256:/
    );

    /*
     * El destino principal debe ser compacto.
     * Dimensiones constructivas e ID geométrico no son necesarias
     * para decidir el scope del requirement.
     */
    assert.match(
      cardText,
      /Muro X\s*·\s*6→7 @ C/
    );

    assert.doesNotMatch(
      cardText,
      /e 101,1/
    );

    assert.doesNotMatch(
      cardText,
      /h 900/
    );

    assert.doesNotMatch(
      cardText,
      /0 vanos/
    );

    assert.doesNotMatch(
      cardText,
      /ID 1784819708086/
    );

    /*
     * La mejora es exclusivamente de presentación:
     * el value contractual del checkbox continúa siendo el ID
     * canónico completo.
     */
    assert.equal(
      checkbox.value,
      REQUIREMENT
    );
  }
);
