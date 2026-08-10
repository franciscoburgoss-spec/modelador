# MEJ-015-D-024 — Separación ubicación / interacción / acción / función

## Estado

Implementado en REV8.

REV8 elimina la colisión conceptual `lateral` separando cuatro dimensiones:

1. **ubicación**: cara, extremo, región o borde;
2. **rol de interacción**: recibe/entrega;
3. **familia de acción**: gravitacional/lateral/indeterminada;
4. **función estructural**: apoyo, transferencia, colector, diafragma o estabilización.

Por tanto, una cercha puede entregar una acción gravitacional a `faceNegativeN` o `facePositiveN`; la palabra cara no determina la familia de acción.
