# SPEC-004-D1 — Render del frontend en el WebView de macOS 11

## Diagnóstico

Los smokes de `SPEC-004-C1` y `SPEC-004-D` demostraron que Tauri crea una ventana y mantiene vivo
el proceso en macOS 11.7.11 x86_64, pero no verificaron que React llegara a renderizar contenido.
La inspección visual posterior muestra una ventana completamente blanca.

Un capturador temporal, retirado después del diagnóstico, reprodujo la excepción previa al primer
render:

```text
TypeError: Object.hasOwn is not a function
getDomainRule .../src/core/domainRules.js:296
resolveRuleLimit .../src/core/domainRules.js:331
.../src/core/shearCapacity.js:15
```

El WebView disponible en el Mac objetivo no implementa `Object.hasOwn`. Producción contiene 47
invocaciones en doce módulos de core/store; Node 22 y los navegadores usados por el E2E sí
implementan la API, por lo que las puertas existentes no detectan la incompatibilidad. Cambiar el
target sintáctico de Vite no agrega polyfills para built-ins.

Además, una excepción durante evaluación de módulos deja `#root` vacío. No existe una guarda
anterior a `main.jsx` que convierta un fallo de bootstrap en feedback visible.

## Decisión

Centralizar la consulta de propiedades propias en un helper puro basado en
`Object.prototype.hasOwnProperty.call`. Todo código de producción deja de depender de
`Object.hasOwn`; no se modifica globalmente `Object`, no se agrega una dependencia y se preserva
el comportamiento con objetos de prototipo nulo o que sombrean `hasOwnProperty`.

Antes de cargar `main.jsx`, un script local mínimo instala una guarda de bootstrap. Una excepción o
promesa rechazada no manejada antes del render reemplaza el estado de carga por un mensaje visible
usando `textContent`; no evalúa datos, no transmite información ni amplía la capability. El render
normal retira el estado de carga al ocupar `#root`.

El smoke real pasa a exigir evidencia de contenido reconocible —barra de menú y selector de vista—
además de ventana y proceso vivos. La versión de Node de la terminal se activa con `.nvmrc`; este
ajuste de entorno es independiente de la compatibilidad del WebView.

## Alcance

- Agregar un helper puro compatible para propiedades propias.
- Sustituir las 47 invocaciones productivas de `Object.hasOwn`.
- Agregar prueba que inspeccione todo `src/` y bloquee la API incompatible.
- Agregar una guarda de bootstrap local, visible y sin red.
- Probar el helper contra objetos normales, de prototipo nulo y propiedades heredadas.
- Ejecutar el frontend real en Tauri sobre macOS 11.7.11 x86_64 y verificar contenido visible.
- Corregir documentación, decisión, riesgo y el criterio de smoke que aceptó una ventana vacía.

## Fuera de alcance

- Actualizar Tauri, Wry, React, Vite, Node o el sistema operativo mínimo.
- Incorporar una biblioteca general de polyfills o ampliar soporte a navegadores no objetivo.
- Crear logging persistente, telemetría o un error boundary general de componentes.
- Cambiar UX funcional, modelo, store, reglas, geometría, DXF, INP o resultados.
- Incorporar CalculiX nativo, packaging, firma o instalación.

## Criterios de aceptación

1. Con `Object.hasOwn` ausente, las rutas de reglas que antes abortaban se importan y ejecutan.
2. El helper distingue propiedades propias/heredadas y funciona con prototipo nulo, claves
   `Symbol` y objetos que sombrean `hasOwnProperty`.
3. Ningún archivo productivo bajo `src/` contiene `Object.hasOwn`; la inspección recorre archivos
   nuevos automáticamente.
4. Una excepción de bootstrap produce feedback visible y escapado; el arranque correcto reemplaza
   el estado de carga con la aplicación.
5. Localhost conserva el mismo comportamiento funcional y las suites de componentes permanecen
   verdes.
6. Tauri conserva exactamente nueve comandos propios, CSP local y ninguna capacidad nueva.
7. `make doctor` pasa con Node 22 activado mediante `.nvmrc`.
8. `npm run tauri:dev -- --no-watch` muestra en macOS 11.7.11 x86_64 la barra de menú, el selector
   de vista y el lienzo; permanece vivo al menos diez segundos sin error de bootstrap.
9. `make governance` y `npm run validate` terminan con código 0; DXF y CCX heredados no cambian.

## Evidencia

- Prueba pura del helper y reproducción con `Object.hasOwn` temporalmente ausente.
- Inspección automática recursiva de `src/`.
- Prueba DOM de la guarda de bootstrap con texto no confiable.
- Reversión temporal de una sustitución productiva para demostrar que la inspección falla.
- `make doctor`, `npm run validate`, captura reproducible y smoke real
  `npm run tauri:dev -- --no-watch`.

## Corte sugerido

Detener al demostrar render real y feedback de bootstrap en el WebView del Mac objetivo. Retomar
después el diagnóstico de ejecución controlada de CalculiX previsto por `SPEC-004`.
