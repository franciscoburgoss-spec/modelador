# Spec R8 — Informe markdown y criterios de revisión

> Octava unidad del plan de reglas de dominio.
> Base: commit `def6437`, suite 684/684.
> Decisiones de origen: legado D-016, D-017 y D-030; gobernanza D-018–D-029.

## Diagnóstico

R4 fijó el finding canónico y su presentación; R5 agregó roles explícitos; R6 estabilizó la
topología; R7 incorporó checks con cobertura y capacidad de corte. Todavía no existe un
entregable de revisión que reúna esos resultados:

- `ValidationModal` llama `validateModel(model)` y, por separado, concatena
  `validateRoofSystems(model)` y `validateRoofPlanes(model)`;
- `validateModel` mantiene por compatibilidad un retorno array y descarta la cobertura estructurada
  de `evaluateWallDomainChecks`, `evaluateRoofSupportChecks` y
  `computeShearCapacityByDirection`;
- los checks geométricos legacy y las validaciones de faldón/sistema sólo devuelven findings; no
  exponen casos inspeccionados ni omitidos;
- no existe `core/reportMarkdown.js`, descarga `.md` ni una frontera compartida entre lo que ve la
  pantalla y lo que saldría en un informe;
- el catálogo no declara la sección del informe ni en qué variante de lámina corresponde mostrar
  un criterio;
- `sheetLegend.js` usa notas estáticas o un override de usuario completo. Ningún criterio se
  obtiene todavía desde `DOMAIN_RULES`;
- un renderer markdown ingenuo podría interpretar pipes, saltos de línea o HTML crudo proveniente
  del modelo como estructura activa del documento.

### Medición reproducible

Sobre `tests/fixtures/casa-L.json` en el commit base, concatenando exactamente las tres rutas que
usa hoy `ValidationModal`:

- hay 54 findings: 8 `error`, 1 `warning` y 45 `info`;
- 45 son `wallRole`, 6 `trussJambAlignment`, 2 `trussInsideWall` y 1 `mismatchedEdge`;
- sólo los 6 `trussJambAlignment` llevan regla catalogada, medida, límite y fuente; los otros 48
  no pueden presentarse como incumplimientos normativos;
- `evaluateWallDomainChecks` inspecciona cero muros y registra 45 omisiones
  `wall-role-unresolved`;
- `evaluateRoofSupportChecks` inspecciona tres muros de apoyo, sin omisiones, y produce seis
  findings;
- la capacidad no evalúa muros MP1, registra 45 omisiones por rol ausente y no emite findings;
- el catálogo tiene ocho reglas, pero el fixture no contiene `wallTypes`: no hay roles explícitos
  desde los que inferir criterios de lámina.

El baseline demuestra dos fronteras distintas: un informe debe conservar los 54 findings sin
inventar norma para 48, y debe declarar que gran parte de la cobertura condicionada por rol no fue
verificable.

## Decisión

### 1. Una sola evaluación para pantalla e informe

`modelValidation.js` agrega una frontera pura `evaluateModelValidation(model, extraMargin)` que
devuelve los mismos findings de `validateModel`, junto con las salidas R7 ya calculadas:

```js
{
  findings: [],
  components: {
    wallTypeFindings: [],
    wallDomain: { findings: [], coverage: {} },
    roofSupport: { findings: [], coverage: {} },
    shearCapacity: { walls: [], totals: {}, findings: [], coverage: {} },
    legacyGeometryFindings: []
  }
}
```

`validateModel` delega y conserva su retorno array exacto. No se cambia su API pública.

Se crea `core/modelReview.js` con `evaluateModelReview(model, extraMargin)`. Agrega una sola vez
`validateRoofSystems` y `validateRoofPlanes` y devuelve:

```js
{
  findings: [],
  coverage: {
    wallDomain: {},
    roofSupport: {},
    shearCapacity: {},
    legacyGeometry: { instrumented: false, findingCount: 0 },
    roofGeometry: { instrumented: false, findingCount: 0 }
  },
  criteria: []
}
```

`ValidationModal` y el informe consumen el mismo resultado. Ninguno vuelve a ejecutar checks para
reconstruir cobertura o cifras. El orden de findings sigue siendo el visible hoy: validación común,
sistemas legacy y faldones.

