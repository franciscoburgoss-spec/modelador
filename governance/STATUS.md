# Estado del proyecto

> Única fuente de verdad del estado. Los cierres y documentos archivados no declaran qué está
> abierto. Actualizar al cerrar cada sesión.

Última actualización: **11-ago-2026**

## Línea base

| Campo | Estado |
|---|---|
| Etapa | SPEC-015-E cerrada tras validación integral y revisión visual real FX-008 |
| Código en este repositorio | Baseline migrado; hashes de origen preservados y cambios posteriores registrados |
| Spec activa | Ninguna |
| Esfuerzo activo | Ninguno |
| Suite oficial | SPEC-015-E final: focal 27/27; Node 1023/1023; componentes 49/49; Rust 9/9; lab 35/35; CalculiX 3/3 |
| Build | PASS local Vite; warning heredado de chunk inicial mayor a 600 kB permanece documentado |
| Cobertura | PASS: core 92,30 % líneas / 80,76 % ramas / 94,15 % funciones; store 92,35 % / 81,01 % / 93,33 % |
| Toolchain de verificación | Node 22.23.2; npm 10.9.9; Rust/Cargo, Tauri, Python/ezdxf y CalculiX ejercitados por los gates locales |
| DXF heredados | 40 archivos auditados, 0 errores / 0 reparaciones |
| DXF R3-B | 14 archivos (`casa-L`: 2 R12 + 12 AC1015), 0 errores / 0 reparaciones |
| DXF R6-B | 6 archivos (`casa-L`: 1 R12 + 5 AC1015), 0 errores / 0 reparaciones |
| DXF R6-C | 8 archivos OSB (`casa-L`: 1 R12 + 7 AC1015), 0 errores / 0 reparaciones |
| DXF R8-C | 4 láminas A3 AC1015 representativas, 0 errores / 0 reparaciones |
| DXF SPEC-003-B | 9 archivos de 8 familias (3 R12 + 6 AC1015), 0 errores / 0 reparaciones |
| DXF R9-A | Matriz A1/A3 de cuatro familias: 10 láminas AC1015; clipping/overflow/unlocked 0; 0 errores / 0 reparaciones |
| CalculiX R6-B | 45 muros regenerados con IDs cortos; 1.362 nodos / 1.012 elementos; `Job finished` |
| Objetivo de release | `v1.0.0-local` |
| Bloqueo actual | F-009 bloquea afirmar que los planos están listos para ejecución |

## Hallazgos bloqueantes confirmados

| ID | Severidad | Hallazgo | Spec |
|---|---|---|---|
| F-009 | P1 | Las colisiones de rótulos/burbujas y la composición por familia aún comprometen la legibilidad de los DXF | `SPEC-R9-B/R9-C` |

## Hallazgos resueltos

| ID | Resultado | Evidencia |
|---|---|---|
| F-007 | Existen scripts oficiales y `npm run validate` es la puerta única | `sessions/close-SPEC-000.md` |
| F-001 | Fórmulas usan un parser aritmético cerrado, sin evaluación de JavaScript | `sessions/close-SPEC-001.md` |
| F-002 | `roofSystems` se preserva y `roofPlanes` declara precedencia sin pérdida | `sessions/close-SPEC-001.md` |
| F-003 | El modelo se migra y valida antes de cualquier commit al store | `sessions/close-SPEC-001.md` |
| F-004 | Parámetros, biblioteca, niveles y vanos invalidan mediante el registro central | `sessions/close-SPEC-002.md` |
| F-005 | Las tres variantes CalculiX tienen guarda dura y no descargan stale | `sessions/close-SPEC-002.md` |
| F-006 | Recovery nativo distingue crash/cierre limpio y muestra errores sin tocar el original | `sessions/close-SPEC-004-D.md` |
| F-008 | Frontend compatible con el WebView de macOS 11 y fallo de bootstrap visible | `sessions/close-SPEC-004-D1.md` |
| F-010 | Ocho cuerpos importados tienen nombres canónicos, envolvente G0 y recuperación byte a byte por SHA-256 | `sessions/close-SPEC-GOV-C.md` |
| F-011 | `agnostic-geometry-v1.0` expone una autoridad `elements[]` tipada y `roofGeometry[]`; el consumidor contractual de SPEC-14 recupera 45 muros y 43 vanos | `sessions/close-SPEC-006-B.md` |
| F-012 | `projectRoofPlane` usa la menor coronación colineal compatible, conserva el rechazo de pendiente negativa y no exporta solución constructiva | `sessions/close-SPEC-006-C.md` |
| F-013 | Cada descarga geométrica exige un informe independiente con biyección y comparación por ruta a 0,001 mm; las diferencias bloquean antes del DOM | `sessions/close-SPEC-006-D.md` |
| BUG-015-C-001 | Muros y elementos tienen descriptor, preview individual/lote, vanos y localización transitoria sin mutar selección global, historial ni trace | `sessions/close-SPEC-015-C-1.md` |

