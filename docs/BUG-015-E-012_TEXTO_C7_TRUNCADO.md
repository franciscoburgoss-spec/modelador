# BUG-015-E-012 — Texto crítico de C/7 truncado

## Hallazgo

Después de B3.2, el detalle ampliado de C/7 representaba correctamente la interfaz como
`end=highS` con `anchorS=2000`, pero la tarjeta SVG reutilizaba líneas `<text>` sin ajuste automático
y el contenido excedía el ancho disponible.

Quedaban parcialmente truncadas precisamente las frases que distinguen
`localizationEnvelope=[1999.9,2000]` de una longitud física.

## Riesgo

La salida estructurada era correcta, pero una revisión humana podía perder la advertencia y volver a
interpretar la envolvente de 0,1 mm como longitud física del receptor.

## Correctiva B3.2.1

Modificar sólo `scripts/generate-spec015e-evidence.mjs` para repartir el detalle C/7 en líneas
explícitas que quepan dentro del inset:

- `Extremo highS · S 2.000 mm`
- `Localización S 1.999,9→2.000 mm`
- `tol. 0,1 mm · Z 3.250→4.150 mm`
- `La envolvente NO es longitud física`

No cambia R11, REV8, geometría, intención, candidate paths ni el JSON estructural de evidencia.
