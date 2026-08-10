# SPEC-015-D — Propuestas no autoritativas y caminos de carga candidatos

**Estado:** cerrada; validación local autoritativa y visual real completada el 10-ago-2026
**Fecha:** 2026-08-06
**Base de diseño:** `main@0a2504c`
**Esfuerzo planificado para Fase B:** `high`; escalamiento `xhigh` prohibido

## Diagnóstico

El modelo ya separa geometría, intención estructural y techumbre. Sin embargo, no existe una capa
que convierta esa información en sugerencias explicables y rutas candidatas sin invadir la autoridad
del usuario. La topología disponible termina en R5: sirve para relaciones y nodos de muros, pero no
resuelve fundaciones, techumbre, requisitos, capacidad ni continuidad resistente.

## Decisión

Crear cuatro contratos separados:

```text
structural-proposals-v1.0                 derivado canónico, no persistente
candidate-load-paths-v1.0                 derivado canónico, no persistente
structural-proposal-review-log-v1.0       revisión humana persistente, no intención
prepared-structural-proposal-decision-v1  preview efímera y guardia stale
```

La aceptación se ejecuta mediante un mutador separado que combina una revisión persistente con una
mutación explícita de `structural-intent-v1.0`. Los motores derivados nunca importan ni invocan ese
mutador.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: combina contratos deterministas, grafos separados, persistencia, mutación explícita, UI y evidencia real, sin justificar superar el techo ordinario.

## Alcance

- Generar propuestas estructurales no autoritativas y grafos candidatos gravitacional/lateral separados.
- Persistir sólo la revisión humana y ejecutar la aceptación mediante una mutación explícita stale-safe.
- Integrar presentación macro→micro con descriptores y localización visual, manteniendo IDs como referencia técnica secundaria.
- Probar determinismo, independencia, reversión y el caso real FX-008.

## 1. Invariantes de autoridad

D-AUTH-01. `structuralIntent` continúa siendo la única autoridad persistente sobre participación y
funciones estructurales.

D-AUTH-02. Propuesta, ruta, finding, confianza, coincidencia o score no crean intención.

D-AUTH-03. Aceptar o modificar y aceptar requiere preview, confirmación, guardia stale y una
mutación separada. Rechazar o diferir no modifica intención.

D-AUTH-04. `structural-intent-trace-v1.0` registra sólo mutaciones efectivas. El review log registra
la revisión humana y nunca se interpreta como intención negativa.

D-AUTH-05. Gravedad y lateral son grafos separados. Pueden referenciar una misma entidad, pero no
comparten nodos semánticos, aristas, estados de completitud ni findings implícitos.

D-AUTH-06. Ningún estado de propuesta o ruta se denomina `verified`.

D-AUTH-07. Cielo falso, terminaciones, materiales, perfiles y soluciones constructivas no son
nodos, aristas, evidencia de transferencia ni criterios de decisión.

## 2. Entradas y precedencia

### 2.1 `generateStructuralProposals(input)`

Entrada exacta:

```json
{
  "geometry": {"schema":"agnostic-geometry-v1.0"},
  "structuralIntent": {"schema":"structural-intent-v1.0"},
  "roofStructuralIntent": ["roof intents canónicos vigentes"],
  "topology": {"schema":"recognized-structural-topology-v1.0"},
  "sourceFindings": [],
  "config": {}
}
```

`topology` es obligatoria como snapshot auditable, pero SPEC-015-D sólo consume fases efectivamente
declaradas. En la base R0–R5 no se aceptan `foundations`, `roofSupports` o `verticalSupports` como
resueltos; se leen directamente desde geometría e intención.

### 2.2 `buildCandidateLoadPaths(input)`

Recibe los mismos snapshots más `structuralProposals` y `analysisContexts[]`. Un contexto lateral
declara exclusivamente la dirección de consulta (`x` o `y`); no crea intención.

### 2.3 Precedencia

1. Intención explícita válida del usuario.
2. Intención canónica de techumbre y función declarada del borde.
3. Geometría canónica para coordenadas, intervalos y contacto.
4. Topología sólo para relaciones ejecutadas y referencias resolubles.
5. Review log únicamente como overlay de revisión; jamás retroalimenta generación.