## Fases

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Repositorio y entorno reproducibles | Completada |
| 1 | Seguridad, integridad e invalidación | Completada |
| 2 | Reglas de dominio R3–R8 y formatos | En ejecución |
| 3 | Persistencia y recuperación nativas | Completada |
| 4 | Aplicación Tauri y CalculiX integrado | En ejecución |
| 5 | UX, rendimiento y observabilidad local | No iniciada |
| 6 | Release `v1.0.0-local` | No iniciada |

## Deudas de dominio heredadas

Las deudas A-1 a A-10 se conservan en `archive/LEGACY_STATUS.md`. La ejecución vigente es:

- R3-A/B/C/D: cerrados; su baseline histórico generaba 493 cadenetas reales (134,551 m) con rótulo `CD`,
  sin alterar el despiece OSB ni los 1.529 nodos / 1.104 elementos del INP; kerf independiente.
  El metrado agrega 11 filas por perfil y rol, con 1.473 piezas y 2.679,051 m, y preserva
  `deepEqual` las 11 filas heredadas.
- R4-A/B/C: cerrados; catálogo inmutable, constructor canónico, cuatro fronteras públicas
  `deepEqual`, presentación de tres severidades y navegación por cuatro IDs tipados.
- R5-A/B/C: cerrados; contrato/migración, CRUD/asignación con historial, invalidación central,
  modulación efectiva, `osbGap` por muro, nesting por rol y coordinación UI completos.
- R5-D: cerrado. `Elementos` expone un inventario filtrable de elementos y vanos; `casa-L`
  produce 92 filas e identifica sus 45/45 muros sin tipo. La asignación individual o masiva exige
  una elección explícita, valida antes de mutar, invalida framing+OSB de todo el lote y crea un
  solo paso de historial. El inspector no modal de elemento, techumbre y faldón ahora se arrastra
  dentro del viewport.
- R6-A/B/C: cerrados; frame local normalizado y topología global pura reconocen en `casa-L` exactamente
  80 nodos/bandas (23 L, 35 T, 18 rectas y 4 terminales), con prioridad L estable, candidatos
  completos, host T interior, Z parcial/disjunto y ambigüedad explícita. Metalcon consume esa
  autoridad de forma coordinada/atómica: genera 109 `corner`, cero `backup`, respalda las 26 T
  directas y rebasa `casa-L` a 439 cadenetas, 1.361 piezas y 2.500,147 m. La topología de muro
  invalida framing+OSB globalmente sin ampliar cerchas ajenas. OSB aplica la media cara firmada
  sólo en L: 408 piezas, 284 placas de compra y 845,4112 m²; 16 muros se prolongan y 18 se
  retranquean hasta −50,5/+50,6 mm, sin cambiar el largo estructural.
