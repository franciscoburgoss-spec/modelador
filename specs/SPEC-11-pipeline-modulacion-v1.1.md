# SPEC-11 — Pipeline de modulación v1.1

## Diagnóstico

El cuerpo normativo importado no seguía el contrato documental de G0. Su contenido debe quedar
literal y pendiente de un corte funcional que trate su pipeline como una decisión de dominio.

## Decisión

Conservar el cuerpo importado como un bloque opaco recuperable por marcadores, identificado por
SHA-256 y longitud. Esta envolvente agrega sólo gobernanza; no interpreta ni activa sus reglas.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `condicionado`
- Motivo: la futura implementación altera un pipeline de dominio y geometría DXF.

## Alcance

- Preservar íntegramente el cuerpo normativo importado de SPEC-11 v1.1.
- Mantenerlo disponible como fuente para una futura spec funcional explícita.

## Fuera de alcance

- Implementar, ordenar o conciliar las fases descritas en el cuerpo importado.
- Modificar código, DXF o artefactos desde esta normalización.

## Criterios de aceptación

1. El extractor recupera exactamente 4.481 bytes con SHA-256
   `068f2770bba77e9169ee17e8a3bee4ce0a690128015545cc69b1dc08c7ec0489`.
2. G0 reconoce esta envolvente y su declaración de esfuerzo futuro.
3. Ninguna fase del pipeline se considera implementada por esta normalización.

## Evidencia

- `governance/IMPORTED_SPEC_BODIES.json` y `tests/importedSpecsGovernance.test.mjs`.
- Cierre `sessions/close-SPEC-GOV-C.md`.

## Cuerpo normativo importado — preservado literalmente

<!-- IMPORTED-NORMATIVE-BODY:BEGIN sha256=068f2770bba77e9169ee17e8a3bee4ce0a690128015545cc69b1dc08c7ec0489 bytes=4481 -->
# SPEC-11 · Orden del pipeline de modulación — v1.1

**Estado:** v1.1 · 2026-08-01 · sobre v1.0 de 2026-07-31.
Cambios: (A) E2 filtra T-MID por eje estructural vs. tabique (SPEC-08 Addendum v2.0);
(B) E7 implementa layout Opción C — filas compactas agrupadas por tipo de eje.

El pipeline E1..E6 y el principio "estructura primero, modulación después" no cambian.

---

## Cambios en E2 — Intersecciones

### v1.0 (anterior)
Todo encuentro T-MID segmentaba el paño, sin distinción del tipo de eje perpendicular.

### v1.1 (actual)
**Solo los T-MID desde ejes estructurales segmentan el paño.**

Un T-MID desde un tabique (eje no listado en STRUCTURAL_AXES) **no corta el paño**:
- El paño receptor mantiene su longitud continua para CE-06.
- Se fuerza un montante simple en el eje del encuentro (R-ENC-01 débil, `tag='encuentroTab'`).

Esto se implementa en `segment_panos(r, enc)` retornando `(cuts, zones, panos, tab_mids)`,
donde `tab_mids` es el conjunto de posiciones T-tabique que E4 convierte en montantes forzados.

Referencia: SPEC-08 Addendum v2.0 §A.

---

## Cambios en E7 — Layout Opción C

### v1.0 (anterior)
Elevaciones apiladas verticalmente (tiras horizontales), una por fila, despiece a la derecha.

### v1.1 (actual)
**Opción C: filas compactas por tipo de eje.**

#### Principio
- Las elevaciones se empaquetan en filas de izquierda a derecha, ordenadas por span decreciente
  dentro de cada fila (mayor primero).
- No hay celda de ancho fijo: cada elevación ocupa su span real + márgenes.
- Múltiples elevaciones conviven en la misma fila si la suma no excede MAX_ROW_W.
- No hay espacio en blanco al final de una fila cuando no hay más elevaciones que encajen.

#### Secciones

El layout se divide en tres secciones verticales, en este orden:

| Sección | Contenido | Header en DXF |
|---|---|---|
| 1 | Ejes longitudinales (letras estructurales: A, B, C, F, G, H, I, J, M, N, O) | `ELEVACIONES — EJES LONGITUDINALES` |
| 2 | Ejes transversales (números estructurales: 1, 2, 4, 6, 7, 9, 11, 11A, 13, 15, 16) | `ELEVACIONES — EJES TRANSVERSALES` |
| 3 | Tabiques (ejes no estructurales: 3, 5, 8, 10, 12, 14, C1, D, K, L) | `TABIQUES — MUROS NO ESTRUCTURALES` |

Entre secciones: separación SECT_GAP = 7000 mm en espacio modelo.

#### Parámetros de layout

| Parámetro | Valor | Descripción |
|---|---|---|
| MAX_ROW_W | 45 000 mm | Ancho máximo de una fila de elevaciones |
| H_GAP | 2 500 mm | Separación horizontal entre elevaciones en la misma fila |
| V_GAP | 4 200 mm | Separación vertical entre filas (igual al anterior, cubre cotas + título) |
| SECT_GAP | 7 000 mm | Separación extra entre secciones |

#### Despiece y leyenda

Al fondo del layout (después de la última sección), en zona compartida:
- Despiece de elementos reticulados (origen x=0, posición y = fondo - 4000mm).
- Leyenda (a la derecha del despiece, x = max_content_x + 3000mm).
- Cada tipo en el despiece lleva el nombre de los ejes donde aparece (`EJE A`, `EJE A, H`, etc.).

#### Algoritmo de empaquetado

```python
def pack_rows(group):
    """Greedy: ordena por span decreciente, llena filas sin exceder MAX_ROW_W."""
    sorted_g = sorted(group, key=lambda x: -elevation_span(x[1]))
    rows, cur_row, cur_w = [], [], 0
    for eje_id, walls in sorted_g:
        sp = elevation_span(walls)
        if cur_row and cur_w + H_GAP + sp > MAX_ROW_W:
            rows.append(cur_row)
            cur_row, cur_w = [(eje_id, walls, sp)], sp
        else:
            if cur_row: cur_w += H_GAP
            cur_row.append((eje_id, walls, sp))
            cur_w += sp
    if cur_row: rows.append(cur_row)
    return rows
```

#### Coordenadas en modelo (OX/OY)

El sistema usa dos globales `OX` y `OY` que se aplican en todas las primitivas de dibujo:
- `OY` = offset vertical de la fila en curso (set por `draw_elevation`).
- `OX` = offset horizontal de la elevación en curso dentro de la fila (set por el bucle principal).
- Todas las primitivas (`rect`, `line`, `text`, `circle`, `dim_h`, `dim_v`, `keynote`) añaden
  OX a sus coordenadas x y OY a sus coordenadas z/y.

Referencia: SPEC-12 §1 para el sistema de referencia de coordenadas por muro.

---

## Hallazgos antes y después de v1.1

| Hallazgo | v1.0 | v1.1 |
|---|---|---|
| Pilares T-01 | 60 | 49 (−11 tabiques) |
| Paños de corte | 34 | 36 (+2 continuos) |
| MC-BOARD-FLOAT-PILAR | 30 | 20 (menos pilares, menos juntas flotantes) |
| V-01..V-08 bloqueantes | 0 | 0 |
<!-- IMPORTED-NORMATIVE-BODY:END -->
