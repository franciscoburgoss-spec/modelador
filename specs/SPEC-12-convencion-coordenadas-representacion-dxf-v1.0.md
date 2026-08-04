# SPEC-12 — Convención de coordenadas y representación DXF v1.0

## Diagnóstico

El cuerpo normativo importado no seguía el contrato documental de G0. Su contenido debe quedar
literal y pendiente de un corte funcional que formalice sus contratos geométricos.

## Decisión

Conservar el cuerpo importado como un bloque opaco recuperable por marcadores, identificado por
SHA-256 y longitud. Esta envolvente agrega sólo gobernanza; no interpreta ni activa sus reglas.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `condicionado`
- Motivo: la futura implementación define coordenadas y representación DXF compleja.

## Alcance

- Preservar íntegramente el cuerpo normativo importado de SPEC-12 v1.0.
- Mantenerlo disponible como fuente para una futura spec funcional explícita.

## Fuera de alcance

- Implementar, conciliar o auditar los contratos geométricos del cuerpo importado.
- Modificar código, DXF o artefactos desde esta normalización.

## Criterios de aceptación

1. El extractor recupera exactamente 3.955 bytes con SHA-256
   `5f39e1c4e96a0fd02e319355770df8a038b5fd144a01cc320b1b2ebff56228c6`.
2. G0 reconoce esta envolvente y su declaración de esfuerzo futuro.
3. Ninguna convención se considera implementada por esta normalización.

## Evidencia

- `governance/IMPORTED_SPEC_BODIES.json` y `tests/importedSpecsGovernance.test.mjs`.
- Cierre `sessions/close-SPEC-GOV-C.md`.

## Cuerpo normativo importado — preservado literalmente

<!-- IMPORTED-NORMATIVE-BODY:BEGIN sha256=5f39e1c4e96a0fd02e319355770df8a038b5fd144a01cc320b1b2ebff56228c6 bytes=3955 -->
# SPEC-12 · Convención de coordenadas y representación de elementos en elevación DXF

**Estado:** v1.0 · 2026-08-01 · creada para eliminar la ambigüedad de `offset` que produjo:
(a) pilarRetChord desplazado 26 mm del borde del paño, (b) jamba ICA centrada en el borde del vano
en vez de flush, (c) jamba dibujada como 38 mm en lugar de 76 mm. Complementa SPEC-09 (reglas
de representación) y SPEC-07 (esquema de export).

---

## 1. Sistema de referencia

| Eje | Origen | Sentido |
|---|---|---|
| x | Cara izquierda del muro (borde del paño más a la izquierda) | → derecha |
| z | `bottomZ` del muro (elevación del nivel de apoyo) | ↑ arriba |

Todo elemento se define por su **bounding box (x1, x2, z1, z2)** en el sistema local del muro:
- `x1` = cara izquierda del elemento (mm desde origen)
- `x2` = cara derecha (`x2 > x1`)
- `z1` = cara inferior (`z1 ≥ 0`)
- `z2` = cara superior (`z2 > z1`)

## 2. Elementos simples — perfil único W_PROF = 38 mm

Son los roles: `corner`, `backup`, `stud`, `king`, `cripple`, `crippleTop`.

Se almacenan en el JSON con **`offset` (centro) + `zMin/zMax`** por compatibilidad con el editor.
El DXF computa: `x1 = offset − W_PROF/2`, `x2 = offset + W_PROF/2`.

**Excepción de borde:** los `corner` de extremo de muro se dibujan con cara flush al borde:
- Corner izquierdo (offset=0): `x1=0`, `x2=W_PROF`
- Corner derecho (offset=L): `x1=L−W_PROF`, `x2=L`

## 3. Elementos compuestos — x1/x2 explícitos en el JSON

Los roles `jambICA`, `pillarICA` y `pilarRetChord` llevan en el JSON los campos **`x1` y `x2`**
además de `offset=(x1+x2)/2` y `zMin/zMax`. El DXF usa `x1/x2` directamente.

### 3.1 jambICA / pillarICA

**Definición:** sección compuesta ICA = 2 perfiles C (C+CA formando I, Anexo IV Manual).
En elevación aparece como **dos alas** de W_PROF cada una: `ancho_dibujado = 2 × W_PROF = 76 mm`.

**Posición — flush con el borde del vano, cuerpo hacia el paño:**

| Borde del vano | x1 | x2 |
|---|---|---|
| Izquierdo (vano_x1) | `vano_x1 − 2·W_PROF` | `vano_x1` |
| Derecho (vano_x2) | `vano_x2` | `vano_x2 + 2·W_PROF` |

**Representación DXF** — dos rectángulos en capa `JAMBA_ICA` (o `PILAR_ICA`):
```
ala exterior (flush al vano): rect(x2 − W_PROF, x2)
ala interior (hacia el paño): rect(x1, x1 + W_PROF)
```

### 3.2 pilarRetChord

**Definición:** cordón del pilar reticulado T-01 = 1 perfil C de W_PROF = 38 mm.
Siempre hay dos cordones por pilar (izquierdo y derecho).

**Posición — flush con el límite efectivo del paño, DESPUÉS de la jamba si la hay:**

| Límite del paño | Tipo de borde | Cordón x1 | Cordón x2 |
|---|---|---|---|
| Extremo del muro (a=0) | `end` | 0 | W_PROF |
| Extremo del muro (b=L) | `end` | L − W_PROF | L |
| Borde de vano izquierdo (a=vano_x1) | `vano` | a + 2·W_PROF | a + 3·W_PROF |
| Borde de vano derecho (b=vano_x2) | `vano` | b − 3·W_PROF | b − 2·W_PROF |
| Eje T interior (a o b = eje_T) | `T` | a | a + W_PROF (izq.) o b − W_PROF, b (der.) |

**Representación DXF** — el pilar se dibuja de `x1` del cordón izquierdo a `x2` del cordón
derecho. `draw_pilar_ret(c1['x1'], c2['x2'], z1, z2)`.

## 4. Orden de adyacencia en el borde de vano (R-G-01)

De la luz del vano hacia el paño:
```
[VANO]  | jamba ala exterior | jamba ala interior | pilar chord | ... interior pilar ... |
        x=vano_edge        x=vano_edge±W       x=vano_edge±2W  x=vano_edge±3W
```
No hay espacio libre entre jamba y pilar: son adyacentes, nunca superpuestos.

## 5. Trazabilidad

| Bug corregido | Regla |
|---|---|
| jamba centrada en el borde del vano (offset = edge ± 87.5) | §3.1: x2=vano_edge (flush) |
| jamba dibujada como 38 mm (un solo perfil) | §3.1: 2 alas de W_PROF |
| pilarRetChord a ±45 mm del borde del paño | §3.2: flush con borde efectivo |
| pilar superpuesto con jamba | §4: adyacente, nunca fusionado |
| pilar sobre borde de muro a 26 mm del edge | §3.2: x1=0 para bt='end' |
<!-- IMPORTED-NORMATIVE-BODY:END -->
