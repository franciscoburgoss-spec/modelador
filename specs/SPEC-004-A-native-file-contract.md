# SPEC-004-A — Contrato de archivo y escritura atómica

## Diagnóstico

`saveModel` escribe directamente el modelo activo en `localStorage` y `loadModel` lo recupera
desde la misma clave. La importación JSON ya migra y valida antes de modificar el store, pero no
existe una frontera equivalente para un archivo nativo ni un contrato de filesystem que pueda
implementar Tauri. Una interrupción durante el futuro guardado nativo podría truncar el único
archivo del usuario y hoy no hay rotación de versiones anteriores.

## Decisión

Introducir un contrato puro de proyecto que valida y serializa antes de solicitar I/O, y un puerto
mínimo con operaciones `readText` y `writeTextAtomic`. El llamador sólo puede aplicar al estado el
resultado ya preparado de una apertura exitosa.

El adaptador Node de referencia escribe un temporal hermano, sincroniza su contenido, respalda los
bytes anteriores y reemplaza el destino mediante `rename` en el mismo directorio. Los respaldos
viven en un directorio hermano oculto y se podan a las diez versiones anteriores más recientes.
Este adaptador constituye evidencia ejecutable del algoritmo y fija el contrato que implementará
el comando estrecho de Tauri en un corte posterior.

## Alcance

- Serialización canónica del modelo vigente, con validación previa y salto de línea final.
- Apertura de texto mediante la migración y validación existentes, sin callback de commit ni
  mutación de estado.
- Errores tipados para puerto inválido, lectura y escritura fallidas.
- Puerto inyectable `readText` / `writeTextAtomic`, sin dependencias de React o Tauri.
- Adaptador Node de referencia con temporal en el mismo directorio, `fsync`, `rename` y
  sincronización del directorio.
- Copia exacta del destino anterior antes de reemplazarlo y rotación a diez backups.
- Ensayo en directorio temporal que mata un proceso entre `fsync` y `rename`.
- Pruebas de contrato, filesystem real y reversión enfocada.

## Fuera de alcance

- Reemplazar todavía los comandos web `Guardar`, `Cargar`, importar o exportar.
- Estado de ruta, título, recientes, estado sucio o integración con el store.
- Autosave nativo, recuperación de crash y migración desde `localStorage`.
- Crear `src-tauri`, capabilities, CSP, packaging, firma o instalación.
- Integrar, ejecutar o bundlear CalculiX.
- Limpieza global de temporales abandonados o coordinación de escritores concurrentes.
- Cambiar `modelVersion`, inferir datos legacy o modificar emisores DXF/INP.

## Criterios de aceptación

1. Serializar un modelo válido produce JSON canónico reabrible, no muta la entrada y valida antes
   de invocar el puerto; un modelo inválido no escribe bytes.
2. Abrir JSON inválido o un modelo inválido devuelve un error tipado sin ofrecer un resultado
   aplicable; el contrato no recibe estado ni función de commit.
3. El adaptador crea el temporal en el directorio del destino, sincroniza archivo y directorio y
   sólo publica mediante `rename`.
4. Al matar un proceso real después de sincronizar el temporal y antes del reemplazo, el hash del
   destino conserva exactamente la última versión válida.
5. Cada reemplazo completado conserva una copia byte a byte de la versión anterior; después de
   superar el límite existen exactamente diez backups reabribles y corresponden a las diez
   versiones previas más recientes.
6. Ninguna operación construye comandos de shell con rutas o contenido del modelo; el módulo puro
   no importa APIs de Node, React, navegador o Tauri.
7. Revertir el reemplazo atómico hace fallar el ensayo de kill y revertir la poda hace fallar el
   contrato de diez backups.
8. `make governance` y `npm run validate` terminan con código 0. No aplica auditoría DXF ni smoke
   CalculiX adicional porque no se modifican emisores ni archivos de solver.

## Evidencia

- `tests/nativeProjectFile.test.mjs` para serialización, errores y frontera del puerto.
- `tests/nodeProjectFileSystem.test.mjs` sobre directorios temporales para reemplazo y rotación.
- `tests/helpers/interruptedAtomicWrite.mjs` ejecutado con `spawn`, argumentos estructurados,
  canal IPC y `SIGKILL`, sin shell.
- Prueba de reversión enfocada y cierre `sessions/close-SPEC-004-A.md`.
