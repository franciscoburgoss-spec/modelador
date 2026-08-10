# MEJ-015-D-026 — Contexto canónico transversal para ubicaciones de interfaz

## Objetivo

Extender el patrón de identificación visual de SPEC-015-C-1 y de la Correctiva Techumbre/Localizar a las ubicaciones canónicas de interfaces estructurales.

## Alcance REV8

Para un host muro, la pestaña `Interfaces` muestra un único marco visual coherente:

- **Cara:** resalta `+N` o `−N` y mantiene ambas normales visibles.
- **Extremo:** resalta `S mínimo` o `S máximo` y muestra sus ejes humanos.
- **Región S/Z:** muestra en Planta la banda longitudinal S y conserva Z como dato explícito, sin fingir que la altura puede verse en planta.

Cada modo dispone de una acción `Localizar …` que reutiliza la vista temporal no autoritativa existente.

## Criterio UX

Los códigos internos siguen disponibles para trazabilidad, pero ninguna decisión debe depender de memorizar una convención de signos o un ID técnico. El usuario debe poder reconocer la ubicación por geometría, ejes nominales y orientación de Planta antes de persistir la interfaz.
