# SPEC-015-C — Interfaz de declaración y decisiones estructurales explícitas

**Estado:** borrador de planificación · 2026-08-04

## Diagnóstico

Después de SPEC-015-A/B existirá un contrato persistente, pero no una interfaz segura para editarlo.
La UI actual de tipos de muro pertenece a Metalcon/OSB y no puede reutilizarse para intención
estructural.

La aplicación necesita una herramienta separada que permita declarar intención de elementos y
techumbre sin mostrar campos constructivos. Toda acción debe distinguir entre:

- datos derivados de geometría;
- intención declarada;
- campos pendientes;
- propuestas futuras.

## Decisión

Crear el menú principal:

```text
Estructura
├── Intención estructural…
├── Propuestas estructurales…      [habilitado en SPEC-015-D]
├── Caminos de carga…              [habilitado en SPEC-015-D]
└── Topología estructural…         [habilitado en SPEC-015-E]
```

En este corte sólo se habilita `Intención estructural…`.

La herramienta tendrá vistas separadas:

```text
Resumen
Muros y elementos
Techumbre
Encuentros
Diafragmas
Pendientes
```

`Encuentros` y `Diafragmas` podrán permanecer limitados a los campos implementados por el contrato
vigente.

## Reglas de interfaz

### Separación constructiva

La herramienta no muestra ni permite editar:

- tipo Metalcon;
- MP1, MP2, MP3 o tabique Metalcon;
- perfiles;
- OSB;
- separación de montantes;
- materiales;
- soluciones constructivas.

### Muros y elementos

Campos mínimos:

```text
Participación prevista
Funciones previstas
Interacción secundaria
Notas
```

Acciones:

```text
Declarar
Modificar
Eliminar declaración
Asignar a selección
Limpiar selección
```

La asignación masiva debe mostrar:

- cantidad de elementos afectados;
- valor anterior;
- valor nuevo;
- conflictos;
- confirmación explícita.

### Techumbre

Mostrar:

- superficie seleccionada;
- polígono;
- dirección resistente;
- distribución;
- función de diafragma prevista;
- lista gráfica de bordes canónicos;
- función declarada de cada borde.

La UI no debe etiquetar un muro como portante al seleccionar un borde.

### Estado de decisión

Cada campo se presenta como:

```text
Declarado
No definido
Inválido
Referencia rota
```

No se usa “aprobado” ni “verificado” en esta fase.

### Guardado

Las ediciones se aplican mediante mutaciones del dominio. El formulario no escribe directamente
en el store.

## Decisiones sobre propuestas

La UI debe quedar preparada para recibir propuestas en SPEC-015-D, pero en este corte no las
genera.

La separación visual futura será obligatoria:

```text
Propuesta de las SPEC
Decisión vigente del usuario
```

Nunca se mostrará una propuesta con el mismo estilo que una declaración aceptada.

## Flujo del usuario

### Declaración manual de muro

```text
seleccionar muro
→ revisar geometría
→ elegir participación
→ elegir funciones
→ guardar
→ mostrar declaración vigente
```

### Declaración de techumbre

```text
seleccionar superficie
→ visualizar bordes
→ declarar dirección
→ clasificar bordes
→ definir intención de diafragma
→ guardar
```

### Cambio posterior

```text
abrir declaración vigente
→ modificar
→ revisar impacto
→ confirmar
```

## Trazabilidad

Cada cambio debe registrar al menos:

```json
{
  "action": "structuralIntentUpdated",
  "targetType": "element",
  "targetId": 1784600403613,
  "previousFingerprint": "...",
  "nextFingerprint": "...",
  "source": "userAction"
}
```

El registro no reemplaza el objeto vigente y no participa en el hash de geometría.

## Caso real obligatorio

La prueba visual usará el fixture completo.

Flujo mínimo:

1. seleccionar un muro de frontón;
2. dejar su participación indeterminada;
3. declarar una cubierta con dirección y bordes;
4. comprobar que el muro continúa sin intención;
5. declarar un muro interior como resistente lateral;
6. comprobar que la UI acepta la intención aunque el muro no toque la cubierta;
7. mostrar que la transferencia permanece pendiente y no se resuelve en este corte;
8. editar un elemento secundario como tabique solidario y luego flotante.

## Ejecución Codex

- Esfuerzo planificado: `medium`
- Escalamiento xhigh: `prohibido`
- Motivo: integra contratos ya definidos en una UI separada, con mutaciones y pruebas de no mezcla.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Añadir campos al modal Metalcon | Mezcla intención y solución |
| Guardar al cambiar un selector | Reduce control sobre cambios masivos |
| Inferir valores iniciales | Una propuesta no puede ser decisión |
| Mostrar “estructural/no estructural” binario | No representa funciones ni secundarios |
| Activar soluciones constructivas | Pertenece a SPEC-016 |

## Alcance

- Crear menú `Estructura`.
- Crear modal o espacio de trabajo de intención.
- Editar intenciones de elementos y techumbre.
- Asignación individual y masiva.
- Visualizar bordes canónicos.
- Mostrar estados pendientes y errores.
- Registrar cambios explícitos.
- Cubrir accesibilidad básica y navegación por teclado.
- Mantener separados todos los módulos constructivos.

## Fuera de alcance

- Generar propuestas.
- Calcular caminos de carga.
- Verificar capacidad.
- Completar R6–R12.
- Crear menú `Soluciones constructivas`.
- Mover `wallTypes`.
- Crear miembros Metalcon.

## Criterios de aceptación

1. `Estructura > Intención estructural…` abre una herramienta independiente.
2. Ningún texto o control de Metalcon/OSB aparece dentro de ella.
3. Declarar, modificar y eliminar una intención produce exactamente las mutaciones esperadas.
4. La asignación masiva requiere confirmación y reporta los elementos afectados.
5. La vista de techumbre permite declarar orientación y funciones de bordes canónicos.
6. Declarar un borde de apoyo no modifica muros.
7. Un muro interior separado de la cubierta puede declararse resistente lateral sin fabricar una
   conexión.
8. Referencias rotas o campos inválidos son visibles y no se guardan.
9. Reabrir el proyecto reproduce las declaraciones.
10. Pruebas de componentes demuestran que la UI no importa módulos constructivos.
11. La evidencia visual del caso real cumple el flujo macro → micro y registra decisiones.
12. Gates, build y cierre pasan.

## Evidencia

- Tests de componentes y store.
- Pruebas de asignación individual/masiva.
- Pruebas de rechazo de campos inválidos.
- Captura o HTML reproducible del caso real.
- Inspección de dependencias.
- Test de persistencia.
- Cierre `sessions/close-SPEC-015-C.md`.

## Corte sugerido

Detener cuando toda intención disponible pueda declararse manualmente desde una herramienta
separada, sin propuestas ni soluciones constructivas.
