const WIDTH = 1900;
const HEIGHT = 1000;
const BACKGROUND_COLOR = "#0000009a";
const SCALE = window.innerWidth <= 600 ? 15 : 25;
const Y_OFFSET = -30;


const WORDS = ["i love you", "I LOVE YOU", "love you"];
const CENTER_TEXT = "Te Amo MI Cachetona";
const COLORS = [
  "rgb(35, 127, 255)",
  "rgb(45, 244, 255)",
  "rgb(45, 80, 255)",
  "rgb(90, 252, 255)",
  "rgb(60, 60, 255)"
];

const OUTLINE_FONT_SIZE = 20;
const FILL_FONT_SIZE = 17;
const CENTER_FONT_SIZE =
    window.innerWidth <= 600 ? 32 : 54;
const OUTLINE_FONT_FAMILY = "Arial, sans-serif";
const FILL_FONT_FAMILY = "Arial, sans-serif";
const CENTER_FONT_FAMILY = "Georgia, serif";

// ---- Helpers ----
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randUniform(min, max) {
  return Math.random() * (max - min) + min;
}
function randInt(min, max) {
  // inclusive, like python's random.randint
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Parametric heart curve (same formula as heart_xy in the Python version)
function heartXY(t) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y =
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t);
  return [x, -y];
}

function toScreen(x, y) {
  return [x * SCALE + WIDTH / 2, y * SCALE + HEIGHT / 2 + Y_OFFSET];
}

