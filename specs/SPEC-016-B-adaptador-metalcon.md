# SPEC-016-B — Adaptador Metalcon sobre arquitectura de soluciones constructivas

**Estado:** abierta · 15-ago-2026
**Esfuerzo planificado:** `high`
**Baseline de apertura:** `fde781c4c95fa66bab2fdb7014839922db1cdb33`
**Predecesora obligatoria:** SPEC-016-A cerrada
**SPEC-016-C:** bloqueada hasta cierre humano, gates y publicación de SPEC-016-B

## Diagnóstico

SPEC-016-A cerró la arquitectura común de escenarios, frontera efectiva,
generación efímera, receipts, freshness, coverage y verification.

La inspección A2-A5 demostró que Metalcon legacy contiene autoridad histórica,
derivados persistidos y consumidores acoplados que no deben migrarse al nuevo
dominio. SPEC-016-B desarrolla Metalcon desde cero sobre la frontera cerrada
por SPEC-015/016-A.


## 1. Objetivo

Implementar desde cero Metalcon como primer adaptador constructivo productivo de la arquitectura cerrada por SPEC-016-A.

El adaptador consume exclusivamente la frontera constructiva efectiva formada por geometría agnóstica efectiva, `structural-requirements-v1.0` efectivos, configuración persistente del escenario, assignments explícitos y biblioteca Metalcon versionada.

Metalcon no define geometría, intención estructural ni requirements.

## 2. Autoridades

La precedencia contractual es:

```text
agnostic geometry
        ↓
structuralIntent
        ↓
structural requirements
        ↓
constructive scenario
        ↓
constructive adapter input
        ↓
Metalcon adapter
        ↓
constructive solution derivada
        ↓
receipt persistente
```

Son invariantes:

- geometría agnóstica = autoridad física;
- `structuralIntent` = autoridad humana estructural persistente;
- requirements = derivados recalculables y `notVerified`;
- scenario configuration/assignments = autoridad humana constructiva;
- output del adapter = derivado no persistente;
- receipt = evidencia persistente de generación;
- `resolved != verified`;
- `complete != verified`;
- `fresh != verified`;
- `available != verified`.

SPEC-016-B acepta exclusivamente `verificationState=notVerified`.

## Decisión

Implementar Metalcon como adapter productivo nuevo, sin migración ni
sincronización con la implementación legacy. Mantener modelVersion 4,
preservar las autoridades de SPEC-015/016-A y desarrollar los cortes B1-B5
de forma controlada.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: introduce un adapter constructivo productivo nuevo, biblioteca
  versionada, materialización y trazabilidad sobre las autoridades cerradas
  por SPEC-015/016-A; el desarrollo exige control alto, pero no justifica
  superar el techo ordinario `high`.

## 3. Decisión de ruptura limpia con Metalcon legacy

La implementación Metalcon existente queda congelada como referencia histórica.

El nuevo adaptador no migra, proyecta, sincroniza, interpreta ni usa legacy como fallback o expected contractual.

Quedan fuera de la entrada del nuevo adaptador:

- `wallTypes`;
- `wallTypeId`;
- `wallRoles` y MP1/MP2/MP3/tabique históricos;
- `metalconDefaults` legacy;
- `osbDefaults` legacy;
- `model.library.metalconProfiles`;
- `wall.studs`;
- `wall.headers`;
- `wall.osbCourses`;
- `metalconModulation`;
- `batchModulation`;
- exportadores y consumidores Metalcon históricos.

Los módulos legacy permanecen físicamente operativos mientras existan consumidores productivos anteriores, pero SPEC-016-B no los modifica salvo que un defecto ajeno bloquee el funcionamiento general y exista un BUG separado autorizado.

No existe criterio de equivalencia pieza a pieza entre legacy y el nuevo adaptador.

## 4. Persistencia

SPEC-016-B conserva `modelVersion: 4` y no modifica la migración v3→v4 cerrada por SPEC-016-A.

Permanecen los contratos persistentes:

- `constructive-solution-scenarios-v1.0`;
- `constructive-solution-scenario-v1.0`;
- `constructive-solution-assignment-v1.0`;
- `constructive-generation-receipt-v1.0`.

Los escenarios continúan usando IDs canónicos secuenciales `scenario:000001`, `scenario:000002`, etc. No existe `scenario:metalcon:legacy`.

## 5. Escenario Metalcon

Un escenario Metalcon se crea sólo mediante una acción explícita y usa:

```json
{
  "adapterRef": {
    "adapterId": "metalcon",
    "adapterVersion": "1.0.0"
  }
}
```

Su configuración usa `metalcon-scenario-configuration-v1.0`.

## 6. Configuración constructiva y assignments

`scenario.configuration` y `scenario.assignments[]` tienen responsabilidades distintas.

La configuración expresa decisiones constructivas que no requieren por sí mismas un requirement estructural: selección de sistema de muro, perfil, material, panel, separación, parámetros de modulación y otras decisiones constructivas explícitas.

Forma conceptual:

```json
{
  "schema": "metalcon-scenario-configuration-v1.0",
  "inputRefs": {
    "schema": "constructive-configuration-input-refs-v1.0",
    "elementIds": []
  },
  "constructionSelections": []
}
```

`scenario.assignments[]` permanece reservado a elecciones explícitas que responden a requirements o regiones estructurales reales. Nunca se crea un assignment sólo porque un muro tenga una selección constructiva.

## 7. Geometría adicional solicitada por configuración

Un adapter no puede abrir `model.elements` directamente.

La proyección efectiva común se amplía como unión de geometría requerida por structural requirements y geometría solicitada por `configuration.inputRefs`.

El contrato inicial es `constructive-configuration-input-refs-v1.0`.

