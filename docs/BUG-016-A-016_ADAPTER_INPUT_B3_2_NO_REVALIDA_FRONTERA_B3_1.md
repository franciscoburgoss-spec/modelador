# BUG-016-A-016 — B3.2 no revalida la frontera exacta producida por B3.1

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Durante la revisión humana posterior a la regresión B1+B2+B3.1+B3.2 se detectó que
`src/core/constructiveSolutionGeneration.js` acepta un objeto cuyo `schema` declara:

`constructive-adapter-input-v1.0`

pero no demuestra que dicho objeto corresponda realmente a una salida íntegra y válida de B3.1.

La función interna `requireAdapterInput()` comprueba actualmente sólo una parte de la frontera:

- schema;
- scenarioId no vacío;
- presencia básica de adapterRef/libraryRef/library;
- assignments como array;
- requirements efectivos como array;
- formato hexadecimal de `effectiveGenerationInputSha256`.

No vuelve a demostrar invariantes ya garantizadas por B3.1, entre ellas:

- identidad exacta `library === libraryRef`;
- `library.componentTypes` igual a la selección requerida por assignments;
- exactitud del shape canónico B3.1;
- coherencia de los ocho `effectiveFingerprints`;
- correspondencia real de `effectiveGenerationInputSha256` con las dimensiones contractuales.

## Impacto

Un consumidor podría fabricar o alterar un objeto que aparenta usar
`constructive-adapter-input-v1.0` y entregarlo directamente a B3.2.

Ejemplos adversarios:

1. eliminar o sustituir `library.componentTypes` de modo que ya no corresponda a assignments;
2. reemplazar `effectiveGenerationInputSha256` por otro SHA-256 hexadecimal sin cambiar las
   dimensiones efectivas.

B3.1 rechazaría dichas entradas, pero B3.2 actualmente puede aceptarlas y producir
`constructive-solution-v1.0`.

Esto permitiría que provenance y output se construyan desde una frontera que nunca fue válida en
B3.1.

## Decisión congelada que protege

La corrección no debe redefinir B2 ni B3.1.

B3.2 debe consumir exclusivamente una frontera equivalente a la salida canónica producida por:

`buildConstructiveAdapterInput()`

No debe existir un segundo contrato más laxo para objetos con el mismo schema.

B3.1 debe permanecer byte-identical durante la correctiva.

## Corrección requerida

La validación B3.2 debe demostrar que el adapter input recibido es exactamente reproducible por B3.1.

Una estrategia admisible es:

1. reconstruir únicamente la forma B2 necesaria a partir de la frontera B3.1 recibida;
2. reinsertar `relevantBlockingDecisionContext` dentro de
   `effectiveStructuralRequirements`, como exige B2;
3. ejecutar `buildConstructiveAdapterInput()` sobre esa reconstrucción;
4. comparar canónicamente el resultado recalculado con el adapter input recibido;
5. fallar cerrado con `INVALID_ADAPTER_INPUT` ante cualquier diferencia.

Esta estrategia reutiliza la autoridad productiva B3.1 sin modificarla ni duplicar silenciosamente
sus reglas.

## Resguardos

La correctiva no puede:

- modificar B1;
- modificar B2;
- modificar producto ni corpus B3.1;
- cambiar el contrato B3.2 aprobado;
- ampliar componentes neutrales soportados;
- introducir receipt;
- introducir freshness;
- introducir store o UI;
- importar Metalcon, OSB, perfiles, capacidades o normativa;
- alterar los resultados reales FX-008 A/B aprobados.

## Evidencia previa al BUG

Antes de registrar el defecto:

- focal B3.2: 16/16 PASS;
- regresión conjunta B1+B2+B3.1+B3.2: 136/136 PASS;
- FX-008 A:
  - gap 571.429 mm;
  - transferencia `resolved`;
  - lateral `unresolved`;
  - coverage `partial`, 1/0/1;
  - verification `notVerified`;
- FX-008 B:
  - gap 571.429 mm;
  - ambos requirements `unresolved`;
  - coverage `none`, 0/0/2;
  - verification `notVerified`;
- hashes efectivos y outputs A/B independientes;
- independencia estática B3.2: PASS;
- whitespace B3.2: PASS.

SHA previos:

- producto B3.2:
  `4c8f1991cf302ae063a6e0389a295bdec962d61ca6596a1a9ec62176ad3f7c88`;
- corpus B3.2:
  `4071e8f74554607e4a51f086fc056ae4244d9573444594add8fbc16557fc22a1`;
- producto B3.1:
  `8d59db1f81127d522b6c5f1aa049356885f58140316281f251acbc1dfb4024c9`;
- corpus B3.1:
  `e3fa8d5bfe2716f88e4d8ba97177aa34c98a82d684d9e0cdb048c1d90cf40611`.

## Criterio de cierre

BUG-016-A-016 puede cerrarse cuando:

- existe prueba BEFORE que demuestra que B3.2 acepta al menos una frontera que B3.1 rechazaría;
- la correctiva reutiliza la validación productiva B3.1 sin modificar B3.1;
- library/componentTypes adulterados fallan con `INVALID_ADAPTER_INPUT`;
- aggregate/fingerprints adulterados fallan con `INVALID_ADAPTER_INPUT`;
- el corpus B3.2 completo queda verde;
- la regresión B1+B2+B3.1+B3.2 queda verde;
- FX-008 A/B conserva exactamente su semántica aprobada;
- B3.1 conserva sus SHA;
- no se realiza staging, commit ni push.

B3.2 permanece abierto y no se inicia B3.3.

## Evidencia AFTER

La correctiva reutiliza `buildConstructiveAdapterInput()` como productor autoritativo de la frontera
B3.1. B3.2 reconstruye mecánicamente el paquete efectivo necesario, vuelve a producir
`constructive-adapter-input-v1.0` y exige igualdad canónica total con el objeto recibido.

El corpus adversario demuestra ahora:

- library efectiva adulterada: rechazada;
- `effectiveGenerationInputSha256` adulterado: rechazado;
- subfingerprint adulterado: rechazado;
- focal B3.2: 19/19 PASS;
- regresión B1+B2+B3.1+B3.2: 139/139 PASS;
- FX-008 A conserva `partial`, 1/0/1, gap 571.429 mm y `notVerified`;
- FX-008 B conserva `none`, 0/0/2, gap 571.429 mm y `notVerified`;
- A/B mantienen hashes efectivos y outputs independientes;
- B3.1 permanece byte-identical;
- no se introdujeron receipt, freshness, store, UI, Metalcon ni OSB.

BUG-016-A-016 queda cerrado.
