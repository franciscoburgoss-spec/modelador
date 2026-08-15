# BUG-016-A-027 — Pager interrumpe gate diff del runtime neutral

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Después de obtener GREEN 7/7 para `constructiveNeutralRuntime.js`, el gate:

`git diff --no-index /dev/null src/core/constructiveNeutralRuntime.js`

abrió el pager interactivo `less`.

La ejecución quedó contaminada por la sesión interactiva y posteriormente aparecieron errores de
shell:

- `unexpected EOF while looking for matching quote`;
- `syntax error: unexpected end of file`.

## Impacto

El GREEN focal y el SHA del runtime neutral son válidos y ocurrieron antes de la anomalía.

Sin embargo, esta salida no permite afirmar que se hayan completado correctamente:

- la inspección final no interactiva del diff;
- `git diff --check`;
- el status final del corte.

No existe evidencia de falla de producto.

## Correctiva

Repetir únicamente los gates posteriores al GREEN usando explícitamente:

`git --no-pager`

para impedir interacción con `less`.

## Resguardos

- no modificar `constructiveNeutralRuntime.js`;
- no modificar el corpus GREEN;
- no tocar B1/B2/B3.1/B3.2/B3.3;
- no realizar Git write;
- no cerrar BUG-016-A-023 todavía.

## Criterio de cierre

Cerrar cuando:

- el diff pueda inspeccionarse sin pager;
- `git diff --check` sea limpio;
- los SHA congelados de B3 permanezcan intactos;
- el test focal continúe 7/7;
- `git status -sb` sea obtenible normalmente.

## Evidencia de cierre

El gate se repitió sin pager y con el RC esperado de `git diff --no-index` controlado explícitamente.

Resultados:

- diff no interactivo obtenido correctamente;
- RC=1 interpretado como diferencia esperada, no como falla;
- `git diff --check` sin observaciones;
- archivos nuevos sin trailing whitespace y con un solo newline final;
- runtime neutral focal 7/7 PASS;
- SHA producto: `ac26cfe34602a1ffe847b42eabedf03b8d79aba80e2f3eeb05ed835434eea0f3`;
- SHA test: `e8ad171554525b87e34e81c7307587d66b49729b4f62a347a678c780ae318792`;
- identidad neutral: `404ca9e7ed30b522dfddb211b98099bb8a739119957071d1642f41f004d2fc2f`;
- B3.1/B3.2/B3.3 permanecieron byte-idénticos;
- `git status -sb` se obtuvo normalmente.

No se realizó Git write.