Una referencia inexistente, ambigua o no resoluble falla cerradamente. No existe fallback geométrico silencioso.

## 8. Biblioteca Metalcon

SPEC-016-B crea una biblioteca Metalcon nueva e independiente del catálogo legacy.

Manifest inicial: `metalcon-library-manifest-v1.0`.

Identidad:

```json
{
  "libraryId": "metalcon-library",
  "libraryVersion": "1.0.0",
  "sha256": "..."
}
```

El hash debe corresponder al manifest canónico real.

El vocabulario usa IDs textuales propios: `metalcon-profile:*`, `metalcon-material:*`, `metalcon-panel:*`, `metalcon-wall-assembly:*`, `metalcon-component:*` y `metalcon-connection:*`. No se reutilizan IDs numéricos históricos.

## 9. Library context productivo

SPEC-016-A conserva `constructive-library-context-v1.0` para el runtime neutral.

SPEC-016-B introduce `constructive-library-context-v2.0` con envolvente genérica:

```json
{
  "schema": "constructive-library-context-v2.0",
  "libraryId": "...",
  "libraryVersion": "...",
  "sha256": "...",
  "componentTypes": [],
  "adapterPayload": {}
}
```

El núcleo común conoce identidad, versión, hash y component types. El adapter interpreta exclusivamente su `adapterPayload`.

## 10. Runtime común

El pipeline deja de invocar directamente al generador neutral.

El runtime explícito entrega como mínimo capacidades equivalentes a:

```text
runtime.generateSolution(adapterInput)
runtime.assertValidSolution(solution, adapterInput)
```

El pipeline común no contiene ramas especiales por material. El runtime neutral de SPEC-016-A permanece como regresión contractual y continúa aceptando su protocolo v1.

## 11. Output productivo

SPEC-016-B introduce `constructive-solution-v2.0` como salida derivada y no persistente.

Forma conceptual:

```json
{
  "schema": "constructive-solution-v2.0",
  "scenarioId": "...",
  "adapterRef": {},
  "libraryRef": {},
  "effectiveGenerationInputSha256": "...",
  "verificationState": "notVerified",
  "generatedArtifacts": [],
  "requirementResolutions": [],
  "findings": [],
  "canonicalSha256": "..."
}
```

`canonicalSha256` excluye su propia inclusión y representa el payload canónico completo.

## 12. Artefactos constructivos

La envolvente común es independiente del material:

```json
{
  "artifactId": "constructive-artifact:sha256:...",
  "kind": "member",
  "sourceRefs": [],
  "requirementRefs": [],
  "payload": {}
}
```

Kinds iniciales: `member`, `connection`, `panel`, `assembly`.

El payload técnico es propiedad del adapter y declara schema propio. Un artefacto nacido sólo desde configuración puede declarar `requirementRefs: []`. Un artefacto que afirma responder a un requirement debe conservar provenance explícita y coherente con un assignment originador.

## 13. Requirement resolutions v2

Se mantienen `resolved`, `partiallyResolved` y `unresolved`.

Una respuesta materializada usa refs a artefactos derivados mediante `constructive-resolution-response-v2.0`.

Reglas:

- `unresolved` → `response=null` y cero assignments originadores;
- `resolved`/`partiallyResolved` → al menos un assignment originador;
- todo `artifactRef` debe existir;
- un artifact no puede adjudicarse un requirement sin provenance;
- ninguna resolution cambia `verificationState=notVerified`.

## 14. Dominio Metalcon nuevo

La materialización de muros se desarrolla desde cero sobre `effectiveGeometry`.

El dominio podrá generar, según configuración aprobada, solera inferior, solera superior, montantes, jambas, dinteles constructivos, antepechos, refuerzos alrededor de vanos y paneles/revestimientos básicos.

No reutiliza `wall.studs`, `wall.headers` ni `wall.osbCourses`.

## 15. Vanos

Los vanos provienen exclusivamente de geometría efectiva. El adapter puede materializar componentes alrededor del vano, pero nunca modifica el vacío físico ni crea uno nuevo por inferencia.

## 16. Caso real obligatorio — FX-008

FX-008 se usa como proyecto real desde cero, no como fuente de migración.

Caso lateral gobernante:

```text
gap vertical = 571.429 mm
→ loadTransferRequired
```

Sin assignment Metalcon explícito queda `unresolved` y `verificationState=notVerified`.

Con assignment explícito puede producir artefactos trazables y quedar `resolved` o `partiallyResolved` según contrato, siempre `notVerified`.

La existencia de cielo falso, revestimiento u otra pieza no declarada resistente nunca resuelve implícitamente la transferencia.

## 17. Independencia legacy

Los nuevos módulos Metalcon no pueden importar ni leer autoridades legacy.

Debe existir auditoría estática y reversión dinámica: cambiar `wallTypeId`, `wall.studs` o el catálogo Metalcon legacy no puede alterar el mismo adapterInput efectivo, output ni canonicalSha256 del escenario nuevo.

## Alcance

SPEC-016-B comprende la apertura del protocolo común necesario para adapters
productivos, el dominio Metalcon nuevo, su materialización, la respuesta
explícita a requirements y la interfaz/evidencia final, divididos en los
cortes B1-B5 definidos a continuación.

## 18. Cortes

### B1 — protocolo común

**Estado del corte:** CERRADO — 15-ago-2026.

Runtime adapter-neutral, refs constructivas explícitas, library context v2, solution v2, validadores comunes y compatibilidad completa del runtime neutral v1. Ningún algoritmo Metalcon.

El cierre técnico B1 conserva `modelVersion: 4`, mantiene byte-identical el generador neutral v1, no persiste generated solution, persiste únicamente receipt compatible y conserva `verificationState=notVerified`.