Una contradicción entre 1–4 produce finding bloqueante y no se resuelve por prioridad silenciosa.
Una referencia rota en una autoridad obligatoria aborta con error tipado. Una referencia rota en un
snapshot opcional de evidencia produce candidato `blockedCandidate` y finding, sin inventar el dato.

## 3. Fingerprints y stale

Cada ejecución declara:

```json
{
  "geometrySha256": "...",
  "elementIntentSha256": "...",
  "roofIntentSha256": "...",
  "topologySha256": "...",
  "aggregateSha256": "..."
}
```

Los hashes se calculan sobre JSON canónico UTF-8, claves ordenadas, números finitos normalizados,
listas semánticamente ordenadas y sin incluir el propio hash.

Una decisión preparada conserva:

- `proposalId` y `proposalFingerprint`;
- los cinco fingerprints de fuente;
- fingerprint de la intención previa del objetivo;
- fingerprint de geometría visual de SPEC-015-C-1;
- acción y diff propuesto.

Al confirmar se recalculan todos. Cualquier diferencia devuelve `SI-PROPOSAL-STALE`, no crea
historial, review event ni trace, y obliga a recalcular y revisar nuevamente.

## 4. Identidad y determinismo

D-ID-01. `proposalId`, `nodeId`, `edgeId` y `pathId` usan SHA-256 de una clave semántica canónica.
No usan fecha, índice, contador, aleatoriedad ni orden de entrada.

D-ID-02. Claves mínimas:

```text
proposal = kind + roofGeometryId + boundaryId + targetType + targetId
node     = graph + role + referencia semántica
edge     = graph + kind + fromNodeId + toNodeId
path     = graph + secuencia ordenada de edgeId
```

D-ID-03. El ID no incluye score, review, mensaje, orden de UI ni fingerprint de fuentes. El
`proposalFingerprint` sí incluye el payload completo de la propuesta y cambia cuando cambia la
evidencia o el patch.

D-ID-04. Candidatos duplicados con la misma clave semántica se fusionan acumulando evidencia
ordenada. Candidatos con igual objetivo pero distinta fuente o función permanecen separados.

D-ID-05. Cada bifurcación produce rutas distintas con `pathId` distinto. La ruta no elige un ganador.

D-ID-06. Permutar elementos, cubiertas, intenciones, relaciones o review events conserva
`deepEqual` y `canonicalSha256` de los derivados canónicos.

## 5. Tolerancias

Defaults:

| Parámetro | Valor |
|---|---:|
| `linearToleranceMm` | 0,1 |
| `levelToleranceMm` | 0,1 |
| `minimumOverlapMm` | 0,1 |
| `minimumSupportOverlapMm` | 38,0 |
| `roundDecimals` | 3 |

Se comparan valores sin redondear y se redondea sólo la salida. Tolerancias de topología pueden
reutilizarse sólo si coinciden exactamente; de otro modo se registra la configuración efectiva.
No existe tolerancia implícita de transferencia. Un gap mayor que `levelToleranceMm` nunca se cruza
automáticamente.

## 6. Contrato `structural-proposals-v1.0`

```json
{
  "schema": "structural-proposals-v1.0",
  "sourceFingerprints": {},
  "config": {},
  "proposals": [
    {
      "proposalId": "proposal:sha256:...",
      "proposalFingerprint": "...",
      "proposalKind": "roofBoundaryReceiver",
      "targetType": "element",
      "targetId": 1784604634483,
      "candidateState": "candidate",
      "confidence": "candidate",
      "proposedIntentPatch": {},
      "evidence": {},
      "limitations": [],
      "sourceRefs": {}
    }
  ],
  "findings": [],
  "canonicalSha256": "..."
}
```

Estados canónicos de propuesta:

```text
candidate
insufficientEvidence
blockedCandidate
```

`accepted`, `rejected`, `deferred`, `superseded` y `stale` no pertenecen al objeto canónico; son
estados de revisión materializados desde el review log y los fingerprints actuales.

## 7. Coincidencia de borde de cubierta y receptor

D-PROP-ROOF-01. Sólo bordes `gravitySupport`, `lateralSupport` o
`gravityAndLateralSupport` inician propuestas de esa función. `geometricBoundary`, `gutterSupport`,
`nonStructuralBoundary` y `undetermined` no crean receptor resistente.

