# Contrato de implementación local v2

## Fuentes y límites

`VISION.md`, los siete documentos de `research/` y los seis de `specs/` se mantienen byte a byte. La base es `becbcdc0aaaace4f9b98006ae44e0449795c001a`. No se reutilizó la implementación histórica.

El programa de investigación distingue comportamiento, hipótesis causales, objetivos de diseño y evidencia perceptual. Esta etapa implementa mecánicas locales y herramientas de evaluación, pero no declara promoción de los hitos normativos ni equivalencia con PES 2017.

## Motor y contratos

`world-v2`, `replay-v2`, `vision-rebuild-config-v2`; SI, dt = 1/60 s y cuatro subpasos de balón. Xorshift32 serializado; hash canónico FNV-1a para diagnóstico, no seguridad criptográfica. Configuración, RNG, inputs futuros, fases, acciones, contactos, memoria táctica, ventaja, tarjetas pendientes, posesión del portero y restricciones de saque están en el checkpoint.

El core no importa DOM, Three.js, red, archivos ni reloj real. El mismo scheduler sirve al partido, al replay, al laboratorio y a las pruebas headless. Los adaptadores no alteran el estado autoritativo. Las capturas están separadas por copia.

Orden por tick: comandos → reglas pendientes → posesión e interferencia → decisiones tácticas → intenciones → preparación → locomoción → cuerpos → entradas activas → golpeos → balón subpasado → postes/límites/contactos → hechos derivados → reloj. Los contactos compiten por tiempo de barrido, distancia e ID estable. El contacto con poste modifica el recorrido antes de comprobar el límite. Las reposiciones son discontinuidades explícitas.

## Mecánicas locales

| Sistema | Comportamiento |
|---|---|
| Locomoción | Aceleración, frenado, orientación independiente de velocidad, pérdida de velocidad al girar, energía, recuperación |
| Balón | Rodadura, gravedad, arrastre, restitución, spin y curvatura; impulso inicial sin homing |
| Cuerpo | Separación ponderada por masa, intercambio de velocidad, estabilidad y tropiezo; proteger cambia resistencia y dirección de toque |
| Recepción | Control contextual según velocidad, orientación, presión, capacidad y lado de pie; microcontactos de conducción |
| Acciones | Pase, filtrado, elevado, centro, tiro cargado, cabezazo, entrada de pie y deslizante; preparación/contacto/recuperación observables |
| Individualidad | Capacidades separadas de velocidad/aceleración, fuerza/equilibrio, potencia/técnica, cabeceo/salto; equipos ficticios reemplazables |
| Portero | Arco pequeño en 2v2/5v5; área de movimiento mayor en 11v11; reacción, visibilidad, reversión por inercia, pie/mano, blocada/despeje, recuperación y distribución |
| Táctica | Formación, perseguidor con histéresis, cobertura, apoyos, desmarques, línea, amplitud, compactación, contra presión temporal y retorno a estructura |
| Adaptación | Memoria de contactos y bandas observadas con decaimiento; prioridad de marca y desplazamiento del bloque, siempre serializados |
| Presentación | Cancha, kits, figuras articuladas, animaciones de golpeo/entrada/cabeceo/portero, radar, tres cámaras, HUD, estadísticas, sonido opcional |
| Controles | Teclado, dos mandos estándar, stick derecho para apuntar, botones táctiles completos, tiro cargado, pausa y neutralización al perder foco |

## Reglas experimentales v2