- R7-A: cerrado. El catálogo contiene ocho reglas; `domainChecks` devuelve findings y cobertura
  sin regenerar. Paso MP1/MP2, distancia eje a eje montante–jamba, holgura a cara perpendicular y
  largos MP2/MP3 quedan integrados en validación/presentación. La regeneración tipada sólo omite
  `stud` regular próximo si el paso local resultante cumple y preserva pilares L/T.
- Las 6 piezas de cadeneta de 12/24 mm de `casa-L` ahora son findings medidos y permanecen
  geométricamente intactas; su solución constructiva sigue pendiente de un detalle aprobado.
- R7-B: cerrado. `roofSupportChecks` consume la fuente viva `getRoofSystems`, agrupa vanos
  apilados y verifica cada llegada sobre vano contra `B/2` sin fallback. `casa-L` conserva seis
  llegadas únicas, todas fuera de 19 mm. Las tres guardas `MIN_TRAMO` emiten etapa, solape,
  umbral estricto y muro sin volver a crear el tramo; el wrapper de faldones conserva el finding.
- R7-C: cerrado. `computeShearCapacityByDirection` separa X/Y y estados
  `verified`/`conditional`/`excluded`, individualiza catorce condiciones, mantiene cuatro como
  `unknown`, calcula 417 kgf/m sólo como capacidad condicionada y deja cero capacidad verificada.
  Los totales y findings por dirección nunca mezclan capacidad condicionada con verificada.
- R8: cerrada en tres cortes. A fija snapshot/renderer/cobertura; B integra descarga y pantalla;
  C agrega criterios de catálogo a `NOTAS GENERALES` con auditoría DXF.
- R8-A: cerrado. Las ocho reglas declaran sección/variantes; `evaluateModelValidation` preserva el
  array histórico y `evaluateModelReview` reúne una sola vez los 54 findings de `casa-L`.
  Cobertura R7, productores no instrumentados y criterios por rol explícito quedan visibles. El
  renderer puro emite una fila por finding, distingue fuente/ausencia/null, neutraliza datos no
  confiables y es determinista.
- R8-B: cerrado. `ValidationModal` usa un único `useMemo` de `evaluateModelReview`; pantalla y
  descarga consumen el mismo snapshot y margen. El botón exporta `revision-constructiva.md`
  incluso sin findings. El adaptador DOM inyectable usa MIME Markdown, no muta el modelo y revoca
  su object URL también si falla el click.
- R8-C: cerrado. Las láminas anteponen criterios de tipos asignados por variante, excluyen los
  agregados sólo por findings y conservan después las notas de usuario o defaults. El peor caso
  A3 con MP1/MP2/MP3/tabique mantiene todos los IDs sin `(...)`; cuatro DXF AC1015 pasan 0/0.
- SPEC-003-PREP: cerrado. El baseline confirma que `casa-L`/`modelo-26` comparten los mismos 49
  elementos y hash abreviado `d33ce29e466b`; los seis fixtures JSON actuales pasan el esquema,
  pero ninguno prueba una cubierta moderna resoluble persistida. La ejecución se divide en
  A fixtures, B artefactos/DXF, C solver, D store/componentes y E integración/E2E externo.
- SPEC-003-A: cerrado. El manifiesto registra los ocho fixtures JSON actuales con checksum,
  versión, propósito, cobertura e invariantes ejecutables. FX-003 aporta seis muros independientes,
  perfiles 60/90 y seis vanos; FX-004 aporta un `roofPlane` v2 resoluble que deriva un sistema,
  seis posiciones de cercha y dos ledgers reproducibles tras roundtrip, sin persistirlos.
- SPEC-003-B: cerrado. Dieciocho artefactos (4 JSON, 2 CSV, 9 DXF y 3 INP) tienen goldens
  semánticos compactos y normalización explícita; `audit:dxf` usa `ezdxf` 1.4.4 desde el entorno
  del repositorio y verifica las ocho familias completas con 0 errores / 0 reparaciones.