Evidencia B1: protocolo focal 7/7 PASS; suite constructiva 192/192 PASS; Node 1219/1219 PASS; componentes 61/61 PASS; Rust 9/9 PASS; laboratorio 35/35 PASS; `npm run validate` integral PASS; `git diff --check` PASS; ninguna modificación en store, UI, `modelSchema.js` o Metalcon/OSB legacy.

### B2 — dominio Metalcon

**Estado del corte:** CERRADO — 16-ago-2026 mediante `SPEC-016-B / B2-CLOSE`.

Manifest Metalcon, configuración Metalcon, runtime Metalcon, adapter shell, IDs canónicos, hash real de biblioteca y auditoría de independencia legacy.

B2 materializa exclusivamente el dominio Metalcon nuevo previo a B3:

- `metalcon-library-manifest-v1.0` como fuente única de la biblioteca nueva;
- `metalcon-library-payload-v1.0` derivado del manifest;
- IDs textuales namespaced y sin reutilización de IDs históricos;
- `metalcon-scenario-configuration-v1.0` con `inputRefs` explícitos;
- configuración constructiva separada de assignments estructurales;
- runtime `metalcon@1.0.0` compatible con el protocolo común B1;
- salida v2 efímera y receipt v1 persistente;
- pre-B3, todo requirement efectivo permanece `unresolved`, sin artefactos y `notVerified`;
- auditoría estática y reversión dinámica D-070 contra Metalcon legacy.

La biblioteca inicial conserva registros productivos vacíos y
`componentTypes=[]`; B2 no materializa miembros ni componentes de respuesta
estructural.

Evidencia B2:

- SHA-256 canónico inicial de la biblioteca:
  `f90a840bd2a88a2ddd270592ef5e375d4177f345f7eb1d0c6fea608ff65135f0`;
- biblioteca B2: 8/8 PASS;
- configuración B2: 7/7 PASS;
- runtime Metalcon B2: 4/4 PASS;
- regresión conjunta B1+B2: 26/26 PASS;
- FX-008 usa explícitamente muro `1784606313849`, cubierta
  `1785158713616` y gap contractual `571.429 mm`;
- sin assignment ni `constructionSelections`, la transferencia permanece
  `unresolved` y `verificationState=notVerified`;
- generated output no persiste y el receipt sí;
- BUG-016-B-009 y BUG-016-B-010 cerrados;
- `npm run validate` pre-cierre: Node 1238/1238, componentes 61/61,
  Rust 9/9, laboratorio 35/35, goldens 19, DXF 14 con 0 errores /
  0 reparaciones, CalculiX 3/3, build, migración, artefactos, derivados,
  auditoría y gobernanza PASS.

B2 no implementa tracks, studs, jambas, headers, sills, paneles, resolución
estructural mediante assignments ni UI Metalcon. Esas fronteras permanecen
respectivamente en B3, B4 y B5.

### B3 — materialización

**Estado del corte:** ABIERTO — 17-ago-2026 mediante D-072.

La Fase A B3 v1.0 queda aprobada por revisión humana. B3 transforma decisiones
constructivas B2 y geometría efectiva en artifacts constructivos lógicos,
deterministas y efímeros sin resolver requirements estructurales.

#### B3.1 Frontera de entrada

B3 consume exclusivamente la frontera efectiva del adapter:

- configuración Metalcon persistente;
- biblioteca Metalcon nueva/versionada;
- `effectiveGeometry`;
- `effectiveStructuralRequirements` únicamente para mantener la partición
  completa de resolutions;
- fingerprints/provenance ya definidos por el protocolo común.

No accede libremente al modelo ni consume `wallTypes`, `wallTypeId`,
`wall.studs`, `wall.headers`, `wall.osbCourses`, defaults, perfiles o módulos
Metalcon legacy.

`element.solids` no se utiliza como fallback para reconstruir framing. La
autoridad física B3 es el prisma efectivo del host y sus `openings[].void`.

##### B3.1a — contrato y resolver de familias

**Estado: CERRADO — 17-ago-2026 mediante D-074.**

B3.1a implementa la semántica de resolución sin poblar todavía el catálogo
productivo canónico.

El resolver consume exclusivamente:

- una `constructionSelection` B2 válida;
- la biblioteca Metalcon nueva suministrada por la frontera constructiva;
- refs declaradas explícitamente por la selección o resueltas desde
  `wallAssemblyRef`.

B3.1a:

- no consume geometría para inferir decisiones;
- no consume Metalcon legacy;
- no introduce defaults;
- no materializa studs, tracks, jambas, sills, heads ni paneles;
- no produce `generatedArtifacts`;
- no procesa assignments;
- no resuelve requirements;
- conserva `verificationState=notVerified`.

Los tests de B3.1a pueden usar manifests/adapterPayload sintéticos para cubrir
el contrato adversario, pero dichos fixtures son explícitamente no
productivos y no pueden convertirse por copia, nombre o coincidencia incidental
en entradas de la biblioteca canónica.

La biblioteca productiva puede permanecer vacía durante B3.1a.

##### B3.1b — catálogo productivo real inicial

**Estado: CERRADO — 17-ago-2026 mediante D-076.**

Antes de comenzar B3.2, SPEC-016-B debe incorporar un catálogo Metalcon
productivo inicial pequeño pero real y suficiente para ejercer FX-008.

Cada entrada productiva debe:

- corresponder a un producto, sección, material o panel real;
- conservar ID namespaced propio del dominio nuevo;
- declarar fuente y versión/fecha documental suficientes para su trazabilidad;
- usar únicamente valores demostrados por dicha fuente;
- distinguir datos geométricos/materiales documentados de cualquier conclusión
  estructural posterior;
- evitar cualquier lectura, migración o fallback desde Metalcon legacy.

