# SPEC-016-C — Comparación trazable de soluciones constructivas

**Estado:** borrador de planificación · 2026-08-04

## Diagnóstico

La ventaja principal de la arquitectura es comparar soluciones sobre la misma geometría e
intención. Sin un contrato de comparación, dos escenarios podrían usar fuentes distintas o mostrar
métricas incompatibles.

El primer adaptador será Metalcon. El comparador debe funcionar inicialmente entre dos escenarios
Metalcon y quedar preparado para madera, SIP y albañilería.

## Decisión

Crear:

```text
constructive-solution-comparison-v1.0
```

La comparación sólo admite escenarios con:

```text
geometrySha256 iguales
intentSha256 iguales
requirementsSha256 iguales
```

Si difieren, la comparación se bloquea y explica la causa.

## Contrato

```json
{
  "schema": "constructive-solution-comparison-v1.0",
  "baseline": {
    "geometrySha256": "...",
    "intentSha256": "...",
    "requirementsSha256": "..."
  },
  "scenarioIds": [],
  "requirementCoverage": [],
  "unresolvedRequirements": [],
  "verificationSummary": [],
  "quantities": [],
  "mass": [],
  "cost": [],
  "findings": [],
  "comparability": "comparable",
  "canonicalSha256": "..."
}
```

## Categorías

### Cobertura de requisitos

Para cada requisito:

```text
resolved
partiallyResolved
unresolved
notApplicable
failed
```

### Verificación

```text
notChecked
requiresCalculation
passed
failed
notComparable
```

No se transforma `generated` en `passed`.

### Cantidades

Cada adaptador debe declarar:

- unidad;
- método;
- alcance;
- fuente;
- precisión.

No se suman unidades incompatibles.

### Masa y costo

Opcionales. Un escenario sin datos sigue siendo comparable técnicamente, pero la categoría queda
`notAvailable`.

### Hallazgos

Comparar:

- bloqueantes;
- advertencias;
- pendientes;
- decisiones requeridas;
- requisitos no resueltos.

## No ranking automático

El comparador no selecciona “la mejor solución”.

Puede ordenar por una métrica elegida por el usuario, pero debe mostrar:

- criterio;
- unidades;
- datos faltantes;
- restricciones;
- estado de verificación.

## Interfaz

```text
Soluciones constructivas
└── Comparar soluciones…
```

Vistas:

```text
Base común
Cobertura de requisitos
Caminos de carga
Elementos generados
Verificaciones
Cantidades
Masa
Costo
Hallazgos
```

La base común debe permanecer visible.

## Caso inicial

Comparar dos escenarios Metalcon:

- mismo proyecto;
- misma intención;
- mismas rutas;
- distintas configuraciones constructivas.

Ejemplo:

```text
Metalcon A: perfiles/configuración 1
Metalcon B: perfiles/configuración 2
```

La prueba demuestra el contrato sin requerir todavía otro material.

## Caso futuro

Cuando existan adaptadores:

```text
Metalcon
Madera
SIP
Albañilería
```

todos deben resolver el mismo conjunto de requisitos o declarar por qué no pueden hacerlo.

## Ejecución Codex

- Esfuerzo planificado: `medium`
- Escalamiento xhigh: `prohibido`
- Motivo: agrega un contrato de lectura y visualización sobre escenarios ya aislados.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Comparar escenarios con bases distintas | El resultado no sería atribuible al sistema |
| Elegir ganador automáticamente | Sustituye decisión técnica del usuario |
| Comparar sólo costo | Omite requisitos y verificación |
| Ocultar datos faltantes | Produce conclusiones falsas |
| Exigir varios materiales desde el inicio | Dos escenarios Metalcon bastan para validar el contrato |

## Alcance

- Validar base común.
- Comparar cobertura de requisitos.
- Comparar rutas y hallazgos.
- Comparar verificación.
- Comparar métricas declaradas.
- Implementar UI de comparación.
- Exportar informe JSON/Markdown.
- Probar dos escenarios Metalcon.
- Preparar extensibilidad.

## Fuera de alcance

- Recomendar automáticamente una solución.
- Normalizar costos externos.
- Crear otros adaptadores.
- Modificar escenarios.
- Resolver requisitos desde el comparador.
- Cambiar intención.

## Criterios de aceptación

1. Escenarios con hashes distintos no se comparan.
2. La base común se muestra explícitamente.
3. Cada requisito se compara por ID estable.
4. Datos faltantes se muestran como tales.
5. No se mezclan unidades incompatibles.
6. Verificación, generación y cálculo pendiente permanecen separados.
7. El comparador no modifica escenarios.
8. Dos escenarios Metalcon reales producen un informe determinista.
9. El usuario puede revisar hallazgos y rutas por escenario.
10. No existe selección automática de ganador.
11. Un adaptador futuro puede añadir métricas sin cambiar el contrato base.
12. Gates, build y cierre pasan.

## Evidencia

- Tests de comparabilidad.
- Tests de unidades y datos faltantes.
- Dos escenarios Metalcon.
- Informe JSON/Markdown.
- Pruebas UI.
- No mutación.
- Cierre `sessions/close-SPEC-016-C.md`.

## Corte sugerido

Detener cuando dos escenarios con la misma base puedan compararse de forma técnica y trazable, sin
selección automática.
