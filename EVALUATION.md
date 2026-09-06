# Evaluación reproducible de la etapa local

## Ejecución

`npm test` comprueba contratos del motor, reglas, dos slots de control, replay, independencia de cámara, geometría del rig, resolución del catálogo y controles negativos del evaluador. `npm run evaluate` ejecuta 69 IDs × dos variantes × semillas 2017 y 37, además de tres partidos CPU de seis minutos. No hay dependencia de un navegador para esos checks.

`artifacts/evaluation.json` registra versión de runtime/configuración, hash SHA-256 del oráculo, hashes inicial/final/de traza, métricas por variante/semilla, criterios individuales y fallos locales. `npm run evaluate:traces` añade observaciones por tick comprimidas en `artifacts/traces/`. Se excluyen esas trazas voluminosas de Git; pueden guardarse como artefactos de una ejecución.

`npm run evaluate -- --test=LOC-ACC-002` expande transitivamente los IDs de impacto y guarda `artifacts/targeted-evaluation.json`. Un ID inexistente, métrica no finita o esquema incompatible invalida la ejecución; no produce un PASS vacío.

## Contratos y comparación

- `eval/catalog.json`: los 69 casos extraídos literalmente de los bloques YAML originales, sin alterar los documentos preservados.
- `eval/scenarios.ts`: condiciones iniciales, variantes, inputs con ticks, observaciones y estimadores. Los perfiles son ficticios y provisionales.
- `eval/registry.ts`: bindings de criterios, observaciones, definiciones de escenario, cierre de impacto y precedencia de resultados.
- `eval/oracles.ts`: límites de diseño y comprobaciones independientes del motor. El motor no importa el evaluador.
- `eval/baseline.json`: hashes de 276 ejecuciones del perfil local. Se congela explícitamente después de comprobar pruebas y ausencia de fallos locales. Cambiar el archivo requiere revisión del cambio de comportamiento; no se actualiza al ejecutar una evaluación normal.
- `eval/reference.ts`: esquema de evidencia, unidades admitidas, elegibilidad y comparación con intervalos de incertidumbre.

Precedencia: `INVALID_RUN` → `FAIL` → `NEEDS_PERCEPTUAL_REVIEW` → `BLOCKED_MISSING_REFERENCE` → `NOT_EVALUATED` → `PASS`. Un criterio duro o una regresión pueden pasar aunque el caso completo siga bloqueado por falta de referencia. Los controles negativos validan el evaluador mediante trazas corrompidas; no se presentan como una campaña exhaustiva de mutantes del código fuente.

La base inicial verifica regresiones futuras de este perfil; no demuestra que se hayan satisfecho todos los umbrales del catálogo histórico. La exportación completa permite calcular otras estadísticas y revisar las curvas. Los estimadores disponibles usan observaciones locales; no inventan parámetros, capturas ni pruebas causales de PES.

## Referencias medidas

No hay capturas reales importadas. Para añadirlas prepara un JSON que cumpla `ReferenceTarget` en `eval/reference.ts` y ejecuta:

```bash
npm run reference:import -- /ruta/captura-medida.json
```

Campos obligatorios:

| Grupo | Contenido |
|---|---|
| Identidad | `version: reference-target-v1`, ID seguro, `testId` del catálogo y clase A/B/C |
| Fuente | Juego PES 2017, plataforma, build, modo, dificultad, velocidad de juego, controlador y cámara |
| Captura | URI de evidencia, SHA-256 del archivo, operador, procedencia directa, timestamps PTS monotónicos |
| Clase C | Inputs controlados y SHA-256 de su registro; no basta un vídeo público |
| Estratos | Condiciones observadas y `scenario_id`, por ejemplo `LOC-ACC-002:0` |
| Mediciones | Métrica instrumentada, unidades, estimación, incertidumbre, tamaño de muestra ≥ 2, observabilidad, método y ventana PTS |

Se rechazan unidades incompatibles, métricas desconocidas, falta de procedencia, ventanas fuera de captura y objetivos no observables. El importador no sobrescribe IDs existentes ni calibra el motor. La comparación numérica es sólo con la medida admitida y su incertidumbre; los criterios causales UNKNOWN y la revisión perceptual no se aprueban a partir de un intervalo numérico.

## Revisión manual pendiente

El entorno bloqueó la vista local por política de URL. No se intentaron rutas alternativas para eludirla. Ejecuta el servidor en tu equipo y registra esta evidencia:

1. **Partido de escritorio:** iniciar, mover, frenar, girar, pasar, cargar y soltar tiro, cambiar jugador, pausar, abrir/cerrar menú y llegar al final. Repetir en modo dos jugadores y comprobar que el control no se cruza.
2. **Mandos físicos:** conectar dos, iniciar, comprobar ejes/botones, desconectar uno durante una carga y reconectar. No debe dispararse una acción retenida ni cambiar el slot del otro mando. Registrar modelo, conexión, SO y navegador.
3. **iPhone:** abrir el servidor por una ruta accesible desde el dispositivo, probar orientación vertical/horizontal, joystick simultáneo con tiro/protección, cancelar un gesto y cambiar de aplicación. Registrar modelo/iOS/navegador. Para APIs que exijan contexto seguro, usar HTTPS o la configuración de desarrollo adecuada; el juego táctil no necesita Gamepad.
4. **Laboratorio:** abrir `/lab.html`, elegir un caso, semilla y variante; reiniciar y avanzar hasta el contacto. Exportar evidencia y capturar los fotogramas antes/en/después. Revisar pie, cabeza y mano, continuidad de balón y cuerpos, cámara y posibilidad de leer la acción. Repetir con ambas variantes.
5. **Repetición:** exportar un partido y cargarlo en el mismo build/runtime. Debe terminar con “REPETICIÓN VERIFICADA”. Un archivo v1 o inválido debe mostrar un error legible.

Plantilla de revisión: caso/semilla/variante, build, dispositivo, navegador, resolución, FPS observado, ticks/fotogramas, tarea, resultado esperado/observado, gravedad, confianza, evidencia y comentario del probador. Para juicio de arquetipos, ocultar etiquetas de variante y alternar el orden antes de revelar las capacidades.

No usar un único “feel score” para aprobar el proyecto. Registrar por separado respuesta al input, inercia, peso del balón, coherencia de contacto y legibilidad táctica. Esos resultados siguen pendientes hasta realizar la sesión.
