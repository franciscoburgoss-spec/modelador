# BUG-016-B-044 — Mapa de subcortes omite B3.6 Deduplicación y roles verticales

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

Después del cierre técnico de implementation subcut B3.3 se inspeccionó el
mapa vivo de subcortes de SPEC-016-B.

El contrato vigente establece:

- implementation subcut B3.3 = sección técnica B3.5 Retícula maestra vertical;
- B3.5 conserva candidatos separados por causa;
- sección técnica B3.6 = Deduplicación y roles verticales;
- D-095 reserva expresamente la deduplicación y unión canónica de roles y
  sourceRefs para B3.6.

Sin embargo, el mapa de subcortes continúa directamente con:

- B3.4 — familia horizontal;
- B3.5 — panelCoverage;
- B3.6 — integración runtime y generatedArtifacts;
- B3.7 — determinismo, FX-008, receipt/freshness y regresión.

No existe un subcorte de implementación explícitamente asignado a la sección
técnica B3.6 Deduplicación y roles verticales.

## Contradicción de alcance

D-077 congela que la numeración de secciones técnicas no define por sí sola el
scope de un subcorte.

Por tanto no puede inferirse legítimamente que implementation subcut B3.4
incluya la sección técnica B3.6 sólo porque sea la etapa siguiente.

Abrir B3.4 como "familia horizontal" sin resolver esta omisión dejaría B3.6
técnica:

- sin implementación explícitamente autorizada; o
- absorbida implícitamente por otro subcorte, contradiciendo D-077.

## Impacto

La transición posterior a B3.3 queda bloqueada hasta congelar explícitamente
qué subcorte implementará B3.6 técnica.

El defecto no invalida la implementación ya verificada de B3.3/B3.5 ni reabre
D-088 a D-095.

## Restricciones

La resolución no puede:

- incorporar B3.6 técnica retroactivamente a B3.3;
- asumir que B3.4 la contiene sin decisión humana;
- adelantar miembros horizontales;
- adelantar panelCoverage;
- adelantar runtime/generatedArtifacts;
- modificar D-095 para acomodar el roadmap.

Debe definirse una transición explícita y auditable antes de continuar.

## Resolución aprobada

D-096 resuelve la omisión sin renumerar los subcortes existentes.

Se introduce explícitamente:

`implementation subcut B3.3b`

asignado exclusivamente a:

`technical section B3.6 — Deduplicación y roles verticales`

B3.3b queda habilitado únicamente para Fase A READ-ONLY. No autoriza todavía
implementar deduplicación, unir roles o `sourceRefs` ni modificar producción.

B3.4 permanece reservado a familia horizontal y todos los subcortes posteriores
continúan bloqueados.

La resolución preserva D-077 y D-095: B3.6 técnica no se absorbe implícitamente
en B3.3 ni B3.4.

## Cierre verificado

CERRADO — 19-ago-2026.

La sección técnica B3.6 dispone ahora de un subcorte de implementación explícito
y auditable antes de cualquier autorización de código.
