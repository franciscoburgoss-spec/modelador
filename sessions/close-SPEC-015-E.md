# Cierre — SPEC-015-E / requisitos estructurales agnósticos R6–R12

> Documento inmutable después de publicar el commit.

## Identidad

| Campo | Valor |
| --- | --- |
| Fecha | 11-ago-2026 |
| Commit base | `6d371bd` (`6d371bd5062de3f8a647bfce0631d722b63f8f26`) |
| Rama | `main` |
| Spec | `SPEC-015-E` |
| Toolchain confirmado | Node 22.23.2; npm 10.9.9; Rust/Cargo, Tauri, Python/ezdxf y CalculiX ejercitados por la puerta local |
| Autoridad de caso real | FX-008 / casa-L |
| Geometría agnóstica | 45 muros, 43 vanos, 32 fundaciones y 7 cubiertas |
| Estado de salida | derivado, recalculable y `notVerified` |

## Alcance ejecutado

SPEC-015-E incorpora el núcleo puro que deriva requisitos estructurales R6–R12 a partir de R0–R5,
intención estructural explícita, interfaces, relaciones, propuestas revisadas y caminos de carga
candidatos.

El resultado usa el esquema `structural-requirements-v1.0`, permanece separado de cualquier solución
constructiva y no se persiste silenciosamente dentro del modelo fuente.

Toda salida estructural derivada conserva `notVerified`. Los caminos candidatos son evidencia y nunca
se convierten por sí mismos en verificación, dimensionamiento ni solución constructiva.

La implementación se desarrolló en B1, B2, B3, B3.1, B3.2 y B3.2.1 sobre el caso real FX-008.

## Contratos principales cerrados

- R6–R12 se derivan sin mutar R0–R5.
- Una relación local no promueve una función estructural a todo el host.
- `supportedByFoundation` permanece evidencia candidata.
- Un gap lateral genera requisito explícito de transferencia, no verificación.
- Cero caminos laterales significa ausencia de declaración y nunca `notApplicable` automático.
- Relaciones `stale` bloquean su ámbito y no habilitan fallback geométrico silencioso.
- `requirementRefs` son resolubles contra `requirements[]`.
- La misma entrada produce salida `deepEqual` y SHA idéntico.
- El núcleo no depende de UI ni de soluciones constructivas.
- La salida no se persiste silenciosamente en el modelo fuente.

## Corrección semántica B3.2

Se corrigió la interpretación de regiones de extremo en R11.

C/6 conserva una región física longitudinal:

`S 1.949,45 → 2.050,55 mm`, longitud física `101,1 mm`.

C/7 queda representado como localización de extremo:

- `kind = end`;
- `end = highS`;
- `anchorS = 2000 mm`;
- `localizationEnvelope = [1999.9, 2000]`.

La envolvente de `0,1 mm` es exclusivamente evidencia de localización/tolerancia y no longitud
física del receptor.

Las relaciones declaradas referencian `regionId` mediante `targetRegionRefs[]`; los solapes de
soporte candidato permanecen dentro de evidencia candidata.

## Evidencia FX-008

La evidencia final conserva:

- cuatro relaciones gravitacionales;
- cuatro caminos G1–G4 `completeCandidate`;
- todos los caminos `notVerified`;
- checkpoint lateral explícito con gap de `571,429 mm`;
- cero soluciones constructivas inferidas;
- cero promoción de evidencia candidata a autoridad estructural.

SHA-256 semántico final de evidencia:

`e30e71382c880101bc3c3f39efc9d4710646378e2b1a5fc28d4cc5823c1c3883`

La correctiva visual B3.2.1 conservó ese SHA semántico sin cambios.

SHA-256 visual SVG B3.2.1:

`2b3f54dae82fb24b01f0138bbff7c2a199c0884cd65fb6646a5db7a4a1ffce7a`

SHA-256 visual HTML B3.2.1:

`319a62961a59d79b7505d55ddba083716cddbc7a12f268de34a54c8ebf5228f8`

## Revisión visual humana

La evidencia HTML/SVG fue revisada sobre FX-008.

Quedaron aprobados:

- callouts sin invadir la geometría;
- foco mediante halo sin ocultar elementos;
- detalles ampliados C/6 y C/7 no a escala;
- descriptores humanos antes de IDs técnicos;
- G1–G4 inspeccionables;
- propagación de foco B1/C6/C7;
- C/7 presentado como extremo `highS` en S=2.000 mm;
- advertencia visible de que la envolvente de localización no es longitud física.

## Incidencias cerradas

