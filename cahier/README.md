# Cahier — ortografía en español y francés en 30 días

App web sin servidor ni build: abre `index.html` en el navegador y funciona.
El progreso se guarda en el `localStorage` del navegador.

## Dos cuadernos separados

| | Ortografía (español) | Francés |
|---|---|---|
| Niveles | Básico · Intermedio · Avanzado | A0 · A1 · A2 · B1 |
| Unidades | 14 (b/v, h, tildes, diacríticas, por qué/porque, homófonos…) | 16 (saludos → subjuntivo) |
| Minijuegos | Elige la forma, ¿Qué falta?, Caza el error, Dictado, ¿Dónde va la tilde? | Traduce, Escucha y elige, Parejas, Completa, Ordena la frase, Escribe |

## Cómo arma el plan

1. **Prueba de nivel** (12 preguntas, ~3 min). Va de fácil a difícil por niveles
   y se detiene cuando un nivel falla; tiene «No lo sé» para no adivinar.
2. **Plan de 30 días** desde la unidad de su nivel: cada unidad son 2 días
   (Aprende + Practica); los días 7, 14 y 21 son repaso semanal; las unidades
   anteriores a su nivel entran al final como refuerzo; el día 30 repite la
   prueba inicial y muestra la diferencia.
3. **Repetición espaciada** (cajas de Leitner): cada error vuelve en la
   siguiente lección y los aciertos se espacian 1, 2, 4, 7 y 12 sesiones.
   Además, lo que se falla dentro de una lección se repite al final.
4. **Motivación**: XP, meta diaria, racha, combos, estrellas por día y un
   modo Contrarreloj de 60 segundos con récord.

## Archivos

- `index.html` — estilos y contenedor.
- `contenido.js` — todo el contenido didáctico (unidades y prueba de nivel). Para
  añadir una unidad basta con agregar un objeto a `FR` o `ES`.
- `app.js` — motor: prueba, plan, repetición espaciada y minijuegos.

La voz (escuchar y dictado) usa la síntesis de voz del navegador; si no existe,
esos ejercicios se cambian por otros automáticamente.