D-PROP-MATCH-01. El borde y el muro deben ser paralelos, con distancia de ejes <= 0,1 mm y solape
longitudinal > 38 mm. Se registra distancia, solape, cobertura de borde y muro, rango Z y tolerancias.

D-PROP-MATCH-02. El rango Z del borde debe quedar dentro del intervalo vertical del muro, con
tolerancia. Se registra la holgura hasta la coronación; no se interpreta como detalle de conexión.

D-PROP-OPENING-01. Todo vano cuyo intervalo longitudinal intersecte la entrega se incluye en la
evidencia. Si también intersecta el rango Z, el candidato queda bloqueado con
`SI-ROOF-LOAD-OVER-OPENING`. Si no hay solape Z, permanece visible con su distancia vertical.

D-PROP-INTENT-01. Una intención existente compatible no se sobrescribe. La propuesta puede quedar
`noOpCandidate` en la vista de revisión, pero el derivado conserva su identidad y evidencia.
Una intención contradictoria produce `SI-PROPOSAL-CONFLICTS-WITH-DECLARED-INTENT`.

## 8. Grafo gravitacional

Secuencia jerárquica:

```text
roof source
→ declared gravity boundary
→ receiver candidate
→ immediate lower wall
→ declared transfer element
→ coincident foundation/base
```

D-GRAV-01. Se busca primero el apoyo inmediato. No se salta a fundación desde un muro superior.

D-GRAV-02. Contacto parcial genera una rama por receptor con cobertura explícita. Contacto sólo de
extremo <= 38 mm no es apoyo y se registra como evidencia insuficiente.

D-GRAV-03. Un vano en la entrega aplica D-PROP-OPENING-01.

D-GRAV-04. Múltiples receptores o fundaciones producen bifurcaciones; no se selecciona una ruta.

D-GRAV-05. Estados canónicos de ruta:

```text
completeCandidate
incompleteCandidate
blockedCandidate
```

Una ruta completa candidata posee continuidad geométrica/declarativa hasta base, pero no afirma
capacidad, conexión, anclaje, resistencia ni deformación.

## 9. Grafo lateral

D-LAT-01. La fuente requiere `diaphragmBehavior=intended` o una fuente lateral explícita. El valor
`candidate` sólo produce `SI-DIAPHRAGM-UNDECLARED` y no inicia una ruta intent-backed.

D-LAT-02. El contexto declara dirección X o Y. Un muro es compatible cuando su eje longitudinal es
paralelo a la dirección de análisis y posee `inPlaneLateralResistance` declarada.

D-LAT-03. Un muro puede ser destino lateral aunque no toque la cubierta. La separación vertical
produce `SI-LATERAL-TRANSFER-REQUIRED`; la ruta queda `incompleteCandidate` hasta declarar un
elemento con `collectorAction`, `loadTransfer` o conexión equivalente.

D-LAT-04. La ausencia de transferencia no invalida la intención del muro.

D-LAT-05. Múltiples destinos compatibles producen bifurcaciones independientes.

D-LAT-06. No se evalúan rigidez, resistencia, anclaje, torsión, distribución de fuerzas ni
compatibilidad de deformaciones.

## 10. Review log y lifecycle

`structural-proposal-review-log-v1.0` es persistente y append-only en el modelo v3 como autoridad de
revisión humana, no de comportamiento estructural.

Disposiciones:

```text
accepted
modifiedAndAccepted
rejected
deferred
```

Estados materializados adicionales:

```text
pending
superseded
stale
```

D-REVIEW-01. `accepted`: aplica exactamente el patch previsualizado al mismo objetivo.

D-REVIEW-02. `modifiedAndAccepted`: permite modificar sólo campos válidos del patch de intención,
mantiene el mismo target y muestra diff. Cambiar target convierte la acción en declaración manual
independiente, no en aceptación modificada.

D-REVIEW-03. `rejected`: persiste `proposalId`, fingerprint, source fingerprint, código/motivo y
nota opcional. No crea intención negativa. Si reaparece exactamente el mismo fingerprint, la vista
muestra `rejectedByUser`; si cambia payload o fuente, el evento anterior queda `superseded` y la
nueva propuesta vuelve a revisión.

D-REVIEW-04. `deferred`: registra una decisión de dejar pendiente sin modificar intención. Cerrar
la UI sin elegir `deferred` no persiste nada.

