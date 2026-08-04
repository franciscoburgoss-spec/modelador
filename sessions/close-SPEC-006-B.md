# Cierre — SPEC-006-B / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | `a08d7b41850436358ddc5914e6e51d993b0b66e0` + árbol de trabajo gobernado |
| Spec | `SPEC-006-B` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Python 3.14.5 + ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | medium |
| Esfuerzo efectivo | medium |
| Escalamiento | No |

## Alcance ejecutado

Se corrigió la forma de la versión aún no liberada `agnostic-geometry-v1.0` para que sea
literalmente consumible por la entrada obligatoria de SPEC-14. La proyección conserva los mismos
prismas, vacíos, sólidos y superficies resueltos de SPEC-006-A, sin referencias paramétricas,
intención estructural ni solución constructiva.

## Cambios

- La raíz reemplaza `walls`, `columns`, `beams` y `foundations` por una única autoridad
  `elements[]`; cada entrada declara `type: wall|column|beam|foundation`.
- `roofs` pasa a `roofGeometry[]` y conserva las superficies planares de cubiertas legacy y
  modernas sin perfiles, modulación, cerchas ni miembros.
- El orden canónico queda fijado por tipo (`wall`, `column`, `beam`, `foundation`) y luego por ID;
  ejes, niveles, vanos, sólidos y cubiertas mantienen su orden determinista previo.
- `spec14Input.js` implementa un consumidor/validador puro sin store, React ni Tauri. Exige el
  schema, grilla, IDs únicos, geometría finita y al menos un `elements[type=wall]`; valida además
  que cada vano resuelva a su muro anfitrión.
- La prueba del menú inspecciona la forma descargada y confirma que no aparecen autoridades
  antiguas ni datos Metalcon/OSB.
- F-011 y R-022 quedan resueltos; D-048 fija la forma estable. El cierre de SPEC-006-A no fue
  editado y F-009 permanece abierto como baseline conocido.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Raíz exacta sin colecciones duplicadas | PASS | Objeto vacío exacto y ausencia de cinco claves legacy en `agnosticGeometry.test.mjs` |
| 2. Elementos tipados, finitos, únicos y ordenados | PASS | Proyección de muro/columna/viga/fundación; consumidor valida IDs, tipos y prismas |
| 3. Consumidor SPEC-14 recupera `casa-L` | PASS | `elements[type=wall]`: 45 muros, 43 vanos y 4 fundaciones |
| 4. FX-003/FX-004 conservan geometría | PASS | 6 muros/6 vanos; un `roofGeometry` planar moderno sin solución constructiva |
| 5. Garantías heredadas de SPEC-006-A | PASS | Corpus adversario, determinismo, newline, MIME, rechazo previo al DOM y revocación |
| 6. Menú corregido y archivo nativo intacto | PASS | Prueba componente 5/5; `nativeProjectFile.test.mjs` conserva v2/Metalcon/OSB |
| 7. Evidencia de reversión | PASS | Restaurar colecciones separadas hace fallar el consumidor con `INVALID_COLLECTION`; restauración 9/9 |
| 8. Puertas y esfuerzo | PASS al retorno | Gates técnicos verdes; medium planificado/enviado/efectivo, sin escalamiento |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `node --test tests/agnosticGeometry.test.mjs` | PASS | 9/9 |
| Pruebas enfocadas de componente/política/nativo | PASS | 26/26 |
| `npm run validate` con Node 22.23.2 | PASS al retorno | 806 Node; 19 componentes; 9 Rust; 35 lab; core 92,81 %; store 96,59 %; 18 goldens; DXF 14 archivos, 0/0; CCX 3/3; build OK |
| `make governance` | PASS al retorno | La ejecución hija sólo espera su propio `launch_completed` |
| `git diff --check` | PASS | Sin errores de whitespace |

El build conserva el warning medido del chunk inicial de 748,98 kB. No se modificaron DXF ni INP;
sus auditorías se ejecutaron como regresión. El registro Codex es append-only: durante la ejecución
hija, `codex:audit` rechaza correctamente el único `launch_started` aún sin pareja. Al retornar
código 0, el lanzador lee este cierre, compara `medium == medium == medium` y anexa
`launch_completed`; ese evento no se simula ni se escribe manualmente desde el hijo.

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Se retira `elements[]` del productor y se restauran `walls`/`columns`/`beams`/`foundations` | 1: consumidor `casa-L`, `INVALID_COLLECTION` |
| Se restaura `elements[]` tipado y `roofGeometry[]` | 0; prueba enfocada 9/9 |

## Desviaciones y deudas descubiertas

- La rama conserva el nombre heredado `spec/GOV-A-reasoning-effort-policy`; `.git` es de sólo
  lectura en esta ejecución. Se preservaron todos los cambios acumulados ajenos.
- La primera puerta heredó Node 20.20.2 y alcanzó 806 Node, 19 componentes, 9 Rust y 35 lab antes
  de detenerse porque ese binario no soporta los flags de cobertura. Se repitió completa cargando
  Node 22.23.2, sin cambiar código ni relajar gates.
- No se implementó reconocimiento topológico ni clasificación de SPEC-14. No se abrió deuda
  constructiva nueva; F-009 continúa P1 y bloquea declarar planos listos para ejecución.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, D-048
