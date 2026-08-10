# MEJ-015-D-021 — Interfaces estructurales sobre referentes geométricos

## Estado

Implementado en REV8.

`structural-intent-v1.1` añade `interfaceIntents[]`. Cada interfaz conserva:

- `ownerRef` geométrico (`element` o `roofBoundary`);
- locator canónico;
- `hostGeometryFingerprint`;
- `source=userDeclared`;
- nota opcional.

No contiene material, perfil, capacidad, familia de acción ni función estructural. Su identidad es determinista e independiente de invertir un prisma geométricamente equivalente.
