# Cierre — SPEC-003 / corte B

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-003-verification-harness.md`, corte B — Artefactos |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Python 3.14.5; ezdxf 1.4.4 |

## Alcance ejecutado

Se implementaron normalizadores y goldens semánticos para JSON, CSV, DXF e INP, junto con un
entorno Python fijado y una auditoría reproducible de las ocho familias DXF. No se ejecutó
CalculiX, no se modificaron exportadores de dominio, componentes ni umbrales de cobertura.

## Cambios

- El conjunto de referencia genera 18 artefactos: 4 JSON, 2 CSV, 9 DXF de 8 familias y 3 INP.
- FX-003/FX-004 se regeneran en memoria mediante funciones puras; `casa-L` aporta fundaciones y el
  INP global con IDs persistidos.
- Cinco goldens compactos registran contrato de normalización, versión, referencias, unidades,
  magnitudes, stale, capas, layouts, entidades, extents, textos, `NSET`/`ELSET`, nodos, elementos,
  materiales, cargas y condiciones de borde.
- `verify:goldens` sólo compara; `update:goldens` es la única actualización explícita.
- `ezdxf==1.4.4` vive en dependencias Python del repo y se instala en `.venv-verification`.
- `audit:dxf` invoca ese Python con argumentos directos, genera en `artifacts/<commit>/dxf` y
  escribe un reporte JSON con hash, versión y auditoría por archivo.
- El manifiesto de fixtures enumera exactamente los goldens de FX-001, FX-003 y FX-004.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 5. Normalización explícita | PASS | `normalization-contract.json`; IDs estructurales preservados; fecha fijada; órdenes declarados |
| 5. Cambios contractuales | PASS | prueba muta magnitud, referencia, unidad, capa y stale; los cinco cambios alteran el resumen |
| 6. JSON/CSV deterministas | PASS | 4 JSON + 2 CSV, LF terminal, comparación semántica y modelo `deepEqual` antes/después |
| 7. Ocho familias DXF | PASS | 9 archivos: planta, fundaciones, framing/OSB/cerchas R12 y A3; OSB A3 ocupa 2 láminas |
| 7. Auditoría DXF | PASS | `ezdxf doc.audit()`: 0 errores / 0 reparaciones en cada archivo |
| 8. Entorno fijado | PASS | Python 3.14.5 + ezdxf 1.4.4 en `.venv-verification`; script sin Python global ni `/tmp` |
| INP golden | PASS | global, cerchas y fundaciones conservan IDs/NSET/ELSET y declaran tokens no finitos |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` previo | PASS | 20 archivos; 26 requisitos; 30 decisiones |
| `node --test tests/artifactGoldens.test.mjs` | PASS | 4/4 |
| `npm run verify:goldens` | PASS | 18 artefactos |
| `npm run audit:dxf` | PASS | 8 familias; 9 archivos; 0 errores / 0 reparaciones |
| `npm test` con Node 22 | PASS | 708/708 |
| `npm run validate` con Node 22 | PASS | 708/708; laboratorio 35/35; core 93,45 %; store 72,76 %; build OK |
| `npm run verify:migration` | PASS | 187 archivos: 140 idénticos, 47 cambios registrados; 2 fixtures de migración |
| `npm run verify:artifacts` | PASS | 337 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | 701,70 kB raw / 217,88 kB gzip |
| `scripts/doctor.sh --advisory` | PASS para B | Node/CCX/ezdxf presentes; Rust/Cargo ausentes, fuera del corte |
| Smoke CalculiX | No ejecutado | exclusión explícita de B; corresponde a C |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Normalización simulada con +1 mm, referencia rota, unidad `ft`, capa alterada y `studsStale=true` | el test contractual detecta los 5 cambios |
| Omitir el entorno `.venv-verification` o volver a `python3`/`/tmp` en `audit:dxf` | falla el contrato automático del comando |

## Desviaciones y deudas descubiertas

- El INP de cerchas de FX-004 contiene 16 tokens `NaN`: los perfiles propios del fixture declaran
  geometría, pero no área ni inercias, y sombrean los perfiles completos del catálogo. El golden
  lo expone; no se ejecutó ni corrigió porque el solver está excluido de B. `SPEC-003-C` requiere
  una decisión explícita antes de ese smoke.
- El INP global conserva los IDs numéricos largos dentro de `ELSET`; la ejecución real de C debe
  reproducir y corregir el defecto conocido sin renumerar el fixture.
- `make doctor` no pasa en modo estricto porque Rust/Cargo aún no están instalados. El modo
  advisory confirma el toolchain requerido por B; Rust entra con Tauri.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo decisión nueva
- [x] `docs/DEVELOPMENT.md`
- [x] `harness/README.md`
