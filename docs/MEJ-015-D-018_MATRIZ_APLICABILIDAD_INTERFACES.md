# MEJ-015-D-018 — Matriz de aplicabilidad de interfaces

## Estado

Implementado en REV8.

| Dimensión | Valores | Aplica a | No autoriza |
|---|---|---|---|
| ubicación | cara ±N | muros | familia lateral/gravedad |
| ubicación | extremo lowS/highS | muros | apoyo automático |
| ubicación | boundary | borde canónico de cubierta | receptor resistente automático |
| ubicación | region S/Z | subdominio de host | sólido o elemento nuevo |
| interacción | receives/delivers | puerto dentro de relación | rol global del host |
| acción | gravity/lateral/undetermined | relación | capacidad |
| función | support | relación entre hosts | contacto constructivo verificado |
| función | loadTransfer | mecanismo intra/multi-host | viga/cercha/perfil |

La UI sólo ofrece combinaciones que el contrato de `structuralInterfaces.js` valida. `face` no se traduce a `lateral` y `end` no se traduce a `support`.
