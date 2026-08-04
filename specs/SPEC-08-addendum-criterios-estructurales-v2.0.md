# SPEC-08 — Addendum de criterios estructurales v2.0

## Diagnóstico

El addendum importado no seguía el contrato documental de G0 y debe permanecer separado de la
SPEC-08 base, sin resumir ni alterar su contenido normativo.

## Decisión

Conservar el cuerpo importado como un bloque opaco recuperable por marcadores, identificado por
SHA-256 y longitud. Esta envolvente agrega sólo gobernanza; no interpreta ni activa sus reglas.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `condicionado`
- Motivo: la futura implementación involucra criterios estructurales y representación DXF.

## Alcance

- Preservar íntegramente el cuerpo normativo importado del addendum SPEC-08 v2.0.
- Mantener el addendum como documento independiente de la SPEC-08 base.

## Fuera de alcance

- Implementar, fusionar, conciliar o validar constructivamente sus reglas.
- Modificar código de dominio, React, Tauri, DXF o INP desde esta normalización.

## Criterios de aceptación

1. El extractor recupera exactamente 4.104 bytes con SHA-256
   `261cbeb415fff42a24a2d8dd4da0a5a9d534156ac4db1b655165e749c6df8425`.
2. G0 reconoce esta envolvente y su declaración de esfuerzo futuro.
3. El addendum continúa siendo un documento distinto de la SPEC-08 base.

## Evidencia

- `governance/IMPORTED_SPEC_BODIES.json` y `tests/importedSpecsGovernance.test.mjs`.
- Cierre `sessions/close-SPEC-GOV-C.md`.

## Cuerpo normativo importado — preservado literalmente

<!-- IMPORTED-NORMATIVE-BODY:BEGIN sha256=261cbeb415fff42a24a2d8dd4da0a5a9d534156ac4db1b655165e749c6df8425 bytes=4104 -->
# SPEC-08 · Addendum v2.0 — Criterios estructurales actualizados

**Estado:** v2.0 · 2026-08-01 · complementa SPEC-08 v1.0.
Dos actualizaciones mayores: (A) clasificación de ejes estructurales vs. tabiques para
el criterio E2 de segmentación de paños; (B) ensamble de término de muro per Manual
Cintac 2020 p.61 (U+C+C sin separación).

---

## A. Clasificación de ejes — criterio E2 de segmentación de paños

### Antecedente
En SPEC-11 v1.0 (E2), todos los encuentros T-MID segmentaban el paño sin importar si el
muro que llegaba era estructural o tabique. Esto generaba paños artificialmente cortos que
clasificaban como pilar reticulado T-01 sin respaldo estructural real.

### Regla actualizada (2026-08-01)

**Un encuentro T-MID segmenta el paño de corte SOLAMENTE si el eje que llega
perpendicularmente es un EJE ESTRUCTURAL.**

Los encuentros T desde tabiques (muros no estructurales) NO cortan el paño:
- No alteran la evaluación CE-06 del paño receptor.
- Sí fuerzan un **montante simple** en el eje del encuentro (R-ENC-01 débil).
- El montante del tabique actúa como punto de amarre, no como borde de paño.

### Ejes estructurales del proyecto casa-L

| Tipo | Ejes |
|---|---|
| Longitudinales estructurales (Y) | A, B, C, F, G, H, I, J, M, N, O |
| Transversales estructurales (X) | 1, 2, 4, 6, 7, 9, 11, 11A, 13, 15, 16 |
| Tabiques (no estructurales) | 3, 5, 8, 10, 12, 14, C1, D, K, L |

### Impacto en el pipeline

Antes de esta actualización: **60 pilares T-01**, 34 paños de corte.
Después: **49 pilares T-01**, 36 paños de corte.
Diferencia: 11 pilares T-01 que eran consecuencia de T-tabique desaparecen;
esos paños ahora califican como corte continuo.

### Implementación en modulador_SPEC11_v2.py

```python
STRUCTURAL_AXES = {
    '1','2','4','6','7','9','11','11A','13','15','16',
    'A','B','C','F','G','H','I','J','M','N','O',
}

def segment_panos(r, enc):
    cuts = {0.0, r['L']}
    ...
    tab_mids = set()
    for e in enc[r['id']]:
        if e['kind'] == 'MID':
            if e['otherLabel'] in STRUCTURAL_AXES:
                cuts.add(round(e['x'], 1))     # corta el paño
            else:
                tab_mids.add(round(e['x'], 1)) # solo montante en E4
    ...
    return cuts, zones, panos, tab_mids
```

---

## B. Ensamble de término de muro — U+C+C (Manual Cintac 2020 p.61)

### Antecedente
La implementación anterior usaba `corner` centrado en el borde del muro (offset=0 o offset=L)
y `backup` a 100 mm del borde. En el DXF esto producía:
- Corner half-outside del muro (19mm fuera).
- Gap de 62 mm entre cara del backup y cara del corner.

### Regla actualizada per Manual p.61 ("Fin de muro o vano")

**El ensamble de término es U+C+C, sin separación entre perfiles:**

| Perfil | Posición | Body (mm desde borde) |
|---|---|---|
| U (solera/track) | Contenedor del ensamble | el track mismo |
| C1 (corner = cara exterior) | Flush con el borde del muro | [L−38, L] |
| C2 (backup = cara interior) | Adyacente a C1, sin hueco | [L−76, L−38] |

Para el extremo izquierdo (mirror):
- C1 corner: [0, 38]
- C2 backup: [38, 76]

### Efecto en representación DXF

En `draw_wall`, los perfiles corner y backup se dibujan con la posición corregida
(`_corner_x12(role, offset, L, W)`) independientemente del `offset` almacenado en el JSON
(que mantiene los valores legacy 0/100 para compatibilidad con V-02).

**Nota:** cuando el extremo del muro corresponde a un paño pilar reticulado, corner y backup
se suprimen visualmente (el pilar reemplaza toda la función de borde).

---

## C. Supresión de elementos en zona pilar reticulado

### Regla (actualizada de SPEC-12 §2 → ahora formalizada en SPEC-08)

Dentro de un paño clasificado como pilar reticulado T-01:
- `corner` y `backup`: suprimidos en el DXF.
- `king` (montante de soporte de lintel/dintel): suprimido si cae dentro del paño pilar.
- El pilar reticulado sustituye toda la función estructural de borde y de apoyo.

En el JSON estos studs siguen presentes (necesarios para la validación V-02),
pero el generador DXF los omite al dibujar.
<!-- IMPORTED-NORMATIVE-BODY:END -->