La cobertura no instrumentada se declara literalmente; R8 no deduce casos exitosos desde la
ausencia de findings.

### 2. Metadata de informe en el catálogo

Cada regla agrega metadata inmutable y validada:

```js
{
  reportSection: 'Muros' | 'OSB' | 'Techumbre' | 'Modelo',
  sheetVariants: ('framing' | 'osb' | 'truss' | 'foundations')[]
}
```

La asignación inicial es:

| Regla | Sección | Lámina |
|---|---|---|
| `osb.tornillo.borde` | OSB | `osb` |
| `osb.cadeneta.ala` | OSB | `osb` |
| `muro.vano.holguraManilla` | Muros | `framing` |
| `muro.montante.paso` | Muros | `framing` |
| `muro.jamba.distanciaMontante` | Muros | `framing` |
| `muro.dintel.llegadaCercha` | Techumbre | `truss` |
| `muro.panel.largo` | Muros | `framing` |
| `muro.corte.capacidadOsb` | OSB | `osb` |

No se deriva la sección desde strings del ID ni desde la categoría del finding cuando existe una
regla. Findings sin regla usan los IDs tipados: techo → `Techumbre`, muro → `Muros`; el resto →
`Modelo`.

### 3. Criterios aplicables

`collectApplicableCriteria(model, findings)` es puro y usa únicamente roles explícitos:

1. considera sólo tipos asignados al menos a un muro;
2. construye por tipo el contexto resoluble actual (`role`, `gap`, `flangeWidth`);
3. aplica `ruleAppliesToRole` y `resolveRuleLimit`, sin defaults normativos inventados;
4. agrupa límites idénticos y conserva separados los que cambian por rol/tipo;
5. agrega una regla referenciada por un finding aunque el modelo sea legacy y no tenga rol,
   usando el límite medido por ese finding cuando exista;
6. ordena por el orden inmutable de `DOMAIN_RULES`, después por rol/tipo.

Un tipo declarado pero no asignado no agrega criterios. Un muro sin tipo no recibe rol inferido.
Un límite no resoluble queda como “No resoluble con los datos actuales”; no cae a 19 mm, gap 5 ni
otro default.

Para láminas se usan sólo criterios provenientes de roles explícitos. Una regla agregada
exclusivamente por un finding legacy pertenece al informe, no al plano.

### 4. Formato markdown

`core/reportMarkdown.js` expone un renderer puro y un adaptador de descarga. El documento usa LF y
este orden:

1. `# Informe de revisión constructiva`;
2. identificación desde `projectInfo` (`obra`, `ubicacion`, `proyectoNumero`, fecha declarada);
3. resumen con conteos `crítico` / `moderado` / `observación`;
4. una sección por severidad, en orden `error` → `warning` → `info`;
5. cobertura;
6. `NOTAS GENERALES — criterios aplicables`.

Cada sección de hallazgos usa exactamente:

```markdown
| # | Sección | Hallazgo | Norma | Esperado | Encontrado |
|---:|---|---|---|---|---|
```

Mapeo:

| Finding | Informe |
|---|---|
| `error` | Hallazgos críticos |
| `warning` | Hallazgos moderados |
| `info` | Observaciones |

- `Hallazgo` conserva categoría y mensaje.
- `Norma` enlaza las fuentes del catálogo para reglas manuales; una regla `derivado` dice
  “No aplica — criterio derivado”; una regla `obra`, “No aplica — criterio de obra”.
- Un finding sin regla dice “Sin regla catalogada”; no hereda una fuente por similitud textual.
- `Esperado` usa `limit`; si no existe, “No declarado”.
- `Encontrado` usa `measured`; `measured: null` dice “No verificable” y un campo ausente,
  “No medido”.
- No se omite ni deduplica ningún finding. La cantidad de filas es exactamente la cantidad de
  findings de la evaluación compartida.

El renderer no agrega la hora actual. La fecha sale de `projectInfo` o de una opción explícita
inyectada por el llamador, para conservar determinismo en pruebas.

### 5. Cobertura

La sección de cobertura distingue:

- `wallDomain`: IDs inspeccionados, IDs sin hallazgo dentro de ese evaluador, cantidad de findings
  y eventos `skipped` agrupados por `rule`/`reason`;
