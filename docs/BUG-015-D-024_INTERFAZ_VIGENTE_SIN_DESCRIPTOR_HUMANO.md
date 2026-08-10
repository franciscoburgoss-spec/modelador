# BUG-015-D-024 — Interfaz vigente pierde el descriptor humano del host

## Estado

Corregido en SPEC-015-D REV8 — Correctiva 10.

## Detección

Durante la validación visual real de REV8 se persistió la primera interfaz del caso corto FX-008 sobre el host `1784819708086` (muro X · 6→7 @ C), cara `−N`, con `S 12800→14500` y `Z 3250→4150`.

La tarjeta de `Interfaces vigentes` quedó reducida a `cara −N · muro X` más los rangos numéricos. Con varios muros X, esa representación obliga a reconstruir el host mediante coordenadas o abrir la referencia técnica, contradiciendo el criterio ya aplicado en SPEC-015-C-1, Techumbre y el marco canónico de Interfaces.

## Causa

`StructuralInterfacesPanel` reutilizaba directamente `describeInterfaceIntent()`. Ese descriptor deliberadamente mínimo es suficiente para el núcleo semántico, pero no incorpora el descriptor visual humano del workspace (`6→7 @ C`, niveles, longitud, espesor y vanos).

Además, la tarjeta persistida no exponía una acción de localización, aunque REV8 exige `Localizar` para targets geométricos resolubles.

## Corrección

La presentación de interfaces persistidas se compone en la UI a partir de la autoridad vigente y del presentador geométrico:

- para muros/elementos, la tarjeta muestra ubicación canónica + descriptor humano del host;
- conserva rango S/Z y estado de frescura;
- muestra la nota declarada como contexto secundario;
- la referencia técnica permanece colapsada;
- `Localizar interfaz` reutiliza la geometría exacta de cara/extremo/región y permanece deshabilitado si la interfaz no está `fresh` o no es resoluble;
- el mismo descriptor humano se reutiliza en `Puertos` y en las relaciones vigentes para evitar volver a nombres ambiguos.

Para bordes de cubierta se usa el contexto de planta por ejes nominales y el borde visual `B1…Bn`, manteniendo el ID técnico fuera de la identificación primaria.

## Regresión exigida

En FX-008, después de persistir la cara `−N` de C/6→7:

- la tarjeta contiene `Cara −N · Muro X · 6→7 @ C`;
- mantiene el detalle de niveles del host;
- muestra `S 12800→14500 · Z 3250→4150 · fresh`;
- muestra la nota `Cara del frontón hacia y<C.`;
- el selector de puertos usa el mismo descriptor humano;
- `Localizar interfaz` muestra la cara `−N` exacta;
- Localizar/Restaurar no cambia modelo, historial ni futuro.

## Alcance

No cambia schema, `modelVersion`, geometría agnóstica, IDs canónicos, fingerprints, reglas de frescura, relaciones, paths, trace ni review. Es una corrección de presentación y navegación temporal sobre autoridad ya persistida.