Los nombres e IDs usados en fixtures B2/B3.1a no constituyen por sí mismos
autoridad para crear entradas productivas.

El conjunto inicial puede ser deliberadamente pequeño. No es requisito cargar
un catálogo comercial completo para cerrar B3.1b.

La selección y contenido exactos del catálogo inicial requieren revisión humana
antes de materializarse.

`studSpacingMm` continúa siendo una decisión explícita de configuración y no se
incorpora como default oculto de `wallAssemblyRef`.

Conocer dimensiones o propiedades reales de un producto no implica que éste
resuelva un requirement estructural. Esa adjudicación permanece fuera de B3 y
requiere la frontera B4.

D-076 acredita el cierre humano de B3.1b con catálogo productivo real y gates verdes.
B3.2 queda habilitado exclusivamente para Fase A READ-ONLY; su implementación
requiere una nueva aprobación humana explícita.

###### Catálogo productivo inicial aprobado — D-075

B3.1b implementará exactamente estas cuatro autoridades productivas nuevas:

1. `metalcon-profile:cintac-90ca085`
   - fabricante: CINTAC;
   - familia: Metalcon Estructural;
   - nomenclatura comercial de sección: `90CA085`;
   - forma: C atiesada, sin perforación;
   - alma `H = 90 mm`;
   - ala `B = 38 mm`;
   - atiesador `C = 12 mm`;
   - espesor `e = 0,85 mm`;
   - peso nominal documentado `1,23 kg/m`.

2. `metalcon-profile:cintac-92c085`
   - fabricante: CINTAC;
   - familia: Metalcon Estructural;
   - nomenclatura comercial de sección: `92C085`;
   - forma: U;
   - alma `H = 92 mm`;
   - ala `B = 30 mm`;
   - espesor `e = 0,85 mm`;
   - peso nominal documentado `1,00 kg/m`.

3. `metalcon-material:cintac-metalcon-estructural-a653-sq-gr40-g90`
   - fabricante/familia: CINTAC Metalcon Estructural;
   - materia prima documentada: `ASTM A653 SQ Gr 40`;
   - recubrimiento documentado: `G90`;
   - masa nominal de recubrimiento documentada: `275 g/m2`.

4. `metalcon-panel:lp-osb-apa-protec-11_1-1220x2440`
   - fabricante: LP Building Solutions / LP Chile;
   - producto: `LP OSB APA Protec`;
   - tipo: tablero estructural OSB;
   - espesor `11,1 mm`;
   - ancho `1220 mm`;
   - largo `2440 mm`.

Fuentes CINTAC congeladas para B3.1b:

- `Manual de Diseño Metalcon`, Primera Edición, enero de 2004:
  ficha técnica y serie de perfiles;
- `Manual de Construcción Metalcon`, aportado por revisión humana:
  tabla Metalcon Estructural y detalles constructivos.

Fuente LP congelada para B3.1b:

- ficha oficial `LP OSB APA Protec` de LP Chile, revisada 17-ago-2026.

Reglas de autoridad:

- el nombre del archivo local del Manual de Diseño no gobierna su edición;
  gobierna la edición interna declarada por el documento;
- un largo comercial o código SAP/CINTAC de presentación no forma parte de la
  identidad de la sección;
- no se crean variantes de perfil sólo por diferencias de largo comercial;
- no se copian IDs ni valores desde fixtures de B3.1a;
- no se lee ni reconcilia Metalcon legacy;
- `wallAssemblies` permanece vacío en B3.1b;
- `components` y `connections` permanecen vacíos;
- `studSpacingMm` permanece decisión explícita de escenario;
- no se incorporan en este corte `Fy`, `Fu`, tablas de capacidad, cargas
  admisibles ni resistencia de diseño del panel;
- datos geométricos o materiales documentados no resuelven requirements y no
  cambian `verificationState=notVerified`;
- la condición de D-075 mantuvo B3.2 bloqueado hasta gates verdes y cierre humano de B3.1b; D-076 acredita su cumplimiento y habilita únicamente su Fase A READ-ONLY.

###### Cierre B3.1b — D-076

APROBADO Y CERRADO — 17-ago-2026.

La revisión humana cierra B3.1b después de materializar exactamente el
catálogo productivo aprobado por D-075.

Evidencia de cierre:

- manifest productivo canónico SHA-256
  `6937c18a134c9bd4b228150f2336431723649e21f98fee9158ab9c7c1651e93d`;
- catálogo productivo: 4/4 PASS;
- puente resolver + catálogo productivo: 1/1 PASS;
- focal integrada B2/B3.1: 26/26 PASS;
- SPEC-016-B: 41/41 PASS;
- Node: 1253/1253 PASS;
- componentes: 61/61 PASS;
- build e independencia legacy: PASS;
- diff, format y governance: PASS.

El cierre no introduce capacidades, Fy/Fu de cálculo, assignments,
requirement responses ni verificación estructural.

D-076 habilita B3.2 exclusivamente para Fase A READ-ONLY. Su
implementación requiere una nueva aprobación humana explícita.

#### B3.2 Hosts y frame local

B3-core materializa exclusivamente hosts de muro explícitamente tipados como
tales en `effectiveGeometry`.

Cada muro usa un frame local canónico `(s,z)`:

- `s=0...L` recorre longitudinalmente el host;
- `z` conserva elevación;
- invertir el orden incidental de `start/end` no altera artifacts, IDs ni SHA;
- si el prisma no permite construir inequívocamente el frame requerido, B3
  falla cerrado.

D-078 congela la elegibilidad geométrica defensiva del host antes de construir
el frame:

- todas las coordenadas de `start/end` deben ser finitas;
- un host X exige `start.y === end.y`, `start.z === end.z` y
  `start.x !== end.x`;