- SPEC-003-C0: cerrado. FX-004 persiste área e inercias canónicas para `90CA085`, `40CA085` y
  `60CA085`; su golden INP baja de 16 a cero tokens no finitos. CalculiX 2.23 termina la cercha
  con 13 nodos de desplazamiento, 78 valores finitos y máximo absoluto de 0,590202 mm.
- SPEC-003-C-DIAG: cerrado como sustituido. Cercha y fundaciones terminan, pero el global confirma
  125 referencias de sección con `ELSET` mayor a 20 caracteres. Al compactarlas temporalmente,
  CCX descubre además barras `FUNDACIONES` sin sección y termina con código 201. C1 reemplaza el
  alcance anterior y prohíbe aceptar el falso positivo código 0 + `Job finished` con `*ERROR`.
- SPEC-003-C1-DIAG: cerrado como sustituido. La corrección provisional dejó 133 sets de máximo
  16 caracteres y 137 secciones resueltas, pero CCX falla al coexistir cuatro B31 con los U1,
  incluso sin compartir nodos. La variante temporal toda U1 conserva 1.384 nodos/1.046 elementos
  y produce 8.304 desplazamientos finitos. C2 reemplaza C1; el código provisional no se retuvo.
- SPEC-003-C2: cerrado. El global usa 133 sets de máximo 16 caracteres, 137 secciones resueltas y
  una familia U1 homogénea que conserva 1.384 nodos/1.046 elementos, IDs, coordenadas y
  conectividad. `smoke:ccx` ejecuta global, cercha y fundaciones con CalculiX 2.23, valida 1.486
  nodos/8.649 valores finitos y registra hashes, extremos, warnings y duración por commit.
- SPEC-003-D: cerrado. Siete pruebas conductuales cubren mutaciones, invalidación, historial,
  navegación, selección, sustitución, techumbre y fronteras de persistencia/archivo del store.
  Cuatro pruebas con DOM cubren importación fallida visible, exportación stale bloqueada,
  carga persistida desde el menú y revisión/descarga. El store alcanza 97,85 % con gate de 85 %;
  core conserva 93,55 %. Eliminar un perfil Metalcon referenciado se bloquea explícitamente.
- SPEC-003-E: cerrado. `npm run validate` ejecuta una sola vez todos los gates locales, incluidos
  18 goldens, nueve DXF de ocho familias con auditoría 0/0 y tres jobs CalculiX con 1.486 nodos /
  8.649 valores finitos. Playwright 1.62.0 ejecutó externamente el flujo crítico de revisión y
  descarga sobre `11962f3b114cd0a60262f0f21ae4a156a20855ed`: 1/1 esperado, sin reintentos, y
  publicó reporte JSON/HTML identificado por ese mismo SHA.
- SPEC-004-A: cerrado. El contrato puro valida y serializa antes de I/O, y devuelve aperturas
  preparadas sin recibir estado ni callback de commit. El adaptador Node de referencia escribe un
  temporal hermano con `fsync`, respalda byte a byte la versión anterior y publica por `rename`;
  un proceso muerto con `SIGKILL` antes del reemplazo conserva el SHA previo. Después de doce
  versiones permanecen exactamente los diez backups reabribles más recientes. La UI web todavía
  usa `localStorage`: el riesgo R-004 sigue en mitigación hasta integrar el contrato con Tauri.
- SPEC-004-B: cerrado. La sesión de documento separa ruta, título, sucio y diez recientes del
  modelo persistido. Historial/undo/redo marcan cambios; navegación no. Abrir sólo sustituye
  modelo, documento e historiales después de validar, y Guardar conserva `dirty=true` si hubo una
  edición mientras el snapshot se escribía. El menú expone Abrir/Guardar/Guardar como/Recientes
  mediante runtime inyectable, conserva los flujos web con etiquetas distintas y muestra título y
  `*`; las acciones nativas siguen deshabilitadas en localhost hasta conectar Tauri.
