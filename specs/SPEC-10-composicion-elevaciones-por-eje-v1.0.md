# SPEC-10 — Composición de elevaciones por eje v1.0

## Diagnóstico

El cuerpo normativo importado no seguía el contrato documental de G0. Su contenido debe quedar
literal y pendiente de un corte funcional que resuelva sus dependencias sin reescribirlo.

## Decisión

Conservar el cuerpo importado como un bloque opaco recuperable por marcadores, identificado por
SHA-256 y longitud. Esta envolvente agrega sólo gobernanza; no interpreta ni activa sus reglas.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `condicionado`
- Motivo: la futura implementación involucra composición geométrica de elevaciones y DXF.

## Alcance

- Preservar íntegramente el cuerpo normativo importado de SPEC-10 v1.0.
- Mantenerlo disponible como fuente para una futura spec funcional explícita.

## Fuera de alcance

- Implementar, conciliar o validar visualmente sus reglas de composición.
- Modificar código, DXF o artefactos desde esta normalización.

## Criterios de aceptación

1. El extractor recupera exactamente 3.871 bytes con SHA-256
   `bc6df874a9ea9bdf19843656c65753435064c139b563dd652c6e610a6c1794b8`.
2. G0 reconoce esta envolvente y su declaración de esfuerzo futuro.
3. Ninguna regla de composición se considera implementada por esta normalización.

## Evidencia

- `governance/IMPORTED_SPEC_BODIES.json` y `tests/importedSpecsGovernance.test.mjs`.
- Cierre `sessions/close-SPEC-GOV-C.md`.

## Cuerpo normativo importado — preservado literalmente

<!-- IMPORTED-NORMATIVE-BODY:BEGIN sha256=bc6df874a9ea9bdf19843656c65753435064c139b563dd652c6e610a6c1794b8 bytes=3871 -->
# SPEC-10 · Composición de elevaciones por eje — unión de muros

**Estado:** v1.0 · 2026-07-31 · creada como respuesta a la pregunta "¿será necesario hacer una spec para hacer la unión de los distintos muros del proyecto en cada una de las elevaciones?" — **sí**: hasta la v7 la unión era implícita (cada muro se dibujaba desde z=0), lo que ponía muros de frontón al nivel del NPT. Este documento rige cómo se agrupan y unen los muros colineales en una elevación por eje.

**Base:** SPEC-06 v1.3 + Addendum OSB v1.4 · SPEC-08 v1.1 · SPEC-09 v1.0. Complementa, no reemplaza: la geometría de cada muro se dibuja según SPEC-09; SPEC-10 rige la **composición** de la elevación.

## R-EJ-01 · Agrupación por eje
Una elevación por **eje de retícula** (xAxes e yAxes del modelo). Pertenecen a la elevación del eje todos los muros colineales con él (mismo eje de apoyo, cualquier sentido y cualquier nivel). Un eje puede tener **varios muros a distinto nivel** (casa-L: ejes J, K, N, 6, 9, 11, 13, I tienen 2–3 muros apilados o alternados).

## R-EJ-02 · Datum absoluto, nunca relativo al muro
Todos los muros de la elevación se dibujan en **cota absoluta de nivel** (elevación del zLevel del modelo: NTN 0, NPT 450, CIELO GENERAL 3250, CIELO ALTO 3850, FRONTON GENERAL 4150, FRONTON ALTO 4750). **Prohibido dibujar cada muro desde z=0**: un muro que nace en CIELO GENERAL (3250) se dibuja a partir de 3250, nunca en el NPT. Se dibuja la línea de referencia **NPT +450** en toda la elevación con su etiqueta.

## R-EJ-03 · Posición horizontal absoluta
Cada muro se ubica en su **posición absoluta sobre el eje** (posiciones de los ejes perpendiculares que lo delimitan). Los vacíos entre muros del mismo eje se respetan (no se cierran ni se traslapa un muro sobre otro; muros apilados comparten el mismo tramo x en distinto nivel, R-EJ-02).

## R-EJ-04 · Continuidad en la unión muro–muro
En la unión vertical de dos muros consecutivos del mismo eje y nivel, el elemento de borde (esquina/backup) se dibuja **una sola vez** (el del muro de inicio; R-G-01 de adyacencia). En la unión horizontal (muro sobre muro), la solera superior del muro bajo y la inferior del muro alto se dibujan como una sola solera en el nivel de contacto.

## R-EJ-05 · Ejes y cotas de la elevación compuesta
- Ejes perpendiculares que cruzan el tramo: burbuja y cadena de distancia entre ejes bajo la elevación (datum NPT).
- Cadena de tramos por muro (largo de cada muro, en su nivel).
- Cadena vertical por muro: desde su nivel base hasta su tope, con los cortes en antepechos/vanos/dinteles (headers del muro).
- Cadenas de distanciamiento de montantes/despuntes por muro (R-G-09), en la parte superior de **cada muro** (no de la elevación completa), sin invadir.

## R-EJ-06 · Keynotes y leyenda únicos del plano
La numeración de keynotes es **única para todo el plano** (misma tabla de leyenda que SPEC-09 R-G-07, ampliada: 15 cordón, 16 poste/travesaño, 17 diagonal, 18 pilar ICA). En cada elevación se etiqueta la primera ocurrencia de cada elemento presente; la leyenda se dibuja una vez por plano.

## R-EJ-07 · Despieces por tipo, no por elemento
Los elementos reticulados repetidos se despiezan **por tipo único** (largo × alto): una sola vista por cada geometría distinta de viga/pilar reticulado del proyecto, con sus componentes referenciados (15/16/17). La elevación referencia "(VER DESPIECE)".

## R-EJ-08 · Auditoría de composición
Antes de entregar se verifica:
1. Todo muro con bottomZ > NPT se dibuja con base z > 450 (ningún muro de frontón/cielo en el NPT).
2. Ningún par de muros del mismo eje se traslapa en (x, z).
3. Toda junta de placa a ≥150 mm de bordes de vano (V-06, Addendum v1.4).
4. Línea NPT +450 presente en cada elevación.
5. Leyenda única y keynotes consistentes en todas las elevaciones.
<!-- IMPORTED-NORMATIVE-BODY:END -->