- un host Y exige `start.x === end.x`, `start.z === end.z` y
  `start.y !== end.y`;
- X se canonicaliza ordenando extremos por `x` creciente e Y por `y`
  creciente; invertir incidentalmente `start/end` produce el mismo frame;
- prismas diagonales, casi ortogonales, casi nivelados, de longitud plana cero
  o no finitos fallan cerrado;
- B3 no promedia, proyecta, hace snapping ni selecciona un eje dominante;
- estas comparaciones se realizan sobre `effectiveGeometry` antes del
  redondeo canónico.

Esta regla se limita a hosts WALL y no se extiende automáticamente a
`opening.void`.

D-084 completa las precondiciones defensivas del host antes de construir el
frame:

- `host.type === 'wall'`;
- `host.prism.kind === 'oriented-prism'`;
- `host.prism.height` debe ser finito y estrictamente mayor que cero;
- `host.prism.thickness` debe ser finito y estrictamente mayor que cero;
- después de canonicalizar únicamente la inversión incidental de extremos:
  - `z0 = canonicalStart.z`;
  - `z1 = z0 + host.prism.height`;
  - para X, `L = canonicalEnd.x - canonicalStart.x`;
  - para Y, `L = canonicalEnd.y - canonicalStart.y`.

Todo incumplimiento falla cerrado antes de construir `M`, validar openings o
producir geometría derivada. Las tolerancias B3.4 no reparan, aproximan ni
vuelven válidos `kind`, `height` o `thickness`.

D-081 hace explícita la frontera de dominio: que una geometría
`agnostic-geometry-v1.0` sea válida o haya sido auditada upstream no implica
que sea materializable por todos los adaptadores. B3.2 consume deliberadamente
el subdominio más estricto definido por D-078. Un host válido/auditado upstream
que no satisfaga esas igualdades exactas falla cerrado en B3.2; no se declara
inválido upstream ni se proyecta, promedia, ajusta, hace snapping o
reinterpreta para volverlo elegible.

B3 no materializa todavía vigas, pilares ni reticulados generales.

#### B3.3 Dominio geométrico y openings

En el frame local, usando exclusivamente `L`, `z0` y `z1` construidos por
B3.2:

`M = [0,L] × [z0,z1]`

Cada vano efectivo define un void rectangular `Oi` y la materia conceptual es:

`S = M \ union(Oi)`.

Los openings quitan materia; nunca redefinen ni reinician la modulación.

D-082 congela las precondiciones defensivas para convertir un `opening.void`
en su rectangle local `Oi`. Para cada opening del host:

- `opening.hostWallId === host.id`;
- `opening.kind` debe ser `door` o `window`;
- `opening.void.kind === 'oriented-prism'`;
- `void.start`, `void.end`, `void.thickness` y `void.height` deben contener
  únicamente números finitos;
- `void.thickness > 0` y `void.height > 0`;
- para host X:
  `void.start.y === void.end.y === host.prism.start.y`,
  `void.start.z === void.end.z` y `void.start.x !== void.end.x`;
- para host Y:
  `void.start.x === void.end.x === host.prism.start.x`,
  `void.start.z === void.end.z` y `void.start.y !== void.end.y`;
- `void.thickness === host.prism.thickness`.

Sea `h0` la coordenada longitudinal del origen canónico del host. Se define:

- host X:
  `sStart = void.start.x - h0`,
  `sEnd = void.end.x - h0`;
- host Y:
  `sStart = void.start.y - h0`,
  `sEnd = void.end.y - h0`;
- `sMin = min(sStart,sEnd)`;
- `sMax = max(sStart,sEnd)`;
- `zMin = void.start.z`;
- `zMax = void.start.z + void.height`.

La inversión incidental de `void.start/end` produce el mismo `Oi`; no modifica
ninguna coordenada. B3.2 no proyecta, promedia, ajusta, hace snapping ni
corrige espesor para volver elegible un opening.

D-079 y D-080 congelan además la validación geométrica local de los openings:

- cada `Oi=[sMin,sMax] × [zMin,zMax]` debe satisfacer exactamente `Oi ⊆ M`;
- el contacto exacto con `s=0`, `s=L`, `z=z0` o `z=z1` es válido;
- cualquier excedencia estrictamente positiva de `Oi` fuera de `M` en `s` o
  `z` falla cerrado;
- para dos openings del mismo host:
  `overlapS = min(s1Max,s2Max) - max(s1Min,s2Min)` y
  `overlapZ = min(z1Max,z2Max) - max(z1Min,z2Min)`;
- existe solape 2D inválido únicamente cuando
  `overlapS > 0 && overlapZ > 0`;
- el contacto exacto de borde o esquina entre openings es válido;
- toda comparación ocurre antes del redondeo canónico.

B3 no recorta, mueve, repara, fusiona ni reinterpreta openings y no aplica
clipping implícito ni importa silenciosamente tolerancias o `minimumOverlap`
desde SPEC-014.

#### B3.4 Tolerancias

B3 congela como contrato propio:

- `MATERIALIZATION_TOL_LINEAR_MM = 0.1`;
- `MATERIALIZATION_TOL_LEVEL_MM = 0.1`;
- `MATERIALIZATION_MIN_SEGMENT_MM = 0.1`;
- salida canónica a 3 decimales.

Se compara antes de redondear. La tolerancia no modifica geometría
autoritativa.

`MATERIALIZATION_TOL_LINEAR_MM` y `MATERIALIZATION_TOL_LEVEL_MM` no participan
en la elegibilidad geométrica del host definida en B3.2 y no convierten una
desigualdad de coordenadas en igualdad.

Estas tolerancias tampoco participan en las precondiciones de `opening.void`
definidas por D-082: no corrigen eje, coordenada transversal, nivel, espesor,
longitud ni dimensiones, y no se importa
`DEFAULT_AGNOSTIC_GEOMETRY_TOLERANCE_MM` como tolerancia B3.2.

