# Fundamentos del producto

## Problema

El proyecto existente resuelve una parte sustancial del modelado, modulación, documentación y
análisis de viviendas Metalcon, pero todavía puede perder datos al importar, exportar derivados
obsoletos y ejecutar fórmulas no confiables. Además, el flujo de archivos y CalculiX depende de
acciones manuales y no existe una puerta de calidad reproducible.

## Resultado buscado

Una aplicación personal de escritorio que permita abrir o crear una vivienda, editarla, validar sus
reglas, guardar sin riesgo de corrupción y producir documentación y modelos de cálculo auditables.
Debe arrancar con doble clic, funcionar sin red y explicar cualquier operación que no pueda
completar.

## Usuario y contexto

- Usuario principal: propietario del Mac y autor de los modelos.
- Plataforma inicial: Mac Intel con 8 GB de RAM y macOS Monterey como máximo oficial.
- Modo de uso: local, offline, un proceso y un usuario.
- Los archivos de proyecto son propiedad del usuario y deben seguir siendo legibles fuera de la
  aplicación.

El sistema operativo máximo de este equipo está fuera del ciclo actual de seguridad. La meta es una
producción local fiable con ese riesgo explícito, no afirmar soporte de plataforma inexistente.

## Alcance de v1.0.0-local

- Edición de geometría, niveles, muros, vanos, fundaciones y techumbre actualmente soportidos.
- Modulación Metalcon y OSB con invalidación verificable.
- Validación de reglas constructivas y navegación a hallazgos.
- Metrados y exportaciones JSON, CSV, DXF e INP.
- Ejecución controlada de CalculiX e importación de resultados.
- Guardado, backups, autosave, recuperación y migraciones de formato.
- Aplicación Tauri firmada ad hoc e instalable localmente.

## Fuera de alcance

- Colaboración multiusuario, nube, cuentas o sincronización.
- Aplicaciones móviles o Windows en la primera versión.
- Notarización y distribución pública.
- Inferir reglas constructivas cuando faltan datos declarados.
- Reemplazar CalculiX por un solver propio.
- Actualizaciones automáticas por red.

## Principios

1. **El modelo guardado es fuente; los derivados se regeneran.**
2. **Ninguna pérdida silenciosa.** Un dato no soportado se preserva, migra o bloquea con explicación.
3. **No inventar geometría.** Un cálculo incompleto genera un hallazgo, no un fallback oculto.
4. **Core puro.** Dominio y geometría no dependen de React, DOM, Tauri ni almacenamiento.
5. **Puertas duras para entregables.** Un INP inválido o derivado obsoleto no se exporta.
6. **Offline por diseño.** La aplicación instalada no necesita Node ni un servidor.
7. **Evidencia antes que cierre.** La definición de terminado incluye pruebas y artefactos.

## Arquitectura objetivo

```text
React UI
  |
Application services (commands, workflows, error mapping)
  |
Pure domain core + Zustand state
  |
Ports: project files | exporters | CalculiX runner | logs
  |
Tauri adapters with narrow capabilities
```

### Límites

- `core/`: reglas, geometría, validación, migraciones puras y exportadores deterministas.
- `store/`: estado de edición, comandos y registro central de invalidación.
- `ui/`: interacción y presentación; no contiene reglas constructivas.
- `src-tauri/`: acceso a archivos, diálogo nativo, logs y proceso CalculiX.
- `tests/`: contratos públicos, regresiones, fixtures y pruebas doradas.

### Presupuesto técnico inicial

| Métrica | Objetivo |
|---|---:|
| Arranque en el Mac objetivo | < 3 s |
| Apertura de fixture de referencia | < 2 s |
| Edición habitual sin exportar | < 100 ms |
| Chunk inicial | < 450 kB raw o < 150 kB gzip |
| Cobertura de líneas `core` | >= 90% |
| Cobertura de líneas `store` | >= 85% |

## Definición de éxito

La versión está lista cuando un usuario puede instalarla, trabajar con Terminal cerrada, recuperar
un guardado interrumpido, detectar datos inválidos antes de mutar el modelo y reproducir todas las
salidas mediante una única validación documentada.

