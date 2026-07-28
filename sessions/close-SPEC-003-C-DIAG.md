# Cierre — SPEC-003 / corte C-DIAG

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-003-verification-harness.md`, corte C — diagnóstico sustituido por C1 |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; CalculiX 2.23 |

## Alcance ejecutado

Se ejecutaron sin modificar los tres INP de referencia y se continuó el global con una
transformación temporal fuera del repositorio para aislar el siguiente fallo. No se modificó código
de producto: el diagnóstico cambió y el protocolo exige sustituir el alcance antes de implementar.

## Cambios

- La reproducción demuestra que cercha y fundaciones alcanzan `Job finished`.
- El global emite errores de lectura para nombres largos pese a devolver código cero y
  `Job finished`.
- El contrato estático cuenta 133 referencias `*BEAM SECTION`, 125 mayores a 20 caracteres.
- Una copia temporal con prefijos compactos alcanza `gen3delem` y descubre que
  `ELSET=FUNDACIONES` no tiene `*BEAM SECTION`; CCX termina con código 201.
- D-032 y `SPEC-003-C1-solver-harness.md` gobiernan la sustitución.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Reproducir tres variantes | PASS diagnóstico | CCX 2.23 directo sobre global, cercha y fundaciones |
| Confirmar defecto conocido | PASS | 125/133 referencias de sección superan 20 caracteres; errores `element set ... has not yet been defined` |
| Aislar siguiente bloqueo | PASS | copia temporal compactada: `first thickness ... is zero` en elemento B31 de `FUNDACIONES` |
| Criterios 9–10 de SPEC-003 | NO CERRADOS | corte sustituido por C1 antes de implementar |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` previo | PASS | 20 archivos; 26 requisitos; 31 decisiones |
| `/usr/local/bin/ccx job` — cercha | PASS diagnóstico | código 0; `Job finished` |
| `/usr/local/bin/ccx job` — fundaciones | PASS diagnóstico | código 0; `Job finished`; `.dat` y `.frd` no vacíos |
| `/usr/local/bin/ccx job` — global original | FAIL esperado | código 0 y `Job finished`, pero múltiples `*ERROR reading *BEAM SECTION` |
| `/usr/local/bin/ccx job-fixed` — global temporal | FAIL diagnóstico | código 201; fundación B31 sin espesor/sección |
| `npm run validate` | PASS | 709/709; build 701,70/217,88 kB; migración 187/140/47; 341 artefactos; 13 exportadores/14 mutadores; gobernanza 20/26/32 |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| No aplica: este corte sólo reprodujo y sustituyó el diagnóstico | la prueba de reversión corresponde a C1 |

## Desviaciones y deudas descubiertas

- El código de salida y `Job finished` no son evidencia suficiente de normalidad en CCX 2.23.
- El exportador global declara fundaciones B31 sin una sección. Se incorpora explícitamente a C1;
  no se corrigió bajo el alcance anterior.
- La falta deliberada de step/cargas del global requiere una sonda cinemática separada, no cargas
  de proyecto inventadas.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] nueva spec sustituta C1