Estas tolerancias tampoco expanden `M` ni convierten un opening exterior en
válido. `MATERIALIZATION_TOL_LINEAR_MM`, `MATERIALIZATION_TOL_LEVEL_MM` y
`MATERIALIZATION_MIN_SEGMENT_MM` no constituyen umbral de solape: cualquier
penetración estrictamente positiva en ambas dimensiones mantiene inválido el
solape, incluso si es menor o igual que `0.1 mm`.

Para una posición derivada de grid `sGrid` y un borde geométrico autoritativo
`sEdge` se define:

`distance = abs(sGrid - sEdge)`.

Si `distance <= MATERIALIZATION_TOL_LINEAR_MM`, incluyendo exactamente
`0.1 mm`, prevalece `sEdge` y se unifican las posiciones constructivas
asociadas. No se promedia, no se mueve el opening y no se crea una tercera
coordenada.

Si `distance > MATERIALIZATION_TOL_LINEAR_MM`, `sGrid` y `sEdge` permanecen
como posiciones distintas.

Cuando un mismo `sGrid` queda dentro de tolerancia de múltiples bordes
geométricos autoritativos distintos, se considera el conjunto:

`E = { sEdge | abs(sGrid - sEdge) <= MATERIALIZATION_TOL_LINEAR_MM }`.

Si existe un único borde de `E` con distancia mínima a `sGrid`, prevalece
exclusivamente ese borde para el candidato derivado de grid.

Si dos o más bordes autoritativos distintos comparten exactamente la distancia
mínima, B3 falla cerrado por ambigüedad geométrica. No se decide por orden
incidental, ID, menor o mayor coordenada, promedio ni desplazamiento del
opening.

Los demás bordes autoritativos conservan sus propias posiciones candidatas; no
se fusionan ni eliminan por esta regla.

La comparación ocurre antes del redondeo canónico. Esta regla actúa únicamente
sobre una posición constructiva derivada de grid y no repara, expande ni vuelve
válida geometría autoritativa.

#### B3.5 Retícula maestra vertical

Con spacing explícito `d`, el índice de retícula pertenece a los enteros no
negativos:

`n ∈ Z, n >= 0`.

Se define:

`Pgrid = { n*d | n ∈ Z, n >= 0, n*d < L } union { L }`.

Por tanto, `s=0` pertenece a `Pgrid` mediante `n=0`; no existen posiciones
negativas; los múltiplos regulares se calculan directamente como `n*d`; y `L`
se incorpora exactamente una vez como extremo final.

Si `d == L` o `d > L`, `Pgrid` contiene exactamente `{0,L}`.

La modulación se calcula siempre desde `s=0`; no usa suma acumulativa y nunca
se reinicia por un vano.

Las posiciones candidatas verticales son la unión de grid, bordes efectivos de
openings y extremos `0/L`.

Después de canonicalizar previamente las posiciones derivadas de grid conforme
D-088, para cada posición candidata vertical `s` y cada opening
`Oi=[sMin,sMax] × [zMin,zMax]` se distingue exactamente entre frontera e
interior longitudinal:

- sólo `sMin < s && s < sMax` constituye interior longitudinal del opening y
  hace que se sustraiga su intervalo `[zMin,zMax]`;
- `s === sMin` o `s === sMax` constituye frontera longitudinal exacta y ese
  opening no sustrae su intervalo Z en dicha posición;
- si `sMin === 0` o `sMax === L`, la coincidencia con el extremo del host sigue
  siendo frontera y no interior.

Esta regla no desplaza, ensancha, contrae ni redefine `Oi`; sólo gobierna la
materialización constructiva derivada en una posición vertical.

Sea `length` la longitud de cada segmento vertical resultante. La
materialización aplica exactamente:

- `length <= MATERIALIZATION_MIN_SEGMENT_MM` no produce miembro;
- `length > MATERIALIZATION_MIN_SEGMENT_MM` produce miembro.

Con el valor vigente `MATERIALIZATION_MIN_SEGMENT_MM = 0.1 mm`, un segmento de
longitud exactamente `0.1 mm` no se materializa. La comparación ocurre antes
del redondeo canónico.

Omitir un microsegmento no desplaza, corrige, expande ni contrae ningún opening,
no modifica geometría autoritativa y no fusiona artificialmente segmentos
separados.

Los segmentos que superan el umbral producen miembros verticales y permiten,
con un único algoritmo:

- `stud`;
- `wallEnd`;
- `jamb`;
- studs inferiores, superiores o intermedios recortados por openings.

No existe una modulación independiente de cripples/despuntes.

Conforme D-094, esta familia vertical pertenece a una implementación nueva e
independiente del generador Metalcon legacy. B3.5 no importa, invoca, adapta,
traduce ni obtiene defaults o semántica desde el generador histórico. Cualquier
concepto necesario pertenece al contrato nuevo de SPEC-016-B.

Conforme D-095, B3.5 preserva explícitamente la causa de cada candidato vertical:

- una causa proveniente de `Pgrid` produce rol `stud`;
- `s=0` y `s=L` producen, cada uno, una causa `wallEnd`;
- cada borde autoritativo `sMin` o `sMax` de un opening produce una causa `jamb`;
- un candidato `stud` recortado por el interior de uno o más openings conserva
  rol `stud`.

La resolución geométrica D-088/D-092 puede hacer que la coordenada efectiva de
una causa grid coincida con un borde autoritativo, pero no elimina la causa grid
ni transforma su rol.

Si dos o más causas producen igual geometría lógica, B3.5 conserva candidatos
separados. B3.5 no deduplica dichos candidatos ni une sus roles o `sourceRefs`.

