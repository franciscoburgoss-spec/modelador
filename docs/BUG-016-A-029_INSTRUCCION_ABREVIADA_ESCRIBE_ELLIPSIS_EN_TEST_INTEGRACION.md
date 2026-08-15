# BUG-016-A-029 — Instrucción abreviada escribe ellipsis en test de integración

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Al solicitar materializar el test permanente de BUG-016-A-023, la instrucción posterior resumió el
bloque previamente entregado como:

`cat > tests/constructiveNeutralRuntimeIntegration.test.mjs <<'EOF'`
`...`
`EOF`

Ese resumen fue ejecutado literalmente y produjo un archivo cuyo contenido era `...`.

`node --check` falló con:

`SyntaxError: Unexpected token '...'`

El test conjunto informó 7 PASS y 1 FAIL porque el único archivo inválido era el test de integración
recién creado.

## Impacto

No existe evidencia de falla del runtime neutral ni de B3.

En la misma ejecución:

- el corpus focal existente del runtime neutral mantuvo sus 7 casos válidos;
- B3.1 + B3.2 + B3.3 ejecutados conjuntamente dieron 60/60 PASS;
- no se modificó producto B3.

El SHA del test inválido no constituye evidencia contractual.

## Causa

Defecto de la instrucción de ChatGPT: se presentó una abreviación con `...` dentro de un bloque
ejecutable en lugar de repetir el contenido completo.

## Correctiva

Sobrescribir únicamente:

`tests/constructiveNeutralRuntimeIntegration.test.mjs`

con el corpus completo previamente definido y volver a ejecutar:

- sintaxis;
- runtime focal + integración;
- regresión B3;
- whitespace/EOF;
- SHA;
- estado Git.

## Resguardos

- no modificar `constructiveNeutralRuntime.js`;
- no modificar B1/B2/B3.1/B3.2/B3.3;
- no modificar tests congelados para hacer pasar el nuevo test;
- no cerrar BUG-016-A-023 hasta obtener GREEN permanente;
- no tocar store/UI;
- no realizar Git write.

## Criterio de cierre

Cerrar cuando el test completo:

- pase `node --check`;
- produzca GREEN junto con los 7 tests del runtime;
- preserve la regresión B3;
- tenga whitespace/EOF limpio;
- confirme A partial 1/0/1 y B none 0/0/2;
- confirme `notVerified`;
- confirme exclusión de `model.library`.

## Evidencia de cierre

Se reemplazó únicamente el test de integración inválido por el corpus completo.

Resultados:

- no quedó ellipsis literal;
- `node --check` PASS;
- runtime neutral + integración: 8/8 PASS;
- regresión B3.1/B3.2/B3.3: 60/60 PASS;
- whitespace y EOF limpios;
- no se modificó `constructiveNeutralRuntime.js`;
- no se modificó B1/B2/B3.1/B3.2/B3.3;
- no se realizó Git write.

SHA del test permanente corregido:

`f2a45f4ad2a18b5bb624495ad5197d50561e0a5d91938f5713cd998789e72f87`
