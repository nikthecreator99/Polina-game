// Вся отрисовка мира. Персонажи и фон нарисованы кодом, без картинок:
// так проще менять цвета одежды, а позже часть заменим на нарисованные спрайты.
import { TILE } from './levels.js';

// Детерминированный «случайный» шум, чтобы фон не прыгал между кадрами.
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------- Фон: летний Зелёный ----------------

export function drawBackground(ctx, theme, cx, dy, W, H, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#7cc8f2');
  sky.addColorStop(0.65, '#cfeefc');
  sky.addColorStop(1, '#eaf8ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // солнце
  ctx.fillStyle = 'rgba(255, 244, 190, .55)';
  ctx.beginPath();
  ctx.arc(W * 0.82, H * 0.16 - dy * 0.05, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff6c9';
  ctx.beginPath();
  ctx.arc(W * 0.82, H * 0.16 - dy * 0.05, 40, 0, Math.PI * 2);
  ctx.fill();

  // облака
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  for (let i = 0; i < 6; i++) {
    const span = W + 500;
    let x = (i * 330 + 120 - cx * 0.06 - t * 6) % span;
    if (x < 0) x += span;
    x -= 250;
    const y = H * (0.08 + hash(i) * 0.22) - dy * 0.05;
    const s = 0.7 + hash(i + 9) * 0.6;
    cloud(ctx, x, y, s);
  }

  // дальний лес: ельник
  forest(ctx, cx * 0.12, H * 0.6 - dy * 0.15, W, H, '#8fb9a0', 22, 70, 1);
  forest(ctx, cx * 0.22, H * 0.64 - dy * 0.25, W, H, '#5f9a72', 28, 80, 2);

  // деревня: дома, дачи, берёзы
  village(ctx, cx * 0.4, H * 0.74 - dy * 0.4, W, H, t);

  // железная дорога с электричкой
  railway(ctx, cx * 0.55, H * 0.765 - dy * 0.55, W, H, t);

  // луг перед путями
  const my = H * 0.8 - dy * 0.7;
  ctx.fillStyle = '#7fc35a';
  ctx.fillRect(0, my, W, H - my + 400);
  meadow(ctx, cx * 0.7, my, W);
}

function cloud(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 26 * s, 0, Math.PI * 2);
  ctx.arc(x + 30 * s, y - 12 * s, 32 * s, 0, Math.PI * 2);
  ctx.arc(x + 64 * s, y, 24 * s, 0, Math.PI * 2);
  ctx.arc(x + 32 * s, y + 8 * s, 26 * s, 0, Math.PI * 2);
  ctx.fill();
}

function forest(ctx, off, baseY, W, H, color, step, maxH, seed) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  const first = Math.floor(off / step) - 1;
  for (let i = first; i * step - off < W + step; i++) {
    const x = i * step - off;
    const h = maxH * (0.55 + hash(i * 3.1 + seed) * 0.45);
    ctx.lineTo(x - step * 0.5, baseY);
    ctx.lineTo(x, baseY - h);
    ctx.lineTo(x + step * 0.5, baseY);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(0, baseY - 1, W, H - baseY + 400);
}

const WALLS = ['#b5523b', '#e2b84f', '#6e9bc4', '#8bb174', '#c97b4a', '#a36d9e'];
const ROOFS = ['#5b4b49', '#8e3b2e', '#4a6378', '#6b5a3a'];

function village(ctx, off, baseY, W, H, t) {
  const seg = 230;
  const first = Math.floor(off / seg) - 1;
  for (let i = first; i * seg - off < W + seg; i++) {
    const x0 = i * seg - off;
    const r = hash(i * 7.3);
    if (r < 0.45) house(ctx, x0 + 30 + hash(i) * 60, baseY, i);
    else if (r < 0.7) dacha(ctx, x0 + 20 + hash(i + 2) * 50, baseY, i);
    else birches(ctx, x0 + 40, baseY, i);
    // заборчик
    ctx.strokeStyle = 'rgba(120, 90, 60, .55)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 9; k++) {
      const fx = x0 + k * 26;
      ctx.beginPath();
      ctx.moveTo(fx, baseY);
      ctx.lineTo(fx, baseY - 18);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x0, baseY - 12);
    ctx.lineTo(x0 + seg, baseY - 12);
    ctx.stroke();
  }
  ctx.fillStyle = '#93c977';
  ctx.fillRect(0, baseY, W, H - baseY + 400);
}

