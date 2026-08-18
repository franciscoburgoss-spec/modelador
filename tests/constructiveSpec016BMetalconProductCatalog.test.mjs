import assert from 'node:assert/strict';
import test from 'node:test';

import {
  METALCON_PRODUCT_MATERIALS,
  METALCON_PRODUCT_PANELS,
  METALCON_PRODUCT_PROFILES
} from '../src/core/metalconProductCatalog.js';

import {
  METALCON_LIBRARY_MANIFEST,
  METALCON_LIBRARY_SHA256,
  buildMetalconLibraryContext,
  buildMetalconLibraryRef
} from '../src/core/metalconConstructiveLibrary.js';

const EXPECTED_PRODUCT_SHA256 =
  '6937c18a134c9bd4b228150f2336431723649e21f98fee9158ab9c7c1651e93d';

test(
  'SPEC-016-B B3.1b: catálogo productivo contiene exactamente los perfiles CINTAC aprobados',
  () => {
    assert.deepEqual(
      METALCON_PRODUCT_PROFILES,
      [
        {
          profileId:
            'metalcon-profile:cintac-90ca085',
          manufacturer: 'CINTAC',
          productFamily:
            'Metalcon Estructural',
          designation: '90CA085',
          sectionType: 'lipped-c',
          perforation: 'none',
          dimensionsMm: {
            web: 90,
            flange: 38,
            lip: 12,
            thickness: 0.85
          },
          nominalMassKgPerM: 1.23,
          source: {
            publisher: 'CINTAC S.A.',
            title: 'Manual de Diseño Metalcon',
            edition: 'Primera Edición',
            publicationDate: '2004-01',
            locator:
              'Serie de Perfiles — Metalcon Estructural C sin perforación'
          }
        },
        {
          profileId:
            'metalcon-profile:cintac-92c085',
          manufacturer: 'CINTAC',
          productFamily:
            'Metalcon Estructural',
          designation: '92C085',
          sectionType: 'u',
          dimensionsMm: {
            web: 92,
            flange: 30,
            thickness: 0.85
          },
          nominalMassKgPerM: 1,
          source: {
            publisher: 'CINTAC S.A.',
            title: 'Manual de Diseño Metalcon',
            edition: 'Primera Edición',
            publicationDate: '2004-01',
            locator:
              'Serie de Perfiles — Metalcon Estructural U'
          }
        }
      ]
    );
  }
);

test(
  'SPEC-016-B B3.1b: material y panel productivos coinciden exactamente con D-075',
  () => {
    assert.deepEqual(
      METALCON_PRODUCT_MATERIALS,
      [
        {
          materialId:
            'metalcon-material:cintac-metalcon-estructural-a653-sq-gr40-g90',
          manufacturer: 'CINTAC',
          productFamily:
            'Metalcon Estructural',
          specification:
            'ASTM A653 SQ Gr 40',
          coating: {
            designation: 'G90',
            nominalMassGPerM2: 275
          },
          source: {
            publisher: 'CINTAC S.A.',
            title: 'Manual de Diseño Metalcon',
            edition: 'Primera Edición',
            publicationDate: '2004-01',
            locator:
              'Ficha Técnica Metalcon Estructural'
          }
        }
      ]
    );

    assert.deepEqual(
      METALCON_PRODUCT_PANELS,
      [
        {
          panelId:
            'metalcon-panel:lp-osb-apa-protec-11_1-1220x2440',
          manufacturer:
            'LP Building Solutions / LP Chile',
          productName:
            'LP OSB APA Protec',
          panelType: 'structural-osb',
          dimensionsMm: {
            thickness: 11.1,
            width: 1220,
            length: 2440
          },
          source: {
            publisher: 'LP Chile',
            title: 'LP OSB APA Protec',
            sourceType:
              'official-product-page',
            reviewedAt: '2026-08-17'
          }
        }
      ]
    );
  }
);

test(
  'SPEC-016-B B3.1b: manifest canónico integra sólo 2+1+1 productos y conserva registros posteriores vacíos',
  () => {
    assert.deepEqual(
      METALCON_LIBRARY_MANIFEST.profiles,
      METALCON_PRODUCT_PROFILES
    );
    assert.deepEqual(
      METALCON_LIBRARY_MANIFEST.materials,
      METALCON_PRODUCT_MATERIALS
    );
    assert.deepEqual(
      METALCON_LIBRARY_MANIFEST.panels,
      METALCON_PRODUCT_PANELS
    );

    assert.deepEqual(
      METALCON_LIBRARY_MANIFEST.componentTypes,
      []
    );
    assert.deepEqual(
      METALCON_LIBRARY_MANIFEST.wallAssemblies,
      []
    );
    assert.deepEqual(
      METALCON_LIBRARY_MANIFEST.components,
      []
    );
    assert.deepEqual(
      METALCON_LIBRARY_MANIFEST.connections,
      []
    );

    assert.equal(
      METALCON_LIBRARY_MANIFEST.libraryVersion,
      '1.0.0'
    );
    assert.equal(
      METALCON_LIBRARY_SHA256,
      EXPECTED_PRODUCT_SHA256
    );
  }
);

test(
  'SPEC-016-B B3.1b: libraryRef y adapterPayload transportan exactamente el catálogo productivo',
  () => {
    const libraryRef =
      buildMetalconLibraryRef(
        METALCON_LIBRARY_MANIFEST
      );

    assert.equal(
      libraryRef.sha256,
      EXPECTED_PRODUCT_SHA256
    );

    const context =
      buildMetalconLibraryContext(
        METALCON_LIBRARY_MANIFEST,
        libraryRef
      );

    assert.deepEqual(
      context.adapterPayload.profiles,
      METALCON_PRODUCT_PROFILES
    );
    assert.deepEqual(
      context.adapterPayload.materials,
      METALCON_PRODUCT_MATERIALS
    );
    assert.deepEqual(
      context.adapterPayload.panels,
      METALCON_PRODUCT_PANELS
    );
    assert.deepEqual(
      context.adapterPayload.wallAssemblies,
      []
    );
    assert.deepEqual(
      context.adapterPayload.components,
      []
    );
    assert.deepEqual(
      context.adapterPayload.connections,
      []
    );
  }
);
