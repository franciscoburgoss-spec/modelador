# MEJ-015-D-027 — Localizar interfaces persistidas desde su tarjeta

## Objetivo

Mantener verificable una interfaz después de persistirla, sin obligar al usuario a reconstruir su host en el formulario de creación.

## Alcance REV8

Cada interfaz vigente con target geométrico `fresh` y resoluble ofrece `Localizar interfaz`:

- cara: resalta la cara física `+N/−N`;
- extremo: resalta `S mínimo/S máximo`;
- región: resalta su banda longitudinal S sobre el host y conserva Z como dato;
- borde de cubierta: encuadra la cubierta y enfatiza el borde canónico correspondiente.

El localizador continúa siendo una vista temporal: no modifica autoridad estructural, historial, trace, review ni selección global persistente.

## Criterio UX

La tarjeta persistida, el selector de puertos y las relaciones deben referirse al mismo target con el mismo descriptor humano. La referencia técnica queda disponible para auditoría, pero deja de ser necesaria para reconocer el objeto.
