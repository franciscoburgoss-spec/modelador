# Handoff a Codex — estado posterior a SPEC-015-E

Fecha: 11-ago-2026

## Baseline autoritativo

- repositorio: `franciscoburgoss-spec/modelador`
- ruta local habitual: `/Volumes/MEM EXT/Developer/modelador`
- rama: `main`
- HEAD cerrado y publicado: `8164e66`
- mensaje: `Implementa y cierra SPEC-015-E`
- esperado al instalar esta capa: `main...origin/main` sin ahead/behind y working tree limpio.

## Estado de gobernanza

- SPEC-015-E: cerrada.
- Spec activa: `Ninguna`.
- Esfuerzo activo: `Ninguno`.
- candidata posterior conocida: SPEC-016-A, pero NO está activa por este handoff.
- ninguna SPEC posterior debe abrirse por inferencia.

## Toolchain confirmado al cierre

- Node `v22.23.2`
- npm `10.9.9`
- Rust/Cargo y Tauri ejercitados por la puerta integral.
- Python/ezdxf y CalculiX ejercitados por los gates locales.

## Validación final de SPEC-015-E

- focal consolidado: 27/27 PASS;
- Node: 1023/1023 PASS;
- componentes: 49/49 PASS;
- Rust: 9/9 PASS;
- laboratorio: 35/35 PASS;
- core coverage: 92,30 % líneas / 80,76 % ramas / 94,15 % funciones;
- store coverage: 92,35 % / 81,01 % / 93,33 %;
- goldens: 19;
- DXF: PASS;
- CalculiX: 3/3 PASS;
- gobernanza: 22 archivos requeridos / 50 requisitos / 61 decisiones.

## Arquitectura estructural consolidada

Pipeline congelado:

`geometría agnóstica → R0–R5 → structuralIntent v1.1 → interfaces/relations → proposals/reviews → candidateLoadPaths → R6–R12 → structural-requirements-v1.0 → adaptadores constructivos futuros`

Reglas críticas:

- `candidateLoadPaths` son evidencia candidata, no autoridad;
- toda salida de SPEC-015-E permanece `notVerified`;
- `supportedByFoundation` no equivale a soporte verificado;
- cero caminos laterales no significa `notApplicable`;
- relación stale bloquea su ámbito; no fallback geométrico silencioso;
- una región/interfaz local no promueve el host completo a estructural;
- derivados R6–R12 son puros/recalculables y no se persisten silenciosamente.

## Caso FX-008 relevante

- 45 muros;
- 43 vanos;
- 32 fundaciones;
- 7 cubiertas;
- cuatro caminos gravitacionales `completeCandidate`;
- 0 `verified`;
- escenario lateral explícito de prueba conserva gap `571,429 mm` como requisito de transferencia;
- C/6 es región física de 101,1 mm;
- C/7 es `end/highS` anclado en S=2000 mm; la envolvente `[1999.9,2000]` es tolerancia de localización, NO longitud física.

## Primer objetivo al abrir Codex

No implementar nada.

Ejecutar únicamente Gate 0 y responder:

1. HEAD/rama/working tree;
2. estado de `governance/STATUS.md`;
3. toolchain;
4. qué instrucciones Codex cargó (`AGENTS.md` y configuración de proyecto si está activa);
5. confirmar que no hay SPEC activa;
6. listar qué información adicional necesitaría para iniciar una Fase A, sin abrirla.
