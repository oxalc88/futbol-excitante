# Fútbol Excitante — etapa local

Juego experimental de fútbol 3D: 11v11, 5v5 y 2v2, contra la CPU o con dos jugadores locales. Motor TypeScript con ticks fijos y presentación Three.js.

Rama: `main` (motor Astra). La investigación y las herramientas del sistema Gauntlet legado están en la rama `archive/gauntlet-legacy` y en las etiquetas `history/*`. El juego no necesita Gauntlet para compilar, probar ni ejecutarse.

Se reconstruyó desde cero preservando **sin cambios** `VISION.md`, `research/` y `specs/` del commit `becbcdc0aaaace4f9b98006ae44e0449795c001a`. Sus referencias a implementación histórica no describen necesariamente este motor. El alcance actual se documenta en [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Jugar en tu equipo

Necesitas Node.js 22.12 o posterior y un navegador con WebGL2. Las comprobaciones usan Node 24.

```bash
git clone https://github.com/oxalc88/futbol-excitante.git
cd futbol-excitante
npm ci
npm run dev
```

Abre la dirección que imprima Vite, elige equipos, modo y duración y pulsa **Jugar partido**. La CPU se calcula dentro del juego; no necesitas cuentas ni servicios externos.

- **Tú contra la CPU:** teclado, mando estándar o mando táctil en pantalla.
- **Dos jugadores locales:** dos mandos o teclado compartido con teclado numérico.
- **CPU contra CPU:** partido autónomo.
- **Repeticiones:** guarda un partido desde Estadísticas y carga el JSON desde el menú. Se reproduce el estado inicial y sus inputs, verificando el hash final. Los replays v2 requieren esta versión del motor; los antiguos v1 se rechazan.
- **Equipos propios:** descarga el ejemplo desde Plan de juego, edita sus capacidades ficticias e importa el JSON. Los arquetipos separan aceleración, velocidad, fuerza, equilibrio, control, golpeo, cabeceo y salto.
- **Táctica:** formación, presión, contra presión, amplitud, ritmo, apoyo, compactación, línea defensiva, pases cortos, marcaje y adaptación. Los cambios durante el partido se registran como inputs con tick.

Los partidos incluyen penaltis por faltas en el área, tarjetas, expulsión por segunda amarilla, ventaja y su devolución, fuera de juego con intervención, bandas, córners, saques de meta y tiros libres. El modelo arbitral es una aproximación explícita para este juego, no una implementación certificada de todas las leyes IFAB.

## Controles

| Acción | Jugador 1 | Jugador 2 | Xbox / PlayStation estándar |
|---|---|---|---|
| Mover | WASD | Flechas | Stick izquierdo |
| Apuntar independientemente | Dirección de movimiento | Dirección de movimiento | Stick derecho |
| Pase | J | Num 1 | A / ✕ |
| Tiro: mantener y soltar | K | Num 2 | B / ○ |
| Pase filtrado | L | Num 3 | Y / △ |
| Pase elevado | H | Num 4 | LB + A / L1 + ✕ |
| Centro | I | Num 5 | X / □ |
| Entrada de pie | U | Num 0 | RB / R1 |
| Entrada deslizante | B | Num 7 | LT + RB / L2 + R1 |
| Cabecear | O | Num 6 | RT / R2 |
| Correr | Shift izquierdo | Shift derecho | LT / L2 |
| Cambiar jugador | Q | Enter | LB / L1 |
| Proteger balón | Espacio | Num . | L3 |
| Pausa | P / Esc | — | Start / Options |
| Cámara | C | — | Botón en pantalla |

Pulsa un botón del mando para que el navegador lo detecte. El adaptador mantiene la identidad de los dos slots al desconectar un mando y suprime acciones que ya estaban pulsadas al reconectar. Las pruebas usan lecturas simuladas; la compatibilidad física depende del modelo, sistema operativo y navegador.

El mando táctil imita un mando PS: stick flotante en el 40 % izquierdo (aparece donde apoyas el pulgar, con zona muerta), ✕ ○ □ △ redondos a la derecha con una palabra que cambia en ataque, defensa y con el arquero con el balón, y R1 (correr), R2 y L1 (cambiar). Usa el mismo mapeo PS que el mando físico: □ tiro, ○ centro, ✕ pase, △ filtrado. Mantén para cargar y suelta para ejecutar; levantar el dedo en cualquier punto, también fuera del botón, ejecuta la acción. Deslizar el dedo a otro botón lo suma (amago). Aparece solo tras un toque real o con puntero táctil y se oculta al usar teclado o mando; nunca depende del tamaño de la ventana. En vertical pide girar el teléfono. En un saque humano, apunta y pulsa pase o tiro; al agotarse seis segundos se ejecuta automáticamente. Los penaltis siempre se lanzan hacia la portería rival.

## Laboratorio y evaluación

Abre `/lab.html` en el mismo servidor local. Permite seleccionar cualquiera de los 69 IDs conservados, semilla y variante, reiniciar, avanzar uno o 60 ticks y exportar el estado, hash, cámara y envíos al render. Usa el mismo motor y escenarios que la evaluación headless.

```bash
npm run typecheck
npm test
npm run evaluate
npm run build
```

`scripts/verify.sh` ejecuta todas estas comprobaciones y una prueba de humo en Chrome/Chromium headless (`scripts/smoke-browser.mjs`). Devuelve un resumen PASS/FAIL por comprobación.

`npm run evaluate` ejecuta 276 casos —69 IDs × dos variantes × dos semillas— y tres partidos CPU de seis minutos. Genera `artifacts/evaluation.json`, con veredictos **por criterio**, métricas, eventos, hashes, bindings, pruebas negativas del evaluador y límites de evidencia.

```bash
# Un caso y el cierre de sus dependencias de regresión
npm run evaluate -- --test=BALL-IND-001
# Guardar también observaciones completas por tick, comprimidas
npm run evaluate:traces
# Importar una medición real, sin aplicar cambios al motor
npm run reference:import -- /ruta/a/referencia.json
```

La base de regresión de `eval/baseline.json` es un perfil **provisional de este motor**. No es una referencia PES. El evaluador rechaza cambios al oráculo protegido sin revisión de esa base. [EVALUATION.md](EVALUATION.md) explica contratos, observaciones, importación, criterios y reproducción manual.

## Pendiente de evidencia externa

- Revisión visual y de jugabilidad: el navegador de trabajo bloqueó la URL de vista local por política del entorno. No se afirma haber visto el juego funcionando en ese navegador.
- Pruebas en un iPhone real y con dos mandos físicos. La validación del adaptador con lecturas simuladas no sustituye esas pruebas.
- Corpus PES 2017 medido y revisión perceptual. Los documentos preservados no contienen esos datos; no se inventaron objetivos ni una calificación de fidelidad.

## Online y publicación: siguiente etapa

El botón online está oculto y desactivado. El prototipo de red anterior queda archivado en su adaptador y no recibe trabajo ni validación en esta etapa.

El workflow `.github/workflows/ci.yml` se llama **CI — tests, evaluation and build** y se ejecuta en `push` a `main` y en pull requests hacia `main`. Sólo instala dependencias, prueba, evalúa, compila y guarda artefactos. **No tiene job de despliegue ni permisos de Pages.** Subir commits a `main` no publica el juego.

### Preparar archivos estáticos

```bash
npm run build
npm run check:dist
npm run preview
```

`dist/` contiene sólo el juego (`index.html`) y sus recursos con rutas relativas. Se excluyen el laboratorio, medios y datos de investigación o evaluación. El control usa una allowlist: only .html, .js, .css. Rechaza también mapas de código y archivos demasiado grandes; imprime los tamaños. Usa un servidor HTTP, no `file://`.

Para incluir el laboratorio localmente: `npm run build:lab`, `npm run check:dist -- --allow-lab` y `npm run preview`. `npm run dev` también sirve `/lab.html`. La verificación completa termina con un build que incluye el laboratorio para la prueba de navegador: después vuelve a ejecutar `npm run build` y `npm run check:dist` para preparar la distribución pública.

Antes de cualquier publicación:

- Rolando elige el alojamiento y se añade expresamente un workflow de despliegue.
- Ejecutar `scripts/verify.sh` y obtener todos los pasos PASS.
- Regenerar el build público y pasar `npm run check:dist`, sin laboratorio ni medios de PES.
- Probar las rutas relativas en el alojamiento elegido, también bajo una subruta.
- Usar HTTPS y revisar licencias y recursos de terceros.

Estos comandos preparan archivos; no publican el juego.
