# Cierre — SPEC-006-E / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | `a08d7b41850436358ddc5914e6e51d993b0b66e0` + árbol de trabajo gobernado |
| Spec | `SPEC-006-E` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Python 3.14.5 + ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | medium |
| Esfuerzo efectivo | medium |
| Escalamiento | No |

## Alcance ejecutado

Se implementó una vista diagnóstica lazy separada de la Vista 3D constructiva. Un preparador puro
reúne la expectativa canónica reconstruida por el auditor, la proyección exportable viva, el
informe `agnostic-geometry-audit/v1`, los IDs fallidos, las estadísticas, las capas y los bounds.
La escena usa una sola frontera probada de coordenadas `{x, y:z, z:y}` y nunca pasa por
`build3d.js`.

El modal ofrece Fuente, Exportada y Superposición sin offset artificial. La fuente se muestra como
sólido translúcido con vanos sustraídos; la exportada, como contorno contrastante. Muros, vanos,
pilares, vigas, capas de fundación y superficies límite de cubierta proceden sólo del contrato
agnóstico. El panel presenta PASS/FAIL, tolerancia, conteos, máxima desviación, IDs fallidos y
primera diferencia. Un error de preparación o render es visible y evita conservar una escena
parcial.

## Cambios

- `agnosticGeometryAudit.js` expone explícitamente la expectativa independiente sin importar el
  proyector; el auditor consume esa misma autoridad.
- `agnosticGeometryComparison.js` prepara snapshots, estilos, modos, fallos, bounds y la única
  transformación cartesiana sin Three.js, React, DOM ni mutaciones.
- El renderer Three.js aislado dibuja prismas orientados/alineados, vanos, capas y superficies;
  ajusta cámara, órbita, zoom, pan y resize, y libera renderer, controles, geometrías y materiales.
- El modal y el renderer se cargan dinámicamente en chunks separados. `Ver` conserva
  `Vista 3D…` y agrega `Comparar geometría agnóstica…` como acción distinta.
- `Viewer3D.jsx`, `build3d.js`, generadores DXF/INP y artefactos no se modificaron. F-009 permanece
  abierto.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Dos snapshots, informe, pureza e independencia | PASS | Preparador 1/1; snapshots `deepEqual` pero no idénticos, modelo intacto y ausencia estática de `build3d.js` |
| 2. Mínimo, `casa-L`, FX-003 y FX-004 | PASS | Cuatro casos PASS, conteos fuente/exportada idénticos, cero IDs fallidos y desviación ≤0,001 mm |
| 3. Payload alterado | PASS | Posición, dimensión e ID producen FAIL, primera diferencia e IDs resaltables |
| 4. Coordenadas y bounds | PASS | `{x:11,y:22,z:33}` → `{x:11,y:33,z:22}`; bounds finitos para prismas, vanos, fundaciones y cubiertas |
| 5. Tres modos sin desplazamiento | PASS | Fuente, Exportada y Superposición seleccionan capas exactas; centros coinciden y un modo ajeno falla |
| 6. Familias geométricas sin solución constructiva | PASS | Vanos sustraídos, sólidos y superficies en el plan; inspección prohíbe `studs`, Metalcon, OSB, cerchas, costaneras y soleras |
| 7. Menú/modal separado | PASS | Dos pruebas de componente conservan `Vista 3D…`, abren el comparador y muestran PASS/métricas/modos |
| 8. Errores visibles sin escena parcial | PASS | Proyector inyectado que arroja muestra alerta y no monta el contenedor de escena |
| 9. Prueba de reversión | PASS | Intercambiar temporalmente y/z hace fallar 1/1 la aserción exacta de frontera; restauración 6/6 |
| 10. Puertas y esfuerzo | PASS técnico / G0 pendiente | Suite, cobertura, build, artefactos y diff verdes; `medium` planificado/enviado/efectivo. G0 espera el retorno de esta ejecución al lanzador |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| Pruebas enfocadas | PASS | Comparador 6/6; auditor heredado 7/7; componentes SPEC-006-E 2/2 |
| `npm run validate` con Node 22.23.2 | PASS hasta `codex:audit` | 827 Node; 21 componentes; 9 Rust; 35 lab; 18 goldens; DXF 0/0; CCX 3/3; build OK |
| Cobertura oficial | PASS | core 92,86 %; store 95,48 % |
| `npm run build` | PASS | 290 módulos; chunks lazy comparador 9,84/3,85 kB; inicial 767,05 kB raw / 238,40 kB gzip; warning R-010 conocido |
| `npm run codex:audit` | BLOQUEADO | La ejecución SPEC-006-E actual espera retornar; el cierre concordante ya existe |
| `make governance` | BLOQUEADO | Misma causa exclusiva del registro Codex pendiente; documentación restante válida |
| `git diff --check` | PASS | Sin errores de whitespace |

El lanzador de esta ejecución (`9d0efc2d-1ce7-4dec-b4e8-7e419aaad457`) recibió `medium`. Al
retornar leerá este cierre, comparará `medium == medium == medium` y anexará su
`launch_completed`; ese evento no se adelanta ni simula desde la ejecución hija.

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Intercambiar temporalmente la frontera a `{x, y:y, z:z}` | 1/1 enfocada: esperado `{x:11,y:33,z:22}`, observado `{x:11,y:22,z:33}` |
| Restaurar `{x, y:z, z:y}` | 0; comparador 6/6 verde |

## Desviaciones y deudas descubiertas

- La rama conserva el nombre heredado `spec/GOV-D-auditable-codex-retries`; `.git` es de sólo
  lectura y no permite crear la rama requerida. Se preservaron todos los cambios acumulados.
- El warning conocido R-010 continúa y el chunk inicial mide 767,05 kB. Modal y renderer nuevos
  quedaron fuera de ese chunk en dos cargas lazy.
- No se modificaron DXF ni INP; sus auditorías y smokes se ejecutaron sólo como regresión.
- F-009 conserva severidad P1 y sigue bloqueando afirmar que los planos están listos para
  ejecución.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, D-052
- [x] `governance/MIGRATION_MANIFEST.json`
