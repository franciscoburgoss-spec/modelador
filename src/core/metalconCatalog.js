// core/metalconCatalog.js
// Catálogo de perfiles METALCON® ESTRUCTURAL (CINTAC, Manual de Diseño 2020).
// Fuente: Cap. 2 "Serie de Perfiles" (dimensiones) + Cap. 3 "Propiedades de las secciones"
// (área A, inercias Ix/Iy). Unidades tal cual el manual: H/B/C/D/e en [mm], peso en [kg/m],
// A en [cm2], Ix/Iy en [cm4]. La conversión a mm para cálculo (CalculiX, etc.) se hace en el
// consumidor, no aquí — este módulo es solo el catálogo de datos.
//
// shape: 'C' (canal atiesada, con o sin perforación — pie derecho / montante),
//        'U' (canal normal — solera),
//        'OMA' (omega, costanera de techumbre/envigado),
//        'L' (ángulo estabilizador).
// perforated: true si tiene perforación de paso de instalaciones (serie "p").

export const METALCON_PROFILES = [
  // ── C con perforación (montante estándar para muros con paso de instalaciones) ──
  { code: '90CA085p',  catalogDesignation: 'C 2x4x0,85 p', shape: 'C', perforated: true,
    H: 90, B: 38, C: 12, e: 0.85, weightKgM: 1.23, areaCm2: 1.28, ixCm4: 19.9, iyCm4: 2.76,
    lengthsM: [2.5, 3.0, 6.0] },
  { code: '90CA10p',   catalogDesignation: 'C 2x4x1,0 p',  shape: 'C', perforated: true,
    H: 90, B: 38, C: 12, e: 1.0,  weightKgM: 1.44, areaCm2: 1.49, ixCm4: 23.2, iyCm4: 3.19,
    lengthsM: [2.5, 6.0] },
  { code: '100CA085p', catalogDesignation: 'C 2x5x0,85 p', shape: 'C', perforated: true,
    H: 100, B: 40, C: 12, e: 0.85, weightKgM: 1.32, areaCm2: 1.40, ixCm4: 26.3, iyCm4: 3.31,
    lengthsM: [2.5, 6.0] },

  // ── C sin perforación ──
  { code: '40CA085',  catalogDesignation: 'C 2x2x0,85', shape: 'C', perforated: false,
    H: 40, B: 40, C: 6, e: 0.85, weightKgM: 0.83, areaCm2: 1.07, ixCm4: 3.10, iyCm4: 2.12,
    lengthsM: [4.0, 6.0] },
  { code: '60CA085',  catalogDesignation: 'C 2x3x0,85', shape: 'C', perforated: false,
    H: 60, B: 38, C: 6, e: 0.85, weightKgM: 0.96, areaCm2: 1.21, ixCm4: 7.51, iyCm4: 2.24,
    lengthsM: [2.4, 6.0] },
  { code: '90CA085',  catalogDesignation: 'C 2x4x0,85', shape: 'C', perforated: false,
    H: 90, B: 38, C: 12, e: 0.85, weightKgM: 1.23, areaCm2: 1.57, ixCm4: 20.2, iyCm4: 3.26,
    lengthsM: [4.0, 6.0, 7.1] },
  { code: '90CA10',   catalogDesignation: 'C 2x4x1,0', shape: 'C', perforated: false,
    H: 90, B: 38, C: 12, e: 1.0, weightKgM: 1.44, areaCm2: 1.83, ixCm4: 23.5, iyCm4: 3.78,
    lengthsM: [4.0, 7.1] },
  { code: '100CA085', catalogDesignation: 'C 2x5x0,85', shape: 'C', perforated: false,
    H: 100, B: 40, C: 12, e: 0.85, weightKgM: 1.32, areaCm2: 1.69, ixCm4: 26.6, iyCm4: 3.81,
    lengthsM: [6.0] },
  { code: '150CA085', catalogDesignation: 'C 2x6x0,85', shape: 'C', perforated: false,
    H: 150, B: 40, C: 12, e: 0.85, weightKgM: 1.64, areaCm2: 2.11, ixCm4: 68.8, iyCm4: 4.31,
    lengthsM: [4.0, 6.0] },
  { code: '150CA10',  catalogDesignation: 'C 2x6x1,0', shape: 'C', perforated: false,
    H: 150, B: 40, C: 12, e: 1.0, weightKgM: 1.94, areaCm2: 2.47, ixCm4: 80.3, iyCm4: 4.99,
    lengthsM: [4.0, 6.0] },
  { code: '150CA16',  catalogDesignation: 'C 2x6x1,6', shape: 'C', perforated: false,
    H: 150, B: 40, C: 12, e: 1.6, weightKgM: 3.06, areaCm2: 3.90, ixCm4: 124, iyCm4: 7.50,
    lengthsM: [4.0, 6.0] },
  { code: '200CA16',  catalogDesignation: 'C 2x8x1,6', shape: 'C', perforated: false,
    H: 200, B: 40, C: 12, e: 1.6, weightKgM: 3.67, areaCm2: 4.70, ixCm4: 250, iyCm4: 8.07,
    lengthsM: [6.0] },
  { code: '250CA16',  catalogDesignation: 'C 2x10x1,6', shape: 'C', perforated: false,
    H: 250, B: 50, C: 15, e: 1.6, weightKgM: 4.64, areaCm2: 5.91, ixCm4: 495, iyCm4: 16.3,
    lengthsM: [6.0] },

  // ── U (solera) ──
  { code: '42C085',  catalogDesignation: 'U 2x2x0,85', shape: 'U',
    H: 42, B: 25, e: 0.85, weightKgM: 0.58, areaCm2: 0.76, ixCm4: 2.22, iyCm4: 0.49,
    lengthsM: [3.0, 6.0] },
  { code: '62C085',  catalogDesignation: 'U 2x3x0,85', shape: 'U',
    H: 62, B: 25, e: 0.85, weightKgM: 0.72, areaCm2: 0.93, ixCm4: 5.43, iyCm4: 0.56,
    lengthsM: [3.0, 6.0] },
  { code: '92C085',  catalogDesignation: 'U 2x4x0,85', shape: 'U',
    H: 92, B: 30, e: 0.85, weightKgM: 1.00, areaCm2: 1.27, ixCm4: 15.6, iyCm4: 1.03,
    lengthsM: [3.0, 6.0] },
  { code: '92C10',   catalogDesignation: 'U 2x4x1,0', shape: 'U',
    H: 92, B: 30, e: 1.0, weightKgM: 1.17, areaCm2: 1.49, ixCm4: 18.2, iyCm4: 1.20,
    lengthsM: [6.0] },
  { code: '103C085', catalogDesignation: 'U 2x5x0,85', shape: 'U',
    H: 103, B: 30, e: 0.85, weightKgM: 1.06, areaCm2: 1.36, ixCm4: 20.4, iyCm4: 1.06,
    lengthsM: [6.0] },
  { code: '103C10',  catalogDesignation: 'U 2x5x1,0', shape: 'U',
    H: 103, B: 30, e: 1.0, weightKgM: 1.25, areaCm2: 1.60, ixCm4: 23.9, iyCm4: 1.24,
    lengthsM: [6.0] },
  { code: '153C10',  catalogDesignation: 'U 2x6x1,0', shape: 'U',
    H: 153, B: 30, e: 1.0, weightKgM: 1.65, areaCm2: 2.10, ixCm4: 62.6, iyCm4: 1.35,
    lengthsM: [6.0] },
  { code: '203C10',  catalogDesignation: 'U 2x8x1,0', shape: 'U',
    H: 203, B: 30, e: 1.0, weightKgM: 2.04, areaCm2: 2.60, ixCm4: 128, iyCm4: 1.42,
    lengthsM: [6.0] },
  { code: '253C10',  catalogDesignation: 'U 2x10x1,0', shape: 'U',
    H: 253, B: 30, e: 1.0, weightKgM: 2.41, areaCm2: 3.10, ixCm4: 225, iyCm4: 1.47,
    lengthsM: [6.0] },

  // ── OMA (costanera omega, techumbre/envigado) ──
  { code: '35OMA05',  catalogDesignation: 'OMA 0,5', shape: 'OMA',
    H: 35, B: 38, C: 15, D: 8, e: 0.5, weightKgM: 0.60, areaCm2: 0.76, ixCm4: 1.46, iyCm4: 5.41,
    lengthsM: [6.0], steelGrade: 'ASTM A653 SQ Gr37' },
  { code: '35OMA085', catalogDesignation: 'OMA 0,85', shape: 'OMA',
    H: 35, B: 38, C: 15, D: 8, e: 0.85, weightKgM: 1.00, areaCm2: 1.27, ixCm4: 2.10, iyCm4: 8.79,
    lengthsM: [6.0] },

  // ── L (ángulo estabilizador) ──
  { code: '33A085', catalogDesignation: 'L33x0,85', shape: 'L',
    H: 33, B: 33, e: 0.85, weightKgM: 0.46, lengthsM: [6.0] },
];

export function findMetalconProfile(code) {
  return METALCON_PROFILES.find(p => p.code === code) || null;
}

export function metalconProfilesByShape(shape) {
  return METALCON_PROFILES.filter(p => p.shape === shape);
}
