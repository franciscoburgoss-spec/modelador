# Manifiesto de fixtures

## Reglas

Cada fixture declara origen, propósito, versión de modelo, cobertura y checksum. Los archivos de
usuario se anonimizan antes de entrar al repositorio. Los fixtures son inmutables; una corrección crea
una nueva versión.

## Heredados

| ID | Archivo | Cobertura útil | Limitación |
|---|---|---|---|
| FX-001 | `tests/fixtures/casa-L.json` | 45 muros, vanos, niveles, fundaciones, 2 roofSystems | sólo una familia de perfil; sin roofPlanes |
| FX-002 | `lab/roofPlane/fixtures/modelo-26.json` | 19 roofSystems legacy | elements idénticos a FX-001 |

FX-001 y FX-002 cuentan como un solo caso para muros, OSB y fundaciones.

## Requeridos

| ID | Propósito | Requisitos | Estado |
|---|---|---|---|
| FX-003 | segunda vivienda independiente | planta distinta, muros X/Y, puertas/ventanas, perfiles 60 y 90 | Pendiente |
| FX-004 | persistencia moderna de cubierta | `modelVersion`, roofPlanes, ledgers y roundtrip | Pendiente |
| FX-005 | migración mínima por versión | un archivo por cada versión histórica soportada | Pendiente |
| FX-006 | importaciones hostiles | `{}`, truncado, futuro, payloads de fórmula, exceso de tamaño | Pendiente |
| FX-007 | cálculo de referencia | INP pequeño con resultado CCX estable | Pendiente |

## Ficha obligatoria

```text
id:
archivo:
sha256:
modelVersion:
origen:
anonimización:
requisitos cubiertos:
invariantes esperados:
salidas doradas:
```

## Invariantes mínimas

- Cantidades de entidades y niveles.
- Bounding box y unidades.
- Perfiles y parámetros referenciados existentes.
- Ninguna referencia huérfana.
- Techumbre preservada tras roundtrip.
- Derivados ausentes o marcados según contrato.