function house(ctx, x, y, i) {
  const w = 110 + hash(i + 1) * 30;
  const h = 62;
  const wall = WALLS[Math.floor(hash(i + 3) * WALLS.length)];
  const roof = ROOFS[Math.floor(hash(i + 4) * ROOFS.length)];
  ctx.fillStyle = wall;
  ctx.fillRect(x, y - h, w, h);
  // брёвна
  ctx.strokeStyle = 'rgba(0,0,0,.12)';
  ctx.lineWidth = 2;
  for (let k = 8; k < h; k += 10) {
    ctx.beginPath();
    ctx.moveTo(x, y - k);
    ctx.lineTo(x + w, y - k);
    ctx.stroke();
  }
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - h);
  ctx.lineTo(x + w / 2, y - h - 46);
  ctx.lineTo(x + w + 10, y - h);
  ctx.closePath();
  ctx.fill();
  // окна с наличниками
  for (const wx of [x + w * 0.22, x + w * 0.62]) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(wx - 3, y - h + 14, 28, 30);
    ctx.fillStyle = '#9fd3f0';
    ctx.fillRect(wx, y - h + 17, 22, 24);
    ctx.fillStyle = '#fff';
    ctx.fillRect(wx + 10, y - h + 17, 2, 24);
  }
  // труба
  ctx.fillStyle = '#7a4b3a';
  ctx.fillRect(x + w * 0.7, y - h - 40, 12, 24);
}

function dacha(ctx, x, y, i) {
  const wall = WALLS[Math.floor(hash(i + 5) * WALLS.length)];
  ctx.fillStyle = wall;
  ctx.fillRect(x, y - 46, 70, 46);
  ctx.fillStyle = '#6b5a3a';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 46);
  ctx.lineTo(x + 35, y - 76);
  ctx.lineTo(x + 76, y - 46);
  ctx.fill();
  ctx.fillStyle = '#9fd3f0';
  ctx.fillRect(x + 24, y - 36, 22, 18);
  // теплица
  ctx.fillStyle = 'rgba(230, 248, 255, .75)';
  ctx.beginPath();
  ctx.moveTo(x + 90, y);
  ctx.lineTo(x + 90, y - 22);
  ctx.arc(x + 120, y - 22, 30, Math.PI, 0);
  ctx.lineTo(x + 150, y);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 120, 140, .5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // грядки
  ctx.fillStyle = '#4f8a3a';
  for (let k = 0; k < 4; k++) ctx.fillRect(x + 160 + k * 12, y - 10, 8, 10);
}

