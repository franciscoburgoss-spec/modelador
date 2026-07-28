# Estado del proyecto

> Única fuente de verdad del estado. Los cierres y documentos archivados no declaran qué está
> abierto. Actualizar al cerrar cada sesión.

Última actualización: **28-jul-2026**

## Línea base

| Campo | Estado |
|---|---|
| Etapa | Persistencia nativa y runtime — ejecución de `SPEC-004` |
| Código en este repositorio | Baseline migrado; hashes de origen preservados y cambios posteriores registrados |
| Spec activa | `specs/SPEC-004-D1-macos11-webview-render.md` |
| Suite oficial | 765/765 Node; 18/18 componentes; 9/9 Rust; laboratorio 35/35 |
| Build | OK, con warning medido de chunk inicial de 727,24 kB |
| Cobertura | core 93,59 %; store 96,97 % (gates 90 % / 85 %) |
| Toolchain de verificación | Node 22.23.1; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Python 3.14.5 + `ezdxf` 1.4.4 en `.venv-verification`; CalculiX 2.23; Playwright 1.62.0 externo |
| DXF heredados | 40 archivos auditados, 0 errores / 0 reparaciones |
| DXF R3-B | 14 archivos (`casa-L`: 2 R12 + 12 AC1015), 0 errores / 0 reparaciones |
| DXF R6-B | 6 archivos (`casa-L`: 1 R12 + 5 AC1015), 0 errores / 0 reparaciones |
| DXF R6-C | 8 archivos OSB (`casa-L`: 1 R12 + 7 AC1015), 0 errores / 0 reparaciones |
| DXF R8-C | 4 láminas A3 AC1015 representativas, 0 errores / 0 reparaciones |
| DXF SPEC-003-B | 9 archivos de 8 familias (3 R12 + 6 AC1015), 0 errores / 0 reparaciones |
| CalculiX R6-B | 45 muros regenerados con IDs cortos; 1.362 nodos / 1.012 elementos; `Job finished` |
| Objetivo de release | `v1.0.0-local` |
| Bloqueo actual | F-008: Tauri abre una ventana sin renderizar el frontend en macOS 11 |

## Hallazgos bloqueantes confirmados

| ID | Severidad | Hallazgo | Spec |
|---|---|---|---|
| F-008 | P1 | WebView macOS 11 carece de `Object.hasOwn`; React aborta antes del primer render | SPEC-004-D1 |

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

## Próximo cierre

Corregir `SPEC-004-D1`: compatibilidad del frontend y smoke de contenido real en el WebView de
macOS 11. Después retomar la ejecución controlada de CalculiX, sin incorporar todavía instalación
en `/Applications` ni packaging de release.
