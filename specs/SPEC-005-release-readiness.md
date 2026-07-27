# SPEC-005 — Preparación de v1.0.0-local

## Diagnóstico

El bundle inicial heredado mide 611,54 kB raw, los errores críticos pueden quedar sólo en consola y
no existe runbook de instalación, backup, recuperación ni release. El equipo objetivo tiene recursos
limitados y el sistema operativo conserva un riesgo residual aceptado.

## Decisión

Medir y optimizar sólo cuellos reales, completar la interfaz operativa de errores y producir una
release reproducible con evidencia, rollback y restauración ensayada.

## Alcance

- Lazy loading de modales, 3D y exportadores pesados.
- Error boundary, mensajes accionables, progreso, cancelación y logs rotativos.
- Accesibilidad de teclado/foco y revisión de layout en la pantalla objetivo.
- Benchmarks de arranque, apertura y edición.
- Runbooks de instalación, actualización manual, backup, restore y desinstalación.
- Manifiesto de toolchain, changelog, tag y artefacto firmado.

## Fuera de alcance

- Rediseño visual completo.
- Telemetría remota.
- Optimizaciones sin perfil.
- Distribución pública o soporte de plataforma adicional.

## Criterios de aceptación

1. Chunk inicial <450 kB raw o <150 kB gzip, o excepción medida y decidida.
2. Arranque <3 s y fixture de referencia abierto <2 s en el Mac objetivo.
3. Acciones habituales medidas <100 ms sin bloquear interacción.
4. Ningún flujo crítico depende exclusivamente de la consola.
5. Diálogos y controles críticos funcionan con teclado y no se solapan a 1440x900.
6. `npm ci && npm run validate` pasa desde copia limpia.
7. Todos los gates G0–G8 están verdes o un riesgo residual tiene aceptación explícita.
8. Se restaura un backup en una instalación limpia y el modelo es semánticamente equivalente.
9. El artefacto registra commit y versiones de toolchain.
10. El tag `v1.0.0-local` apunta exactamente al commit validado.

## Evidencia

- reporte de bundle y benchmarks;
- checklist de accesibilidad y smoke;
- manifest de release;
- runbooks y simulacro de restore;
- cierre final firmado.

