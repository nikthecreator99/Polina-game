// Вся отрисовка мира кодом. Фон — в scenery.js (кэшированные слои с параллаксом).
// Персонажи и предметы рисуются мягкими формами с градиентами, чтобы был объём.
import { TILE } from './levels.js';
import { drawScenery, hash } from './scenery.js';

export { drawVignette, setRenderScale } from './scenery.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawBackground(ctx, theme, cx, dy, W, H, t) {
  drawScenery(ctx, cx, dy, W, t);
}

// Мягкая тень под персонажем/предметом.
export function drawShadow(ctx, x, y, w, alpha = 0.28) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, w);
  g.addColorStop(0, `rgba(30, 40, 10, ${alpha})`);
  g.addColorStop(1, 'rgba(30, 40, 10, 0)');
  ctx.fillStyle = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.28);
  ctx.translate(-x, -y);
  ctx.beginPath();
  ctx.arc(x, y, w, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------- Тайлы ----------------

const isGround = (c) => c === '#';

export function drawTiles(ctx, L, cx, cy, W, H, t) {
  const x0 = Math.max(0, Math.floor(cx / TILE) - 1);
  const x1 = Math.min(L.w - 1, Math.ceil((cx + W) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(cy / TILE) - 1);
  const y1 = Math.min(L.h - 1, Math.ceil((cy + H) / TILE) + 1);
  const at = (x, y) => (x < 0 || x >= L.w || y < 0 || y >= L.h ? ' ' : L.tiles[y][x]);

  // Овраги: тёмная яма там, где внизу нет земли.
  for (let x = x0; x <= x1; x++) {
    if (!isGround(L.tiles[L.h - 1][x])) {
      const gy = (L.h - 2) * TILE;
      const g = ctx.createLinearGradient(0, gy, 0, gy + 200);
      g.addColorStop(0, '#3b2a1c');
      g.addColorStop(1, '#120c07');
      ctx.fillStyle = g;
      ctx.fillRect(x * TILE - 1, gy + 12, TILE + 2, 400);
    }
  }

  // Земля: сплошная масса с градиентом по глубине.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!isGround(at(x, y))) continue;
      const px = x * TILE;
      const py = y * TILE;
      const g = ctx.createLinearGradient(0, py, 0, py + TILE);
      const d = Math.min(1, (y - topOf(L, x, y)) / 3);
      g.addColorStop(0, mix('#9a6a3e', '#6e4626', d));
      g.addColorStop(1, mix('#8a5d35', '#5e3b20', Math.min(1, d + 0.33)));
      ctx.fillStyle = g;
      ctx.fillRect(px - 0.5, py - 0.5, TILE + 1, TILE + 1);
      // камушки
      const h1 = hash(x * 13 + y * 7);
      if (h1 > 0.35) {
        ctx.fillStyle = 'rgba(60, 35, 15, .35)';
        ctx.beginPath();
        ctx.ellipse(px + 10 + h1 * 26, py + 18 + h1 * 18, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 230, 200, .12)';
        ctx.beginPath();
        ctx.ellipse(px + 9 + h1 * 26, py + 17 + h1 * 18, 2.5, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // торцы обрыва: тень и скругление
      if (!isGround(at(x - 1, y))) edge(ctx, px, py, 1, !isGround(at(x, y - 1)));
      if (!isGround(at(x + 1, y))) edge(ctx, px + TILE, py, -1, !isGround(at(x, y - 1)));
    }
  }

  // Травяная шапка по каждому непрерывному куску поверхности.
  for (let y = y0; y <= y1; y++) {
    let x = x0;
    while (x <= x1) {
      if (isGround(at(x, y)) && !isGround(at(x, y - 1))) {
        let e = x;
        while (e + 1 < L.w && isGround(at(e + 1, y)) && !isGround(at(e + 1, y - 1))) e++;
        let s = x;
        while (s - 1 >= 0 && isGround(at(s - 1, y)) && !isGround(at(s - 1, y - 1))) s--;
        grassCap(ctx, s * TILE, (e + 1) * TILE, y * TILE, !isGround(at(s - 1, y)), !isGround(at(e + 1, y)));
        x = e + 1;
      } else x++;
    }
  }

  // Доски-платформы и ящики.
  for (let y = y0; y <= y1; y++) {
    let x = x0;
    while (x <= x1) {
      const c = at(x, y);
      if (c === '=') {
        let s = x;
        while (at(s - 1, y) === '=') s--;
        let e = x;
        while (at(e + 1, y) === '=') e++;
        plank(ctx, s * TILE, (e + 1) * TILE, y * TILE);
        x = e + 1;
        continue;
      }
      if (c === 'B') crate(ctx, x * TILE, y * TILE, at(x, y + 1) !== 'B');
      else if (c === '~') puddle(ctx, x * TILE, y * TILE, t);
      x++;
    }
  }
}

function topOf(L, x, y) {
  let t = y;
  while (t > 0 && L.tiles[t - 1][x] === '#') t--;
  return t;
}

function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function edge(ctx, x, y, dir, top) {
  const g = ctx.createLinearGradient(x, 0, x + dir * 14, 0);
  g.addColorStop(0, 'rgba(40, 22, 8, .55)');
  g.addColorStop(1, 'rgba(40, 22, 8, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(x, x + dir * 14), y + (top ? 10 : 0), 14, TILE - (top ? 10 : 0));
}

function grassCap(ctx, x0, x1, y, roundL, roundR) {
  const left = x0 - (roundL ? 3 : 0);
  const right = x1 + (roundR ? 3 : 0);
  // тень под травой
  ctx.fillStyle = 'rgba(40, 25, 10, .25)';
  ctx.fillRect(x0, y + 14, x1 - x0, 6);
  const g = ctx.createLinearGradient(0, y - 6, 0, y + 18);
  g.addColorStop(0, '#9be36a');
  g.addColorStop(0.45, '#6cc04a');
  g.addColorStop(1, '#3f8f2f');
  ctx.fillStyle = g;
  ctx.beginPath();
  const r = 10;
  ctx.moveTo(left + (roundL ? r : 0), y - 5);
  ctx.lineTo(right - (roundR ? r : 0), y - 5);
  if (roundR) ctx.quadraticCurveTo(right, y - 5, right, y + 5);
  else ctx.lineTo(right, y - 5);
  // волнистый нижний край
  ctx.lineTo(right, y + 12);
  for (let x = right; x > left; x -= 12) {
    ctx.quadraticCurveTo(x - 6, y + 22, Math.max(left, x - 12), y + 14);
  }
  ctx.lineTo(left, y + 5);
  if (roundL) ctx.quadraticCurveTo(left, y - 5, left + r, y - 5);
  ctx.closePath();
  ctx.fill();
  // блик и травинки
  ctx.fillStyle = 'rgba(255, 255, 210, .35)';
  ctx.fillRect(left + 8, y - 3, right - left - 16, 2.5);
  ctx.fillStyle = '#7fd055';
  for (let x = x0 + 5; x < x1 - 4; x += 9) {
    const h = 4 + hash(x) * 6;
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y - 3);
    ctx.quadraticCurveTo(x + 1, y - 3 - h, x + 2 + hash(x + 1) * 3, y - 4 - h);
    ctx.quadraticCurveTo(x + 1, y - 3, x + 2.5, y - 3);
    ctx.fill();
  }
}

function plank(ctx, x0, x1, y) {
  const w = x1 - x0;
  // тень на фоне
  ctx.fillStyle = 'rgba(30, 30, 10, .18)';
  rr(ctx, x0 + 4, y + 8, w, 18, 9);
  ctx.fill();
  // опоры
  for (const sx of [x0 + 10, x1 - 16]) {
    ctx.fillStyle = '#6b4626';
    ctx.fillRect(sx, y + 14, 6, 14);
  }
  const g = ctx.createLinearGradient(0, y, 0, y + 20);
  g.addColorStop(0, '#d9a066');
  g.addColorStop(0.5, '#b47a42');
  g.addColorStop(1, '#7d5129');
  ctx.fillStyle = g;
  rr(ctx, x0, y, w, 20, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 45, 15, .4)';
  ctx.lineWidth = 1.5;
  for (let x = x0 + TILE; x < x1; x += TILE) {
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, y + 17);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 240, 210, .45)';
  rr(ctx, x0 + 6, y + 3, w - 12, 3, 1.5);
  ctx.fill();
}

function crate(ctx, px, py, onGround) {
  const x = px + 2;
  const y = py + 2;
  const s = TILE - 4;
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, '#e2ad6c');
  g.addColorStop(1, '#a8703a');
  ctx.fillStyle = '#6e451f';
  rr(ctx, x, y, s, s, 7);
  ctx.fill();
  ctx.fillStyle = g;
  rr(ctx, x + 4, y + 4, s - 8, s - 8, 4);
  ctx.fill();
  ctx.strokeStyle = '#7d4f24';
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 9, y + 9);
  ctx.lineTo(x + s - 9, y + s - 9);
  ctx.moveTo(x + s - 9, y + 9);
  ctx.lineTo(x + 9, y + s - 9);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 245, 220, .35)';
  rr(ctx, x + 5, y + 5, s - 10, 3, 1.5);
  ctx.fill();
  ctx.lineCap = 'butt';
}