#### B3.6 Deduplicación y roles verticales

Antes de esta etapa, los candidatos B3.5 permanecen separados por causa conforme
D-095.

Dentro del mismo host, candidatos con igual geometría lógica, perfil y material
se deduplican en una sola pieza. Sus roles y `sourceRefs` se unen y ordenan
canónicamente.

Por ejemplo, una misma pieza puede tener:

`roles=["jamb","stud","wallEnd"]`.

Si dos candidatos geométricamente coincidentes exigen perfiles o materiales
incompatibles, B3 falla cerrado.

No existe deduplicación entre hosts distintos. B3 no inventa assemblies de
esquina, T, cruce o continuidad entre muros.

#### B3.7 Miembros horizontales

La familia horizontal materializa referencias lógicas:

- `bottomTrack`;
- `topTrack`;
- `openingHead`;
- `openingSill`.

Los tracks se interrumpen únicamente donde un void alcanza geométricamente el
límite correspondiente.

Un opening que llega a la base no genera `openingSill`; un opening que llega a
la coronación no genera `openingHead` duplicado.

`openingHead` es una referencia constructiva y nunca implica dintel resistente
ni capacidad estructural.

#### B3.8 Geometría lógica de colocación

Los members B3 son segmentos lógicos 2.5D en coordenadas locales del host.

No representan todavía:

- envolvente física C/U;
- cara/alma/labio;
- rotación física;
- bearing;
- lap;
- corte de extremos;
- fijaciones;
- largo de fabricación.

La longitud de un placement segment no se interpreta automáticamente como
`cutLength`.

#### B3.9 Familias de configuración

La materialización es fail-closed por familia y distingue explícitamente entre
campos que activan una familia y campos compartidos que no la activan por sí
solos.

La familia vertical se considera solicitada cuando la selección contiene al
menos uno de:

- `studProfileRef`;
- `studSpacingMm`.

Si la familia vertical está solicitada, debe existir el conjunto completo:

`studProfileRef + materialRef + studSpacingMm`.

`materialRef` aislado no activa la familia vertical.

La familia horizontal se considera solicitada cuando la selección contiene:

`trackProfileRef`.

Si la familia horizontal está solicitada, debe existir:

`trackProfileRef + materialRef`.

`materialRef` aislado no activa la familia horizontal.

La familia panel se considera solicitada cuando la selección contiene:

`panelRef`.

`panelRef` es suficiente para activar la familia panel y materializar
`panelCoverage`. La presencia adicional de `materialRef` no activa framing por
sí sola.

Por tanto:

- ausencia deliberada de una familia es válida;
- una familia sólo es inválida por incompleta después de haber sido
  efectivamente solicitada por uno de sus campos activadores;
- `materialRef` solo no activa framing;
- `panelRef + materialRef` sin `studProfileRef`, `studSpacingMm` ni
  `trackProfileRef` es una selección válida de panel sin framing.

Cuando se usa `wallAssemblyRef`, B3 resuelve únicamente refs declaradas por la
biblioteca nueva. No introduce defaults ocultos ni spacing legacy.

`stud`, `jamb` y `wallEnd` usan `studProfileRef`.

`bottomTrack`, `topTrack`, `openingHead` y `openingSill` usan
`trackProfileRef`.

Ninguno de esos mappings afirma capacidad resistente.

#### B3.10 Panel coverage

B3-core no despieza hojas.

Con `panelRef` materializa como máximo un artifact lógico `panelCoverage` por
host/selección, representando declarativamente `M \ V`.

No decide caras, dimensiones de hoja, orientación, juntas, desperdicio,
blocking, fijaciones ni política de soporte.

Una cobertura desconectada continúa siendo un único artifact lógico. Una
cobertura vacía no genera artifact de área cero y produce finding
constructivo.

La panelización física queda fuera de B3-core.

#### B3.11 Provenance e identidad

Los artifacts B3 usan el contrato común determinista.

La provenance local conserva:

- host para todo artifact;
- openings sólo cuando efectivamente causan un borde, recorte o cobertura.

Un opening distante que no afecta una pieza no cambia la identidad de esa
pieza.

No se usan contador, timestamp, índice incidental ni orden de arrays como
identidad.

Permutar `elements`, `openings`, refs o selections semánticamente equivalentes
no cambia artifacts, IDs ni `canonicalSha256`.

#### B3.12 Barrera B3/B4

Durante todo B3:

- `scenario.assignments=[]`;
- todos los artifacts B3 tienen `requirementRefs=[]`;
- todos los requirements efectivos aparecen exactamente una vez en
  `requirementResolutions`;
- todas esas resolutions permanecen `unresolved`;
- `response=null`;
- `assignmentIds=[]`;
- coverage estructural permanece `none`;
- `verificationState=notVerified`.

La existencia de framing, paneles o cualquier artifact B3 no resuelve un
requirement por inferencia.

B4 no mutará un artifact B3 agregándole `requirementRefs`; una respuesta
estructural futura deberá crear artifacts/assemblies requirement-specific con
assignment originador explícito.

#### B3.13 FX-008

El gate real conserva como referencia gobernante:

- muro `1784606313849`;
- cubierta `1785158713616`;
- gap `571.429 mm`.

B3 puede materializar artifacts constructivos mediante configuración explícita,
pero la transferencia y resistencia lateral continúan `unresolved`,
`coverage=none` y `notVerified` hasta B4.

Ningún cielo falso, revestimiento o framing no asignado puede cerrar
implícitamente el gap.

#### B3.14 Subcortes

B3 se implementará de forma controlada.

Mapa explícito de alcance vigente, gobernado por D-077:

```text
implementationSubcut=B3.3b
technicalSections=B3.6
phase=READ-ONLY
authorizedBy=D-077,D-095,D-096
```

