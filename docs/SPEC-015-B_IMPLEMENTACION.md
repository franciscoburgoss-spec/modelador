# SPEC-015-B — Implementación validada localmente

**Estado:** implementación completa y validada en el Mac el 05-ago-2026.

## 1. Diagnóstico de entrada

- El ZIP contiene 560 entradas y no incluye `.git`, `node_modules`, `target`, `dist` ni artefactos pesados.
- `specs/SPEC-015-B-intencion-techumbre-y-bordes-canonicos.md` ya estaba activa con fecha 2026-08-05.
- `governance/STATUS.md` todavía declaraba SPEC-015-A cerrada y SPEC-015-B pendiente.
- `make governance` inicial pasó con 22 archivos requeridos, 43 requisitos y 55 decisiones.
- Al no existir `.git` dentro del ZIP, el corte no puede verificar el SHA del HEAD ni demostrar qué archivos estaban modificados antes de comprimir. El parche se construye y verifica contra los bytes exactos del ZIP recibido.
- La redacción propuesta en el contexto para `Esfuerzo activo` no era compatible con el validador real: G0 exige dos valores entre backticks, planificado y efectivo. Se registró `high`/`high`; la prohibición de `xhigh` permanece en la SPEC.

## 2. Arquitectura implementada

### 2.1 Proyección selectiva de cubierta

`projectAgnosticRoofGeometry(model, requestedRoofGeometryIds)` usa la misma autoridad y los mismos
proyectores de `agnostic-geometry-v1.0`, pero sólo resuelve las cubiertas solicitadas. Esto permite
que el esquema nativo exija resolubilidad a las cubiertas con intención sin convertir todas las
cubiertas editables en requisito de importación.

### 2.2 Bordes canónicos

`src/core/roofStructuralIntent.js` implementa:

- `surface.kind=planar-polygon` obligatorio;
- coordenadas finitas, redondeadas a 3 decimales y sin `-0`;
- eliminación de cierre final 3D duplicado;
- segmentos consecutivos y cierre;
- longitud en planta estrictamente mayor que 0,1 mm;
- extremos ordenados por X/Y;
- identidad independiente de Z;
- payload `roof-boundary-v1|roof=<id tipado>|a=<x,y>|b=<x,y>`;
- SHA-256 completo en minúsculas;
- rechazo de bordes duplicados dentro de la misma cubierta;
- salida determinista con `length3d`, `planDirection` y `zRange`.

### 2.3 Direcciones resistentes

Las direcciones se normalizan como ejes no orientados:

- `v` y `-v` producen el mismo objeto;
- magnitud positiva y componentes finitos;
- primer componente no nulo positivo;
- redondeo a 6 decimales;
- `twoWay` ordenado lexicográficamente;
- rechazo de paralelismo o antiparalelismo dentro de 0,001°;
- `local` y `undetermined` sin dirección global.

### 2.4 `roofIntents[]`

Se activa la colección existente en `structural-intent-v1.0`, manteniendo `modelVersion: 3`.

Las APIs puras son:

```text
setRoofIntent(model, roofGeometryId, intent)
removeRoofIntent(model, roofGeometryId)
clearStructuralIntent(model)
```

Cada resultado incluye:

```text
affectedElementIds
affectedRoofGeometryIds
invalidatedStructuralDerivatives
```

El último arreglo permanece vacío. La implementación no escribe flags `stale`, perfiles,
modulación, OSB, cerchas ni otras soluciones constructivas.

### 2.5 Validación y persistencia

`modelSchema.js`:

- conserva versión 3 y la migración `2→3` sin inferencia;
- proyecta sólo IDs de cubierta referenciados por intención o findings;
- valida pertenencia y unicidad de cada `boundaryId`;
- canonicaliza `roofIntents[]` al reabrir;
- valida findings persistentes de cambio geométrico.

### 2.6 Reconciliación e historial

`withHistory` reconcilia el modelo candidato antes de crear la entrada de historial. Por ello una
mutación de parámetros, ejes, niveles, muros o cubiertas y sus cambios de intención quedan en una
sola operación atómica.

Reglas implementadas:

- agregar cubierta no crea intención;
- eliminar cubierta retira intención y findings asociados;
- una cubierta con intención debe seguir resoluble;
- IDs persistentes conservan la intención sin cambios;
- bordes declarados desaparecidos se eliminan sin reasignación;
- se crea `SI-ROOF-BOUNDARY-REVIEW-AFTER-GEOMETRY-CHANGE` con las declaraciones retiradas;
- cambios constructivos que no cambian `roofGeometry` no modifican intención ni findings;
- undo/redo restaura conjuntamente geometría, intención y findings.

## 3. Caso real FX-008

El fixture `tests/fixtures/casa-L-completa-v3.json` conserva:

```text
45 muros
43 vanos
32 fundaciones
7 cubiertas
```

La evidencia representa las cubiertas:

```text
1785030887081
1785161146258
1785161396221
1785161662029
```