El perfil se inspira en las leyes actuales de [fuera de juego](https://www.theifab.com/laws/latest/offside/), [faltas y sanciones](https://www.theifab.com/laws/latest/fouls-and-misconduct/) y [penalti](https://www.theifab.com/laws/latest/the-penalty-kick/), consultadas el 6 de septiembre de 2026. Las decisiones geométricas y umbrales del juego son aproximaciones declaradas:

- Una falta en el área defensora da penalti; fuera del área, tiro libre. Entradas deslizantes imprudentes o de velocidad excesiva pueden recibir amarilla o roja. Segunda amarilla expulsa. Los expulsados conservan identidad en el estado, pero dejan de intervenir, aparecer o recibir control. En 11v11, menos de siete jugadores termina el partido; los modos pequeños usan un mínimo de dos.
- La ventaja se mantiene durante una ventana finita si hay continuación favorable. Se devuelve al punto original si se pierde la ventaja; las tarjetas se muestran al detenerse el juego. Un gol del equipo beneficiado la consume.
- El fuera de juego guarda candidatos al contacto de pase o tiro; exige intervención al jugar o disputar el balón, o interferencia cercana en la línea de visión del portero. Una parada o desvío no borra automáticamente la posición previa. Un juego deliberado rival la puede borrar. Hay excepción de recepción directa de banda, córner y saque de meta. Las posiciones usan centros físicos y márgenes, no una reconstrucción de cada extremidad para arbitraje.
- Las manos del portero están limitadas al área. Se prohíbe blocar una cesión deliberada con el pie, un saque de banda propio directo y su propia distribución sin otro contacto. Una blocada detiene el balón en el punto de contacto; el portero permanece allí hasta distribuir. No se teletransporta el balón a una mano. Ocho segundos de posesión de manos dan córner rival; la distribución normal ocurre antes.
- Los saques humanos aceptan dirección y acción y tienen ejecución automática de respaldo. En el penalti, el guardameta empieza sobre la línea y el resto queda fuera del área y detrás del punto. Se detecta segundo toque del sacador. Un tiro indirecto o una banda directos no pueden dar gol sin otro contacto; un saque directo a portería propia da córner.
- Se usan dos mitades de tiempo efectivo escaladas a 45 minutos mostrados. No hay prórroga, tandas de desempate ni añadido. No se simulan árbitro humano, VAR, protestas, sustituciones, lesiones médicas, manos intencionadas de jugadores de campo o todos los protocolos disciplinarios. No se afirma reglamento completo certificado.

## Representación y cámara

`procedural-rig-v2` declara unidades, superficies, alcances y longitudes. El solucionador de dos segmentos preserva longitudes y lleva el extremo al contacto factible; los objetivos imposibles se rechazan. El portero distingue extensión, recuperación y posesión. La representación sigue siendo estilizada y necesita revisión de fotogramas para comprobar deslizamientos, contacto de cabeza y legibilidad.

`camera-rig-v2` integra en ticks y no en frecuencia de dibujo. Cambiar cámara o calidad no altera el motor. El acumulador del juego recupera hasta seis pasos por frame; al perder visibilidad se pausa. El laboratorio separa reset, step, capture y registro de envío al render. Enviar un render no demuestra que el contacto sea visualmente correcto ni mide latencia física.

## Evaluación y estado real

Hay 69 IDs materializados como escenarios diagnósticos ejecutables con variantes, dos semillas, observaciones, métricas, bindings por criterio y cierre de impacto. Los oráculos protegidos verifican propiedades locales; controles negativos corrompen trazas para comprobar que se detectan teletransportes, impulsos sin contacto y cabezazos fuera de alcance. La base congelada pertenece a este motor provisional.

Esto no convierte las descripciones de investigación en evidencia PES. Las métricas instrumentadas están enumeradas en el reporte y en `eval/reference.ts`; las comparaciones perceptuales y causales sin datos permanecen abiertas. No hay un resultado global de fidelidad ni una promoción automática de milestone.

La vista local fue bloqueada por la política de URL del navegador de trabajo. Las pruebas de `BrowserTestSession` verifican el adaptador sin GPU, no una sesión visual real. Tampoco se verificaron iPhone físico, mandos físicos ni juicio humano ciego. [EVALUATION.md](EVALUATION.md) deja el procedimiento para recoger esa evidencia.

Online y publicación se difieren por decisión del usuario. El workflow sólo prueba, evalúa y compila; no despliega.
