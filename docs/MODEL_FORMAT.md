# Formato versionado del modelo

## Contrato vigente

Todo modelo guardado por la aplicación declara:

```json
{
  "modelVersion": 1,
  "grid": {
    "xAxes": [],
    "yAxes": [],
    "zLevels": []
  },
  "elements": []
}
```

`grid` y `elements` son obligatorios. Los ejes requieren identificadores únicos y coordenadas
finitas; los elementos requieren identificador único y `type`. Las colecciones opcionales
`projectParams`, `dimensions`, `roofSystems` y `roofPlanes`, cuando existen, deben ser arreglos.

La única entrada autorizada al store es `prepareModelImport` en `src/core/modelSchema.js`: clona,
migra y valida antes de permitir una mutación. El objeto o archivo original nunca se modifica
durante la apertura.

## Versiones y migraciones

| Versión | Identificación | Migración |
|---|---|---|
| 0 | ausencia de `modelVersion` o valor `0` | agrega `modelVersion: 1` y normaliza las colecciones de techumbre sin eliminar su contenido |
| 1 | `modelVersion: 1` | versión vigente; no requiere migración |

Las migraciones son puras, secuenciales e idempotentes. Una versión mayor que la admitida se
rechaza: la aplicación no intenta interpretar ni degradar datos futuros.

## Techumbres heredadas

`roofSystems` y `roofPlanes` se preservan como datos independientes. Cuando ambos existen,
`roofPlanes` tiene precedencia para cálculo y representación, mientras `roofSystems` permanece en
el archivo y sobrevive los roundtrips. La aplicación muestra un aviso visible para que la
precedencia nunca sea silenciosa.

## Errores y avisos

Los fallos de entrada son `ModelImportError` con `code`, `message` y `details`. Entre los códigos
estables están:

- `INVALID_JSON`: archivo truncado o JSON mal formado;
- `INVALID_MODEL_TYPE`: la raíz no es un objeto;
- `FUTURE_MODEL_VERSION`: versión posterior a la soportada;
- `MODEL_VALIDATION_FAILED`: incumplimiento estructural o de invariantes.

Los avisos exitosos incluyen `LEGACY_MODEL_MIGRATED`,
`LEGACY_ROOF_SYSTEMS_PRESERVED` y `ROOF_SOURCE_PRECEDENCE`. Errores y avisos se exponen en
`modelImportFeedback` y se presentan en la interfaz; no dependen de la consola.