Incluye geometría real, borde canónico declarado, dirección cuando existe, función del borde,
estado declarado y casos `local`/`undetermined`. Los muros no se clasifican automáticamente.

La geometría agnóstica antes y después de declarar intención conserva:

```text
81.875 bytes
SHA-256 966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a
```

## 4. Pruebas añadidas

- `tests/roofStructuralIntent.test.mjs`
- `tests/roofStructuralIntentIntegration.test.mjs`
- `tests/roofStructuralIntentStore.test.mjs`
- `tests/spec015bEvidence.test.mjs`

Cubren el corpus obligatorio: siete cubiertas, inversión, rotación, cambio Z, degeneración,
duplicación, pertenencia, direcciones, persistencia v3, eliminación, irresolubilidad, finding,
cambio constructivo, byte identity, prohibición de reasignación, undo/redo, IDs mixtos e
importación sin inferencia.

## 5. Evidencia reproducible

`npm run evidence:spec015b` genera:

- `evidence/spec-015-b/FX-008-roof-intent.json`
- `evidence/spec-015-b/FX-008-roof-intent.svg`
- `evidence/spec-015-b/MANIFEST.json`

`tests/spec015bEvidence.test.mjs` vuelve a generar los tres contenidos en memoria y exige igualdad
byte a byte con los archivos versionados.

## 6. Validación ejecutada en el entorno web

### VALIDADO EN WEB

- `make governance` inicial: PASS, 22 archivos/43 requisitos/55 decisiones.
- `make governance` final: PASS, 22 archivos/44 requisitos/56 decisiones.
- Pruebas enfocadas finales: PASS, 18/18.
- Suite Node ampliada: PASS, 866/866, excluyendo sólo los dos archivos que requieren paquetes
  ausentes del ZIP (`@tauri-apps/api` y `jsdom`).
- Cobertura con el mismo conjunto ejecutable: core 93,34 % de líneas (umbral 90 %) y store
  95,77 % (umbral 85 %).
- Laboratorio de techumbre: PASS, 35/35.
- Evidencia FX-008 reproducible y byte identity: PASS.
- Goldens semánticos: PASS, 19 artefactos.
- Manifiesto de migración: PASS, 187 archivos y 57 cambios posteriores registrados. El cambio de
  `src/store/useModelStore.js` quedó asociado a la serie `SPEC-015`, que es el identificador
  aceptado por el validador heredado para los cortes 015-A/015-B.
- Contrato de derivados: PASS, 14 exportadores y 14 mutadores.
- Auditoría Codex histórica: PASS, 11 ejecuciones completas, 2 fallidas recuperadas y 0 no
  recuperadas.
- Comprobación sintáctica de todos los módulos modificados: PASS.

### PREPARADO PERO NO EJECUTADO COMPLETAMENTE EN WEB

`npm ci` no pudo descargar `zustand@4.5.7` porque el registro interno respondió HTTP 404. Para
probar exclusivamente el store se usó un stub temporal mínimo de Zustand; fue eliminado antes de
crear el parche y no integra ningún entregable.

Por la ausencia de dependencias reales no se ejecutaron ESLint, componentes React ni build Vite.
Las dos pruebas Node no ejecutables en web son:

- `tests/tauriProjectRuntime.test.mjs`: requiere `@tauri-apps/api`;
- `tests/webviewCompatibility.test.mjs`: requiere `jsdom`.

Rust y `tauri:check` sí se intentaron y terminaron con `cargo: not found`. Las auditorías de
artefactos, DXF y CalculiX también se intentaron, pero sus scripts requieren un repositorio Git y
el ZIP recibido no contiene `.git`. Estos resultados son limitaciones verificadas del entorno, no
gates aprobados ni defectos atribuidos a SPEC-015-B.

### VALIDADO LOCALMENTE EN EL MAC

La ejecución autoritativa terminó el 05-ago-2026 con:

```text
RESULTADO: PASS
GATES_APROBADOS: 24
DIRECTORIO_DE_LOGS: artifacts/validation-spec-015-b/20260805-170823
AUTORIDAD: validación local ejecutada en este Mac
```

El entorno confirmado usó Node 22.23.2 y npm 10.9.9. Los 24 gates incluyeron preflight de Git,
Node/npm y dependencias; gobernanza; evidencia reproducible; formato JS/Rust; ESLint; pruebas
SPEC-015-B, Node, componentes y Rust; Tauri; laboratorio; cobertura; goldens; DXF; CalculiX;
build; migración; inventario; derivados; auditoría Codex; byte identity y `git diff --check`.

### Incidente del validador y corrección

La primera ejecución falló correctamente al detectar Node 20.20.2. Después de activar Node 22, el
preflight seguía viendo Node 20 porque el script abría `bash -lc` y el shell de login reemplazaba el
`PATH` activo de nvm. Se corrigió exclusivamente el script de entrega para usar `bash -c`; el
validador corregido fue el que produjo el PASS autoritativo. El incidente no requirió cambios en el
repositorio ni afecta la implementación de SPEC-015-B.

No se ejecutó `git add`, commit ni push durante aplicación o validación.
