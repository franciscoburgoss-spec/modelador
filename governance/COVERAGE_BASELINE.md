# Baseline de cobertura

`SPEC-000` convierte la suite heredada en comandos oficiales sin ampliar comportamiento funcional.
`SPEC-001` agrega contratos del parser y de la importación. Node 22 mide cobertura con el runner
nativo y aplica umbrales separados por capa.

| Capa | Líneas medidas | Umbral bloqueante | Objetivo |
|---|---:|---:|---:|
| `src/core` | 90,48 % | 90 % | >= 90 % |
| `src/store` | 57,80 % | 50 % | >= 85 % |

El umbral del store es un piso de no regresión, no una aceptación del objetivo final. Alcanzar 85 %
requiere contratos de mutadores adicionales y pertenece a `SPEC-003`; incorporarlos aquí ampliaría
el alcance de la migración y mezclaría cambios funcionales con el baseline.

`npm run test:coverage` ejecuta ambas mediciones y falla si cualquiera cae bajo su umbral.
