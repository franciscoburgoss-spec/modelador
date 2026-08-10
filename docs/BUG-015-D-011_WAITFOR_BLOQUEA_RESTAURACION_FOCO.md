# BUG-015-D-011 — `waitFor()` bloquea la prueba de restauración de foco

## Estado

Corregido en SPEC-015-D Fase B REV6.

## Reproducción instrumentada

Después de demostrar que `Escape` retorna y restaura el foco correctamente, se reprodujo la misma interacción dentro de `node:test` usando `waitFor()`:

```text
T04 - diálogo abierto
T05 - Escape retornó
✖ /tmp/diagnostico_waitfor_spec015d.test.mjs (~15015 ms)
'test timed out after 15000ms'
```

El marcador posterior al `await waitFor(...)` nunca se alcanzó. El timeout interno solicitado al `waitFor` tampoco devolvió control antes del timeout externo del runner.

## Causa

La prueba estaba usando `waitFor()` para una condición cuya fuente temporal no es una mutación DOM ni una actualización de estado pendiente: `closeDecision()` programa directamente la restauración de foco con `requestAnimationFrame`. En esta combinación de Node 22 + `node:test` + JSDOM + React Testing Library, el `waitFor()` usado en ese punto queda bloqueado y oculta un comportamiento productivo que ya fue verificado de forma instrumentada.

No se atribuye este bloqueo al motor de propuestas ni al componente productivo.

## Corrección

La prueba espera exactamente la frontera temporal declarada por producción:

```js
fireEvent.keyDown(window, { key: 'Escape' });
await new Promise((resolve) => requestAnimationFrame(() => resolve()));
assert.equal(document.activeElement, reject);
```

También se elimina `waitFor` de los imports del archivo de prueba.

## Alcance

- no cambia código productivo respecto de REV4;
- no cambia store, motores, fingerprints, propuestas ni caminos candidatos;
- no cambia historia, review ni trace;
- la prueba sigue verificando el contrato observable real;
- no se incorpora ninguna operación Git.
