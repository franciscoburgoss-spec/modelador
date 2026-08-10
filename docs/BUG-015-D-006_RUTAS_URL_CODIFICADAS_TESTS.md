# BUG-015-D-006 — Tests SPEC-015-D usan `URL.pathname` como ruta local

## Estado

Registrado y corregido durante la regresión del BUG-015-D-005, antes del cierre.

## Reproducción

Con el repositorio en una ruta con espacios, los tests `spec015dEvidence.test.mjs` y
`spec015dIndependence.test.mjs` fallaban intentando leer rutas como:

```text
/Volumes/MEM%20EXT/Developer/modelador/...
```

El generador de evidencia ya estaba corregido, por lo que este fallo aparecía después, dentro de
las pruebas enfocadas.

## Causa

Ambos tests calculaban `ROOT` mediante:

```js
resolve(new URL('..', import.meta.url).pathname)
```

por lo que conservaban `%20` en vez de convertir la URL `file:` a una ruta POSIX.

## Corrección

Usar `fileURLToPath()` en ambos tests antes de resolver `ROOT`.

## Regresión exigida

El preflight completo de SPEC-015-D debe pasar desde una ruta real que contenga espacios. El
barrido estático de la implementación SPEC-015-D no debe conservar otros usos de
`new URL(..., import.meta.url).pathname` para rutas de filesystem.