D-REVIEW-05. Un resultado stale no puede aceptarse, rechazarse ni diferirse; primero se recalcula.

## 11. Historial, trace y undo/redo

| Acción | Pasos historial | Review events | Trace de intención | Efecto en intención |
|---|---:|---:|---:|---|
| Aceptar | 1 | 1 | 1 | crea/modifica |
| Modificar y aceptar | 1 | 1 | 1 | crea/modifica |
| Rechazar | 1 | 1 | 0 | ninguno |
| Dejar pendiente explícito | 1 | 1 | 0 | ninguno |
| Cancelar/cerrar | 0 | 0 | 0 | ninguno |
| Confirmación stale | 0 | 0 | 0 | ninguno |

Undo revierte review log e intención en un solo snapshot; redo restaura ambos. El trace persistido
forma parte del snapshot y vuelve al estado anterior. Para lote homogéneo: un paso de historial,
un review event con N decisiones y un único trace `batchSet` sólo si hay cambios efectivos.

## 12. UI macro→micro

1. Resumen: conteos, fuentes, fingerprints y separación G/L.
2. Lista de propuestas: filtro por grafo, estado, cubierta, objetivo, finding y review.
3. Localizador: reutiliza descriptor, preview y foco local de SPEC-015-C-1 sin tocar selección global.
4. Evidencia geométrica: borde, muro, vanos, tolerancias y limitaciones.
5. Grafo: ruta y bifurcaciones, gaps y bloqueos.
6. Decisión: antes/después, autoridad que cambiará, history/trace esperados y confirmación.
7. Auditoría: review events, trace de intención, stale y fuentes.

Marcas no dependientes sólo del color:

```text
G↓ gravedad   L→ lateral   ∥ gap   × bloqueo   ⟳ stale   ✓ aceptación humana
```

Teclado: Tab recorre controles, flechas navegan lista, Enter abre detalle, Escape cierra sin mutar,
Ctrl/Cmd+Enter confirma sólo en diálogo final. Foco vuelve al origen. Estados tienen texto, icono y
`aria-label`; grafos poseen resumen textual equivalente. Borradores se protegen antes de cambiar de
propuesta o pestaña.

### 12.1 Identidad visual y localización de entidades

D-UI-ID-01. Los IDs de cubierta, muro, fundación, nodo, arista y ruta siguen siendo las referencias
canónicas del contrato máquina, pero **no pueden ser la etiqueta visible principal ni el único medio
de reconocimiento humano**.

D-UI-ID-02. Toda entidad geométrica mostrada en una lista o grafo debe resolver, en este orden:

```text
descriptor geométrico legible → preview contextual → acción Localizar → referencia técnica secundaria
```

Para muros y elementos se reutiliza el descriptor, preview y localización temporal de
SPEC-015-C-1. Para cubiertas se reutiliza su preview en planta y se deriva un descriptor estable con
rango de ejes, forma, dimensiones, cotas y dirección geométrica de pendiente. Los descriptores son
contextuales: no declaran portancia, resistencia, apoyo ni capacidad.

D-UI-ID-03. Un nodo visible del grafo debe incluir como mínimo:

- título humano sin depender del ID;
- resumen geométrico y estado/rol candidato;
- mini-preview o acceso inmediato al preview contextual;
- botón `Localizar`, que encuadra y destaca temporalmente sin cambiar selección global;
- bloque colapsable `Referencia técnica` con los IDs canónicos copiables.

D-UI-ID-04. Queda prohibido que un selector, fila, nodo, tooltip o `aria-label` use solamente textos
como `Muro 178...` o `Cubierta 178...`. El `aria-label` usa el descriptor humano y agrega la
referencia técnica sólo al final.

D-UI-ID-05. La presentación visual es efímera: no se persiste, no participa en
`canonicalSha256` de propuestas/rutas, no entra en historial ni trace y no modifica intención. Su
`visualFingerprint` separado protege previews stale. Si la entidad ya no existe se muestra
`Referencia rota`, conserva el ID técnico y bloquea decisión/localización hasta recalcular.

## 13. Fronteras estáticas

D-STATIC-01. `generateStructuralProposals()` no importa store, React, Three.js ni mutadores.

D-STATIC-02. `buildCandidateLoadPaths()` tiene la misma prohibición.

