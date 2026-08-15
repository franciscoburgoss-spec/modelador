import test, {
  after,
  afterEach,
  before,
  beforeEach
} from 'node:test';

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let cleanup;
let fireEvent;
let render;
let screen;
let MenuBar;
let useModelStore;
let dom;

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
    'HTMLAnchorElement',
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
  useModelStore.setState({
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
    default:
      MenuBar
  } =
    await import(
      '../src/components/MenuBar.jsx'
    ));

  ({
    useModelStore
  } =
    await import(
      '../src/store/useModelStore.js'
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
  'BUG-016-A-020 RED: Estructura conserva sus herramientas y no contiene Escenarios',
  () => {
    render(
      <MenuBar
        onOpenModal={() => {}}
        canvasSize={{
          width: 800,
          height: 600
        }}
      />
    );

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name: /^Estructura/
        }
      )
    );

    assert.ok(
      screen.getByRole(
        'button',
        {
          name:
            'Intención estructural…'
        }
      )
    );

    assert.ok(
      screen.getByRole(
        'button',
        {
          name:
            'Propuestas y caminos candidatos…'
        }
      )
    );

    assert.ok(
      screen.getByRole(
        'button',
        {
          name:
            'Topología estructural…'
        }
      )
    );

    assert.equal(
      screen.queryByRole(
        'button',
        {
          name:
            'Escenarios…'
        }
      ),
      null
    );
  }
);

test(
  'BUG-016-A-020 RED: Soluciones constructivas es menú raíz independiente y abre Escenarios',
  () => {
    const opened = [];

    render(
      <MenuBar
        onOpenModal={
          (modal) =>
            opened.push(modal)
        }
        canvasSize={{
          width: 800,
          height: 600
        }}
      />
    );

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            /^Soluciones constructivas/
        }
      )
    );

    const scenarios =
      screen.getByRole(
        'button',
        {
          name:
            'Escenarios…'
        }
      );

    fireEvent.click(
      scenarios
    );

    assert.deepEqual(
      opened,
      [
        'constructiveScenarios'
      ]
    );
  }
);
