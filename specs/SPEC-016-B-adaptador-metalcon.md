# SPEC-016-B — Adaptador Metalcon y migración de la solución vigente

**Estado:** borrador de planificación · 2026-08-04

## Diagnóstico

Metalcon es actualmente parte del modelo principal:

- `model.wallTypes[]`;
- `element.wallTypeId`;
- perfiles;
- defaults Metalcon y OSB;
- modulación;
- capacidad de corte;
- informes y leyendas.

La nueva arquitectura exige que Metalcon sea el primer adaptador de `Soluciones constructivas`,
consumiendo geometría, intención y requisitos sin definirlos.

La migración debe conservar proyectos existentes y resultados reproducibles. No puede convertir
MP1, MP2, MP3 o tabique en intención estructural.

## Decisión

Crear el adaptador:

```text
adapterId = metalcon
```

y migrar la solución legacy a un escenario inicial:

```text
Alternativa Metalcon heredada
```

La migración mueve o proyecta:

```text
wallTypes
wallTypeId
metalconProfiles
materials OSB
defaults
configuraciones constructivas
```

hacia:

```text
solutionLibraries.metalcon
solutionScenarios[scenario:metalcon:legacy]
```

Durante una etapa de compatibilidad puede mantenerse una vista legacy, pero la autoridad nueva
queda en el escenario.

## Entrada

El adaptador consume:

- geometría;
- intención aceptada;
- requisitos estructurales;
- biblioteca Metalcon;
- asignaciones del escenario;
- configuración específica.

No puede consultar `wallType.role` para definir intención.

## Vocabulario interno

Se mantienen dentro del adaptador:

```text
MP1
MP2
MP3
tabique
```

Su significado y reglas deben documentarse como clasificación Metalcon, no como participación
estructural universal.

## Resolución de requisitos

Cada componente generado debe referenciar:

```json
{
  "generatedElementId": "...",
  "sourceElementId": 1784600403613,
  "resolvedRequirementIds": ["..."],
  "systemRole": "MP1",
  "geometry": {},
  "materialId": "...",
  "verificationState": "notVerified"
}
```

Un requisito no resuelto permanece explícito.

Ejemplos:

- apoyo gravitacional;
- resistencia lateral;
- transferencia sobre vano;
- continuidad vertical;
- conexión a fundación;
- colector;
- conexión de diafragma;
- gap entre muro interior y cubierta.

## Techumbre y muros interiores

El adaptador debe tratar el caso real:

- frontones candidatos aceptados como apoyo;
- orientación resistente de techumbre;
- muros interiores laterales separados de la cubierta;
- necesidad de transferencia;
- prohibición de usar cielo falso como pieza estructural implícita.

Metalcon puede proponer montantes, cerchas, vigas, colectores o conexiones sólo después de recibir
el requisito correspondiente.

## Migración

### Datos existentes

Crear un escenario por proyecto cuando existan datos Metalcon:

```text
scenario:metalcon:legacy
```

### Reglas

1. conservar IDs cuando sea seguro;
2. conservar tipos y asignaciones;
3. conservar bibliotecas;
4. no crear intención;
5. marcar el escenario stale si sus fuentes estructurales todavía no existen;
6. permitir revisión antes de regenerar;
7. no borrar datos legacy hasta demostrar equivalencia.

### Corte de compatibilidad

La retirada de `element.wallTypeId` requiere una SPEC posterior o una fase explícita dentro del
cierre, después de comparar:

- asignaciones;
- derivados;
- informes;
- invalidación;
- guardado/reapertura.

## Interfaz

```text
Soluciones constructivas
└── Metalcon
    ├── Escenario activo…
    ├── Tipos de muro…
    ├── Perfiles…
    ├── Placas y revestimientos…
    ├── Modulación…
    ├── Verificación…
    └── Informes…
```

Estos controles no aparecen bajo `Estructura`.

## Verificación

Distinguir:

```text
generated
checked
verified
requiresCalculation
failed
```

La existencia de un miembro no resuelve automáticamente un requisito.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: migra una solución productiva, conserva compatibilidad y redirige múltiples consumidores
  a un adaptador aislado.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Convertir MP1 en intención lateral | Infiere decisión desde Metalcon |
| Reescribir toda la solución de una vez | Aumenta riesgo de regresión |
| Borrar campos legacy al migrar | Impide demostrar equivalencia |
| Mantener Metalcon como autoridad global | Bloquea otras materialidades |
| Resolver gaps con cielo falso | Fabrica una pieza resistente |

## Alcance

- Implementar adaptador Metalcon.
- Crear biblioteca Metalcon en la nueva arquitectura.
- Migrar tipos y asignaciones.
- Consumir requisitos agnósticos.
- Generar componentes y conexiones trazables.
- Mantener hallazgos no resueltos.
- Reubicar UI constructiva bajo `Soluciones constructivas`.
- Validar equivalencia del flujo existente.
- Aplicar el caso real.

## Fuera de alcance

- Madera, SIP o albañilería.
- Comparación entre materiales.
- Cambiar intención.
- Modificar geometría base.
- Declarar conformidad normativa sin verificadores.
- Retirar inmediatamente todos los campos legacy.
- Reescribir SPEC-08 completa sin un corte posterior.

## Criterios de aceptación

1. El escenario Metalcon consume los mismos hashes base que otros escenarios.
2. MP1/MP2/MP3/tabique permanecen exclusivamente en Metalcon.
3. Migrar un proyecto existente conserva tipos, perfiles, OSB y asignaciones.
4. La migración no crea ni modifica intenciones.
5. Cada componente generado referencia requisitos y elementos fuente.
6. Requisitos no resueltos permanecen visibles.
7. Un muro interior lateral con gap exige una solución de transferencia explícita.
8. El cielo falso no se genera como elemento resistente por defecto.
9. Cambiar Metalcon no invalida intención ni geometría.
10. La UI constructiva aparece sólo en `Soluciones constructivas > Metalcon`.
11. Comparación de resultados legacy/nuevo demuestra equivalencia o documenta divergencias.
12. Prueba de reversión que use `wallType.role` como intención falla.
13. Gates, build y cierre pasan.

## Evidencia

- Fixtures legacy y migrados.
- Comparación de asignaciones y derivados.
- Tests de requisitos resueltos/no resueltos.
- Caso real.
- Inspección de dependencias.
- Pruebas UI.
- Prueba de reversión.
- Cierre `sessions/close-SPEC-016-B.md`.

## Corte sugerido

Detener cuando Metalcon funcione como primer escenario aislado y la migración sea demostrablemente
segura, sin implementar todavía otros materiales.
