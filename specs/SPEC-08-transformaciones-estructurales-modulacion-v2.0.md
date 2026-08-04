# SPEC-08 — Transformaciones estructurales de la modulación v2.0

## Diagnóstico

El cuerpo normativo importado no seguía el contrato documental de G0. Su contenido pertenece al
usuario y debe permanecer literal hasta que una spec funcional posterior autorice implementarlo.

## Decisión

Conservar el cuerpo importado como un bloque opaco recuperable por marcadores, identificado por
SHA-256 y longitud. Esta envolvente agrega sólo gobernanza; no interpreta ni activa sus reglas.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `condicionado`
- Motivo: la futura implementación involucra criterios estructurales y transformaciones de dominio.

## Alcance

- Preservar íntegramente el cuerpo normativo importado de SPEC-08 v2.0.
- Mantenerlo disponible como fuente para una futura spec funcional explícita.

## Fuera de alcance

- Implementar, conciliar o validar constructivamente las reglas del cuerpo importado.
- Modificar código de dominio, React, Tauri, DXF o INP desde esta normalización.

## Criterios de aceptación

1. El extractor recupera exactamente 9.876 bytes con SHA-256
   `3fc94c9691dbd16cc7c5e9c96b0a26c5204b05c1e108b1eea8439c145126524b`.
2. G0 reconoce esta envolvente y su declaración de esfuerzo futuro.
3. Ninguna regla del cuerpo importado se considera implementada por esta normalización.

## Evidencia

- `governance/IMPORTED_SPEC_BODIES.json` y `tests/importedSpecsGovernance.test.mjs`.
- Cierre `sessions/close-SPEC-GOV-C.md`.

## Cuerpo normativo importado — preservado literalmente

<!-- IMPORTED-NORMATIVE-BODY:BEGIN sha256=3fc94c9691dbd16cc7c5e9c96b0a26c5204b05c1e108b1eea8439c145126524b bytes=9876 -->
# SPEC-08 · Transformaciones estructurales de la modulación — v2.0

**Estado:** v2.0 · 2026-08-01 · consolida v1.0 (2026-07-30), Addendum v1.1 (2026-07-31)
y Addendum v2.0 (2026-08-01).
**Base:** SPEC-06 v1.3 + criterios CE aprobados + Manual Cintac 2020 p.61 + definición
de ejes estructurales vs. tabiques (Francisco, 2026-08-01).
**Arquitectura:** `CRITERIO CE-* → REGLA R-*/T-* → HALLAZGO MC-*` — toda decisión
geométrica declara su respaldo estructural.

---

## 1. Niveles de verificación y fuentes

- **G — geométrico determinista:** el pipeline verifica y decide sin cálculo.
- **C — requiere cálculo:** el pipeline **marca siempre** (`MC-*-CALC`) y solo resuelve
  donde el Manual dé tabla directa.
- **Fuentes:** `[MANUAL]` Manual Metalcon 2020 (lámina/página) · `[AISI S100-16]` con
  sección explícita · `[PRINCIPIO]` estática básica, criterio propio declarado.

---

## 2. Criterios estructurales

