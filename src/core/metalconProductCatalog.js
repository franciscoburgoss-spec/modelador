export const METALCON_PRODUCT_PROFILES =
  Object.freeze([
    Object.freeze({
      profileId:
        'metalcon-profile:cintac-90ca085',
      manufacturer: 'CINTAC',
      productFamily:
        'Metalcon Estructural',
      designation: '90CA085',
      sectionType: 'lipped-c',
      perforation: 'none',
      dimensionsMm: Object.freeze({
        web: 90,
        flange: 38,
        lip: 12,
        thickness: 0.85
      }),
      nominalMassKgPerM: 1.23,
      source: Object.freeze({
        publisher: 'CINTAC S.A.',
        title: 'Manual de Diseño Metalcon',
        edition: 'Primera Edición',
        publicationDate: '2004-01',
        locator: 'Serie de Perfiles — Metalcon Estructural C sin perforación'
      })
    }),
    Object.freeze({
      profileId:
        'metalcon-profile:cintac-92c085',
      manufacturer: 'CINTAC',
      productFamily:
        'Metalcon Estructural',
      designation: '92C085',
      sectionType: 'u',
      dimensionsMm: Object.freeze({
        web: 92,
        flange: 30,
        thickness: 0.85
      }),
      nominalMassKgPerM: 1.00,
      source: Object.freeze({
        publisher: 'CINTAC S.A.',
        title: 'Manual de Diseño Metalcon',
        edition: 'Primera Edición',
        publicationDate: '2004-01',
        locator: 'Serie de Perfiles — Metalcon Estructural U'
      })
    })
  ]);

export const METALCON_PRODUCT_MATERIALS =
  Object.freeze([
    Object.freeze({
      materialId:
        'metalcon-material:cintac-metalcon-estructural-a653-sq-gr40-g90',
      manufacturer: 'CINTAC',
      productFamily:
        'Metalcon Estructural',
      specification:
        'ASTM A653 SQ Gr 40',
      coating: Object.freeze({
        designation: 'G90',
        nominalMassGPerM2: 275
      }),
      source: Object.freeze({
        publisher: 'CINTAC S.A.',
        title: 'Manual de Diseño Metalcon',
        edition: 'Primera Edición',
        publicationDate: '2004-01',
        locator: 'Ficha Técnica Metalcon Estructural'
      })
    })
  ]);

export const METALCON_PRODUCT_PANELS =
  Object.freeze([
    Object.freeze({
      panelId:
        'metalcon-panel:lp-osb-apa-protec-11_1-1220x2440',
      manufacturer:
        'LP Building Solutions / LP Chile',
      productName:
        'LP OSB APA Protec',
      panelType: 'structural-osb',
      dimensionsMm: Object.freeze({
        thickness: 11.1,
        width: 1220,
        length: 2440
      }),
      source: Object.freeze({
        publisher: 'LP Chile',
        title: 'LP OSB APA Protec',
        sourceType:
          'official-product-page',
        reviewedAt: '2026-08-17'
      })
    })
  ]);
