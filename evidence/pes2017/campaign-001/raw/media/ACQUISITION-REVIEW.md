# Revisión de la adquisición recibida

Base revisada: `b5e0ffbba73985d4da705e922600aefc832ede36`. Se leyó `ACQUISITION.md`, `INDEX.csv`, los tres resúmenes ffprobe, el resumen de auditoría de entrenamiento y los logs de descarga de `gauntlet-observer-box`.

**Las tres descargas están documentadas en la máquina de adquisición; sus vídeos no se han transferido a este entorno.** Git transportó los documentos, no los MP4. Las reglas de `.gitignore` excluyen tanto `raw/media/*.mp4` como `raw/audit-*/frames.jsonl` y `raw/audit-*/ffprobe.json`. No hay assets en Releases en la consulta realizada.

## Resultado verificable con los archivos recibidos

| Fuente | Evidencia recibida | Resultado de esta revisión |
| --- | --- | --- |
| C4-W1u8w-yE | Índice, resumen ffprobe, `audit.json`, log de adquisición | Hash y tamaño declarados coinciden entre índice y auditoría; consistencia aritmética temporal correcta. Falta verificar bytes y revisar imágenes. |
| 8afTHuMZxbI | Índice, resumen ffprobe, log de adquisición | Resumen consistente con 1280×720 y 60/1. No hay registros por frame ni auditoría temporal completa. |
| LFvEnk0mcLI | Índice, resumen ffprobe, log de adquisición | Resumen consistente con 1280×720 y 60/1. Sustituye a WeirdFifa como candidato reservado; independencia y contenido aún sin revisar. |

El resumen del entrenamiento informa 1.725 frames, base temporal `1/30000`, PTS primero `0`, último `1725724` e histograma de 1.724 intervalos de `1001` ticks. Se verificó que `1724 × 1001 = 1725724`, que los conteos coinciden y que la tasa declarada `30000/1001` corresponde a ese intervalo. El resumen informa también 100 repeticiones RGB24 exactas. **Estas cifras proceden de la auditoría de la otra máquina; aquí no se volvió a decodificar el vídeo.**

No es posible saber, a partir del conteo agregado, si esas repeticiones ocurren en menús, pausas o durante movimiento. Tampoco prueba cadencia única, ausencia de mezcla/interpolación ni cámara calibrable. Se conserva `admitted:false`; no se calculan velocidades ni se asignan ventanas a eventos.

Los hashes de `frames.jsonl` y `ffprobe.json` en la auditoría identifican archivos que no llegaron. El hash del MP4 en el índice es un **hash declarado por el operador**, todavía sin comprobación local de los bytes. No se usa como verificación de un archivo ausente.

## Intento local de recuperar el mismo entrenamiento

Se intentó la selección `136+251`, salida MP4, con yt-dlp `2026.08.19`, sin cookies, cero reintentos y timeout de red de 15 s. El intento devolvió código 1: tras un timeout del watch page, YouTube exigió iniciar sesión para confirmar que no era un bot. No se obtuvo ningún archivo de vídeo y no se intentó eludir ese requisito. Salida conservada en `../../logs/acquisition-transfer-recheck.log`.

## Estado actualizado

- Tres fuentes adquiridas según el operador; cero archivos de vídeo locales; cero fuentes admitidas.
- Los 14 cupos reservados de `planned-clips.csv` ahora apuntan al candidato `LFvEnk0mcLI`. Los PTS siguen vacíos. Los 54 cupos siguen siendo un plan, no eventos observados.
- No hay nuevas anotaciones ni ReferenceTarget; no se invocó `reference:import`.
- La adquisición está declarada como medio público secundario. El contrato actual sólo admite `DIRECT_CAPTURE`; no se cambió ni se asignó una procedencia falsa. Las medidas A/B primarias pueden avanzar cuando lleguen los archivos; la exportación sigue necesitando procedencia/configuración compatibles.
- Permanecen pendientes las curvas de atributos, funciones input→output, LOC-ACC-002 clase C y las revisiones perceptuales. No se modificaron motor, oráculos ni baseline.

## Transferencia mínima para continuar

No hace falta volver a descargar los tres vídeos en la máquina que ya los tiene. Para iniciar la revisión visual y el piloto, basta adjuntar aquí **`C4-W1u8w-yE.mp4`** (9.760.410 bytes), con SHA-256 esperado `7c2d52bf91bd89315f352bf641c8f065c957c7bdb2d2e7166dfbc0eb8204f1fb`. Al recibirlo, se verificará su hash y se podrá regenerar la auditoría completa.

Si se quiere transferir también la auditoría original, adjuntar `frames.jsonl`, `ffprobe.json` y ambos logs stderr de `raw/audit-C4-W1u8w-yE/`. No basta adjuntar de nuevo sólo `audit.json`.

Después se necesitan los otros dos MP4, por adjunto o URI de descarga accesible que sirva los archivos exactos del índice. No es necesario introducir binarios grandes en Git ni publicar el juego. El archivo de entrenamiento por sí solo permite arrancar un piloto; no completa la campaña de tres fuentes.
