# BUG-015-E-006 — IDs técnicos como nombre principal en el escenario lateral

## Síntoma observado

La evidencia B3 mostraba `Cubierta <id>` y `Muro <id>` como identificación principal del escenario lateral, contradiciendo la convención humana ya fijada en REV8.

## Regla corregida

B3.1 consume la presentación humana vigente. La cubierta se identifica por faldón/ejes y el muro por orientación/ejes; el ID queda sólo en una línea secundaria `Ref. técnica`.

## Invariante

La referencia técnica no desaparece del artefacto auditable, pero nunca reemplaza al descriptor humano como lectura principal.
