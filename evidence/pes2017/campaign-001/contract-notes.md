# Compatibilidad de las observaciones con el contrato vigente

Autoridad: `EVALUATION.md`, `research/02-reference-measurement.md`, catálogo de `research/01-pes2027-behavior.md`, `eval/reference.ts` y criterios de `specs/GAMEPLAY_EVALUATION_SPEC.md`. No se modificó ninguno.

## Identidad, fuente y muestras

- Cada exportación real tendrá `version: reference-target-v1`, ID kebab-case único, `testId` del catálogo y clase A/B. No hay IDs de referencia asignados a los cupos de planificación.
- `capture` exige URI, SHA-256 **del vídeo**, `DIRECT_CAPTURE`, reloj `PTS`, PTS estrictamente crecientes, operador y `controlledInputs:false`. La procedencia directa se acredita con la captura; no se etiqueta automáticamente por ser un enlace de YouTube.
- Los registros públicos conservan `input_known:false`. Si se exportan, se conserva también `strata.input_known: "false"` porque ese mapa admite strings. No se crean stick, potencia, sprint ni hash de inputs.
- Configuración desconocida permanece `null` en la evidencia primaria y bloquea los campos obligatorios del contrato. El título no acredita una build, un controlador ni ajustes exactos.
- La ventana PTS, las entidades y el método de muestreo deben ser trazables. `sampleSize` describe qué se contó; no se usa el número de frames correlacionados para fingir repeticiones independientes.

## Mapeos que requieren comprobar equivalencia

La tabla identifica posibilidades y restricciones, **no mediciones disponibles ni promesas de cobertura**. Las unidades proceden de `METRIC_UNITS`. La definición exacta del candidato se leyó en `eval/scenarios.ts` para evitar comparar cantidades diferentes; no se alteró.

| Familia | Métricas del contrato potencialmente observables | Condición para exportar |
| --- | --- | --- |
| LOC-ACC-001 | `earlyDistance` (m), `t25/t50/t90` (s), `peakAcceleration` (m/s²), `plateau` (m/s) | Inicio de movimiento visible, meseta observada, escala/PTS e incertidumbre. Acreditar ventanas equivalentes: el candidato usa desplazamiento a 30 ticks, últimos 30 ticks para meseta y máximo de cambio **absoluto** de rapidez. No son automáticamente distancia recorrida, aceleración de arranque ni tiempo desde un input. |
| LOC-MAX-001 | `plateau`, `maxSpeed` (m/s) | Sólo máximo/meseta de esa trayectoria observada, sin afirmar máximo del atributo Speed. Igualar duración y estimador para la comparación. |
| LOC-DEC-001 | `distance` (m), `durationSeconds` (s), `peakAcceleration` (m/s²) | `distance` en el candidato es desplazamiento entre extremos, no arco ni distancia de frenada aislada. `durationSeconds` es duración del escenario, no automáticamente tiempo de frenada. No renombrar observaciones para encajarlas. |
| Giros | `minimumTurnSpeed` (m/s), `speedRetention` (ratio) | Deflexión reconstruida y ventanas equivalentes. El candidato usa velocidad en tick 30 y mínimo después de tick 30; no es automáticamente el cociente entrada/salida de cualquier giro. |
| Pase/rodadura | `initialStrikeSpeed` (m/s), `ballRange` (m), `contacts` (count) | El primero es rapidez **3D** en el primer estado con evento de golpeo; la rapidez 2D de rodadura no equivale sin acreditar componente vertical y ventana. `ballRange` es desplazamiento entre extremos del escenario. Los contactos deben ser identificables. |
| Primer toque | `firstTouchOutgoing` (m/s) | Contacto y velocidad saliente observables, misma ventana/magnitud que el evento candidato. Orientación corporal e incertidumbre visibles para subtipos. No mide estabilidad interna. |

Las series de velocidad del balón, su desaceleración, orientación, curvatura, lead distance y separación tras el toque pueden ser productos de evidencia. No todas tienen un nombre equivalente en el contrato actual. No se añadieron métricas, no se reutilizó la aceleración del jugador como fricción del balón y no se sustituyeron ticks internos por frames de vídeo. `freeTicks`, `minimumStability`, `maximumRecovery`, `memoryEntries` y spin no se rellenan desde imágenes que no los identifican.

La incertidumbre se estima con evidencia de repetibilidad, error de cámara, intervalo de contacto y ajuste, con significado explícito del intervalo. No se amplía para abarcar al motor.

## Correspondencia de escenario

El evaluador existente busca por `testId` y `strata.scenario_id === "TEST-ID:0"`, y selecciona una referencia mediante `find`. No agrega automáticamente distribuciones de varios JSON ni compara cada estrato del vídeo. Tampoco verifica equivalencia física de los estimadores por validar la estructura.

Por ello, se debe documentar la correspondencia de condiciones, magnitud, ventana y estimador **antes** de asignar el identificador del escenario. No se asigna `TEST-ID:0` sólo para cambiar el resultado. Las referencias por fuente/evento se conservan separadas y la fuente reservada no se incorpora a un objetivo usado para ajustar reglas. Cualquier necesidad futura de comparación estratificada se documenta; esta campaña no cambia evaluador, oráculos ni baseline.

Ni una referencia numérica ni un PASS sustituyen los criterios causales UNKNOWN o las rúbricas perceptuales. No se produce un único feel score.
