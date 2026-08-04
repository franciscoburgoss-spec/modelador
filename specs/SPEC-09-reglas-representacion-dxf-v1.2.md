# SPEC-09 — Reglas de representación DXF v1.2

## Diagnóstico

El cuerpo normativo importado no seguía el contrato documental de G0. Su contenido debe quedar
literal y pendiente de un corte funcional que aporte las fuentes y decisiones que correspondan.

## Decisión

Conservar el cuerpo importado como un bloque opaco recuperable por marcadores, identificado por
SHA-256 y longitud. Esta envolvente agrega sólo gobernanza; no interpreta ni activa sus reglas.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `condicionado`
- Motivo: la futura implementación modifica geometría y representación DXF compleja.

## Alcance

- Preservar íntegramente el cuerpo normativo importado de SPEC-09 v1.2.
- Mantenerlo disponible como fuente para una futura spec funcional explícita.

## Fuera de alcance

- Implementar, conciliar o auditar geometría DXF descrita en el cuerpo importado.
- Modificar código, DXF o artefactos desde esta normalización.

## Criterios de aceptación

1. El extractor recupera exactamente 4.141 bytes con SHA-256
   `ba923404ac92c88de1984a82d0fa12e7a306219ea8565b3d3b182d5345ccec6d`.
2. G0 reconoce esta envolvente y su declaración de esfuerzo futuro.
3. Ninguna regla DXF se considera implementada por esta normalización.

## Evidencia

- `governance/IMPORTED_SPEC_BODIES.json` y `tests/importedSpecsGovernance.test.mjs`.
- Cierre `sessions/close-SPEC-GOV-C.md`.

## Cuerpo normativo importado — preservado literalmente

<!-- IMPORTED-NORMATIVE-BODY:BEGIN sha256=ba923404ac92c88de1984a82d0fa12e7a306219ea8565b3d3b182d5345ccec6d bytes=4141 -->
# SPEC-09 · Reglas geométricas y de representación DXF — v1.2

**Estado:** v1.2 · 2026-08-01.
Cambios sobre v1.1: R-G-01/02 actualizadas (jambICA 76mm, pilarRetChord flush,
corner U+C+C per Manual p.61); R-G-09 nueva (solera en dirección correcta);
R-G-10 nueva (supresión de king en zona pilar).

Reglas sin cambio: R-G-03..08 se conservan íntegras de v1.1.

---

## R-G-01 · Prohibición de superposición — adyacencia, nunca fusión *(actualizada)*

Dos elementos estructurales nunca comparten espacio. El orden desde la luz del vano hacia el
paño en un borde de vano es:

```
[VANO]  jamba ala exterior  jamba ala interior  pilar chord  ← interior pilar →
        x=vano_edge        +W                  +2W          +3W
```

- **jamba ICA**: 2 alas de W_PROF=38 mm cada una = **76 mm total**, flush con el borde del
  vano. Las dos alas son adyacentes entre sí, nunca fusionadas.
- **cordón del pilar**: adyacente a la cara interior de la jamba, nunca dentro de ella.
- Caso EJE A borde izq (vano en x=1300): jamba en [1224, 1300]; cordón en [1186, 1224];
  paño efectivo pilar: [−19, 1224] (incluye plomo exterior del muro eje 2).

---

## R-G-02 · Posición flush con límites del paño y del vano *(actualizada)*

### jambICA / pillarICA — SPEC-12 §3.1
| Borde del vano | x1 (cara izq) | x2 (cara der) |
|---|---|---|
| Izquierdo (vano_x1) | `vano_x1 − 2·W` | `vano_x1` |
| Derecho (vano_x2) | `vano_x2` | `vano_x2 + 2·W` |

W = W_PROF = 38 mm. La jamba tiene ancho dibujado = 2×38 = **76 mm**.

### pilarRetChord — SPEC-12 §3.2
| Tipo de borde | Cordón x1 | Cordón x2 |
|---|---|---|
| Extremo del muro izq (a=0) | −W/2 = −19 | +W/2 = +19 |
| Extremo del muro der (b=L) | L−W/2 | L+W/2 |
| Borde de vano izq (a=vano) | a+2W | a+3W |
| Borde de vano der (b=vano) | b−3W | b−2W |
| Eje T estructural | eje | eje+W (o eje−W) |

El paño pilar en DXF: desde `x1` del cordón izquierdo hasta `x2` del cordón derecho.

### corner / backup — Manual Cintac 2020 p.61
Ensamble U+C+C, sin separación:
- C1 (corner): [0, W] para extremo izq; [L−W, L] para extremo der.
- C2 (backup): [W, 2W] para extremo izq; [L−2W, L−W] para extremo der.

---

## R-G-09 · Orientación de la solera (track U) *(nueva)*

La solera es un perfil U con el alma (web) en el exterior y las alas (flanges) apuntando
hacia el interior donde se insertan los montantes.

| Solera | Alma en | Alas van hacia | Rect DXF |
|---|---|---|---|
| Inferior | z0 = NPT (450 mm abs) | ↑ arriba | [z0, z0+W] |
| Superior | z0+H = cota de término | ↓ abajo | [z0+H−W, z0+H] |

**Cadeneta:** centrada en z=2440 desde la cara del alma de la solera inferior (= desde z0).
No desde el ala (z0+W). La cadeneta en DXF queda a z0+2440 (sin corrección adicional).

**Solera antepecho** (sill track, flanges abajo):
- Para cada vano con sillHeight > 0: rect de [z0+sill−W, z0+sill] en ancho = vano.

**Solera dintel** (lintel track, flanges arriba):
- Sobre el tope de cada viga reticulada: rect de [z0+viga_z2, z0+viga_z2+W] en ancho = vano.
- Para vanos sin viga: rect sobre z0+header_z (= top del vano).

**Cortes de solera:**
- Solera inferior: cortada en puertas (sillHeight=0) y en paños pilar reticulado.
- Solera superior: cortada en paños pilar reticulado (las puertas no la afectan).

---

## R-G-10 · Supresión de elementos redundantes en paño pilar *(nueva)*

Los siguientes roles se suprimen en la representación DXF cuando su posición cae dentro del
rango [x_pilar1, x_pilar2] de un paño pilar reticulado:
- `corner` (rol MONTANTE)
- `backup` (rol MONTANTE)
- `king` (rol MONTANTE)

Motivo: el pilar reticulado asume íntegramente la función estructural de borde, lintel y
apoyo. La presencia de estos elementos en el JSON se mantiene para la validación V-02.

---

## R-G-03 a R-G-08 — sin cambios respecto a v1.1

Ver documento SPEC-09 v1.1 para el texto completo de R-G-03 (perfiles de inicio/término),
R-G-04 (diagonales con espesor), R-G-05 (cadeneta con espesor y cesión en vanos),
R-G-06 (fusión de despuntes con jambas), R-G-07 (keynotes sin líderes),
R-G-08 (auditoría gráfica).
<!-- IMPORTED-NORMATIVE-BODY:END -->