function puddle(ctx, px, py, t) {
  const g = ctx.createLinearGradient(0, py + TILE - 14, 0, py + TILE);
  g.addColorStop(0, '#8fd3ff');
  g.addColorStop(1, '#3a8fd0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2, py + TILE - 5, TILE / 2 + 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath();
  ctx.ellipse(px + 16 + Math.sin(t * 2 + px) * 4, py + TILE - 8, 7, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- Предметы ----------------

export function drawCoin(ctx, x, y, t) {
  const k = Math.cos(t * 3);
  const w = Math.max(1.5, 13 * Math.abs(k));
  const rim = ctx.createLinearGradient(x - w, y - 13, x + w, y + 13);
  rim.addColorStop(0, '#ffe08a');
  rim.addColorStop(1, '#b8740c');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(x, y, w, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createRadialGradient(x - w * 0.3, y - 5, 1, x, y, 11);
  face.addColorStop(0, '#fff3b8');
  face.addColorStop(0.5, '#f7c948');
  face.addColorStop(1, '#d99a1c');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1, w - 2.5), 10.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (w > 6) {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath();
    ctx.ellipse(x - w * 0.35, y - 4, w * 0.15, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawStone(ctx, x, y, r, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#9a948c';
  ctx.strokeStyle = '#5f5a54';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-r, -r * 0.2);
  ctx.lineTo(-r * 0.4, -r);
  ctx.lineTo(r * 0.6, -r * 0.8);
  ctx.lineTo(r, r * 0.1);
  ctx.lineTo(r * 0.5, r * 0.9);
  ctx.lineTo(-r * 0.6, r * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(-r * 0.3, -r * 0.6, r * 0.5, r * 0.25);
  ctx.restore();
}

export function drawSign(ctx, x, ground, active) {
  drawShadow(ctx, x, ground, 16, 0.25);
  ctx.fillStyle = '#7a5230';
  rr(ctx, x - 3, ground - 54, 6, 54, 3);
  ctx.fill();
  const g = ctx.createLinearGradient(0, ground - 74, 0, ground - 40);
  g.addColorStop(0, active ? '#ffd99a' : '#ecc187');
  g.addColorStop(1, active ? '#e2a75c' : '#c99456');
  ctx.fillStyle = '#7a5230';
  rr(ctx, x - 25, ground - 76, 50, 36, 9);
  ctx.fill();
  ctx.fillStyle = g;
  rr(ctx, x - 22, ground - 73, 44, 30, 7);
  ctx.fill();
  ctx.fillStyle = '#5a3a1e';
  ctx.font = '900 22px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('!', x, ground - 50);
}

export function drawCheckpoint(ctx, x, ground, active) {
  drawShadow(ctx, x, ground, 12, 0.25);
  ctx.fillStyle = '#8a8f96';
  rr(ctx, x - 2.5, ground - 82, 5, 82, 2.5);
  ctx.fill();
  ctx.fillStyle = active ? '#4caf50' : '#e5484d';
  ctx.beginPath();
  ctx.moveTo(x + 2, ground - 80);
  ctx.quadraticCurveTo(x + 20, ground - 76, x + 36, ground - 70);
  ctx.quadraticCurveTo(x + 20, ground - 64, x + 2, ground - 60);
  ctx.fill();
  ctx.fillStyle = '#f4c542';
  ctx.beginPath();
  ctx.arc(x, ground - 84, 4, 0, Math.PI * 2);
  ctx.fill();
}

// Финиш: станция «Зелёный».
export function drawStation(ctx, x, ground, t) {
  const bx = x + 90;
  drawShadow(ctx, bx + 110, ground - 14, 170, 0.3);
  // перрон
  const pg = ctx.createLinearGradient(0, ground - 20, 0, ground);
  pg.addColorStop(0, '#e1dbcf');
  pg.addColorStop(1, '#9f988b');
  ctx.fillStyle = pg;
  rr(ctx, x - 40, ground - 20, 380, 24, 6);
  ctx.fill();
  // здание
  const wg = ctx.createLinearGradient(bx, 0, bx + 200, 0);
  wg.addColorStop(0, '#9ccde0');
  wg.addColorStop(1, '#6a9fb5');
  ctx.fillStyle = wg;
  rr(ctx, bx, ground - 138, 200, 120, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.08)';
  ctx.lineWidth = 2;
  for (let k = 28; k < 134; k += 11) {
    ctx.beginPath();
    ctx.moveTo(bx + 3, ground - k);
    ctx.lineTo(bx + 197, ground - k);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(bx, ground - 138, 200, 9);
  ctx.fillStyle = '#4d6b78';
  ctx.strokeStyle = '#4d6b78';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(bx - 16, ground - 136);
  ctx.lineTo(bx + 100, ground - 194);
  ctx.lineTo(bx + 216, ground - 136);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const wx of [bx + 22, bx + 140]) {
    ctx.fillStyle = '#fbf7ef';
    rr(ctx, wx - 3, ground - 115, 44, 52, 5);
    ctx.fill();
    const gl = ctx.createLinearGradient(wx, ground - 110, wx + 38, ground - 68);
    gl.addColorStop(0, '#e6f6ff');
    gl.addColorStop(1, '#7fb6d6');
    ctx.fillStyle = gl;
    rr(ctx, wx + 2, ground - 110, 34, 42, 3);
    ctx.fill();
  }
  const dg = ctx.createLinearGradient(0, ground - 98, 0, ground - 18);
  dg.addColorStop(0, '#8a5a32');
  dg.addColorStop(1, '#5b3a1e');
  ctx.fillStyle = dg;
  rr(ctx, bx + 82, ground - 98, 38, 80, 5);
  ctx.fill();
  // табличка
  ctx.fillStyle = '#2b4c7e';
  rr(ctx, bx + 26, ground - 172, 148, 34, 7);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  rr(ctx, bx + 30, ground - 168, 140, 26, 5);
  ctx.fill();
  ctx.fillStyle = '#2b4c7e';
  ctx.font = '800 18px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ЗЕЛЁНЫЙ', bx + 100, ground - 148);
  // флажок финиша
  drawShadow(ctx, x, ground, 12, 0.25);
  ctx.fillStyle = '#6b7078';
  rr(ctx, x - 2.5, ground - 142, 5, 142, 2.5);
  ctx.fill();
  const wave = Math.sin(t * 5) * 4;
  const fg = ctx.createLinearGradient(x, 0, x + 50, 0);
  fg.addColorStop(0, '#f2655f');
  fg.addColorStop(1, '#c23a34');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(x + 3, ground - 140);
  ctx.quadraticCurveTo(x + 24, ground - 136 + wave, x + 50, ground - 128);
  ctx.quadraticCurveTo(x + 26, ground - 118 - wave, x + 3, ground - 112);
  ctx.fill();
}

// ---------------- Гусь ----------------

export function drawEnemy(ctx, e, t) {
  if (e.alive) drawShadow(ctx, e.x + e.w / 2, e.y + e.h, 22, 0.3);
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h);
  if (!e.alive) ctx.rotate(Math.PI * (1 - Math.max(0, e.dead) / 0.6));
  ctx.scale(e.dir > 0 ? 1 : -1, 1);
  const step = Math.sin(t * 12 + e.x * 0.1);
  const bob = Math.abs(step) * 1.5;
  // лапы
  ctx.strokeStyle = '#f08a24';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.lineTo(-4 + step * 4, -1);
  ctx.moveTo(4, -10);
  ctx.lineTo(4 - step * 4, -1);
  ctx.stroke();
  ctx.translate(0, -bob);
  // тело
  const bg = ctx.createRadialGradient(-6, -22, 2, -2, -16, 22);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.7, '#eef0f3');
  bg.addColorStop(1, '#c4c9d1');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-26, -24);
  ctx.quadraticCurveTo(-24, -6, -4, -6);
  ctx.quadraticCurveTo(14, -6, 16, -16);
  ctx.quadraticCurveTo(12, -28, -6, -27);
  ctx.quadraticCurveTo(-16, -27, -26, -24);
  ctx.fill();
  // крыло
  ctx.fillStyle = 'rgba(170, 178, 190, .55)';
  ctx.beginPath();
  ctx.moveTo(-18, -21);
  ctx.quadraticCurveTo(-4, -26, 6, -18);
  ctx.quadraticCurveTo(-6, -11, -18, -21);
  ctx.fill();
  // шея (вытянута вперёд — шипит)
  const neck = Math.sin(t * 6 + e.x) * 2;
  ctx.strokeStyle = '#f6f7f9';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(8, -20);
  ctx.quadraticCurveTo(20, -24, 18 + neck, -36);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(19 + neck, -37, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f08a24';
  ctx.beginPath();
  ctx.moveTo(23 + neck, -39.5);
  ctx.quadraticCurveTo(33 + neck, -38, 33 + neck, -36);
  ctx.quadraticCurveTo(28 + neck, -34, 23 + neck, -34.5);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(20.5 + neck, -38.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // сердитая бровь
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(18 + neck, -42.5);
  ctx.lineTo(23 + neck, -41);
  ctx.stroke();
  ctx.restore();
  ctx.lineCap = 'butt';
}

// ---------------- Героиня ----------------
// Рисуется от точки «под ногами» (x — центр, y — земля). h — рост в пикселях.
// Внешность по детским фото: тёмно-русые волнистые волосы до плеч, чёлка, карие глаза.

const SKIN = '#f7d5bd';
const SKIN_SHADE = '#e6b394';
const HAIR = '#6a4129';
const HAIR_LIGHT = '#9a6a45';

export function drawHeroine(ctx, o) {
  const { x, y, h, facing, running, airborne, anim, throwing, outfit } = o;
  const u = h / 64;
  if (o.shadowY !== undefined) drawShadow(ctx, x, o.shadowY, 18 * u, airborne ? 0.15 : 0.3);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const swing = running ? Math.sin(anim) : 0;
  const bob = running ? Math.abs(Math.cos(anim)) * 1.6 * u : 0;
  ctx.translate(0, -bob);
  const top = -h;

  // волосы сзади (длинные, волнистые)
  const hy = top + 14 * u;
  const hairBack = ctx.createLinearGradient(0, hy - 14 * u, 0, hy + 22 * u);
  hairBack.addColorStop(0, HAIR_LIGHT);
  hairBack.addColorStop(1, HAIR);
  ctx.fillStyle = hairBack;
  ctx.beginPath();
  ctx.moveTo(-12 * u, hy - 4 * u);
  ctx.quadraticCurveTo(-17 * u - swing * u, hy + 10 * u, -13 * u - swing * 1.5 * u, hy + 21 * u);
  ctx.quadraticCurveTo(-6 * u, hy + 24 * u, -2 * u, hy + 14 * u);
  ctx.lineTo(8 * u, hy + 8 * u);
  ctx.lineTo(10 * u, hy - 6 * u);
  ctx.closePath();
  ctx.fill();

  // ноги
  const legTop = top + 46 * u;
  const legLen = 16 * u;
  const l1 = airborne ? -0.5 : running ? swing * 0.65 : -0.1;
  const l2 = airborne ? 0.35 : running ? -swing * 0.65 : 0.1;
  const legs = [[l2, SKIN_SHADE], [l1, SKIN]];
  for (const [a, col] of legs) {
    const fx = Math.sin(a) * legLen;
    const fy = legTop + Math.cos(a) * legLen;
    ctx.strokeStyle = col;
    ctx.lineWidth = 6 * u;
    ctx.beginPath();
    ctx.moveTo(0, legTop);
    ctx.lineTo(fx, fy - 2.5 * u);
    ctx.stroke();
    const sg = ctx.createLinearGradient(0, fy - 5 * u, 0, fy + 1 * u);
    sg.addColorStop(0, lighten(outfit.shoes));
    sg.addColorStop(1, outfit.shoes);
    ctx.fillStyle = sg;
    rr(ctx, fx - 4 * u, fy - 5 * u, 11 * u, 6 * u, 3 * u);
    ctx.fill();
  }

  // дальняя рука
  ctx.strokeStyle = SKIN_SHADE;
  ctx.lineWidth = 4.5 * u;
  const shoulderY = top + 28 * u;
  ctx.beginPath();
  ctx.moveTo(-2 * u, shoulderY);
  ctx.lineTo(airborne ? -12 * u : -6 * u + swing * 6 * u, airborne ? shoulderY - 7 * u : shoulderY + 13 * u);
  ctx.stroke();

  // сарафан с объёмом
  const dg = ctx.createLinearGradient(-13 * u, 0, 13 * u, 0);
  dg.addColorStop(0, lighten(outfit.top));
  dg.addColorStop(0.55, outfit.top);
  dg.addColorStop(1, darken(outfit.top));
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(-6 * u, top + 25 * u);
  ctx.quadraticCurveTo(0, top + 23 * u, 6 * u, top + 25 * u);
  ctx.quadraticCurveTo(9 * u, top + 36 * u, 14 * u + swing * u, top + 48 * u);
  ctx.quadraticCurveTo(0, top + 51 * u, -14 * u + swing * u, top + 48 * u);
  ctx.quadraticCurveTo(-9 * u, top + 36 * u, -6 * u, top + 25 * u);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (const [dx, dy] of [[-6, 40], [3, 33], [7, 43], [-1, 45], [-3, 30], [10, 47]]) {
    ctx.beginPath();
    ctx.arc(dx * u, top + dy * u, 1.4 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  // бретельки
  ctx.strokeStyle = darken(outfit.top);
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.moveTo(-4 * u, top + 25 * u);
  ctx.lineTo(-3 * u, top + 21 * u);
  ctx.moveTo(4 * u, top + 25 * u);
  ctx.lineTo(3 * u, top + 21 * u);
  ctx.stroke();

  // ближняя рука
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 4.5 * u;
  ctx.beginPath();
  ctx.moveTo(2 * u, shoulderY);
  if (throwing) ctx.lineTo(16 * u, shoulderY - 10 * u);
  else ctx.lineTo(6 * u - swing * 6 * u, shoulderY + 13 * u);
  ctx.stroke();

  // шея и голова
  ctx.fillStyle = SKIN_SHADE;
  ctx.fillRect(-2 * u, hy + 8 * u, 4 * u, 5 * u);
  const fg = ctx.createRadialGradient(-3 * u, hy - 4 * u, 2 * u, 0, hy, 13 * u);
  fg.addColorStop(0, '#fde6d4');
  fg.addColorStop(0.7, SKIN);
  fg.addColorStop(1, SKIN_SHADE);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.ellipse(1 * u, hy, 11.5 * u, 12.5 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  // ухо
  ctx.fillStyle = SKIN_SHADE;
  ctx.beginPath();
  ctx.ellipse(-6 * u, hy + 2 * u, 2.2 * u, 3 * u, 0, 0, Math.PI * 2);
  ctx.fill();

  // волосы: макушка с чёлкой
  const hg = ctx.createLinearGradient(0, hy - 14 * u, 0, hy + 2 * u);
  hg.addColorStop(0, HAIR_LIGHT);
  hg.addColorStop(1, HAIR);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-12 * u, hy + 6 * u);
  ctx.quadraticCurveTo(-14 * u, hy - 12 * u, 0, hy - 13.5 * u);
  ctx.quadraticCurveTo(13 * u, hy - 13 * u, 13 * u, hy - 1 * u);
  // чёлка зубчиками
  ctx.quadraticCurveTo(11 * u, hy - 3 * u, 9 * u, hy - 2 * u);
  ctx.quadraticCurveTo(7 * u, hy - 5 * u, 5 * u, hy - 3 * u);
  ctx.quadraticCurveTo(3 * u, hy - 6 * u, 0, hy - 4 * u);
  ctx.quadraticCurveTo(-3 * u, hy - 4 * u, -4 * u, hy + 1 * u);
  ctx.quadraticCurveTo(-8 * u, hy + 1 * u, -12 * u, hy + 6 * u);
  ctx.fill();
  // блик на волосах
  ctx.strokeStyle = 'rgba(255, 220, 180, .35)';
  ctx.lineWidth = 1.5 * u;
  ctx.beginPath();
  ctx.arc(0, hy - 2 * u, 10 * u, Math.PI * 1.15, Math.PI * 1.55);
  ctx.stroke();

  // глаз: большой, карий, с бликом
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(6.5 * u, hy + 1.5 * u, 2.4 * u, 3 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a2c1a';
  ctx.beginPath();
  ctx.ellipse(7.2 * u, hy + 1.8 * u, 1.8 * u, 2.4 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(7.8 * u, hy + 0.8 * u, 0.7 * u, 0, Math.PI * 2);
  ctx.fill();
  // щёчка и улыбка
  ctx.fillStyle = 'rgba(240, 120, 120, .35)';
  ctx.beginPath();
  ctx.ellipse(5 * u, hy + 6 * u, 2.6 * u, 1.8 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a8584a';
  ctx.lineWidth = 1.1 * u;
  ctx.beginPath();
  ctx.arc(8.5 * u, hy + 6.2 * u, 1.8 * u, 0.4, Math.PI * 0.85);
  ctx.stroke();

  ctx.restore();
  ctx.lineCap = 'butt';
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const lighten = (hex) => shade(hex, 0.3);
const darken = (hex) => shade(hex, -0.25);

// Подсказка сверху экрана (в экранных координатах).
export function drawHint(ctx, text, W, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '700 22px -apple-system, sans-serif';
  const tw = ctx.measureText(text).width;
  const w = tw + 48;
  const x = (W - w) / 2;
  const y = 64;
  ctx.fillStyle = 'rgba(255, 248, 236, .95)';
  rr(ctx, x, y, w, 46, 16);
  ctx.fill();
  ctx.strokeStyle = '#d8a86a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#1d2b3a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, y + 24);
  ctx.restore();
}
