# SPEC-015-D REV8 — Cierre de validación local y visual real

Fecha de cierre: **10-ago-2026**
Caso gobernante: **FX-008 / casa-L**
Estado: **cerrada**

## Alcance del cierre

Este documento registra la barrera final posterior a las Correctivas 14–19 de REV8. El cierre no
agrega autoridad estructural nueva, no modifica geometría agnóstica, no incorpora una solución
constructiva y no crea un estado `verified`.

## Validación local autoritativa final

El validador integral `VALIDAR_SPEC_015_D_REV8_INTERFACES.sh` terminó en PASS sin Git con:

- focal REV8: **90/90**;
- suite Node: **996/996**;
- componentes React: **49/49**;
- Rust: **9/9** y `tauri:check` PASS;
- laboratorio `roofPlane`: **35/35**;
- cobertura core: **92,17 % líneas / 81,10 % ramas / 94,12 % funciones**;
- cobertura store: **92,35 % líneas / 81,01 % ramas / 93,33 % funciones**;
- goldens semánticos: **19**;
- DXF: **14 archivos**, 0 errores, 0 reparaciones y 0 fallas de calidad;
- CalculiX 2.23: **3/3 jobs PASS**, 1.486 nodos y 8.649 valores finitos;
- build Vite: PASS; permanece el warning no bloqueante de chunk >600 kB;
- migración: **187 archivos**, 129 idénticos al origen y 58 cambios posteriores registrados;
- derivados: **14 exportadores / 14 mutadores**;
- Codex audit: **11 completas / 2 fallidas recuperadas / 0 abiertas**;
- gobernanza: **22 archivos requeridos / 49 requisitos / 60 decisiones** antes de este cierre;
- inventario sin Git: **721 archivos fuente/documentales**.

El warning de `block v0.1.6` de Rust permanece no bloqueante y ya estaba gobernado por D-040.

## Validación visual real en localhost

La revisión manual en `http://localhost:5173` comprobó el flujo real macro→micro y cerró los
hallazgos de esta ronda:

| Hallazgo | Resultado visual final |
|---|---|
| BUG-015-D-028 | B1 de la segunda cubierta persiste `S 12800→14500`, interacción 1.700 mm, conservando borde físico 10.400 mm |
| BUG-015-D-029 | `Localizar` de B1 parcial dibuja/encuadra el subtramo y no el host completo |
| BUG-015-D-030 | `Canvas.jsx` queda registrado en `MIGRATION_MANIFEST`; `verify:migration` PASS |
| BUG-015-D-031 | Nodos/caminos distinguen interacción B1 1.700 mm de borde físico 10.400 mm |
| BUG-015-D-032 | La marca `−N` de una cara corta se desplaza fuera de la evidencia mediante líder y deja visible el tramo |
| BUG-015-D-034 | C/6 y C/7 muestran los `locator.sRange/zRange` declarados y no la envolvente completa del host |

La mejora **MEJ-015-D-033 — Encuadre adaptativo para interfaces pequeñas** queda abierta como
mejora de usabilidad no bloqueante: el encuadre actual es correcto, pero puede ocupar demasiado
contexto para interfaces del orden de 100 mm.

## Caso final gravitacional

El estado final declarado para el frontón `Muro X · 6→7 @ C` usa:

- B3 de la cubierta del lado `y<C` → `Cara −N` del frontón;
- B1 parcial de la cubierta del lado `y>C`, `S 12800→14500` → `Cara +N` del frontón;
- `loadTransfer · gravity` desde ambas caras hacia `Extremo S mínimo` y `Extremo S máximo`;
- C/6: `Extremo S mínimo` → `Cara −N · Muro Y · B→I @ 6`, `S 1949.45→2050.55`, `Z 3250→4150`;
- C/7: `Extremo S máximo` → `Extremo S máximo · Muro Y · A→C @ 7`, `S 1999.9→2000`, `Z 3250→4150`.

Los dos receptores continúan por `supportedByFoundation` hacia sus fundaciones corridas. Después de
`Recalcular` una vez, `Resumen` mostró:

```text
Propuestas        0
G↓ Caminos        4
Completos         4
L→ Caminos        0
Bloqueos          0
Estado verified   0 (prohibido por contrato)
```

Los cuatro caminos permanecieron `completeCandidate · 4 tramos`. No reapareció
`SI-EXPLICIT-END-SUPPORT-UNRESOLVED`.

## Intención de techumbre aún no declarada

El aviso de Resumen sobre intención estructural de techumbre permanece válido: todavía faltan
posibles declaraciones de distribución, diafragma o funciones de borde. Las relaciones
`support · gravity` de este cierre no sustituyen esas declaraciones y el motor continúa sin inventar
apoyos desde la geometría.

## Persistencia final

Después del recálculo y de la revisión visual final se ejecutó **Archivo → Guardar copia en
navegador**. La aplicación web no ofrece una descarga equivalente de esa copia; por ello este
checkpoint se registra como persistencia local del navegador y no como archivo externo con SHA-256.

## Exclusiones preservadas

- `modelVersion=3` y `structural-intent-v1.1` sin cambio;
- `agnostic-geometry-v1.0` sin cambio;
- `candidateLoadPaths` conserva su contrato y no fue alterado por las correctivas de presentación;
- ninguna cara implica acción lateral por sí sola;
- ninguna interfaz implica soporte o familia de acción por sí sola;
- sin `structuralAssembly` en REV8;
- sin nuevas reglas CalculiX;
- sin Git durante aplicación, validación ni cierre visual.
