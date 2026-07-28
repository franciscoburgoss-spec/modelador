# Cierre — SPEC-003 / corte C1-DIAG

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-003-C1-solver-harness.md` — sustituida por C2 |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; CalculiX 2.23 |

## Alcance ejecutado

Se implementó provisionalmente C1 en el árbol de trabajo, se verificaron sus contratos puros y se
ejecutó el INP global con CalculiX real. El solver reveló una incompatibilidad nueva entre familias
B31/U1. El código provisional se retiró antes del cierre porque no podía satisfacer la spec
inmutable; sólo se conserva la evidencia diagnóstica y la spec sustituta.

## Cambios

- El global provisional alcanzó 133 sets de máximo 16 caracteres y 137 secciones resueltas.
- Las cuatro fundaciones recibieron conjunto persistente propio y sección B31/RECT real.
- CCX falló en el primer U1 con `first thickness ... is zero`.
- Separar temporalmente nodos de fundación no alteró el fallo; retirar B31 sí lo eliminó.
- La variante temporal homogénea U1 conservó toda la geometría y produjo resultados finitos.
- D-033 y `SPEC-003-C2-solver-harness.md` gobiernan la sustitución.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Nombres y secciones estáticas | PASS diagnóstico | 1.384 nodos; 1.046 elementos; 133 sets; máximo 16; 137/137 secciones resueltas |
| Ejecutar global B31/U1 | FAIL diagnóstico | CCX código 201: espesor cero en nodo 1 del primer U1 |
| Aislar conectividad | PASS diagnóstico | duplicar nodos B31 no cambia el fallo; retirar los cuatro B31 alcanza `Job finished` |
| Probar familia homogénea | PASS diagnóstico | U1 conserva 1.384 nodos/1.046 elementos; FRD con 1.384 nodos/8.304 valores finitos; máximo 0 |
| Criterios 1–9 de C1 | NO CERRADOS | la obligación B31/RECT quedó sustituida por C2 antes de retener producto |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` previo | PASS | 20 archivos; 26 requisitos; 32 decisiones |
| pruebas enfocadas provisionales | PASS | 31/31; parser, exportador y adaptador |
| `npm run lint` provisional | PASS | 0 warnings |
| `npm run format:check` provisional | PASS | 344 archivos |
| `npm run smoke:ccx` provisional | FAIL diagnóstico | global código 201; cercha/fundaciones no se ocultaron como éxito |
| `/usr/local/bin/ccx joballu1` temporal | PASS diagnóstico | `Job finished`; 1.384 nodos/8.304 valores finitos |
| `npm run validate` final | PASS | 709/709; laboratorio 35/35; build 701,70/217,88 kB; migración 187/140/47; 343 artefactos; 13 exportadores/14 mutadores; gobernanza 20/26/33 |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Restaurar un set largo o retirar sección | pruebas contractuales provisionales |
| Restaurar fundación B31 en global U1 | smoke real: código 201 en `gen3delem` |

## Desviaciones y deudas descubiertas

- B31 y U1 no pueden coexistir en este deck de referencia de CCX 2.23 aunque sus nodos no se
  compartan; la familia homogénea queda gobernada en C2.
- La sonda totalmente fija produce el warning esperado de cero grados de libertad; C2 debe
  permitirlo por nombre y rechazar cualquier otro warning.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] nueva spec sustituta C2