// ---- Particle ----
class Particle {
  constructor(x, y, order, kind) {
    this.x = x;
    this.y = y;
    this.order = order;
    this.kind = kind; // "outline" | "fill"
    this.word = randomChoice(WORDS);
    this.color = randomChoice(COLORS);
    this.alpha = 0;
    this.flicker = randUniform(0, Math.PI * 2);
    this.fontSize = kind === "outline" ? OUTLINE_FONT_SIZE : FILL_FONT_SIZE;
    this.fontFamily =
      kind === "outline" ? OUTLINE_FONT_FAMILY : FILL_FONT_FAMILY;
    this.delay = 0;
    this.sizeMult = randUniform(0.85, 1.15);
  }
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function buildOutlineParticles(nOutline, minGap = 34) {
  const particles = [];
  const placed = [];
  for (let i = 0; i < nOutline; i++) {
    const t = (i / nOutline) * 2 * Math.PI;
    const [bx, by] = heartXY(t);
    const [sx, sy] = toScreen(bx, by);
    if (placed.some(([px, py]) => distance(sx, sy, px, py) < minGap)) {
      continue;
    }
    placed.push([sx, sy]);
    particles.push(new Particle(sx, sy, i, "outline"));
  }
  return particles;
}

function buildFillParticles(nFill, minGap = 46) {
  const particles = [];
  const placed = [];
  let attempts = 0;
  const maxAttempts = nFill * 80;

  while (particles.length < nFill && attempts < maxAttempts) {
    attempts++;
    const t = randUniform(0, 2 * Math.PI);
    const r = randUniform(0.0, 0.86);
    const [bx, by] = heartXY(t);
    const px0 = bx * r;
    const py0 = by * r;
    const [sx, sy] = toScreen(px0, py0);

    if (placed.some(([qx, qy]) => distance(sx, sy, qx, qy) < minGap)) {
      continue;
    }

    placed.push([sx, sy]);
    particles.push(new Particle(sx, sy, randInt(0, 320), "fill"));
  }

  return particles;
}

// ---- Drawing ----
// Approximates the Python version's layered glow (big/small scaled blits)
// using canvas shadowBlur, which gives a comparable soft-glow result.
function drawGlowText(ctx, particle, alpha) {
  if (alpha <= 0) return;

  const size = Math.round(particle.fontSize * particle.sizeMult);
  ctx.save();
  ctx.font = `bold ${size}px ${particle.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = particle.color;

  if (alpha > 10) {
    // wide, faint halo (mirrors glow_big, alpha // 7)
    ctx.globalAlpha = (alpha / 255) * (1 / 7);
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = size * 1.4;
    ctx.fillText(particle.word, particle.x, particle.y);

    // tighter, stronger halo (mirrors glow_small, alpha // 3)
    ctx.globalAlpha = (alpha / 255) * (1 / 3);
    ctx.shadowBlur = size * 0.6;
    ctx.fillText(particle.word, particle.x, particle.y);
  }

  // crisp text on top, no shadow
  ctx.shadowBlur = 0;
  ctx.globalAlpha = alpha / 255;
  ctx.fillText(particle.word, particle.x, particle.y);
  ctx.restore();
}

function drawCenterText(ctx, frame, centerStart) {
  if (frame <= centerStart) return;

  const progress = Math.min(1.0, (frame - centerStart) / 60);
  const centerAlpha = 255 * (1 - Math.exp(-progress * 8));
  const pulse = 1.0 + 0.025 * Math.sin(frame * 0.05);
  const size = Math.round(CENTER_FONT_SIZE * pulse);

  ctx.save();
  ctx.font = `bold ${size}px ${CENTER_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgb(136, 49, 142)";

  if (centerAlpha > 10) {
    ctx.globalAlpha = (centerAlpha / 255) * (1 / 5);
    ctx.shadowColor = "rgb(223, 6, 252)";
    ctx.shadowBlur = size * 0.8;
    ctx.fillText(CENTER_TEXT, WIDTH / 2, HEIGHT / 2);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = centerAlpha / 255;
  ctx.fillText(CENTER_TEXT, WIDTH / 2, HEIGHT / 2);
  ctx.restore();
}

// ---- Main ----
function main() {
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");

  const outline = buildOutlineParticles(160);
  const fill = buildFillParticles(130);

  const outlineSpan =
    outline.length > 0 ? Math.max(...outline.map((p) => p.order)) : 0;
  const framesPerStep = 1.6;
  const fillStartFrame = Math.floor(outlineSpan * framesPerStep) + 30;

  for (const p of fill) {
    p.delay = fillStartFrame + p.order;
  }
  for (const p of outline) {
    p.delay = Math.floor(p.order * framesPerStep);
  }

  const particles = outline.concat(fill);
  const centerStart = fillStartFrame + 200;

  let frame = 0;

  function tick() {
    frame++;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    for (const p of particles) {
      if (frame > p.delay && p.alpha < 255) {
        p.alpha = Math.min(255, p.alpha + 14 + randInt(0, 4));
      }

      let flick;
      if (p.alpha >= 255) {
        flick = 0.75 + 0.25 * Math.sin(frame * 0.04 + p.flicker);
      } else {
        flick = 1.0;
      }

      const alpha = Math.floor(p.alpha * flick);
      if (alpha <= 0) continue;

      drawGlowText(ctx, p, alpha);
    }

    drawCenterText(ctx, frame, centerStart);

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

window.addEventListener("load", main);
// ======================================
// MÚSICA DE FONDO
// ======================================

const musica = document.getElementById("musica");
const botonMusica = document.getElementById("botonMusica");
const botonAnterior = document.getElementById("botonAnterior");
const botonSiguiente = document.getElementById("botonSiguiente");

// AQUÍ ELIGES EL ORDEN DE LAS CANCIONES
const canciones = [
    "miusic/oiel canela.mp3",
    "miusic/hasta donde te quiero.mp3",
    "miusic/cancion 1.mp3"
];

// Volumen: 0.0 = silencio
//          0.5 = 50%
//          1.0 = volumen máximo
musica.volume = 0.5;

let cancionActual = 0;


// Cargar la primera canción
function cargarCancion() {
    musica.src = canciones[cancionActual];
    musica.load();
}


// Reproducir la siguiente canción
function siguienteCancion() {

    cancionActual++;

    // Si llega al final, vuelve a la primera
    if (cancionActual >= canciones.length) {
        cancionActual = 0;
    }

    cargarCancion();
    musica.play();
}



// Cuando una canción termina,
// automáticamente comienza la siguiente
musica.addEventListener("ended", siguienteCancion);


// Botón para iniciar la música
botonMusica.addEventListener("click", () => {

    if (musica.paused) {

        musica.play();

        document.getElementById("iconoMusica").textContent = "🔊";
        document.getElementById("textoMusica").textContent = "Pausar música";

        crearNotasMusicales();

    } else {

        musica.pause();

        document.getElementById("iconoMusica").textContent = "▶";
        document.getElementById("textoMusica").textContent = "Continuar música";

    }

});botonAnterior.addEventListener("click", () => {

    cancionActual--;

    if (cancionActual < 0) {
        cancionActual = canciones.length - 1;
    }

    cargarCancion();

    musica.play();

    document.getElementById("iconoMusica").textContent = "🔊";
    document.getElementById("textoMusica").textContent = "Pausar música";

    crearNotasMusicales();

});
botonSiguiente.addEventListener("click", () => {

    cancionActual++;

    if (cancionActual >= canciones.length) {
        cancionActual = 0;
    }

    cargarCancion();

    musica.play();

    document.getElementById("iconoMusica").textContent = "🔊";
    document.getElementById("textoMusica").textContent = "Pausar música";

    crearNotasMusicales();

});


// Cargar la primera canción
cargarCancion();
// ======================================
// VISOR DE IMÁGENES
// ======================================

const visorImagen = document.getElementById("visorImagen");
const imagenGrande = document.getElementById("imagenGrande");


// Buscar todas las imágenes de las columnas
const imagenesColumnas = document.querySelectorAll(
    ".columna .imagenes img"
);


// Cuando se hace clic en una imagen
imagenesColumnas.forEach((imagen) => {

    imagen.addEventListener("click", () => {

        // Copiar la imagen seleccionada
        imagenGrande.src = imagen.src;

        // Mostrar el visor
        visorImagen.style.display = "flex";

    });

});


// Cerrar cuando se haga clic FUERA de la imagen
visorImagen.addEventListener("click", (evento) => {

    if (evento.target === visorImagen) {

        visorImagen.style.display = "none";

        imagenGrande.src = "";

    }

});