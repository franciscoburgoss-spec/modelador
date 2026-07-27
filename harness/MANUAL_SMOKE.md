# Smoke manual de producción local

Registrar fecha, commit, macOS, modelo del equipo, memoria, versión de la app y CalculiX. Marcar cada
paso como `PASS`, `FAIL` o `N/A` con evidencia.

## Instalación

- [ ] Copiar la `.app` firmada a `/Applications`.
- [ ] Abrir por Finder con Terminal cerrada.
- [ ] Confirmar que no aparecen devtools ni consola.
- [ ] Confirmar versión y commit desde Acerca de.

## Proyecto

- [ ] Crear un proyecto y guardarlo en la ubicación elegida.
- [ ] Cerrar, abrir por doble clic y comprobar geometría y parámetros.
- [ ] Editar muro, vano, biblioteca y parámetro; verificar indicador de cambios.
- [ ] Intentar abrir JSON inválido; el proyecto actual permanece intacto.
- [ ] Abrir `casa-L`; confirmar que conserva dos sistemas legacy.

## Derivados y salidas

- [ ] Modificar un dato dependiente; la app marca derivados stale.
- [ ] Intentar exportar INP stale; la app bloquea y ofrece regenerar.
- [ ] Regenerar y exportar JSON, CSV, DXF e INP.
- [ ] Auditar DXF y ejecutar INP con CalculiX.
- [ ] Cancelar una ejecución CCX y confirmar limpieza del proceso/temporal.

## Recuperación

- [ ] Forzar cierre con cambios no guardados.
- [ ] Reabrir y recuperar autosave.
- [ ] Simular interrupción durante guardado; el archivo anterior sigue válido.
- [ ] Superar diez guardados y comprobar rotación exacta.
- [ ] Restaurar un backup en una instalación limpia.

## Operación

- [ ] Desconectar la red y repetir abrir, editar, guardar y exportar.
- [ ] Verificar mensajes de error sin consultar consola.
- [ ] Revisar foco, teclado y ausencia de solapes a 1440x900.
- [ ] Medir arranque, apertura y una edición habitual.
- [ ] Revisar logs: sin contenido completo del proyecto ni información sensible innecesaria.