- BUG-015-E-001: referencias de requisito sin colección raíz `requirements[]`.
- BUG-015-E-002: entrada huérfana en manifiesto.
- BUG-015-E-003: superposición de anotaciones en evidencia.
- BUG-015-E-004: foco ocultaba geometría.
- BUG-015-E-005: regiones parciales ilegibles a escala.
- BUG-015-E-006: IDs técnicos usados como nombre principal.
- BUG-015-E-007: caminos G1–G4 no inspeccionables.
- BUG-015-E-010: región `end` materializada incorrectamente como longitud física.
- BUG-015-E-011: forma de `supports[]` / `transfers[]` divergente del contrato.
- BUG-015-E-012: advertencia crítica de C/7 truncada.
- BUG-015-E-013: escapes innecesarios bloqueaban ESLint.
- BUG-015-E-014: `governance/STATUS.md` permanecía en Fase B abierta después del cierre integral;
  se corrigió antes del staging y quedó con spec/esfuerzo activos en `Ninguna` / `Ninguno`.
- BUG-015-E-015: la auditoría del staged detectó whitespace en tres archivos previamente untracked;
  se normalizó sin cambio semántico y `git diff --cached --check` quedó verde.

Hallazgo documentado:

- H-015-E-B3-001: la clausura REV8 del navegador no era una autoridad reproducible versionada;
  B3 separó `closureReference` de `reproducibleCheckpoint`.

## Validación focal final

Suite consolidada B2+B3+B3.1+B3.2+B3.2.1:

- 27 tests;
- 27 PASS;
- 0 fail.

Correctiva visual:

- 7 tests;
- 7 PASS;
- 0 fail.

## Validación integral autoritativa

`npm run validate` completó la puerta completa bajo Node 22.23.2 / npm 10.9.9.

| Gate | Resultado |
| --- | --- |
| Formato texto | PASS · 660 archivos |
| Rust fmt | PASS |
| ESLint | PASS · 0 warnings |
| Node | PASS · 1023/1023 |
| Componentes | PASS · 49/49 |
| Rust | PASS · 9/9 |
| Laboratorio techumbre | PASS · 35/35 |
| Cobertura core | PASS · 92,30 % líneas / 80,76 % ramas / 94,15 % funciones |
| Cobertura store | PASS · 92,35 % líneas / 81,01 % ramas / 93,33 % funciones |
| Goldens | PASS · 19 |
| DXF | PASS · 0 errores / 0 reparaciones |
| CalculiX | PASS · 3/3 |
| Build Vite | PASS |
| Migración | PASS · 187 archivos / 58 cambios / 2 fixtures |
| Artefactos | PASS · 743 archivos |
| Derivados | PASS · 14 exportadores / 14 mutadores |
| Auditoría Codex | PASS · 11 completas / 2 recuperadas / 0 abiertas |
| Gobernanza | PASS · 22 archivos / 50 requisitos / 61 decisiones |
| `git diff --check` | PASS |

Después de crear los documentos finales de cierre se repitieron los gates afectados:

- `format:check`: PASS · 663 archivos de texto;
- `make governance`: PASS · 22 archivos requeridos / 50 requisitos / 61 decisiones;
- `git diff --check`: PASS;
- `git diff --cached --check`: PASS tras normalizar exclusivamente whitespace del staged.

## Exclusiones preservadas

- No se implementó ninguna solución constructiva de SPEC-016.
- No se dimensionaron perfiles, fijaciones, anclajes ni uniones.
- No se promovieron caminos candidatos a verificados.
- No se cambió la geometría agnóstica.
- No se modificaron interfaces REV8 para resolver artificialmente requisitos.
- No se agregó autoridad estructural derivada al modelo persistido.
- No se interpretó ausencia de camino lateral como `notApplicable`.
- No se ejecutó Git de escritura durante implementación o validación.

## Advertencias conservadas

- Rust mantiene el warning futuro heredado de `block v0.1.6`.
- Vite mantiene el warning heredado de chunk inicial mayor a 600 kB.
- El warning permitido de CalculiX permanece dentro del contrato existente.
- Estas advertencias no bloquearon la puerta integral.

## Documentos y artefactos principales

- `specs/SPEC-015-E-requisitos-estructurales-agnosticos-R6-R12.md`
- `src/core/structuralRequirements.js`
- `scripts/generate-spec015e-evidence.mjs`
- `docs/SPEC-015-E_B3_EVIDENCIA_FX008.md`
- `evidence/spec-015-e/`
- `tests/structuralRequirements.test.mjs`
- `tests/structuralRequirementsIndependence.test.mjs`
- `tests/structuralRequirementsEndpointRegions.test.mjs`
- `tests/spec015eEvidence.test.mjs`
- `tests/spec015eEvidenceVisualCorrective.test.mjs`
- `sessions/implementation-SPEC-015-E.md`
- `sessions/close-SPEC-015-E.md`

## Estado de cierre

La implementación, evidencia real, correctivas semánticas, revisión visual y puerta integral están
aprobadas.

SPEC-015-E queda técnicamente lista para su cierre en el repositorio, sujeto a la inspección final
del working tree y a la autorización explícita para ejecutar Git de escritura.
