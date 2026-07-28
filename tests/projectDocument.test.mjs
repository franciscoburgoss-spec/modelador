import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProjectDocument,
  hydrateProjectDocumentRecents,
  markProjectDocumentDirty,
  openProjectDocument,
  resetProjectDocument,
  saveProjectDocument,
  titleFromProjectPath
} from '../src/core/projectDocument.js';

test('SPEC-004-B: sesión nueva y títulos son puros para rutas POSIX y Windows', () => {
  const document = createProjectDocument();
  assert.deepEqual(document, {
    path: null,
    title: 'Sin título',
    dirty: false,
    recentPaths: []
  });
  assert.equal(titleFromProjectPath('/proyectos/Casa L.modelador.json'), 'Casa L.modelador.json');
  assert.equal(titleFromProjectPath('C:\\Proyectos\\Casa Norte.json'), 'Casa Norte.json');
  assert.throws(() => titleFromProjectPath(''), /ruta/i);
});

test('SPEC-004-B: recientes son únicos, opacos, más nuevos primero y se limitan a diez', () => {
  let document = createProjectDocument({
    recentPaths: [
      '/p/03.modelador.json',
      '',
      '/p/03.modelador.json',
      null,
      '/p/02.modelador.json'
    ]
  });
  assert.deepEqual(document.recentPaths, [
    '/p/03.modelador.json',
    '/p/02.modelador.json'
  ]);

  for (let index = 1; index <= 12; index += 1) {
    document = openProjectDocument(document, `/p/${String(index).padStart(2, '0')}.json`);
  }
  assert.deepEqual(document.recentPaths, [
    '/p/12.json',
    '/p/11.json',
    '/p/10.json',
    '/p/09.json',
    '/p/08.json',
    '/p/07.json',
    '/p/06.json',
    '/p/05.json',
    '/p/04.json',
    '/p/03.json'
  ]);
});

test('SPEC-004-B: dirty, open, save y reset conservan sus invariantes', () => {
  const initial = createProjectDocument({
    recentPaths: ['/p/anterior.json']
  });
  const dirty = markProjectDocumentDirty(initial);
  assert.equal(dirty.dirty, true);
  assert.equal(markProjectDocumentDirty(dirty), dirty);

  const opened = openProjectDocument(dirty, '/p/casa.json');
  assert.deepEqual(opened, {
    path: '/p/casa.json',
    title: 'casa.json',
    dirty: false,
    recentPaths: ['/p/casa.json', '/p/anterior.json']
  });

  assert.deepEqual(saveProjectDocument(markProjectDocumentDirty(opened), '/p/copia.json'), {
    path: '/p/copia.json',
    title: 'copia.json',
    dirty: false,
    recentPaths: ['/p/copia.json', '/p/casa.json', '/p/anterior.json']
  });
  assert.deepEqual(resetProjectDocument(opened), {
    path: null,
    title: 'Sin título',
    dirty: false,
    recentPaths: ['/p/casa.json', '/p/anterior.json']
  });
});

test('SPEC-004-C: hidratar recientes conserva identidad y estado sucio del documento', () => {
  const document = createProjectDocument({
    path: '/p/activo.modelador.json',
    dirty: true,
    recentPaths: ['/p/anterior.modelador.json']
  });

  assert.deepEqual(
    hydrateProjectDocumentRecents(document, [
      '/p/recuperado.modelador.json',
      '/p/recuperado.modelador.json',
      '',
      null
    ]),
    {
      path: '/p/activo.modelador.json',
      title: 'activo.modelador.json',
      dirty: true,
      recentPaths: ['/p/recuperado.modelador.json']
    }
  );
});
