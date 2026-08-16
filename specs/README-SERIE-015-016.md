# Serie SPEC-015/016 — Intención estructural y soluciones constructivas

**Estado:** SPEC-015 y SPEC-016-A cerradas. SPEC-016-B está abierta y activa; B1 y B2 están cerrados, B3 es el siguiente corte no iniciado y requiere autorización humana separada. SPEC-016-C permanece bloqueada hasta el cierre humano, gates y publicación de SPEC-016-B.

## Propósito

Separar de forma verificable:

1. geometría agnóstica;
2. intención estructural declarada por el usuario;
3. propuestas y caminos de carga candidatos;
4. requisitos estructurales agnósticos;
5. soluciones constructivas y materialidades.

La aplicación no puede inferir una decisión del usuario desde Metalcon, OSB, perfiles, materiales,
nombres de ejes ni coincidencias geométricas.

## Regla de autoridad

```text
geometría
  ↓
intención declarada por el usuario
  ↓
topología, propuestas y caminos de carga candidatos
  ↓
requisitos estructurales agnósticos
  ↓
soluciones constructivas
```

Flujos prohibidos:

```text
MP1/MP2/MP3/tabique ──X──> intención estructural
perfil u OSB ─────────X──> participación resistente
coincidencia geométrica ─X──> decisión definitiva
propuesta automática ────X──> escritura silenciosa en structuralIntent
```

## Terminología base

La serie usa como referencia conceptual NCh 433.Of1996 Mod.2012:

- **estructura resistente:** conjunto de elementos considerados colaborantes para mantener la
  estabilidad frente a las solicitaciones;
- **elemento secundario:** elemento permanente que no forma parte de la estructura resistente,
  aunque puede ser afectado por sus movimientos e interactuar con ella;
- **diafragma:** elemento que distribuye fuerzas horizontales hacia elementos verticales
  resistentes;
- **tabique solidario:** sigue la deformación de la estructura;
- **tabique flotante:** puede deformarse independientemente de ella.

La intención no equivale a verificación. Un elemento pasa por estados separados:

```text
declarado → candidato/propuesto → resuelto por una solución → verificado
```

## Caso real transversal

Fixture: `geometria-agnostica_base.json`.

Conteos de referencia:

- 45 muros;
- 43 vanos;
- 32 elementos de fundación;
- 7 superficies de cubierta;
- coordenadas cartesianas en milímetros.

La validación deberá usar este caso antes de aprobar cada SPEC que transforme geometría o topología.

## Orden obligatorio

| Orden | SPEC | Resultado |
|---:|---|---|
| 1 | SPEC-015-A | `structural-intent-v1.0` persistente y modelo v3 |
| 2 | SPEC-015-B | intención de techumbre, orientación y bordes canónicos |
| 3 | SPEC-015-C | interfaz de declaración y decisiones explícitas |
| 4 | SPEC-015-D | propuestas no autoritativas y caminos de carga candidatos |
| 5 | SPEC-015-E | R6–R12 y requisitos estructurales agnósticos |
| 6 | SPEC-016-A | escenarios y contrato de soluciones constructivas |
| 7 | SPEC-016-B | primer adaptador de solución: Metalcon |
| 8 | SPEC-016-C | comparación trazable de soluciones |

No se inicia una SPEC posterior mientras la anterior no tenga cierre y evidencia.

## Fronteras

### Serie 015

No conoce:

- `wallTypes`;
- `wallTypeId`;
- `wallRoles`;
- MP1, MP2, MP3 o tabique Metalcon;
- perfiles;
- OSB;
- tornillos;
- materiales;
- modulación constructiva.

### Serie 016

Consume:

- geometría;
- intención aceptada;
- topología;
- requisitos estructurales.

Cada adaptador mantiene su vocabulario, biblioteca, componentes y verificaciones.

## Archivos incluidos

- `SPEC-015-A-contrato-intencion-estructural-agnostica.md`
- `SPEC-015-B-intencion-techumbre-y-bordes-canonicos.md`
- `SPEC-015-C-interfaz-declaracion-y-decisiones-explicitas.md`
- `SPEC-015-D-propuestas-y-caminos-carga-candidatos.md`
- `SPEC-015-E-requisitos-estructurales-agnosticos-R6-R12.md`
- `SPEC-016-A-arquitectura-soluciones-constructivas.md`
- `SPEC-016-B-adaptador-metalcon.md`
- `SPEC-016-C-comparador-soluciones.md`