| CE | Enunciado | Nivel | Fuente |
|---|---|---|---|
| CE-01 | Cadena de compresión continua e ininterrumpida hasta fundación. Bandas colgadas **prohibidas** salvo excepción documentada con colgante diseñado en nudo | G (+C en excepción) | [PRINCIPIO] |
| CE-02 | Apoyo en axia: la viga corona el pilar; poste extremo de la reticulada sobre el alma del pilar; e=0 | G | [PRINCIPIO] |
| CE-03 | Si coronar interrumpe la continuidad vertical → conexión lateral declarada (ángulo 400, 3 #8×1/2 TIP al pilar + #10×3/4 al cordón) | G+C conector | [MANUAL lám. 73] |
| CE-04 | Uniones entre subsistemas rotuladas por defecto (una hilera de tornillos). Prohibida placa multi-cordón (empotramiento → torsión) | G | [PRINCIPIO + MANUAL cap. 6] |
| CE-05 | Cargas concentradas en nudo de la reticulada. Modulación de postes constante @600; donde no calza con la cercha se agrega una pieza | G | [PRINCIPIO] |
| CE-06 | Paño de corte calificado: **L≥1200 · H/L<2:1** · borde ≥9,5 · anclaje/tornillería continuos. Paño fallido <300 mm se absorbe en jamba; ≥300 mm → T-01 | G+C resistencia | [MANUAL pág. 39] |
| CE-07 | Esbeltez a compresión de pilares y montantes con carga concentrada: pandeo local (B), distorsional y global (E) | C, pre-filtro G | [AISI S100-16] |
| CE-08 | Aplastamiento del alma (web crippling) en apoyos y dinteles | C | [AISI S100-16 sec. C3.4 + MANUAL lám. 72] |
| CE-09 | La retícula @400 y el patrón de placas se subordinan a la estructura: nunca se mueve un elemento estructural por salvar un módulo | G | [PRINCIPIO] |
| CE-10 | Toda transformación re-entra al pipeline y registra efectos colaterales | G | [PRINCIPIO] |

---

## 3. Clasificación de ejes — criterio E2 *(nuevo en v2.0)*

### Regla (2026-08-01)

**Un encuentro T-MID segmenta el paño de corte SOLAMENTE si el eje que llega
perpendicularmente es un EJE ESTRUCTURAL.**

Los encuentros T desde tabiques (muros no estructurales) NO cortan el paño:
- No alteran la evaluación CE-06 del paño receptor.
- Sí fuerzan un **montante simple** en el eje del encuentro (R-ENC-01 débil, `tag='encuentroTab'`).
- El montante del tabique actúa como punto de amarre, no como borde de paño.

### Ejes estructurales del proyecto casa-L

| Tipo | Ejes |
|---|---|
| Longitudinales estructurales (yAxes) | A, B, C, F, G, H, I, J, M, N, O |
| Transversales estructurales (xAxes) | 1, 2, 4, 6, 7, 9, 11, 11A, 13, 15, 16 |
| Tabiques (no estructurales) | 3, 5, 8, 10, 12, 14, C1, D, K, L |

### Impacto en el proyecto casa-L

| Métrica | v1.0 | v2.0 |
|---|---|---|
| Pilares T-01 | 60 | 49 |
| Paños de corte | 34 | 36 |
| MC-BOARD-FLOAT-PILAR | 30 | ~20 |

11 pilares T-01 eran consecuencia de T-tabique; esos paños ahora califican como
corte continuo con el tabique forzando solo un montante de amarre.

### Implementación

```python
STRUCTURAL_AXES = {
    '1','2','4','6','7','9','11','11A','13','15','16',
    'A','B','C','F','G','H','I','J','M','N','O',
}

def segment_panos(r, enc):
    cuts = {0.0, r['L']}
    # ... zonas de vano ...
    tab_mids = set()
    for e in enc[r['id']]:
        if e['kind'] == 'MID':
            if e['otherLabel'] in STRUCTURAL_AXES:
                cuts.add(round(e['x'], 1))      # eje estructural → corta el paño
            else:
                tab_mids.add(round(e['x'], 1))  # tabique → solo montante en E4
    return cuts, zones, panos, tab_mids
```

---

## 4. Reglas de transformación

### T-01 · Paño que no califica → PILAR RETICULADO (CE-06)

- **Gatillo:** paño ≥300 mm con L<1200 o H/L≥2:1 → `MC-NOT-SHEARWALL` + `MC-SHEAR-CALC`.
- **Geometría:** dos cordones verticales 90CA085 + diagonales 60CA085 W + travesaños
  40CA085 @600; placa base 200×600×2 + AN1 por cordón.
- El pilar aporta apoyo vertical y arriostre; **no cuenta** como aporte de corte de placa.
- **El paño del pilar no lleva montantes @400** (R-PRES-06): el sistema resistente es un
  pilar, no un muro de corte.
- **Cordones del pilar (SPEC-12 §3.2):**
  - Borde de muro (bt='end'): cara exterior en −W/2 (plomo exterior del muro perpendicular)
  - Borde de vano (bt='vano'): adyacente a la cara interior de la jamba ICA
  - Borde de T estructural (bt='T'): flush con el eje del encuentro

### T-02 · Dintel luz ≥2400 → VIGA MAESTRA RETICULADA — Esquema A3 (CE-01/02/03)

- **Gatillo:** vano con luz ≥2400 mm → `MC-CRIPPLING-CALC` + `MC-BUCKLING-CALC`.
- **Geometría:** cordones 90CA085, postes 40CA085 @600 (constante), diagonales 60CA085 W;
  h=600 estándar.
- **Apoyo axia (A3):** la viga del nivel más alto **corona el pilar ICA+C en axia** (placa
  tope 2 mm + 2 #10×3/4; poste extremo sobre alma del pilar). El pilar ICA+C es **continuo
  desde fundación hasta el tope de la viga**.
- **Vanos apilados:** solo la viga del nivel más alto corona; las bandas intermedias ≥300 mm
  son **vigas intermedias laterales** (ángulo 400, criterio lám. 73) → `MC-CONNECTOR-CALC`.
- **Cerchas sobre viga (CE-05):** postes @600 constantes + poste extra bajo cada cercha que
  no calce → `MC-LOAD-BETWEEN-NODES`.
- **Unión cercha–viga:** una hilera vertical de 2–3 #10×3/4 (rótula, CE-04).

### T-02-A4 · Vano adyacente a pilar reticulado → vigas laterales sobre ICA *(Addendum v1.1)*

- **Gatillo:** vano con luz ≥2400 mm cuyo paño colindante se transformó en pilar reticulado
  (T-01). El esquema A3 no es aplicable.
- **Solución:** ambos bordes del vano se resuelven con **jambas ICA de altura completa**
  (0→H). **Ambas vigas (V1 y V2) apoyan lateralmente** sobre las ICA de cada extremo
  (ángulo 400, lám. 73 → `MC-CONNECTOR-CALC`), confinadas a la luz libre del vano.
- **Luz libre exacta** entre caras de ICA (EJE A: 5400 mm).
- Caso de referencia casa-L: EJE A 2→7 → pilar reticulado 0–1224 + jambas ICA +
  V1 5400×400 (z 950–1350) lateral + V2 5400×600 (z 1850–2450) lateral.

### R-ENC-01 · Encuentros T (CE-09)

- **Eje estructural:** montante forzado en el eje + segmenta el paño para CE-06
  (lám. 70: #8@100 + #10×3/4 zig-zag @150 + AN1). Tag `'encuentroT'`.
- **Eje tabique:** montante forzado en el eje, **sin segmentar el paño** para CE-06.
  Tag `'encuentroTab'`. *(Actualizado en v2.0)*
- Conflicto con vano/jamba (<150 mm) → `MC-STUD-CLASH`, montante al módulo adyacente.

### R-POST-01 · Re-entrada (CE-10)
- Toda transformación recalcula paños vecinos y registra `MC-SIDE-EFFECT`.

---

## 5. Ensamble de término de muro — U+C+C *(nuevo en v2.0)*

### Antecedente
La implementación anterior centraba el `corner` en el borde del muro (19 mm fuera) y
colocaba el `backup` a 100 mm con un hueco de 62 mm entre ambos.

### Regla actualizada per Manual Cintac 2020 p.61 ("Fin de muro o vano")

**El ensamble de término es U+C+C sin separación entre perfiles:**

| Perfil | Posición izq. (body mm) | Posición der. (body mm) |
|---|---|---|
| U (solera/track) | contenedor del ensamble | contenedor |
| C1 corner (cara exterior) | [0, 38] | [L−38, L] |
| C2 backup (cara interior) | [38, 76] | [L−76, L−38] |

**Cuando el extremo del muro corresponde a un paño pilar reticulado**, corner y backup
se suprimen en el DXF; el pilar reticulado reemplaza toda la función de borde.

---

## 6. Supresión de elementos en zona pilar reticulado *(nuevo en v2.0)*

Dentro de un paño clasificado como pilar reticulado T-01, los siguientes elementos
se suprimen en la representación DXF (permanecen en el JSON para V-02):

| Elemento | Rol JSON | Motivo |
|---|---|---|
| Corner | `corner` | Pilar reticulado asume la función de borde |
| Backup | `backup` | Ídem |
| King | `king` | No aplica cuando el confinante es un pilar ret., no un muro |

---

## 7. Catálogo de hallazgos

`MC-NOT-SHEARWALL` · `MC-SHEAR-CALC` · `MC-CRIPPLING-CALC` · `MC-BUCKLING-CALC` ·
`MC-CONNECTOR-CALC` · `MC-LOAD-BETWEEN-NODES` · `MC-LOAD-PATH-BREAK` ·
`MC-ECCENTRIC-SUPPORT` · `MC-FIXED-JOINT` · `MC-STUD-CLASH` · `MC-SIDE-EFFECT` ·
`MC-HANGER-CALC` · `MC-BOARD-FLOAT-PILAR` *(junta flotante sobre paño pilar)*

---

## 8. Caso de referencia casa-L (v2.0)

| Elevación | Transformaciones |
|---|---|
| EJE A 2→7 | V2 lateral h=600 (z 1850–2450) + V1 lateral h=400 (z 950–1350) + pilar ret. paño 0–1224 (T-02-A4) |
| EJE O 6→9 | viga axia h=600 sobre puerta 3100 (z 2700–3300) |
| EJE 6 I→O | viga axia h=600 sobre puerta 2650 (z 2700–3300) |
| Proyecto | 49 pilares T-01 · 36 paños corte · 10 tabiques sin segmentación de paño |

---

## 9. Historial de versiones

| Versión | Fecha | Cambios |
|---|---|---|
| v1.0 | 2026-07-30 | A3 aprobado; Esquema C descartado; embebido B ajustado a 400mm |
| Addendum v1.1 | 2026-07-31 | T-02-A4: vano adyacente a pilar reticulado → vigas laterales sobre ICA |
| v2.0 | 2026-08-01 | Ejes estructurales vs. tabiques en E2 (−11 pilares T-01); ensamble U+C+C per Manual p.61; supresión corner/backup/king en zona pilar |
<!-- IMPORTED-NORMATIVE-BODY:END -->