D-STATIC-03. `structuralProposalReviews.js` no importa mutadores de intención.

D-STATIC-04. Sólo `applyStructuralProposalDecision.js` puede importar `setElementIntent`,
`setElementIntentsBatch` y append de review log. La UI no los llama directamente.

D-STATIC-05. Ninguno de los cuatro módulos importa módulos de soluciones constructivas.

D-STATIC-06. `structuralProposalVisualPresentation.js` puede consumir los presentadores visuales de
SPEC-015-C-1 y la geometría de preview de cubiertas, pero no store, mutadores ni módulos
constructivos. Sus descriptores no regresan al contrato canónico.

D-STATIC-07. Una prueba de reversión inserta un import/call prohibido en una copia temporal y exige
que el verificador falle. Otra reemplaza stale guard por aceptación directa y exige fallo.

## 14. Errores y findings

Errores tipados mínimos:

```text
SI-PROPOSAL-INPUT-INVALID
SI-PROPOSAL-REFERENCE-NOT-FOUND
SI-PROPOSAL-DUPLICATE-ID
SI-PROPOSAL-NON-FINITE
SI-PROPOSAL-STALE
SI-PROPOSAL-DECISION-INVALID
SI-PROPOSAL-TARGET-CHANGE-NOT-ALLOWED
```

Findings mínimos:

```text
SI-ROOF-SUPPORT-CANDIDATE
SI-ROOF-SUPPORT-UNRESOLVED
SI-GRAVITY-PATH-GAP
SI-LATERAL-TRANSFER-REQUIRED
SI-DIAPHRAGM-UNDECLARED
SI-FOUNDATION-SUPPORT-CANDIDATE
SI-VERTICAL-SUPPORT-UNRESOLVED
SI-ROOF-LOAD-OVER-OPENING
SI-PROPOSAL-USER-DECISION-REQUIRED
SI-PROPOSAL-CONFLICTS-WITH-DECLARED-INTENT
SI-PROPOSAL-BROKEN-REFERENCE
```

## 15. Aplicación normativa a FX-008

### 15.1 Borde B5 / frontón bajo

- Cubierta `1785030887081`, borde gravity B5.
- Muro `1784604634483`, distancia 0,0 mm, solape 9.800 mm, cobertura del borde 100 %.
- Borde z=3.830 mm dentro del muro z=450–4.150; holgura superior 320 mm.
- Puertas `1784604771014` y `1784604806833`: solape longitudinal 800 mm cada una, sin solape Z;
  distancia vertical 1.180 mm. Permanecen visibles y no bloquean.
- Fundación `1784817889908`: 12.800 mm de cobertura a z=450.
- Resultado: propuesta P1; ruta `completeCandidate`; intención sin cambios hasta aceptación.

### 15.2 Borde B3 / frontón alto

- Muro superior `1784819708086`, distancia 0,0 mm, solape 1.700 mm.
- Borde z=3.950 mm dentro del muro z=3.250–4.150; holgura 200 mm.
- No existe muro inferior, transferencia declarada ni fundación coincidente en z=3.250.
- Resultado: propuesta P2 y ruta `incompleteCandidate` con gap jerárquico; no se salta a base.

### 15.3 Muro interior bajo cielo falso

- Descriptor visible de cubierta: **Faldón rectangular 1–6 entre B–H · pendiente B→H · 12.800 × 4.200 mm**; referencia técnica secundaria `1785158713616`; diafragma `intended` en escenario de revisión.
- Descriptor visible de muro: **Muro X · 3→5 @ C1 · NPT +450 → CIELO GENERAL +3.250 · L 4.400 mm · 0 vanos**; referencia técnica secundaria `1784606313849`; intención `inPlaneLateralResistance`, eje X.
- Consulta lateral X: orientación compatible.
- Cubierta sobre el muro z=3.821,429 mm; tope del muro z=3.250 mm; gap=571,429 mm.
- Finding `SI-LATERAL-TRANSFER-REQUIRED`; ruta incompleta.
- No se crea nodo de cielo falso, colector, conexión ni transferencia.

### 15.4 Cuatro decisiones humanas

