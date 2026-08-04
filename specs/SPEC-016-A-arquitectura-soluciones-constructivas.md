# SPEC-016-A — Arquitectura de soluciones constructivas y escenarios

**Estado:** borrador de planificación · 2026-08-04

## Diagnóstico

La aplicación actual tiene una solución Metalcon integrada directamente al modelo mediante
`wallTypes`, `wallTypeId`, perfiles, OSB, modulación y verificaciones. Esa arquitectura sólo permite
una solución vigente por muro y mezcla el proyecto base con un sistema constructivo.

Después de la serie 015 existirán geometría, intención, topología y requisitos independientes.
Se necesita una capa nueva donde puedan convivir varias soluciones sobre las mismas autoridades.

## Decisión

Crear el módulo principal:

```text
Soluciones constructivas
├── Escenarios…
├── Metalcon…
├── Madera…            [futuro]
├── SIP…               [futuro]
├── Albañilería…       [futuro]
└── Comparar soluciones…
```

La serie 016 comienza aquí. Ninguna herramienta de `Estructura` se mueve a este menú.

Definir:

```text
constructive-solution-scenario-v1.0
constructive-adapter-contract-v1.0
```

## Escenario

```json
{
  "scenarioId": "scenario:metalcon:01",
  "name": "Alternativa Metalcon 01",
  "adapterId": "metalcon",
  "adapterVersion": "1.0.0",
  "status": "draft",
  "source": {
    "geometrySha256": "...",
    "intentSha256": "...",
    "requirementsSha256": "..."
  },
  "assignments": [],
  "generatedSolution": null,
  "verification": null,
  "findings": []
}
```

Estados:

```text
draft
generated
partiallyResolved
verified
failed
stale
archived
```

Sólo un verificador de la solución puede usar `verified`.

## Contrato de adaptador

Entrada obligatoria:

```text
agnostic-geometry-v1.0
structural-intent-v1.0
structural-requirements-v1.0
scenario configuration
system library
```

Salida:

```json
{
  "schema": "constructive-solution-v1.0",
  "adapterId": "metalcon",
  "scenarioId": "...",
  "elements": [],
  "connections": [],
  "materials": [],
  "requirementResolutions": [],
  "unresolvedRequirements": [],
  "findings": [],
  "metrics": {},
  "verificationState": "notVerified",
  "canonicalSha256": "..."
}
```

## Fronteras

Un adaptador puede:

- proponer componentes;
- asignar material;
- resolver requisitos;
- generar conexiones;
- verificar según su normativa;
- producir métricas y planos.

No puede:

- cambiar geometría base;
- cambiar intención;
- aceptar propuestas estructurales;
- ocultar requisitos no resueltos;
- escribir en otro escenario;
- cambiar hashes de fuente.

## Asignaciones

Las asignaciones pertenecen al escenario:

```json
{
  "assignmentId": "assignment:scenario:metalcon:01:element:1784600403613",
  "elementId": 1784600403613,
  "solutionTypeId": "metalcon-wall-type-01",
  "source": "userDeclared"
}
```

A largo plazo `element.wallTypeId` dejará de ser autoridad. Su migración se realiza en SPEC-016-B.

## Bibliotecas

```js
model.solutionLibraries = {
  metalcon: {},
  timber: {},
  sip: {},
  masonry: {}
}
```

En SPEC-016-A sólo se define el contenedor y el contrato. No se habilitan bibliotecas vacías como
sistemas funcionales.

## Invalidación

| Cambio | Resultado |
|---|---|
| Geometría | todos los escenarios stale |
| Intención aceptada | todos los escenarios afectados stale |
| Requisitos | todos los escenarios afectados stale |
| Biblioteca de un adaptador | sólo escenarios de ese adaptador stale |
| Configuración de escenario | sólo ese escenario stale |
| Otro escenario | sin efecto |

La eliminación de un escenario no modifica el proyecto base.

## UI

`Soluciones constructivas > Escenarios…` debe permitir:

- crear;
- duplicar;
- renombrar;
- archivar;
- eliminar;
- seleccionar adaptador;
- ver hashes de fuente;
- ver estado;
- regenerar;
- abrir resultados.

En este corte el único adaptador habilitable puede ser un adaptador de prueba vacío. Metalcon se
integra en SPEC-016-B.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: crea una nueva autoridad persistente, contratos de adaptadores y aislamiento entre
  escenarios.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Guardar solución en cada muro | Impide escenarios múltiples |
| Reutilizar `wallTypeId` como intención | Mezcla capas |
| Un escenario global mutable | No permite comparar alternativas |
| Permitir que adaptadores cambien intención | Rompe autoridad humana |
| Implementar Metalcon en el mismo corte | Dificulta validar primero la frontera común |

## Alcance

- Crear menú `Soluciones constructivas`.
- Definir escenarios y adaptadores.
- Persistir múltiples escenarios.
- Definir asignaciones por escenario.
- Definir bibliotecas por adaptador.
- Implementar invalidación y stale.
- Implementar aislamiento y hashes de fuente.
- Crear UI básica de escenarios.
- Probar adaptador mínimo de contrato.

## Fuera de alcance

- Migrar Metalcon real.
- Crear madera, SIP o albañilería.
- Comparar métricas.
- Verificar capacidad.
- Cambiar intención o topología.
- Eliminar campos legacy.

## Criterios de aceptación

1. Pueden existir varios escenarios sobre la misma geometría e intención.
2. Cada escenario conserva hashes de sus autoridades.
3. Un adaptador no puede mutar inputs.
4. Cambiar un escenario no afecta otro.
5. Cambiar geometría o intención marca stale los escenarios correspondientes.
6. Eliminar un escenario no modifica geometría, intención ni requisitos.
7. Las asignaciones se almacenan dentro del escenario.
8. El menú `Soluciones constructivas` está separado de `Estructura`.
9. Ninguna función de la serie 015 se traslada o duplica en este menú.
10. Un adaptador de prueba demuestra resolución y no resolución de requisitos.
11. Prueba de reversión que permita mutar intención hace fallar la suite.
12. Gates, build y cierre pasan.

## Evidencia

- Tests de contrato de escenario.
- Tests de aislamiento.
- Tests de stale.
- Adaptador mínimo.
- Pruebas de UI.
- Inspección de dependencias.
- Prueba de reversión.
- Cierre `sessions/close-SPEC-016-A.md`.

## Corte sugerido

Detener cuando la aplicación soporte escenarios aislados y adaptadores contractuales, sin migrar
todavía la solución Metalcon existente.
