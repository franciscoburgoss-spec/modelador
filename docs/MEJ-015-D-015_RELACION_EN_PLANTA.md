# MEJ-015-D-015 — Ver relación en planta

## Problema de revisión

Localizar sólo la cubierta o sólo el receptor obliga a reconstruir mentalmente la relación geométrica que originó la propuesta.

## Implementación REV7

Cada propuesta visual incorpora un preview efímero `proposal-relation` con:

- ORIGEN: polígono de cubierta;
- OBJETIVO: geometría en planta del receptor;
- borde canónico que inicia la propuesta;
- tramo o tramos de solape geométrico;
- vanos visibles del objetivo;
- bounds combinados para encuadre.

La acción `Ver relación en planta · origen + borde + objetivo` abre el mismo localizador compacto de BUG-015-D-013. No crea autoridad nueva ni modifica el modelo.
