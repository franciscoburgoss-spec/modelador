# SPEC-002 — Invalidación de derivados y seguridad de exportación

## Diagnóstico

Cambiar parámetros usados por fórmulas, actualizar perfiles de biblioteca o eliminar un vano desde
la selección puede dejar `studsStale` y `osbStale` en falso. La exportación CalculiX de cerchas no
usa la confirmación de stale que sí existe en el exportador global.

## Decisión

Centralizar las dependencias de derivados y hacer que cada comando de dominio declare qué invalida.
Las salidas para cálculo se bloquean mientras haya datos obsoletos; las salidas informativas deben
explicitar su estado y nunca aparentar vigencia.

## Alcance

- Registro único de derivados y dependencias.
- Comandos de mutación en lugar de escrituras parciales al store.
- Cobertura de parámetros, biblioteca, niveles, muros, vanos, fundaciones y techumbre.
- Política única para exportadores JSON, CSV, DXF e INP.
- Guarda dura en todas las variantes CalculiX.
- Mensaje visible con acción para regenerar.

## Fuera de alcance

- Regeneración automática global después de cada edición.
- Cambiar algoritmos de modulación.
- Reorganizar toda la estructura de Zustand.
- Integración del proceso nativo CalculiX.

## Criterios de aceptación

1. Existe una matriz de mutador a derivado revisable en código.
2. Cambiar `espesor_placa` invalida studs y OSB de los 45 muros que dependen de la fórmula.
3. Cambiar un perfil que altera 90 a 140 mm invalida todas las salidas afectadas.
4. Eliminar un vano por cualquier ruta invalida studs, headers y OSB del muro.
5. No existe una escritura de entidades persistidas fuera de comandos autorizados.
6. Cada exportador tiene prueba para estado vigente y stale.
7. Ningún INP global, de cercha o fundaciones se descarga con stale.
8. Regenerar devuelve los flags a vigente sólo después de completar correctamente.
9. Fallar a mitad de regeneración conserva el estado stale.
10. Revertir cada guarda rompe al menos una prueba.

## Evidencia

- tabla generada de mutadores;
- tests parametrizados de contrato del store;
- inventario de entry points de exportación;
- cierre con pruebas de reversión.