- `roofSupport`: la misma estructura;
- `shearCapacity`: conteos `verified`/`conditional`/`excluded`, totales X/Y y condiciones
  `unknown`;
- geometría legacy y geometría de techo: “Cobertura no instrumentada”, con su cantidad de
  findings, sin afirmar cuántos casos pasaron.

“Sin hallazgo” sólo puede calcularse para un ID presente en `checkedWallIds` y ausente de los
`wallIds` de findings del mismo evaluador. No significa aprobación normativa global.

Los `skipped` de R7 y las condiciones `unknown` son la forma vigente de “no verificable”.
R8 no agrega un campo persistido `check` ni reabre los checks para producir otro contrato.

### 6. `NOTAS GENERALES` de láminas

La misma colección de criterios genera notas compactas por `sheetVariants`. Cada nota contiene ID,
límite resoluble y rol/tipo aplicable; nunca contiene mensajes de findings.

Los criterios se anteponen a las notas efectivas existentes:

- si el usuario definió `projectInfo.notas[variant]`, se conservan esas notas después de los
  criterios;
- si no, se conservan después los defaults actuales;
- si no existen roles aplicables, la salida de la leyenda permanece igual al baseline.

En el peor caso A3 con los cuatro roles y sin override, ningún criterio aplicable puede desaparecer
detrás de `(...)`. R8 no lleva observaciones del modelo al DXF.

### 7. Integración de descarga

`ValidationModal` usa un único `useMemo` para `evaluateModelReview`. El botón
“Exportar informe (.md)” descarga `revision-constructiva.md` desde ese mismo snapshot y con el
mismo margen extra de conectividad que ve la pantalla.

El adaptador crea y revoca su object URL. No modifica el modelo, no guarda el informe dentro del
JSON y no realiza red.

Todo texto proveniente del modelo o de findings se neutraliza antes de entrar a markdown:
backslashes, pipes, saltos de línea y HTML crudo no pueden crear columnas, enlaces ni tags activos.
Las URLs del catálogo ya validadas como HTTPS son las únicas que se emiten como links.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Renderizar directamente desde `ValidationModal` | Duplica reglas en React y deja sin contrato al informe |
| Llamar otra vez cada check durante la exportación | Pantalla e informe podrían divergir y se perdería la pureza medible |
| Usar sólo `validateModel` | Omite validaciones de sistema/faldón y ya descartó cobertura R7 |
| Considerar ausencia de finding como cumplimiento | Los productores legacy no exponen universo inspeccionado |
| Asignar una norma a categorías legacy por palabras | Convierte similitud textual en trazabilidad falsa |
| Inferir roles desde perfiles, OSB o nombres | Contradice D-019/D-024 |
| Incluir todos los tipos de biblioteca | Tipos no asignados no describen el proyecto |
| Copiar findings a `NOTAS GENERALES` | El plano lleva criterios, no observaciones |
| Reemplazar notas de usuario por criterios | Pierde información persistida de forma silenciosa |
| Agregar fecha/hora actual dentro del renderer | Rompe determinismo y snapshots |
| Generar PDF/DOCX mediante un conversor | Agrega runtime/dependencias fuera del entregable markdown |

## Alcance

- Metadata `reportSection`/`sheetVariants` de las ocho reglas y validación del catálogo.
- Frontera compartida de evaluación para pantalla e informe, preservando `validateModel`.
- Agregación explícita de cobertura R7 y declaración de productores no instrumentados.
- Colección pura de criterios por roles/tipos asignados y reglas referenciadas.
- Renderer markdown determinista con resumen, hallazgos, cobertura y criterios.
- Escape de contenido no confiable y links sólo desde fuentes catalogadas.
- Descarga `.md` desde `ValidationModal` usando el mismo snapshot/margen visible.
- Criterios automáticos por variante en `NOTAS GENERALES`.
- Pruebas focalizadas, regresión `casa-L`, reversión y auditoría DXF de láminas afectadas.

## Fuera de alcance

