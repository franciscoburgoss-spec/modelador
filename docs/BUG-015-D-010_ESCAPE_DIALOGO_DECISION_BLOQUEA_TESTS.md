# BUG-015-D-010 — Timeout de la prueba de Escape del diálogo de decisión

## Estado

Diagnóstico corregido en SPEC-015-D Fase B REV6. La hipótesis productiva de REV5 fue refutada.

## Reproducción real

En macOS, Node 22.23.2 y npm 10.9.9, la prueba focalizada:

```text
node --import tsx --test \
  --test-name-pattern="flechas navegan propuestas" \
  --test-timeout=30000 \
  --test-reporter=spec \
  tests/structuralProposalWorkspace.component.test.jsx

✖ ... (~30030 ms)
'test timed out after 30000ms'
```

REV5 atribuyó provisionalmente el bloqueo a la propagación de `Escape` entre listeners de `window` y añadió `stopImmediatePropagation()`. Esa explicación quedó refutada por una reproducción instrumentada posterior.

## Evidencia que refuta la hipótesis productiva

La secuencia real del componente se ejecutó fuera del runner focalizado y mostró:

```text
06 - JUSTO ANTES de fireEvent Escape
07 - fireEvent Escape RETORNÓ en 7 ms
08 - después de 250 ms
Foco volvió a Rechazar: true
Cantidad de diálogos: 1
09 - cleanup terminado
```

Por tanto:

- `Escape` retorna de forma inmediata;
- el subdiálogo se cierra;
- el workspace permanece abierto;
- el foco vuelve al botón de origen;
- el proceso termina naturalmente.

## Resolución

REV6 retira la mitigación productiva introducida en REV5 y restaura el comportamiento de REV4. El bloqueo restante se registra separadamente como `BUG-015-D-011`, localizado en el uso de `waitFor()` para observar una restauración de foco programada explícitamente con `requestAnimationFrame`.

## Invariantes preservados

- cancelar no crea historial, review ni trace;
- `Escape` del subdiálogo cancela sólo la decisión en curso;
- el foco vuelve al botón que abrió la decisión;
- no cambia el contrato de aceptar, modificar, rechazar o diferir;
- no se incorpora ninguna operación Git.
