# BUG-015-D-003 — Gates heredados intentan Git dentro de una validación sin Git

## Registro

- Detectado: 06-ago-2026 durante la preparación de validación de Fase B.
- Estado: mitigado en el validador autocontenido; pendiente de resolver en una SPEC de herramientas.
- Alcance afectado: `audit:dxf`, `smoke:ccx` y `verify:artifacts` heredados.

## Reproducción

Sobre el ZIP de entrada, que excluye `.git` por contrato:

```text
npm run audit:dxf
npm run smoke:ccx
```

Ambos scripts ejecutan internamente:

```text
git rev-parse --short=12 HEAD
```

La copia no contiene `.git`, por lo que el proceso aborta antes de generar o auditar artefactos.
`verify:artifacts` usa de forma equivalente `git ls-files`.

## Incidente de esta sesión

Los dos primeros comandos fueron invocados una vez antes de detectar esa dependencia interna. La
llamada indirecta a Git falló inmediatamente con `not a git repository`; no leyó un repositorio,
no creó commit, no alteró rama, índice ni working tree y no produjo evidencia DXF/CCX. No se
volverán a ejecutar durante esta Fase B.

## Mitigación de SPEC-015-D

El validador autocontenido no llama `npm run validate`, `verify:artifacts`, `audit:dxf` ni
`smoke:ccx` directamente. En su lugar:

1. inspecciona el árbol con un inventario propio sin Git;
2. crea copias temporales de los auditores DXF/CCX que sustituyen únicamente la obtención del SHA
   Git por un identificador fijo de validación;
3. ejecuta las mismas generaciones, auditores y criterios numéricos;
4. elimina las copias temporales mediante `trap`.

La mitigación no cambia el producto ni rebaja los criterios de DXF/CalculiX. La eliminación de la
dependencia Git en los scripts oficiales queda fuera de SPEC-015-D.