function birches(ctx, x, y, i) {
  for (let k = 0; k < 3; k++) {
    const bx = x + k * 50 + hash(i + k) * 20;
    const h = 120 + hash(i * 2 + k) * 50;
    ctx.fillStyle = '#5e9e48';
    ctx.beginPath();
    ctx.ellipse(bx, y - h + 10, 30, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(bx - 4, y - h + 30, 8, h - 30);
    ctx.fillStyle = '#333';
    for (let m = 40; m < h; m += 18) ctx.fillRect(bx - 4 + ((m / 18) % 2) * 3, y - m, 5, 2);
  }
}

function railway(ctx, off, y, W, H, t) {
  // насыпь
  ctx.fillStyle = '#a99a86';
  ctx.beginPath();
  ctx.moveTo(0, y + 14);
  ctx.lineTo(W, y + 14);
  ctx.lineTo(W, y - 4);
  ctx.lineTo(0, y - 4);
  ctx.fill();
  // шпалы
  ctx.fillStyle = '#6b4f3a';
  const st = 16;
  for (let x = -(off % st); x < W; x += st) ctx.fillRect(x, y - 2, 8, 6);
  ctx.fillStyle = '#5a5a60';
  ctx.fillRect(0, y - 4, W, 3);

  // электричка проезжает раз в ~22 секунды (в координатах слоя)
  const period = 22;
  const phase = (t % period) / period;
  const trainLen = 4 * 190;
  const span = W + trainLen + 400;
  const tx = W + 200 - phase * span * 1.0;
  if (tx < W && tx + trainLen > 0) train(ctx, tx, y - 4);
}

function train(ctx, x, y) {
  for (let c = 0; c < 4; c++) {
    const cx = x + c * 190;
    ctx.fillStyle = '#3e8a54';
    rr(ctx, cx, y - 50, 182, 46, c === 0 ? 14 : 4);
    ctx.fill();
    ctx.fillStyle = '#d9473f';
    ctx.fillRect(cx, y - 18, 182, 6);
    ctx.fillStyle = '#9a9ea3';
    ctx.fillRect(cx + 4, y - 54, 174, 5);
    ctx.fillStyle = '#d6eef9';
    for (let w = 0; w < 7; w++) ctx.fillRect(cx + 14 + w * 24, y - 42, 16, 14);
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(cx + 30, y - 2, 6, 0, Math.PI * 2);
    ctx.arc(cx + 152, y - 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function meadow(ctx, off, y, W) {
  const step = 40;
  const first = Math.floor(off / step) - 1;
  for (let i = first; i * step - off < W + step; i++) {
    const x = i * step - off;
    const r = hash(i * 5.7);
    if (r < 0.35) {
      ctx.fillStyle = '#5ea943';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 22, 14, 0, Math.PI, 0);
      ctx.fill();
    } else if (r < 0.6) {
      const colors = ['#fff', '#ffd84d', '#e86f9b', '#9b7be0'];
      ctx.fillStyle = colors[Math.floor(hash(i) * colors.length)];
      ctx.beginPath();
      ctx.arc(x, y + 10 + hash(i + 1) * 20, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------- Тайлы ----------------

export function drawTiles(ctx, L, cx, cy, W, H, t) {
  const x0 = Math.max(0, Math.floor(cx / TILE) - 1);
  const x1 = Math.min(L.w - 1, Math.ceil((cx + W) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(cy / TILE) - 1);
  const y1 = Math.min(L.h - 1, Math.ceil((cy + H) / TILE) + 1);

  // Овраги: тёмная яма там, где нет земли в самом низу.
  for (let x = x0; x <= x1; x++) {
    if (L.tiles[L.h - 1][x] !== '#') {
      let top = L.h - 1;
      while (top > 0 && L.tiles[top - 1][x] === ' ' && top > L.h - 2) top--;
      const gy = top * TILE;
      const g = ctx.createLinearGradient(0, gy, 0, gy + 160);
      g.addColorStop(0, '#4a3524');
      g.addColorStop(1, '#1d140d');
      ctx.fillStyle = g;
      ctx.fillRect(x * TILE, gy + 10, TILE, 400);
    }
  }

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = L.tiles[y][x];
      if (c === ' ') continue;
      const px = x * TILE;
      const py = y * TILE;
      if (c === '#') groundTile(ctx, L, x, y, px, py);
      else if (c === '=') plank(ctx, px, py, L.tiles[y][x - 1] !== '=', L.tiles[y][x + 1] !== '=');
      else if (c === 'B') crate(ctx, px, py);
      else if (c === '~') puddle(ctx, px, py, t);
    }
  }
}

function groundTile(ctx, L, x, y, px, py) {
  const above = y > 0 ? L.tiles[y - 1][x] : ' ';
  const left = x > 0 ? L.tiles[y][x - 1] : '#';
  const right = x < L.w - 1 ? L.tiles[y][x + 1] : '#';
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(px, py, TILE, TILE);
  // камушки в земле
  ctx.fillStyle = '#74492a';
  const h1 = hash(x * 13 + y * 7);
  ctx.fillRect(px + 8 + h1 * 24, py + 20 + h1 * 14, 7, 5);
  ctx.fillRect(px + 30 - h1 * 18, py + 34, 5, 4);
  if (left !== '#') { ctx.fillStyle = '#6e4626'; ctx.fillRect(px, py, 4, TILE); }
  if (right !== '#') { ctx.fillStyle = '#6e4626'; ctx.fillRect(px + TILE - 4, py, 4, TILE); }
  if (above !== '#') {
    ctx.fillStyle = '#4f9a36';
    ctx.fillRect(px, py, TILE, 14);
    ctx.fillStyle = '#6cc04a';
    ctx.fillRect(px, py, TILE, 8);
    // травинки
    ctx.fillStyle = '#6cc04a';
    for (let k = 0; k < 4; k++) {
      const bx = px + 4 + k * 12 + hash(x + k) * 6;
      ctx.beginPath();
      ctx.moveTo(bx, py + 1);
      ctx.lineTo(bx + 3, py - 7);
      ctx.lineTo(bx + 6, py + 1);
      ctx.fill();
    }
  }
}

function plank(ctx, px, py, leftEnd, rightEnd) {
  ctx.fillStyle = '#6b4626';
  ctx.fillRect(px, py, TILE, 20);
  ctx.fillStyle = '#b07a42';
  ctx.fillRect(px, py + 2, TILE, 14);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(px + TILE - 2, py + 2, 2, 14);
  ctx.fillStyle = '#5a3a1e';
  ctx.beginPath();
  ctx.arc(px + 10, py + 9, 2, 0, Math.PI * 2);
  ctx.arc(px + TILE - 10, py + 9, 2, 0, Math.PI * 2);
  ctx.fill();
  // опоры
  if (leftEnd) { ctx.fillStyle = '#6b4626'; ctx.fillRect(px + 4, py + 18, 6, 10); }
  if (rightEnd) { ctx.fillStyle = '#6b4626'; ctx.fillRect(px + TILE - 10, py + 18, 6, 10); }
}

function crate(ctx, px, py) {
  ctx.fillStyle = '#7a4e26';
  ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
  ctx.fillStyle = '#c08a4c';
  ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
  ctx.strokeStyle = '#7a4e26';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(px + 7, py + 7);
  ctx.lineTo(px + TILE - 7, py + TILE - 7);
  ctx.moveTo(px + TILE - 7, py + 7);
  ctx.lineTo(px + 7, py + TILE - 7);
  ctx.stroke();
}

function puddle(ctx, px, py, t) {
  ctx.fillStyle = '#4aa3df';
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2, py + TILE - 6, TILE / 2 + 4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.fillRect(px + 10 + Math.sin(t * 2 + px) * 4, py + TILE - 9, 12, 2);
}

// ---------------- Предметы ----------------

export function drawCoin(ctx, x, y, t) {
  const w = Math.max(2, 13 * Math.abs(Math.cos(t * 3)));
  ctx.fillStyle = '#c98a12';
  ctx.beginPath();
  ctx.ellipse(x, y, w, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4c542';
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1, w - 3), 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff2b0';
  ctx.fillRect(x - w * 0.3, y - 6, Math.max(1, w * 0.25), 8);
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
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x - 3, ground - 52, 6, 52);
  ctx.fillStyle = active ? '#f1c27d' : '#d8a86a';
  rr(ctx, x - 22, ground - 70, 44, 30, 5);
  ctx.fill();
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#5a3a1e';
  ctx.font = '900 22px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', x, ground - 47);
}

export function drawCheckpoint(ctx, x, ground, active) {
  ctx.fillStyle = '#6b6b6b';
  ctx.fillRect(x - 2, ground - 80, 4, 80);
  ctx.fillStyle = active ? '#4caf50' : '#d9473f';
  ctx.beginPath();
  ctx.moveTo(x + 2, ground - 80);
  ctx.lineTo(x + 34, ground - 70);
  ctx.lineTo(x + 2, ground - 60);
  ctx.fill();
}

// Финиш: станция «Зелёный».
export function drawStation(ctx, x, ground, t) {
  // перрон
  ctx.fillStyle = '#b9b2a6';
  ctx.fillRect(x - 40, ground - 16, 360, 16);
  ctx.fillStyle = '#d6d0c4';
  ctx.fillRect(x - 40, ground - 18, 360, 4);
  // здание станции
  const bx = x + 90;
  ctx.fillStyle = '#7fb5c9';
  ctx.fillRect(bx, ground - 136, 200, 120);
  ctx.strokeStyle = 'rgba(0,0,0,.1)';
  ctx.lineWidth = 2;
  for (let k = 26; k < 120; k += 12) {
    ctx.beginPath();
    ctx.moveTo(bx, ground - k);
    ctx.lineTo(bx + 200, ground - k);
    ctx.stroke();
  }
  ctx.fillStyle = '#4d6b78';
  ctx.beginPath();
  ctx.moveTo(bx - 16, ground - 136);
  ctx.lineTo(bx + 100, ground - 196);
  ctx.lineTo(bx + 216, ground - 136);
  ctx.fill();
  ctx.fillStyle = '#fff';
  for (const wx of [bx + 22, bx + 140]) {
    ctx.fillRect(wx, ground - 112, 38, 46);
    ctx.fillStyle = '#a8daf0';
    ctx.fillRect(wx + 4, ground - 108, 30, 38);
    ctx.fillStyle = '#fff';
  }
  ctx.fillStyle = '#6b4626';
  ctx.fillRect(bx + 84, ground - 96, 34, 80);
  // табличка
  ctx.fillStyle = '#fff';
  rr(ctx, bx + 30, ground - 168, 140, 28, 4);
  ctx.fill();
  ctx.strokeStyle = '#2b4c7e';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#2b4c7e';
  ctx.font = '800 18px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ЗЕЛЁНЫЙ', bx + 100, ground - 147);
  // флажок финиша
  ctx.fillStyle = '#555';
  ctx.fillRect(x - 2, ground - 140, 5, 140);
  const wave = Math.sin(t * 5) * 4;
  ctx.fillStyle = '#d9473f';
  ctx.beginPath();
  ctx.moveTo(x + 3, ground - 140);
  ctx.quadraticCurveTo(x + 24, ground - 134 + wave, x + 48, ground - 128);
  ctx.lineTo(x + 3, ground - 112);
  ctx.fill();
}

// ---------------- Гусь ----------------

export function drawEnemy(ctx, e, t) {
  ctx.save();
  const cx = e.x + e.w / 2;
  ctx.translate(cx, e.y + e.h);
  if (!e.alive) ctx.rotate(Math.PI * (1 - Math.max(0, e.dead) / 0.6));
  ctx.scale(e.dir > 0 ? 1 : -1, 1);
  const step = Math.sin(t * 12 + e.x * 0.1);
  // лапы
  ctx.strokeStyle = '#f08a24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.lineTo(-4 + step * 4, 0);
  ctx.moveTo(4, -10);
  ctx.lineTo(4 - step * 4, 0);
  ctx.stroke();
  // тело
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#c9ccd1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-2, -16, 18, 11, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // хвост
  ctx.beginPath();
  ctx.moveTo(-18, -18);
  ctx.lineTo(-26, -24);
  ctx.lineTo(-17, -12);
  ctx.fill();
  // шея и голова (вытянута вперёд: гусь шипит)
  ctx.beginPath();
  ctx.moveTo(8, -22);
  ctx.quadraticCurveTo(18, -26, 16, -34);
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(17, -35, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f08a24';
  ctx.beginPath();
  ctx.moveTo(21, -37);
  ctx.lineTo(30, -34);
  ctx.lineTo(21, -32);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(18.5, -36.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // крыло
  ctx.strokeStyle = '#c9ccd1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-4, -17, 8, 0.2, Math.PI - 0.4);
  ctx.stroke();
  ctx.restore();
}

// ---------------- Героиня ----------------
// Рисуется от точки «под ногами» (x — центр, y — земля). h — рост в пикселях.

export function drawHeroine(ctx, o) {
  const { x, y, h, facing, running, airborne, anim, throwing, outfit } = o;
  const u = h / 64; // единица масштаба
  const skin = '#f6d2b8';
  const hair = '#6b4226';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  const swing = running ? Math.sin(anim) : 0;
  const bob = running ? Math.abs(Math.cos(anim)) * 1.5 * u : 0;
  ctx.translate(0, -bob);

  const top = -h;
  // ноги
  ctx.strokeStyle = skin;
  ctx.lineCap = 'round';
  ctx.lineWidth = 6 * u;
  const legTop = top + 46 * u;
  const legLen = 16 * u;
  const l1 = airborne ? -0.5 : running ? swing * 0.6 : -0.12;
  const l2 = airborne ? 0.3 : running ? -swing * 0.6 : 0.12;
  for (const a of [l1, l2]) {
    const fx = Math.sin(a) * legLen;
    const fy = legTop + Math.cos(a) * legLen;
    ctx.beginPath();
    ctx.moveTo(0, legTop);
    ctx.lineTo(fx, fy - 2 * u);
    ctx.stroke();
    ctx.fillStyle = outfit.shoes;
    rr(ctx, fx - 4 * u, fy - 4 * u, 10 * u, 5 * u, 2 * u);
    ctx.fill();
  }

  // волосы сзади (хвостик)
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(-12 * u, top + 16 * u + swing * u, 5 * u, 9 * u, 0.5 + swing * 0.15, 0, Math.PI * 2);
  ctx.fill();

  // сарафан
  ctx.fillStyle = outfit.top;
  ctx.beginPath();
  ctx.moveTo(-6 * u, top + 25 * u);
  ctx.lineTo(6 * u, top + 25 * u);
  ctx.lineTo(13 * u, top + 48 * u);
  ctx.lineTo(-13 * u, top + 48 * u);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (const [dx, dy] of [[-6, 38], [3, 33], [6, 43], [-2, 44]]) {
    ctx.beginPath();
    ctx.arc(dx * u, top + dy * u, 1.6 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // руки
  ctx.strokeStyle = skin;
  ctx.lineWidth = 5 * u;
  const shoulderY = top + 28 * u;
  if (throwing) {
    ctx.beginPath();
    ctx.moveTo(3 * u, shoulderY);
    ctx.lineTo(16 * u, shoulderY - 10 * u);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(3 * u, shoulderY);
    ctx.lineTo(6 * u - swing * 6 * u, shoulderY + 13 * u);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-3 * u, shoulderY);
  ctx.lineTo(airborne ? -12 * u : -6 * u + swing * 6 * u, airborne ? shoulderY - 6 * u : shoulderY + 13 * u);
  ctx.stroke();

  // голова
  const hy = top + 13 * u;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, hy, 12 * u, 0, Math.PI * 2);
  ctx.fill();
  // волосы: макушка и чёлка
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(0, hy - 1 * u, 12.5 * u, Math.PI * 0.95, Math.PI * 2.05);
  ctx.lineTo(10 * u, hy - 4 * u);
  ctx.quadraticCurveTo(2 * u, hy - 7 * u, -4 * u, hy - 3 * u);
  ctx.lineTo(-12 * u, hy + 4 * u);
  ctx.closePath();
  ctx.fill();
  // бантик
  ctx.fillStyle = '#e5484d';
  ctx.beginPath();
  ctx.arc(-9 * u, hy - 9 * u, 3 * u, 0, Math.PI * 2);
  ctx.fill();
  // глаз, щёчка, улыбка
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.ellipse(6 * u, hy + 1 * u, 1.6 * u, 2.2 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(240, 120, 120, .45)';
  ctx.beginPath();
  ctx.arc(5 * u, hy + 6 * u, 2.5 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a4a3a';
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.arc(7.5 * u, hy + 5.5 * u, 2 * u, 0.3, Math.PI * 0.75);
  ctx.stroke();

  ctx.restore();
}

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