- Crear, cambiar o reinterpretar reglas, límites o fuentes R4–R7.
- Inferir o asignar roles a modelos legacy.
- Convertir capacidad condicionada en verificada o compararla con demanda.
- Instrumentar cobertura interna de todos los checks geométricos legacy.
- Corregir findings detectados por el informe.
- Persistir informes o cambiar `modelVersion`.
- Agregar firma, aprobación profesional o validez normativa al documento.
- Generar PDF, DOCX, HTML o publicar el informe en red.
- Llevar findings u observaciones a los DXF.
- Modificar geometría, metrado, nesting, INP o resultados CalculiX.
- Integrar guardado nativo Tauri; corresponde a SPEC-004.

## Criterios de aceptación

1. `evaluateModelReview` es puro y sus findings son `deepEqual` a la concatenación visible previa:
   `validateModel` + sistemas legacy + faldones, sin duplicar evaluadores.
2. `validateModel` conserva su retorno array y los baselines R4/R5; pantalla e informe consumen un
   mismo snapshot.
3. `casa-L` conserva exactamente 54 findings (8 errores, 1 warning, 45 info) mientras no cambie un
   productor con justificación documentada.
4. Cada finding produce exactamente una fila; severidad, sección, categoría/mensaje y orden son
   estables. Cero findings genera secciones explícitamente vacías, no un informe vacío.
5. Regla manual muestra fuente; regla derivada/obra se identifica sin fingir norma; finding sin
   regla dice “Sin regla catalogada”.
6. `limit`, `measured`, `null` y ausencia se distinguen como esperado, encontrado, no verificable y
   no medido.
7. Cobertura informa inspeccionados/sin hallazgo/skipped de R7, estados/totales/unknown de capacidad
   y declara como no instrumentados los productores legacy.
8. Los criterios consideran sólo tipos asignados y roles explícitos, resuelven límites por contexto,
   deduplican establemente e incluyen reglas referenciadas por findings legacy.
9. Pipes, saltos, backslashes y HTML crudo de datos no confiables no alteran la tabla ni crean tags;
   sólo URLs HTTPS catalogadas se emiten como links.
10. Dos renderizados con el mismo snapshot/opciones son byte a byte iguales y usan LF.
11. El botón exporta el mismo conjunto y margen de la pantalla, funciona también con cero findings,
    crea `revision-constructiva.md`, revoca la URL y no muta el store.
12. `NOTAS GENERALES` contiene todos los criterios aplicables por variante, nunca findings; conserva
    notas del usuario/defaults y no cambia el baseline cuando no hay roles.
13. El peor caso A3 con MP1/MP2/MP3/tabique conserva todos los IDs de criterio sin `(...)`. Los DXF
    modificados terminan con auditoría `ezdxf` 0 errores / 0 reparaciones.
14. Revertir por separado snapshot compartido, renderer/cobertura y criterios de lámina rompe al
    menos una prueba focalizada de cada corte.
15. `make governance` y `npm run validate` terminan con código 0. R8 no toca INP, por lo que no
    requiere un smoke CalculiX adicional.

## Evidencia

- Regresión `casa-L` con 54 filas y distribución 8/1/45.
- Casos mínimos con regla manual, derivada, de obra y finding legacy sin regla.
- Matriz `measured`/`limit` presentes, `null` y ausentes.
- Cobertura con checked/skipped, OSB stale/ausente y capacidad conditional/excluded/unknown.
- Roles MP1/MP2/MP3/tabique, tipos no usados, límites distintos y modelo sin rol.
- Payloads con `|`, CR/LF, backslash y HTML crudo.
- Snapshot determinista y equivalencia pantalla/informe.
- Descarga con adaptadores DOM inyectados y revocación comprobable.
- Leyendas framing/OSB/truss/foundations en A3 y notas de usuario.
- DXF representativos auditados con `ezdxf` 0/0.
- Reversión controlada por corte.

## Corte sugerido

| Corte | Unidad cerrable |
|---|---|
| **A** | Metadata de catálogo, snapshot compartido, cobertura/criterios y renderer markdown puro |
| **B** | `ValidationModal`, descarga `.md` y equivalencia pantalla/informe |
| **C** | Criterios automáticos en `NOTAS GENERALES`, regresión de láminas y auditoría DXF |

El orden es A → B → C. A fija el documento y la fuente única; B lo hace utilizable sin introducir
otra evaluación; C modifica salidas DXF sólo cuando el contrato de criterios ya está probado.
