# Matriz de mutadores y derivados

> Generada desde `MUTATION_DEPENDENCIES` en `src/core/derivedInvalidation.js`.

| Mutador | Alcance | Derivados invalidados |
|---|---|---|
| `projectParams` | `all` | wallFraming, wallOsb, roofTruss |
| `library` | `all` | wallFraming, wallOsb, roofTruss |
| `gridGeometry` | `all` | wallFraming, wallOsb, roofTruss |
| `wallGeometry` | `wall` | wallFraming, wallOsb, roofTruss |
| `wallOpenings` | `wall` | wallFraming, wallOsb, roofTruss |
| `wallRemoval` | `dependentRoof` | roofTruss |
| `wallTopology` | `removedWalls` | roofTruss |
| `wallTypeConfig` | `wallType` | wallFraming, wallOsb |
| `wallTypeAssignment` | `wall` | wallFraming, wallOsb |
| `foundationGeometry` | `none` | ninguno (resolución en vivo) |
| `roofSystemConfig` | `roofSystem` | roofTruss |
| `roofPlaneConfig` | `none` | ninguno (resolución en vivo) |
| `osbDefaults` | `all` | wallFraming, wallOsb |
| `metalconDefaults` | `all` | wallFraming, wallOsb |
