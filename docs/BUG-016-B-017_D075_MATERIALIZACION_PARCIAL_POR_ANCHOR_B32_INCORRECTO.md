# BUG-016-B-017 — D-075 queda parcialmente materializada por anchor B3.2 incorrecto

## Estado

CERRADO — 17-ago-2026.

## Contexto

La materialización documental aprobada de B3.1b debía registrar D-075 y luego actualizar SPEC, STATUS, TRACEABILITY y la sesión.

La ejecución escribió D-075 correctamente en governance/DECISIONS.md, pero se detuvo antes de escribir los documentos restantes.

## Evidencia

El script terminó con:

    FAIL - encabezado B3.2 no aparece exactamente una vez.

La inspección READ-ONLY confirmó que D-075 existe únicamente en governance/DECISIONS.md.

El encabezado real de la SPEC es:

    #### B3.2 Hosts y frame local

pero el script buscaba:

    ##### B3.2

## Causa

El procedimiento asumió un anchor Markdown que no coincide con la SPEC vigente y además escribió DECISIONS antes de completar todas las validaciones del resto de documentos.

## Clasificación

Defecto del procedimiento de materialización documental. No invalida la decisión humana D-075 ni el catálogo B3.1b aprobado.

## Autoridad preservada

D-075 ya registrada es válida y no debe borrarse, renumerarse, duplicarse ni reinterpretarse.

La correctiva no puede modificar el catálogo aprobado, tocar todavía la biblioteca productiva, abrir B3.2 ni consumir Metalcon legacy.

## Correctiva requerida

1. Reconocer que D-075 ya existe exactamente una vez en DECISIONS.
2. Usar el anchor real #### B3.2 Hosts y frame local.
3. Materializar D-075 en SPEC, STATUS, TRACEABILITY y sesión sin volver a insertarla en DECISIONS.
4. Verificar cada precondición antes de escribir cada archivo.
5. Ejecutar después git diff --check, format:check y make governance.

## Criterio de cierre

BUG-016-B-017 podrá cerrarse cuando D-075 exista una sola vez en DECISIONS y quede coherentemente reflejada en SPEC, STATUS, TRACEABILITY y sesión; B3.2 continúe bloqueado; la biblioteca productiva siga sin cambios; y los gates documentales estén verdes.

No hay autorización git add, commit ni push.

## Cierre verificado

La correctiva se completó sin revertir ni duplicar D-075.

Resultado verificado:

- D-075 permanece una sola vez en governance/DECISIONS.md;
- SPEC-016-B declara B3.1b con Fase A aprobada e implementación autorizada;
- el catálogo productivo inicial aprobado quedó congelado en la SPEC;
- governance/STATUS.md refleja D-075;
- REQ-DOM-013 y REQ-DOM-014 trazan D-075;
- la sesión registra el catálogo B3.1b aprobado;
- B3.2 permanece bloqueado hasta cierre humano de B3.1b;
- la biblioteca productiva todavía no fue modificada por B3.1b;
- git diff --check: PASS;
- npm run format:check: PASS, 775 archivos de texto;
- make governance: PASS, 22 archivos requeridos, 56 requisitos y 75 decisiones.

La causa quedó además cubierta por la regla operativa de comandos:

- una escritura por comando;
- verificación inmediata;
- ausencia esperada no debe romper cadenas con &&;
- no usar anchors Markdown supuestos sin preflight;
- no usar heredoc largos ni cercas Markdown literales en comandos extensos.

No hay autorización git add, commit ni push.