- SPEC-004-C: sustituido por C1 después del smoke. Los seis comandos autorizados, filesystem
  atómico, recientes y seguridad estática compilan y pasan 4 Rust + 11 JS; Tauri 2.11.5/Wry 0.55.1
  aborta en macOS 11 antes de crear ventana al registrar un método WebKit disponible desde macOS
  12. D-040 exige Tauri 2.0.2/runtimes 2.0.1/Wry 0.44.1 y smoke real; Wry 0.48.1
  también reprodujo el panic y descartó el primer candidato de C1.
- SPEC-004-C1: cerrado. El shell conserva seis comandos estrechos, capability exclusiva de
  `main`, CSP local y filesystem Rust autorizado con escritura atómica, backups y recientes.
  `Cargo.lock` fija Tauri 2.0.2, ambos runtimes 2.0.1 y Wry 0.44.1 como única versión; la ventana
  permaneció viva más de 15 segundos en macOS 11.7.11 x86_64 sin panic. La puerta local pasó
  759 Node, 12 componentes, 4 Rust, 35 lab, DXF 0/0 y CCX 3/3; el E2E externo
  [30396039167](https://github.com/franciscoburgoss-spec/modelador/actions/runs/30396039167)
  pasó 1/1 sobre `59bf6e67d2a5`.
- SPEC-004-D: cerrado. Recovery usa un snapshot v2 privado y atómico separado del proyecto, y un
  marcador Rust ofrece recuperación sólo después de una sesión interrumpida. Recuperar valida en
  un único commit, conserva la ruta y exige Guardar explícito; corrupción y versiones futuras son
  visibles y se preservan. La migración de las dos claves web accesibles exige destino, reabre
  antes de consumirlas y documenta Exportar/Importar para orígenes externos. La capability queda
  en exactamente nueve comandos sin red ni plugins amplios. La ventana permaneció viva más de
  30 segundos en macOS 11.7.11 x86_64; la puerta local pasó 765 Node, 18 componentes, 9 Rust,
  35 lab, DXF 0/0 y CCX 3/3, y el E2E externo
  [30398940925](https://github.com/franciscoburgoss-spec/modelador/actions/runs/30398940925)
  pasó 1/1 sobre `9480850c5484`.
- SPEC-004-D1: cerrado. Las 47 consultas productivas de propiedades propias en doce módulos usan
  un helper compatible con el WebView de macOS 11; una inspección recursiva impide reintroducir
  `Object.hasOwn`. El bootstrap muestra un error escapado en vez de una ventana vacía y se retira
  después del primer render. Tauri mostró barra de menú, selector de vista y lienzo durante más de
  30 segundos en macOS 11.7.11 x86_64. La puerta local pasó 770 Node, 18 componentes, 9 Rust,
  35 lab, DXF 0/0 y CCX 3/3; el E2E externo
  [30403943338](https://github.com/franciscoburgoss-spec/modelador/actions/runs/30403943338)
  pasó 1/1 sobre `f78c8404e5b9`.
- SPEC-R9-A: cerrado. Un motor geométrico puro calcula cajas conservadoras de línea, texto rotado,
  círculo, sólido y polilínea, reserva 3 mm de papel y rechaza escala, extent, capacidad o
  encuadre inválidos antes de descargar. Las láminas declaran milímetros/escala de línea, extents
  reales, `SOLID` válido, capa de viewports no imprimible y viewports bloqueados. La matriz oficial
  A1/A3 audita 10 láminas de fundaciones, tabiquería, OSB y cerchas con clipping, overflow,
  unlocked y fallas técnicas en cero, además de `ezdxf` 0/0. Las colisiones detectadas no se
  corrigen todavía y mantienen F-009 abierto para R9-B/R9-C.
- SPEC-GOV-A: cerrado. Cada spec declara esfuerzo `low`, `medium` o `high`; G0 compara el esfuerzo
  planificado con el efectivo, impide iniciar en `xhigh` y mantiene `max` prohibido. Cinco pruebas
  enfocadas cubren coincidencia, discrepancia, declaración ausente, nivel excepcional y sesión
  inactiva; al retirar la comparación, la prueba de discrepancia falla. La puerta completa pasó
  todos los gates técnicos y reprodujo sólo los 42 errores documentales de F-010 al llegar a G0.
- SPEC-GOV-B: cerrado. El lanzador oficial lee la spec activa, envía su esfuerzo a `codex exec`
  mediante argumentos separados y `shell: false`, y no persiste el prompt. Dry-run no ejecuta ni
  registra. Los eventos JSONL append-only conservan inicio incluso ante fallo y comparan al final
  planificado, enviado y cierre; G0 audita el consolidado. Ocho pruebas enfocadas y dos reversiones
  cubren seguridad y discrepancias. La puerta técnica quedó verde y F-010 conserva sus 42 errores.
- SPEC-GOV-C: cerrado. Los ocho documentos importados tienen nombres canónicos `SPEC-`, las seis
  secciones contractuales y esfuerzo futuro `high`. Un manifiesto registra nombres, longitudes y
  SHA-256; el extractor recupera exactamente los 80.268 bytes normativos originales. Tres pruebas
  enfocadas cubren correspondencia uno a uno, hashes, contrato y reversión de `## Diagnóstico`.
  No se implementó ninguna regla constructiva ni se modificó código de aplicación, DXF o INP.
- SPEC-006-A: cerrado con esfuerzo `high` planificado y efectivo, sin escalamiento.
  `agnostic-geometry-v1.0` proyecta mediante allowlist ejes/niveles cartesianos, 45 muros y 43
  vanos de `casa-L`, cuatro fundaciones multicapa y cubiertas legacy/modernas como superficies
  límite. La descarga es `live`, determinista y atómica; el archivo nativo continúa en
  `modelVersion` 2 y conserva Metalcon/OSB. F-009 permanece abierto sin cambios.
- SPEC-006-B: cerrado con esfuerzo `medium` planificado y efectivo, sin escalamiento. La misma
  versión no liberada usa una sola colección `elements[]` con discriminantes geométricos y
  `roofGeometry[]`; un consumidor puro de la entrada mínima de SPEC-14 recupera los 45 muros y 43
  vanos de `casa-L` y rechaza tanto la forma separada como una entrada con cero muros. El volumen
  resuelto, la separación constructiva y el archivo nativo v2 permanecen intactos.
- SPEC-006-C: cerrado con esfuerzo `medium` planificado y efectivo, sin escalamiento. Dos apoyos
  altos colineales a distinta cota gobiernan `roofGeometry[]` por la menor coronación descontada;
  la permutación es idéntica, la pendiente negativa sigue fallando antes del DOM y los campos
  constructivos se excluyen por allowlist. F-012 y R-023 quedan resueltos; A/B y F-009 se conservan.
- SPEC-006-D: cerrado con esfuerzo `high` planificado y efectivo, sin escalamiento.
  `agnostic-geometry-audit/v1` reconstruye por un camino independiente grilla, elementos, vanos,
  capas y cubiertas; compara biyección, miembros y números a 0,001 mm. La geometría se bloquea
  antes del DOM ante diferencias y el menú descarga un informe JSON separado. `casa-L` conserva
  45 muros, 43 vanos, cuatro fundaciones y dos cubiertas; A/B/C y F-009 no cambian.
- SPEC-GOV-D: cerrado con esfuerzo `medium` planificado y efectivo, sin escalamiento. El auditor
  separa estructura, resultado y recuperación; reconoce el fallo histórico de SPEC-006-D sólo por
  su aprobación posterior de identidad exacta; al cierre informa 7 ejecuciones completas / 1 fallo recuperado
- SPEC-006-E: cerrado con esfuerzo `medium` planificado y efectivo, sin escalamiento. Un preparador
  puro reúne snapshots independientes de fuente/exportada, informe, IDs fallidos, escena y bounds;
  la única frontera cartesiana usa `{x, y:z, z:y}`. El modal lazy ofrece Fuente, Exportada y
  Superposición con métricas y error visible, sin importar `build3d.js` ni tocar `Viewer3D`.
  `casa-L`, FX-003, FX-004 y el modelo mínimo pasan; F-009 permanece abierto sin cambios.
  / 0 fallos no recuperados y conserva intacto el prefijo histórico append-only. F-009 no cambia y
  el visor comparativo permanece fuera de alcance.
- SPEC-014-A: cerrado con esfuerzo `high` planificado y efectivo, sin escalamiento.
  `recognized-structural-topology-v1.0` consume literalmente `agnostic-geometry-v1.0`, valida y
  canonicaliza R0/R1, agrupa R2 en 32 líneas y construye 19 relaciones / 8 cadenas sin fusionar
  muros. `casa-L` conserva 45 muros, 43 vanos, cero findings R0–R2 y SHA-256 canónico
  `e73ca10984f18e94b345fbc427ce06dfcf246bcc963ae182c671a59fd6ef08a7`; el SVG y su manifiesto
  son reproducibles byte a byte. R3–R12 siguen pendientes, `eligibleForSpec08=false` y F-009 no
  cambia.
- SPEC-014-B: cerrado con esfuerzo `high` planificado y efectivo, sin escalamiento. R3 clasifica
  apilamientos exactos, parciales, superpuestos y con gap; R4 fija A=X/B=Y, conserva cuatro tipos
  de cobertura y bandas Z; R5 unifica extremos, vanos, encuentros y límites de apilamiento sin
  perder roles ni IDs fuente. `casa-L` conserva 45 muros/43 vanos, produce 60 encuentros, 201
  nodos, 25 warnings de cobertura parcial y un cruce MID–MID bloqueante, con SHA-256 canónico
  `ba783496503c0f9d1da5ebb0cf18a603169e239eba1b07306f02502630cb09e6`. El fixture real no
  contiene pares R3. R6–R12 siguen pendientes, `eligibleForSpec08=false`, F-009 permanece P1 y
  ninguna solución constructiva consumió esta salida.
- SPEC-015-A: cerrada con esfuerzo `high` planificado y efectivo, sin escalamiento. D-055,
  R-028 y REQ-DOM-006 registran la autoridad persistente `structural-intent-v1.0`. El modelo
  nativo usa `modelVersion: 3`; la migración añade intención vacía sin inferir roles
  constructivos y las mutaciones explícitas participan del historial. FX-008 conserva 45 muros,
  43 vanos, 32 fundaciones y 7 `roofPlanes`; `agnostic-geometry-v1.0` mantiene 81.875 bytes y
  SHA-256 `966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a` antes y después de
  agregar intención. Suite oficial, cobertura, build, 19 goldens, auditorías y gobernanza pasan.
  Evidencia: `sessions/close-SPEC-015-A.md`.
- SPEC-015-B: cerrada con esfuerzo `high` planificado y efectivo, sin escalamiento. Los bordes
  canónicos SHA-256 se derivan exclusivamente de `projectAgnosticGeometry(model).roofGeometry`;
  las direcciones resistentes son ejes no orientados y `roofIntents[]` queda persistente en v3
  mediante APIs explícitas y reconciliación atómica dentro del historial. FX-008 conserva 45
  muros, 43 vanos, 32 fundaciones, 7 cubiertas y el golden agnóstico de 81.875 bytes con SHA-256
  `966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a`. El validador único
  pasó 24/24 gates en el Mac; logs: `artifacts/validation-spec-015-b/20260805-170823`.
  Evidencia: `sessions/close-SPEC-015-B.md`.
- SPEC-015-C: cerrada con esfuerzo `medium` planificado y efectivo, sin escalamiento. El corte
  implementa un workspace separado, mutaciones individuales/masivas atómicas, trazabilidad
  opcional, techumbre por bordes canónicos, accesibilidad e independencia constructiva. FX-008
  reproduce 4 declaraciones de elemento, 1 cubierta y 4 eventos sin alterar los 81.875 bytes ni el
  SHA-256 agnóstico. El validador único pasó 25/25 gates en el Mac; logs:
  `artifacts/validation-spec-015-c/20260806-084630`. Evidencia:
  `sessions/close-SPEC-015-C.md`.

- SPEC-015-C-1: cerrada con esfuerzo `high` planificado y efectivo, sin escalamiento. El
  presentador puro deriva descriptores, planta/elevación, vanos, previews T/S1…Sn y fingerprints
  desde la geometría agnóstica. El localizador vive fuera de `model` y preserva selección,
  borrador, historia y trace. FX-008 conserva 45 muros, 43 vanos, 32 fundaciones y 7 cubiertas.
  El validador v3 pasó 22/22 tests enfocados, 10/10 componente y la puerta completa; logs:
  `artifacts/validation-spec-015-c-1/20260806-143453`. Evidencia:
  `sessions/close-SPEC-015-C-1.md`.
- A-7 y A-8 tienen prioridad por afectar reglas constructivas.

## Deudas técnicas del baseline

- Siete hallazgos heredados de dependencias de hooks quedan acotados a cinco archivos; seguimiento
  R-016 / `SPEC-005`.
- `migration-manifest --record` ya acepta identificadores `SPEC-NNN` y `SPEC-Rn`; sigue faltando
  una prueba automatizada del CLI bajo el alcance de herramientas.
- `validate-governance` sólo inspecciona specs en el primer nivel de `specs/`; las specs de
  `specs/domain/` requieren revisión manual hasta ampliar el validador bajo R-011.
- La incompatibilidad B31/U1 del INP global quedó mitigada en `SPEC-003-C2`: nombres, secciones,
  familia homogénea, parser finito, clasificación de warnings y reporte de tres jobs están
  automatizados. La integración controlada de CCX en Tauri sigue correspondiendo a `SPEC-004`.
- `resolveRoofPlane` intenta construir el resultado fallido con variables `let` aún no
  inicializadas cuando falta `canalWallId`; el fixture mínimo `model-v1-dual-roof` reproduce un
  `ReferenceError` si se expande. Seguimiento R-017 en un corte explícito, fuera de SPEC-003-A.
- GitHub Actions advierte que `checkout`, `setup-node` y `upload-artifact` v4 aún declaran runtime
  Node 20 y los fuerza a Node 24. El E2E permanece verde y la aplicación conserva Node 22; actualizar
  las acciones oficiales requiere un corte explícito de herramientas bajo R-011 antes del release.
- La línea Tauri compatible con macOS 11 arrastra `block` 0.1.6, que Rust 1.97.1 marca como
  incompatible con una versión futura del compilador. D-040 bloquea actualizaciones sin smoke real;
  renovar runtime o toolchain exige resolver juntos R-009 y este aviso.

## Próximo corte

SPEC-015-E quedó cerrada el 11-ago-2026 sobre `main@6d371bd` tras implementar y auditar el núcleo
puro R6–R12, validar la evidencia real FX-008 y cerrar las correctivas B3.1, B3.2 y B3.2.1. La
evidencia conserva cuatro caminos gravitacionales `completeCandidate`, 0 estados `verified` y el
escenario lateral explícito mantiene el gap 571,429 mm como requisito de transferencia. C/7 queda
modelado como extremo `highS` en S=2.000 mm y su envolvente de 0,1 mm permanece sólo como evidencia
de localización, no como longitud física. R12 quedó auditado sin introducir solución constructiva.
No hay spec activa; cualquier habilitación de SPEC-08 o apertura de SPEC-016 requiere un corte
explícito posterior. F-009 no cambia. Git de escritura sigue prohibido hasta autorización explícita
del usuario.
