# SPEC-015-D — Propuestas no autoritativas y caminos de carga candidatos

**Estado:** borrador de planificación · 2026-08-04

## Diagnóstico

La geometría y la intención de techumbre permiten identificar contactos y rutas posibles, pero no
autorizan decisiones sobre los muros. El proyecto requiere:

- proponer receptores de carga;
- detectar rutas geométricas continuas;
- separar carga gravitacional y lateral;
- identificar vacíos y transferencias pendientes;
- permitir aceptar, modificar, rechazar o dejar pendiente cada propuesta.

El caso real contiene frontones altos y bajos asociados geométricamente a la techumbre y muros
interiores que terminan bajo ella para dejar espacio al cielo falso. Estos muros interiores pueden
ser declarados como resistentes laterales, pero no son apoyos gravitacionales directos y requieren
transferencia desde el diafragma.

## Decisión

Crear dos resultados derivados y separados:

```text
structural-proposals-v1.0
candidate-load-paths-v1.0
```

Ambos son puros, recalculables y no autoritativos.

Ninguno puede escribir en `structuralIntent`.

## Propuestas

### Contrato

```json
{
  "schema": "structural-proposals-v1.0",
  "sourceGeometrySha256": "...",
  "sourceIntentSha256": "...",
  "proposals": [
    {
      "proposalId": "proposal:roof-boundary:...:wall:...",
      "targetType": "element",
      "targetId": 1784600403613,
      "proposedParticipation": "resistant",
      "proposedFunctions": ["gravityResistance"],
      "confidence": "candidate",
      "evidence": [],
      "limitations": [],
      "status": "pendingUserDecision"
    }
  ],
  "findings": [],
  "canonicalSha256": "..."
}
```

### Estados

```text
pendingUserDecision
accepted
modifiedAndAccepted
rejected
superseded
stale
```

Los estados de revisión se almacenan en un registro separado. El objeto derivado recalculado
permanece canónico.

### Decisiones

Acciones explícitas:

```text
Aceptar
Modificar y aceptar
Rechazar
Dejar pendiente
```

`Aceptar` crea o actualiza una intención mediante una mutación de dominio distinta.

`Rechazar` no crea una intención negativa permanente salvo que el usuario decida declarar
explícitamente `secondary` o una función no resistente.

## Caminos de carga

### Grafos separados

#### Gravitacional

```text
cubierta
→ borde de apoyo declarado
→ receptor geométrico candidato
→ apoyo vertical inmediato
→ fundación/base
```

#### Lateral

```text
masa/cubierta
→ diafragma previsto
→ colector o transferencia
→ elemento vertical resistente previsto
→ anclaje/base/fundación
```

Un elemento puede participar en un grafo y no en el otro.

### Contrato

```json
{
  "schema": "candidate-load-paths-v1.0",
  "gravityPaths": [],
  "lateralPaths": [],
  "nodes": [],
  "edges": [],
  "findings": [],
  "canonicalSha256": "..."
}
```

Estados de ruta:

```text
geometricCandidate
intentConfirmed
completeCandidate
incomplete
blocked
rejectedByUser
```

Ningún estado se denomina `verified`.

## Reglas gravitacionales

1. Sólo un borde declarado `gravitySupport` o `gravityAndLateralSupport` inicia búsqueda
   gravitacional.
2. La dirección resistente de techumbre limita los bordes compatibles, pero no selecciona muros.
3. Un muro coincidente es receptor candidato.
4. La coincidencia debe registrar longitud, distancia, solape Z y tolerancias.
5. Un vano en la zona de entrega crea revisión o bloqueo según la evidencia disponible.
6. El apoyo inferior se busca jerárquicamente:
   - muro directamente inferior;
   - elemento de transferencia declarado;
   - fundación/base coincidente;
   - apoyo no resuelto.
7. Un espacio vacío no se cruza automáticamente.
8. El cielo falso no es elemento de transferencia ni diafragma por defecto.
9. La ausencia de intención de muro no elimina la ruta geométrica; la deja candidata.

## Reglas laterales

1. Se requiere intención de diafragma o una fuente lateral declarada.
2. Un muro con `inPlaneLateralResistance` puede ser destino aunque no toque la cubierta.
3. Si existe separación vertical, la ruta emite:
   `SI-LATERAL-TRANSFER-REQUIRED`.