La numeración de secciones técnicas no define subcortes de implementación. D-093 cerró la Fase A READ-ONLY y habilitó B3.3 exclusivamente para IMPLEMENTATION sobre B3.5. D-096 cierra B3.3 y, para resolver la omisión documentada por BUG-016-B-044, asigna exclusivamente la sección técnica B3.6 al nuevo implementation subcut B3.3b en Fase A READ-ONLY. B3.4 y subcortes posteriores continúan bloqueados.

Subcortes:

- B3.1a — CERRADO: contrato y resolución estricta de familias con fixtures no
  productivos sólo para tests;
- B3.1b — CERRADO mediante D-076: catálogo productivo real inicial exacto
  aprobado por D-075 y materializado con gates verdes;
- B3.2 — CERRADO mediante D-087: frame local, openings, tolerancias y
  dominio geométrico;
- B3.3 — CERRADO mediante D-096: implementación exclusivamente sobre B3.5
  Retícula maestra vertical, con gates finales verdes;
- B3.3b — Fase A READ-ONLY autorizada mediante D-096 exclusivamente sobre
  B3.6 Deduplicación y roles verticales; implementación no autorizada;
- B3.4 — familia horizontal;
- B3.5 — `panelCoverage`;
- B3.6 — integración runtime y `generatedArtifacts`;
- B3.7 — determinismo, D-070 dinámico, FX-008, receipt/freshness y regresión;
- B3-CLOSE — auditoría integral y revisión humana separada.

La apertura B3 no autoriza B4, B5, SPEC-016-C ni escritura Git.

### B4 — requirements

Assignments, component types, artefactos, requirement resolutions, caso FX-008 lateral, cielo falso no resistente y `notVerified` obligatorio.

### B5 — UI y evidencia

Interfaz exclusivamente bajo `Soluciones constructivas > Metalcon`, mostrando escenario, biblioteca, configuración, requirements, artefactos, findings, coverage, freshness, verification y receipt sin presentar resolución como verificación.

## 19. Gates mínimos

Cada corte mantiene verdes las regresiones de SPEC-016-A.

Además se exigen según corresponda: independencia legacy, hash de biblioteca y tamper, refs fail-closed, determinismo y permutación, geometría agnóstica byte-identical, `structuralIntent` deep-identical, artifacts deterministas, vanos reales, partición exacta de requirements, `resolved != verified`, FX-008 con gap 571.429 mm, cielo falso no resistente, output no persistente, receipt/reapertura/freshness, accesibilidad en B5, `npm run validate` y governance.

## 20. Corpus adversario obligatorio

1. cambio de `wallTypeId` legacy no altera output nuevo;
2. cambio de `wall.studs` legacy no altera output nuevo;
3. cambio de catálogo Metalcon legacy no altera output nuevo;
4. cambio de configuración Metalcon no altera geometría ni intención;
5. inputRef inexistente falla cerrado;
6. perfil nuevo inexistente falla cerrado;
7. assembly inexistente falla cerrado;
8. hash de biblioteca falso falla cerrado;
9. target ambiguo/duplicado no se acepta silenciosamente;
10. elemento eliminado tras configurar escenario falla cerrado;
11. requirement sin assignment queda unresolved;
12. artifact constructivo sin requirement es válido cuando nace de configuración;
13. artifact que afirma requirement sin assignment originador es inválido;
14. resolved permanece `notVerified`;
15. coverage complete permanece `notVerified`;
16. fresh permanece `notVerified`;
17. cerrar/reabrir no persiste generatedArtifacts;
18. regenerar la misma entrada reproduce bytes/hash.

## Fuera de alcance

Migración o sincronización Metalcon legacy, retiro del legacy, reutilización de IDs legacy, corrección de defectos legacy no bloqueantes, equivalencia de studs/headers/OSB legacy, reemplazo inmediato de DXF/CalculiX/takeoff legacy, madera, SIP, albañilería, inferencia de intención, verificación resistente automática, conformidad normativa automática y SPEC-016-C.

## Criterios de aceptación

1. Metalcon funciona sin leer campos ni módulos legacy.
2. El adapter recibe únicamente la frontera constructiva efectiva.
3. Geometría adicional sólo entra mediante refs explícitas.
4. Refs irresolubles fallan cerradamente.
5. La biblioteca Metalcon tiene identidad, versión y SHA-256 verificable.
6. Configuración constructiva y assignments estructurales permanecen separados.
7. Artefactos e IDs son deterministas.
8. Todo requirement efectivo aparece exactamente una vez en resolutions.
9. Sin assignment explícito no se fabrica una resolución estructural.
10. `resolved != verified`.
11. Toda salida permanece `verificationState=notVerified`.
12. FX-008 conserva el gap contractual de 571.429 mm.
13. El cielo falso nunca resuelve implícitamente ese gap.
14. Cambiar configuración Metalcon no modifica geometría ni `structuralIntent`.
15. Cambiar legacy no modifica el output Metalcon nuevo.
16. Generated output no persiste; receipt sí.
17. Reapertura y regeneración reproducen el output.
18. Runtime neutral conserva las regresiones de SPEC-016-A.
19. UI Metalcon vive sólo bajo Soluciones constructivas.
20. Gates, build, governance y cierre humano pasan.

## Evidencia

Tests de protocolo común, runtime neutral como regresión, biblioteca/hash/tamper, auditoría estática legacy, corpus adversario, materialización, requirements, evidencia real FX-008, tests UI, sesión de implementación y sesión de cierre.

## 24. Regla de detención

Cada corte B1–B5 se revisa y autoriza de forma controlada.

SPEC-016-C permanece bloqueada hasta que SPEC-016-B tenga cierre humano, gates completos y publicación autorizada.