- P1 aceptar: 1 historial, 1 review event, 1 trace, crea intención.
- P2 modificar y aceptar: agrega `stabilization` y nota; mismos conteos.
- P3 rechazar: 1 historial, 1 review event, 0 trace, intención intacta.
- P4 diferir: 1 historial, 1 review event, 0 trace, intención intacta.
- Intento stale sobre P1: 0/0/0 y `SI-PROPOSAL-STALE`.

## 16. Corte correctivo de revisión visual REV7

La revisión funcional sobre FX-008 antes del cierre agrega requisitos de presentación y comprensión sin
modificar la autoridad estructural ni los motores canónicos.

### 16.1 Estado vacío accionable

El workspace debe distinguir al menos: ausencia de geometría de techumbre, ausencia de intención de
techumbre, ausencia de bordes con función resistente y ausencia de receptor geométricamente compatible.
Cuando falte intención, debe ofrecer acceso directo a **Intención estructural → Techumbre**. No se permite
convertir el estado vacío en inferencia automática.

### 16.2 Localización temporal visible

`Localizar` debe reutilizar el patrón temporal de SPEC-015-C-1: el workspace permanece montado pero se
compacta, el Canvas queda accesible y el usuario puede encuadrar, inspeccionar, restaurar o conservar la
vista. La localización no crea historial, review, trace ni selección estructural persistente.

### 16.3 Relación en planta

Cada propuesta seleccionada debe poder mostrar de forma conjunta y efímera: cubierta origen, borde
canónico que origina la propuesta, objetivo candidato y tramo de solape cuando exista. Esta vista es una
evidencia geométrica derivada y no constituye decisión ni verificación.

### 16.4 Glosario estructural único y contextual

La aplicación mantiene una fuente semántica única para los conceptos de distribución de cubierta,
diafragma, funciones de borde y estados de propuestas/caminos. Cada concepto debe explicar:

`qué declara → qué efecto habilita → qué no significa`

La misma fuente alimenta el glosario y las ayudas contextuales de la UI para impedir divergencias de
terminología.

### 16.5 Nomenclatura de canaleta

El valor canónico persistido `gutterSupport` se conserva para compatibilidad, pero su rótulo humano es
**Soporte local de canaleta**. Esta función no declara apoyo gravitacional de la cubierta, muro portante,
capacidad, conexión ni camino de carga.

## Criterios de aceptación

1. Esquemas exactos y validadores puros implementados.
2. Determinismo ante permutaciones y ejecución repetida.
3. P1/P2/P3/P4 reproducen la evidencia de Fase A.
4. Gravedad y lateral usan colecciones, IDs y estados separados.
5. Aceptación separada, preview, confirmación, stale y trace correctos.
6. Rechazo y deferred persisten sin intención negativa.
7. Undo/redo cumple la tabla exacta.
8. Aperturas y gaps no se ocultan ni cruzan automáticamente.
9. Cielo falso ausente de grafos salvo geometría/intención propia futura.
10. No existen imports constructivos ni escrituras silenciosas.
11. UI accesible macro→micro: ningún grafo depende de IDs visibles; cada entidad tiene descriptor, preview, `Localizar` sin selección global y referencia técnica secundaria.
12. Evidencia JSON/SVG/HTML canónica y manifiesto.
13. Pruebas de reversión estática y stale fallan al retirar protecciones.
14. Puerta completa local pasa antes de Git.

## Fuera de alcance

- capacidad, cálculo sísmico, rigidez, resistencia, derivas o deformaciones;
- dimensionamiento de diafragma, colector, transferencia, conexión o anclaje;
- materiales, perfiles, revestimientos o soluciones constructivas;
- activar R6–R12 de SPEC-014 o requisitos de SPEC-015-E;
- producir DXF, INP o diseño ejecutable;
- decidir automáticamente por el usuario.

## Evidencia

- Pruebas unitarias, store y componentes de los contratos y cuatro acciones de revisión.
- Evidencia JSON/SVG/HTML reproducible de FX-008.
- Inspección estática de independencia y prueba de reversión contra escritura silenciosa.
- Aplicador, validador y ZIP autocontenidos probados sobre extracción limpia.

## Corte exacto

Fase B termina con motores, review log, mutador explícito, UI, pruebas, evidencia, parche, ZIP,
aplicador y validador autocontenidos; luego se detiene para validación local y aprobación. No se
realiza Git antes de PASS local y autorización del usuario.
