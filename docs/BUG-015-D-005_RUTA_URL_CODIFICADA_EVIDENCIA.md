# BUG-015-D-005 — Ruta `file:` codificada al generar evidencia

## Estado

Registrado y corregido durante la validación local de SPEC-015-D, antes del cierre.

## Reproducción

En macOS, con el repositorio ubicado en una ruta que contiene espacios, por ejemplo:

```text
/Volumes/MEM EXT/Developer/modelador
```

el gate:

```bash
npm run evidence:spec015d
```

fallaba con:

```text
EACCES: permission denied, mkdir '/Volumes/MEM%20EXT'
```

## Causa

`scripts/generate-spec015d-evidence.mjs` calculaba `ROOT` mediante:

```js
resolve(new URL('..', import.meta.url).pathname)
```

`URL.pathname` conserva los espacios codificados como `%20`. Ese texto se entregaba a las APIs de filesystem como si fuese una ruta POSIX real, por lo que Node intentaba crear `/Volumes/MEM%20EXT` en vez de usar `/Volumes/MEM EXT`.

## Corrección

Convertir explícitamente la URL `file:` con `fileURLToPath()` antes de resolver la raíz:

```js
import { fileURLToPath } from 'node:url';
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
```

## Regresión exigida

La generación de evidencia debe ejecutarse correctamente desde una copia del repositorio cuya ruta contenga al menos un espacio y debe escribir únicamente bajo `evidence/spec-015-d` dentro de esa copia.

## Alcance

La corrección no cambia contratos, propuesta, intención, grafos, evidencia semántica, store ni UI. Sólo corrige la conversión URL → ruta del script de evidencia.
