# SPEC-13 — Layout de espacio modelo y papel v1.0

## Diagnóstico

El cuerpo normativo importado no seguía el contrato documental de G0. Su contenido debe quedar
literal y pendiente de un corte funcional que resuelva el layout sin completar decisiones abiertas.

## Decisión

Conservar el cuerpo importado como un bloque opaco recuperable por marcadores, identificado por
SHA-256 y longitud. Esta envolvente agrega sólo gobernanza; no interpreta ni activa sus reglas.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `condicionado`
- Motivo: la futura implementación modifica layout DXF en model space y paper space.

## Alcance

- Preservar íntegramente el cuerpo normativo importado de SPEC-13 v1.0.
- Mantenerlo disponible como fuente para una futura spec funcional explícita.

## Fuera de alcance

- Implementar el layout o resolver la distribución de láminas que el cuerpo deja pendiente.
- Modificar código, DXF o artefactos desde esta normalización.

## Criterios de aceptación

1. El extractor recupera exactamente 3.658 bytes con SHA-256
   `ef4b0ebed1bd05ef979258e9ca88d55735878714f7e0e52b4c2423a6ea64c38c`.
2. G0 reconoce esta envolvente y su declaración de esfuerzo futuro.
3. Ninguna regla de layout se considera implementada por esta normalización.

## Evidencia

- `governance/IMPORTED_SPEC_BODIES.json` y `tests/importedSpecsGovernance.test.mjs`.
- Cierre `sessions/close-SPEC-GOV-C.md`.

## Cuerpo normativo importado — preservado literalmente

<!-- IMPORTED-NORMATIVE-BODY:BEGIN sha256=ef4b0ebed1bd05ef979258e9ca88d55735878714f7e0e52b4c2423a6ea64c38c bytes=3658 -->
# SPEC-13 · Layout espacio modelo y espacio papel — v1.0

**Estado:** v1.0 · 2026-08-01 · nueva. Define el sistema de distribución rectangular
(Opción C) en espacio modelo y el mapeo a láminas A0/A1 en espacio papel.

---

## 1. Principio

**El espacio modelo contiene el layout completo del proyecto** en tres secciones verticales
(longitudinal, transversal, tabiques). **El espacio papel contiene viewports** que mapean
regiones del espacio modelo a láminas físicas con rótulo.

---

## 2. Opción C — filas compactas (espacio modelo)

Ver SPEC-11 v1.1 §E7 para el algoritmo de empaquetado y parámetros.

**Estructura del espacio modelo** (coordenadas en mm, escala 1:1):
```
Y=0 ─────────────────────────────────────────
  ELEVACIONES — EJES LONGITUDINALES
  [EJE H 12800mm] [EJE B 12800mm]
  [EJE I 12000mm] [EJE A 11500mm]
  [EJE G 4200mm] [EJE F 1600mm] [EJE L 1000mm]
  ...
Y≈−70000 ────────────────────────────────────
  ELEVACIONES — EJES TRANSVERSALES
  [EJE 6 12150mm] [EJE 16 ...]
  ...
Y≈−150000 ───────────────────────────────────
  TABIQUES — MUROS NO ESTRUCTURALES
  [EJE 10] [EJE 12] [EJE 14] ...
Y≈−220000 ───────────────────────────────────
  DESPIECE ELEMENTOS RETICULADOS   LEYENDA
```

**Extensión total aproximada del proyecto casa-L:**
- X: 0 a ~43 600 mm
- Y: 0 a ~−265 000 mm

---

## 3. Mapeo a láminas (espacio papel)

### Escala estándar: 1:50

| Formato | Papel (mm) | Área útil papel (mm) | Área útil modelo (mm) |
|---|---|---|---|
| A0 landscape | 1189 × 841 | ~1140 × 780 | 57 000 × 39 000 |
| A1 landscape | 841 × 594 | ~800 × 540 | 40 000 × 27 000 |

*(Área útil modelo = área papel × escala, descontando márgenes y rótulo)*

### Rótulo (cuadro de rotulación)

- Posición: borde inferior, horizontal.
- Alto papel: ~55 mm (= 2750 mm modelo @ 1:50).
- Contiene: mandante, obra, ubicación, número de proyecto, prefijo de lámina,
  título de la lámina, dibujó/revisó/aprobó, fecha, revisiones, escala.
- No forma parte del viewport de elevaciones; es un bloque fijo en papel space.

### Viewport estándar

Cada lámina tiene un viewport rectangular que cubre la región de elevaciones.
El viewport excluye el rótulo (tiene su propio bloque en paper space).

---

## 4. Agrupamiento por lámina (pendiente de definición)

Para asignar secciones del espacio modelo a láminas específicas, se definen **bloques de
lámina** — regiones rectangulares en el espacio modelo que corresponden exactamente al
viewport de una lámina.

**Criterios de agrupamiento:**
- Las secciones longitudinal y transversal van en láminas separadas (sin mezclar ejes).
- Los tabiques pueden ir en la misma lámina que los transversales si caben.
- El despiece y la leyenda van en una lámina dedicada (o al final de la última lámina
  de cada sección si el espacio lo permite).

**Definición pendiente:** el usuario define la distribución exacta de elevaciones por
lámina una vez que el layout Opción C se haya validado visualmente en QCAD Pro.

---

## 5. Próximos pasos

1. Validar layout Opción C completo en QCAD Pro.
2. Definir bloques de lámina (qué filas van en qué lámina).
3. Crear bloques de rótulo con campos rellenables (projectInfo del JSON).
4. Generar entidades VIEWPORT en paper space del DXF.
5. Asignar escala 1:50 a cada viewport y anclar al rótulo.
<!-- IMPORTED-NORMATIVE-BODY:END -->