4. La separación no invalida la intención del muro.
5. La ruta permanece incompleta hasta declarar un colector, conexión o elemento de transferencia.
6. La orientación del muro debe ser compatible con la dirección de análisis.
7. La geometría no demuestra rigidez, resistencia, anclaje ni compatibilidad de deformaciones.

## Hallazgos iniciales

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
```

## No decisión automática

Restricción técnica obligatoria:

- `generateStructuralProposals()` no importa store ni mutaciones;
- `buildCandidateLoadPaths()` no importa store ni mutaciones;
- ambos reciben objetos y devuelven objetos nuevos;
- no pueden invocar `setElementIntent`;
- una inspección estática debe verificar esta frontera.

## Caso real obligatorio

### Techumbre y frontones

La visualización debe:

1. mostrar los siete faldones;
2. aplicar una intención de dirección y bordes a un faldón;
3. detectar muros geométricamente coincidentes;
4. presentarlos como propuestas pendientes;
5. comprobar que ninguno queda declarado automáticamente.

### Muros interiores bajo cielo falso

Seleccionar al menos un muro que termine bajo la cubierta:

1. declarar `inPlaneLateralResistance`;
2. comprobar que no aparece como apoyo gravitacional directo;
3. incorporarlo al grafo lateral como destino previsto;
4. detectar el vacío;
5. emitir `SI-LATERAL-TRANSFER-REQUIRED`;
6. mantener la ruta incompleta;
7. no utilizar el cielo falso como solución.

### Revisión humana

Ejecutar en la evidencia:

```text
aceptar una propuesta
modificar y aceptar otra
rechazar una tercera
dejar una cuarta pendiente
```

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: construye grafos deterministas, separa rutas físicas y decisiones, e integra revisión
  humana sin permitir escrituras silenciosas.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Crear load path definitivo desde geometría | La geometría no demuestra función resistente |
| Tratar el cielo falso como transferencia | Inventa un elemento estructural |
| Bloquear muros interiores separados | Pueden participar lateralmente con transferencia |
| Aceptar propuestas automáticamente | Sustituye al usuario |
| Mezclar grafos gravitacional y lateral | Oculta funciones y discontinuidades distintas |
| Generar miembros constructivos | Pertenece a soluciones posteriores |

## Alcance

- Motor puro de propuestas.
- Grafos candidatos gravitacional y lateral.
- Evidencia y niveles de certeza.
- Revisión humana explícita.
- Invalidación por cambios de geometría o intención.
- Visualización paso a paso.
- Caso real completo.
- Determinismo y no mutación.

## Fuera de alcance

- Verificación resistente.
- Cálculo sísmico.
- Dimensionamiento de diafragma.
- Selección de material.
- Solución de conexiones.
- Metalcon.
- R10–R12 definitivos.
- Comparación de soluciones.

## Criterios de aceptación

1. El mismo input produce propuestas y grafos byte a byte equivalentes.
2. Cambiar el orden de elementos, cubiertas o intenciones no cambia el resultado.
3. Un borde gravitacional declarado produce candidatos, no intenciones.
4. Aceptar una propuesta requiere una acción separada y crea una intención trazable.
5. Rechazar o dejar pendiente no modifica la intención.
6. Los frontones reales aparecen como candidatos sólo cuando la intención de cubierta lo permite.
7. Un muro interior bajo cubierta puede participar en el grafo lateral y emite transferencia
   pendiente.
8. Ese muro no aparece como apoyo gravitacional directo.
9. El cielo falso nunca aparece como nodo ni arista sin geometría/intención propia.
10. Rutas hacia fundación respetan la búsqueda jerárquica.
11. Una propuesta stale no puede aceptarse sin recalcular.
12. Inspección estática demuestra ausencia de mutaciones dentro de los motores puros.
13. La visualización permite revisar cada regla y decisión.
14. Prueba de reversión que escriba automáticamente intención hace fallar la suite.
15. Gates, build y cierre pasan.

## Evidencia

- Tests unitarios de ambos contratos.
- Corpus mínimo para rutas completas, gaps y bifurcaciones.
- Fixture real con frontones y muros interiores.
- Registro de decisiones humanas.
- SVG/HTML interactivo del flujo.
- Pruebas de determinismo y stale.
- Inspección de dependencias y mutaciones.
- Prueba de reversión.
- Cierre `sessions/close-SPEC-015-D.md`.

## Corte sugerido

Detener cuando la aplicación pueda proponer y visualizar rutas sin decidir por el usuario ni
generar una solución constructiva.
