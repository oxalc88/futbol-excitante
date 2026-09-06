# PES 2017 — campaña 001: selección de fuentes

**Resultado: bloqueo de acceso al vídeo. No hay mediciones PES ni referencias importables.**

Se inspeccionaron los metadatos de los tres candidatos citados por el research y se intentó descargar su pista de vídeo. Los tres intentos finalizaron por timeout, sin un archivo de vídeo. Esta es una **auditoría preliminar de acceso/procedencia**, no una auditoría FPS/PTS completada. No se han observado sus fotogramas, la cámara ni las marcas de cancha.

Los metadatos de formato, duraciones y títulos son declaraciones del servicio/autor. No son medidas del contenido. `media_sha256`, PTS, cadencia verificada, calibración y mediciones permanecen `null` o vacíos. Los hashes en `manifest.sha256` identifican los documentos del expediente, **nunca sustituyen el SHA-256 del vídeo**.

## Tres candidatos inspeccionados

| Candidato y rol | Declarado, sin verificar | Decisión actual | Motivo |
| --- | --- | --- | --- |
| [C4-W1u8w-yE — entrenamiento](https://www.youtube.com/watch?v=C4-W1u8w-yE), Tajae Lawrence | PC según descripción; 58 s; pista 137: 1920×1080, 30 FPS | Pendiente; no admitido | Descarga sin vídeo. No hay PTS/cadencia/calibración. No consta que un único ejercicio aporte las 15 repeticiones independientes. |
| [8afTHuMZxbI — partido principal](https://www.youtube.com/watch?v=8afTHuMZxbI), Throneful | PC según título; 1333 s; pista 299: 1920×1080, 60 FPS | Pendiente; no admitido | Descarga sin vídeo. Cámara principal estable y visibilidad de cancha aún sin verificar. El extractor también informó un problema de resolución del desafío del reproductor. |
| [7daF_qg6B8s — validación independiente](https://www.youtube.com/watch?v=7daF_qg6B8s), WeirdFifa | PS4 según título; 674 s; pista 137: 1920×1080, 30 FPS | Excluido de la selección inicial | La descripción atribuye el vídeo a IGN/Gamescom 2016: falta vincularlo a la captura original y acreditar build. Además, descarga sin vídeo. Distinto canal no prueba una captura independiente. |

**Admitidos: 0. Pendientes de medios: 2. Excluidos de la selección inicial: 1.** Ningún rechazo se basa en una supuesta mala cadencia o mala cámara: no fue posible medirlas. La mezcla PC/PS4/build desconocido tampoco permite agrupar resultados como si fueran la misma configuración.

`source-audits/sources.json` conserva las decisiones; los tres archivos `*.metadata.json` conservan metadatos sanitizados y su origen. `logs/download-*.log` conserva las salidas de los intentos, con código de salida en `logs/access-attempts.json`. No se guardaron URLs de reproducción firmadas ni credenciales.

## Conjunto mínimo propuesto antes de anotar

Los siguientes son **cupos de adquisición**, no segmentos encontrados. No hay timestamps de clip inventados. `planned-clips.csv` contiene 54 cupos, con fuente concreta y PTS sin asignar cuando no están acreditados.

| Familia / estrato observado | Desarrollo | Fuente independiente reservada | Total | IDs candidatos |
| --- | ---: | ---: | ---: | --- |
| Inicio visible → meseta | 5 entrenamiento | 0 | 5 | LOC-ACC-001 |
| Velocidad alta sostenida en recta | 5 entrenamiento | 0 | 5 | LOC-MAX-001 |
| Velocidad alta → parada visible | 5 entrenamiento | 0 | 5 | LOC-DEC-001 |
| Deflexión de trayectoria 30–60° | 3 partido principal | 2 | 5 | LOC-T45-001 |
| Deflexión de trayectoria 70–110° | 3 partido principal | 2 | 5 | LOC-T90-001 |
| Deflexión de trayectoria 150–180° | 3 partido principal | 2 | 5 | LOC-REV-001 |
| Pase–rodadura–recepción: banda menor, frontal/abierto | 4 partido principal | 2 | 6 | Pases, balón raso y primer toque, según observabilidad |
| Pase–rodadura–recepción: banda menor, lateral/espaldas | 4 partido principal | 2 | 6 | Ídem |
| Pase–rodadura–recepción: banda mayor, frontal/abierto | 4 partido principal | 2 | 6 | Ídem |
| Pase–rodadura–recepción: banda mayor, lateral/espaldas | 4 partido principal | 2 | 6 | Ídem |
| **Total** | **40** | **14** | **54** | |

Se necesitan al menos tres capturas/roles admitidos. El entrenamiento podrá requerir más material si no contiene suficientes acciones limpias; no se contará varias veces el mismo movimiento. Para el tercer rol se solicita un segundo partido de origen independiente, preferentemente con plataforma/build/configuración comparables y secuencias continuas. El vídeo republicado no ocupa esos 14 cupos.

Se revisarán las fuentes completas para localizar ventanas, conservando contexto previo y posterior a cada evento. Cortes, repeticiones de cámara lenta y contactos ocultos excluyen la ventana correspondiente. Registrar también los eventos descartados evita elegir sólo ejemplos favorables.

Las bandas de velocidad se definirán con la distribución **medida en desarrollo**; el límite y el método se congelarán antes de clasificar la fuente reservada. No se propone ningún valor PES en m/s. La orientación se anotará desde el cuerpo visible, con su incertidumbre; no se sustituirá por la dirección de movimiento. Si no puede distinguirse, queda desconocida y no llena ese cupo. Los giros se clasifican después de reconstruir su deflexión. Se buscarán receptores en movimiento para PASS-RUN-001. TOUCH-BACK-001 y TOUCH-90-001 sólo reciben evidencia cuando su orientación concreta está observada.

## Qué falta para admitir una fuente

1. Obtener el archivo de vídeo completo, su URI persistente y SHA-256 real; conservar plataforma, build, modo, dificultad, velocidad de juego, controlador y cámara con evidencia de su procedencia. Lo desconocido queda `null` en los registros primarios. Ningún input se deduce de un vídeo público.
2. Auditar los PTS del archivo y las imágenes decodificadas. Revisar duplicados exactos y aproximados, mezcla/interpolación, cortes y entrelazado. Una cadencia de contenedor regular no acredita contenido único ni FPS originales de captura.
3. Revisar en fotogramas las marcas y ajustar cámara/homografía por segmento y movimiento. No asumir cancha 105×68 ni una escala píxel/metro global. Documentar plantilla, correspondencias, puntos de comprobación y residuos.
4. Anotar jugador por apoyo en el suelo, balón por proyección al suelo únicamente si está rodando, contactos por intervalos PTS y orientación corporal sólo cuando visible. Conservar clics originales, correcciones y doble anotación para estimar repetibilidad.
5. Reconstruir en metros; ajustar estimadores contra PTS reales, separados en cada contacto; propagar incertidumbre de clics, cámara, intervalos temporales y ajuste. No asignar un sigma de píxel arbitrario. Separar incertidumbre instrumental de variabilidad entre eventos.
6. Exportar sólo observables A/B con métricas y unidades de `METRIC_UNITS`, estimación, incertidumbre, método, ventana y tamaño de muestra ≥2 explicado. Los frames correlacionados no sustituyen dos eventos independientes al estimar dispersión entre eventos. Mantener la fuente reservada separada del ajuste y de la elección de reglas.
7. Revisar compatibilidad semántica y de escenario; ejecutar el importador existente sin sobrescribir IDs. La mera validación estructural de JSON no acredita la evidencia.

## Herramienta de auditoría preparada

Desde la raíz del repositorio, con Python 3, NumPy, FFmpeg y ffprobe instalados:

```bash
python scripts/audit-reference-video.py /ruta/captura.mp4 \
  --out evidence/pes2017/campaign-001/raw/audit-captura-01 \
  --source-id captura-01 \
  --uri 'URI-persistente-de-la-captura' \
  --operator 'nombre-del-operador'
```

El directorio de salida debe ser nuevo. La herramienta conserva SHA-256 del archivo, ffprobe, PTS enteros/base racional, hashes RGB24 por frame y diferencias adyacentes. No usa FPS anunciados como reloj, ni `-r`, interpolación o eliminación de duplicados. No admite fuentes automáticamente: deja pendiente la revisión de contenido y cámara. La comprobación del software con un vídeo **sintético, ajeno a PES** preservó PTS variables y dos repeticiones exactas; véase `logs/audit-tool-validation.log`. Aún no se ha validado con un vídeo PES accesible.

Referencias técnicas de la herramienta: [ffprobe](https://ffmpeg.org/ffprobe.html), [FFmpeg, timestamps y sincronización](https://ffmpeg.org/ffmpeg.html). Los intentos de adquisición usaron [yt-dlp](https://github.com/yt-dlp/yt-dlp), sin cookies ni autenticación y sin habilitar componentes remotos tras el fallo.

## Exportación e importación

`import-ready/` no contiene JSON. `raw/annotations.json` tiene cero registros: no hay clics, tracks ni eventos medidos. No se han rellenado ejemplos del research como si fueran datos.

`logs/reference-import.json` y `.log` registran **0 invocaciones, 0 éxitos y 0 rechazos del importador**, con estado `NOT_RUN_NO_ELIGIBLE_TARGETS`. Los tres fallos de adquisición no son rechazos de `reference:import`.

Cuando haya evidencia válida, el comando requerido sigue siendo:

```bash
npm run reference:import -- evidence/pes2017/campaign-001/import-ready/ID-REAL.json
```

El contrato `reference-target-v1` exige configuración como strings no vacíos, mientras el protocolo primario conserva desconocidos como `null`. Esta campaña no sustituye los desconocidos por configuraciones plausibles ni por valores usados para forzar admisión: los campos obligatorios no acreditados son un bloqueo de exportación.

`contract-notes.md` registra límites de unidades/estimadores y `scenario_id`; `evaluation-status.md` lista todos los IDs con criterios bloqueados o revisión perceptual. Es una lectura del informe existente, identificado por hash, no una nueva ejecución ni una mejora del motor.

## Fuera de alcance

- Curvas Speed / Explosive Power y cualquier conclusión causal sobre atributos.
- Funciones de transferencia input→output; stick, potencia, sprint e instante de input inferidos.
- LOC-ACC-002 clase C. Requiere otra campaña con captura controlada, `controlledInputs=true` e `inputLogSha256` real.
- Calibración o modificación del motor, oráculos, baseline, contrato, publicación y online.

**Para desbloquear la medición:** proporcionar tres archivos de captura accesibles: entrenamiento con repeticiones, partido principal continuo y segundo partido independiente. Acompañarlos de los ajustes acreditados que existan. Sin archivo decodificable no es posible entregar medidas, intervalos PTS, SHA-256 de captura ni ReferenceTarget válidos.
