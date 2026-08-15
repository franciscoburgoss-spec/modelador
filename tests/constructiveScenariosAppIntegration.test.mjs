import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const APP_PATH =
  new URL('../src/App.jsx', import.meta.url);

test(
  'SPEC-016-A UI: App compone el workspace constructivo como modal independiente',
  async () => {
    const source =
      await readFile(
        APP_PATH,
        'utf8'
      );

    assert.match(
      source,
      /import ConstructiveScenariosWorkspaceDialog from '\.\/components\/modals\/ConstructiveScenariosWorkspaceDialog\.jsx';/
    );

    assert.match(
      source,
      /<ConstructiveScenariosWorkspaceDialog[\s\S]*?open=\{activeModal === 'constructiveScenarios'\}[\s\S]*?onClose=\{\(\) => setActiveModal\(null\)\}[\s\S]*?\/>/
    );
  }
);

test(
  'BUG-016-A-020: integración constructiva no sustituye ni reubica workspaces SPEC-015',
  async () => {
    const source =
      await readFile(
        APP_PATH,
        'utf8'
      );

    assert.match(
      source,
      /<StructuralIntentWorkspaceDialog[\s\S]*?activeModal === 'structuralIntent'/
    );

    assert.match(
      source,
      /<StructuralProposalWorkspaceDialog[\s\S]*?activeModal === 'structuralProposals'/
    );

    assert.doesNotMatch(
      source,
      /ConstructiveScenariosWorkspaceDialog[\s\S]{0,500}(MetalconModulationModal|OsbModulationModal|OsbNestingModal)/
    );
  }
);
