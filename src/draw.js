// Вся отрисовка мира кодом. Фон — в scenery.js (кэшированные слои с параллаксом).
// Персонажи и предметы рисуются мягкими формами с градиентами, чтобы был объём.
import { TILE } from './levels.js';
import { drawScenery, hash } from './scenery.js';
import { IMG, RIG } from './assets.js';

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
  drawScenery(ctx, cx, dy, W, t, IMG);
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
      if (c === 'B') {
        if (IMG.crate) ctx.drawImage(IMG.crate, x * TILE - 1, y * TILE - 1, TILE + 2, TILE + 2);
        else crate(ctx, x * TILE, y * TILE, at(x, y + 1) !== 'B');
      }
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
  if (IMG.coin) {
    const w = Math.max(3, 28 * Math.abs(k));
    ctx.drawImage(IMG.coin, x - w / 2, y - 14, w, 28);
    return;
  }
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
  if (IMG.stone) {
    const w = r * 2.6;
    const h = w * (IMG.stone.height / IMG.stone.width);
    ctx.drawImage(IMG.stone, -w / 2, -h / 2, w, h);
    ctx.restore();
    return;
  }
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
  if (IMG.sign) {
    const k = active ? 1.08 : 1;
    const w = 72 * k;
    const h = w * (IMG.sign.height / IMG.sign.width);
    ctx.drawImage(IMG.sign, x - w * 0.4, ground - h + 2, w, h);
    return;
  }
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
  if (IMG.station) {
    const h = 230;
    const w = h * (IMG.station.width / IMG.station.height);
    drawShadow(ctx, x + 60 + w / 2, ground, w * 0.55, 0.3);
    ctx.drawImage(IMG.station, x + 60, ground - h + 6, w, h);
    finishFlag(ctx, x, ground, t);
    return;
  }
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
  finishFlag(ctx, x, ground, t);
}

function finishFlag(ctx, x, ground, t) {
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

// Гусь из картинки: оранжевые лапы вырезаем по цвету в отдельные слои и качаем
// их вокруг «бедра», тело рисуем целиком без лап.
const gooseCache = new Map();
function prepareGoose(img) {
  if (gooseCache.has(img)) return gooseCache.get(img);
  let res = null;
  try {
    const w = img.width, h = img.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    const leg = new Uint8Array(w * h);
    for (let y = Math.floor(h * 0.55); y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (d[i + 3] > 30 && r > 150 && r - b > 100 && gg < r - 25) leg[y * w + x] = 1;
      }
    }
    // связные куски оранжевого: две самые большие — это две лапы
    const lab = new Int32Array(w * h);
    const sizes = [0];
    const stack = [];
    for (let p = 0; p < w * h; p++) {
      if (!leg[p] || lab[p]) continue;
      const id = sizes.length;
      let n = 0;
      lab[p] = id; stack.push(p);
      while (stack.length) {
        const q = stack.pop(); n++;
        const x = q % w, y = (q - x) / w;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const r = yy * w + xx;
          if (leg[r] && !lab[r]) { lab[r] = id; stack.push(r); }
        }
      }
      sizes.push(n);
    }
    const ids = sizes.map((n, i) => [n, i]).slice(1).sort((a, b) => b[0] - a[0]).slice(0, 2)
      .filter(([n]) => n > w * h * 0.004).map(([, i]) => i);
    if (ids.length === 2) {
      // немного «раздуваем» лапы, чтобы на теле не осталось оранжевой каймы
      const grow = (mask) => {
        const out = new Uint8Array(mask);
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          const p = y * w + x;
          if (!mask[p] && (mask[p - 1] || mask[p + 1] || mask[p - w] || mask[p + w])) out[p] = 1;
        }
        return out;
      };
      const legs = ids.map((id) => {
        let m = new Uint8Array(w * h);
        for (let p = 0; p < w * h; p++) if (lab[p] === id) m[p] = 1;
        m = grow(grow(m));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const cg = cv.getContext('2d');
        const id2 = cg.createImageData(w, h);
        let top = h, sx = 0, n = 0;
        for (let p = 0; p < w * h; p++) {
          if (!m[p]) continue;
          id2.data.set(d.subarray(p * 4, p * 4 + 4), p * 4);
          top = Math.min(top, Math.floor(p / w));
        }
        for (let x = 0; x < w; x++) for (let y = top; y < top + 6; y++) if (m[y * w + x]) { sx += x; n++; }
        cg.putImageData(id2, 0, 0);
        return { img: cv, mask: m, hipX: n ? sx / n : w / 2, hipY: top + 3 };
      });
      const body = document.createElement('canvas');
      body.width = w; body.height = h;
      const bg = body.getContext('2d');
      const bd = bg.createImageData(w, h);
      bd.data.set(d);
      for (const L of legs) for (let p = 0; p < w * h; p++) if (L.mask[p]) bd.data[p * 4 + 3] = 0;
      bg.putImageData(bd, 0, 0);
      legs.sort((a, b) => a.hipX - b.hipX);
      res = { body, legs };
    }
  } catch (e) { /* без доступа к пикселям — гусь целиком */ }
  gooseCache.set(img, res);
  return res;
}

export function drawEnemy(ctx, e, t) {
  if (e.alive) drawShadow(ctx, e.x + e.w / 2, e.y + e.h, 26, 0.3);
  const img = e.angry ? IMG.gooseAngry : IMG.gooseWalk;
  if (img) {
    const h = e.angry ? 58 : 70;
    const s = h / img.height;
    const w = img.width * s;
    const ph = t * (e.angry ? 14 : 10) + e.x * 0.05;
    const step = Math.sin(ph);
    const G = prepareGoose(img);
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h);
    if (!e.alive) ctx.rotate(Math.PI * (1 - Math.max(0, e.dead) / 0.6));
    ctx.scale(e.dir > 0 ? 1 : -1, 1);
    // гусь смотрит вправо; центр тела чуть левее середины картинки
    const ox = -w * (e.angry ? 0.3 : 0.45);
    if (G) {
      const swing = e.alive ? 0.45 : 0;
      G.legs.forEach((L, k) => {
        const a = (k === 0 ? step : -step) * swing;
        // лапа, которая идёт вперёд, чуть приподнимается
        const lift = Math.max(0, k === 0 ? -Math.cos(ph) : Math.cos(ph)) * 3;
        const hx = ox + L.hipX * s, hy = -h + L.hipY * s;
        ctx.save();
        ctx.translate(hx, hy - lift);
        ctx.rotate(a);
        ctx.drawImage(L.img, ox - hx, -h - hy, w, h);
        ctx.restore();
      });
      ctx.translate(0, -Math.abs(Math.cos(ph)) * 2);
      ctx.rotate(step * 0.05);
      ctx.drawImage(G.body, ox, -h, w, h);
    } else {
      ctx.translate(0, -Math.abs(step) * 2);
      ctx.rotate(step * 0.06);
      ctx.drawImage(img, ox, -h, w, h);
    }
    ctx.restore();
    return;
  }
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

const darkCache = new Map();
function darkened(img) {
  if (darkCache.has(img)) return darkCache.get(img);
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(40, 20, 10, .22)';
  g.fillRect(0, 0, c.width, c.height);
  darkCache.set(img, c);
  return c;
}

// ---------- Полина из картинки сбоку («кукла на шарнирах») ----------
// Картинка тела (без ближней руки) режется на части прямо в браузере:
//  • верх (голова, туловище, платье целиком, включая подол ниже линии разреза);
//  • ноги ниже подола — если ноги на картинке расставлены, то отдельно задняя и передняя;
//  • каждая нога ещё делится по колену на бедро и голень.
// Рука — отдельная картинка, крутится вокруг плеча.

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Средняя x непрозрачных пикселей в строках [y0, y1] (доля ширины).
function centerX(data, w, y0, y1, x0 = 0, x1 = w) {
  let sum = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x < x1; x++) if (data[(y * w + x) * 4 + 3] > 128) { sum += x; n++; }
  }
  return n ? sum / n / w : null;
}

// Оставляет в маске только самый большой связный кусок (убирает обрезки ремешков
// и пальцев другой ноги, попавшие не в ту половину).
function keepLargest(arr, w, h) {
  const lab = new Int32Array(w * h);
  let best = 0, bestN = 0, id = 0;
  const stack = [];
  for (let p = 0; p < w * h; p++) {
    if (lab[p] || arr[p * 4 + 3] < 40) continue;
    id++;
    let n = 0;
    stack.push(p); lab[p] = id;
    while (stack.length) {
      const q = stack.pop(); n++;
      const x = q % w, y = (q - x) / w;
      for (const r of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]) {
        if (r >= 0 && !lab[r] && arr[r * 4 + 3] >= 40) { lab[r] = id; stack.push(r); }
      }
    }
    if (n > bestN) { bestN = n; best = id; }
  }
  for (let p = 0; p < w * h; p++) if (lab[p] !== best) arr[p * 4 + 3] = 0;
}

const prepCache = new Map();
function preparePolina(img, rig) {
  const key = img.src;
  if (prepCache.has(key)) return prepCache.get(key);
  let res = null;
  try {
    const w = img.width, h = img.height;
    const src = mkCanvas(w, h).getContext('2d');
    src.drawImage(img, 0, 0);
    const d = src.getImageData(0, 0, w, h).data;
    const top = new Uint8ClampedArray(d);
    const legs = new Uint8ClampedArray(d);
    const cutY = Math.floor(h * rig.cut);
    const y0 = Math.floor(h * (rig.cut - 0.03));
    // Цвет одежды чуть выше разреза: им отличаем подол от ног.
    let cr = 0, cg = 0, cb = 0;
    if (rig.split) {
      const rs = [], gs = [], bs = [];
      for (let y = Math.floor(h * (rig.cut - 0.1)); y < h * (rig.cut - 0.02); y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] > 200) { rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); }
        }
      }
      const med = (a) => a.sort((p, q) => p - q)[a.length >> 1] || 0;
      const mr = med(rs), mg = med(gs), mb = med(bs), ms = mr + mg + mb + 1;
      cr = mr / ms; cg = mg / ms; cb = mb / ms;
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (y < y0) { legs[i + 3] = 0; continue; }
        let legW = 1;
        if (rig.split) {
          const s = d[i] + d[i + 1] + d[i + 2] + 1;
          const cd = Math.abs(d[i] / s - cr) + Math.abs(d[i + 1] / s - cg) + Math.abs(d[i + 2] / s - cb);
          legW = clamp01((cd - 0.09) / 0.06); // 1 — точно не одежда
        }
        legs[i + 3] = d[i + 3] * legW;
        if (y >= cutY) top[i + 3] = rig.split && y < h * (rig.cut + 0.07) ? d[i + 3] * (1 - legW) : 0;
      }
    }
    const toCanvas = (arr) => {
      const c = mkCanvas(w, h);
      c.getContext('2d').putImageData(new ImageData(arr, w, h), 0, 0);
      return c;
    };
    const kneeY = Math.floor(h * (rig.knee || 0.97));
    const footY0 = Math.floor(h * 0.965), footY1 = Math.floor(h * 0.99);
    const footX = centerX(d, w, footY0, footY1) ?? 0.5;
    const legInfo = (arr, x0, x1) => {
      let low = h - 1; // самая нижняя строка этой ноги (подошва)
      while (low > 0) {
        let any = false;
        for (let x = 0; x < w && !any; x++) any = arr[(low * w + x) * 4 + 3] > 128;
        if (any) break;
        low--;
      }
      return {
        img: toCanvas(arr),
        hipX: centerX(arr, w, cutY + 1, cutY + 6) ?? footX,
        kneeX: centerX(arr, w, kneeY - 1, kneeY + 1) ?? footX,
        footX: centerX(arr, w, Math.max(0, low - Math.floor(h * 0.025)), low) ?? footX,
        footY: (low + 1) / h,
      };
    };
    let back, front;
    if (rig.apart) {
      // Где проходит просвет между ногами — для каждой строки отдельно: где ноги
      // разошлись, режем посередине просвета; выше (где штанины слиты) — по ближайшему просвету.
      const splitAt = new Array(h).fill(null);
      for (let y = y0; y < h; y++) {
        const runs = [];
        let st = -1;
        for (let x = 0; x <= w; x++) {
          const on = x < w && legs[(y * w + x) * 4 + 3] > 100;
          if (on && st < 0) st = x;
          if (!on && st >= 0) { if (x - st > 2) runs.push([st, x]); st = -1; }
        }
        if (runs.length >= 2) {
          // самый широкий просвет между соседними кусками
          let gi = 0, gw = -1;
          for (let k = 0; k + 1 < runs.length; k++) {
            const gap = runs[k + 1][0] - runs[k][1];
            if (gap > gw) { gw = gap; gi = k; }
          }
          splitAt[y] = (runs[gi][1] + runs[gi + 1][0]) / 2;
        }
      }
      // строки без просвета берут значение ближайшей строки с просветом снизу/сверху
      let firstGap = splitAt.findIndex((v) => v !== null);
      if (firstGap < 0) firstGap = h - 1;
      let lastVal = splitAt[firstGap] ?? w / 2;
      for (let y = 0; y < h; y++) {
        if (splitAt[y] === null) splitAt[y] = lastVal; else lastVal = splitAt[y];
      }
      const best = Math.round(splitAt[Math.floor(h * 0.9)]);
      const b = new Uint8ClampedArray(legs), f = new Uint8ClampedArray(legs);
      for (let y = 0; y < h; y++) {
        const sx = splitAt[y];
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (x >= sx) b[i + 3] = 0; else f[i + 3] = 0;
        }
      }
      keepLargest(b, w, h);
      keepLargest(f, w, h);
      back = legInfo(b, 0, best);
      front = legInfo(f, best, w);
    } else {
      back = front = legInfo(legs, 0, w);
    }
    res = { top: toCanvas(top), back, front, footX, hipX: (back.hipX + front.hipX) / 2 };
  } catch (e) { /* без доступа к пикселям (file://) рисуем запасную Полину кодом */ }
  prepCache.set(key, res);
  return res;
}

function drawPolinaSprite(ctx, img, rig, P, o, arm) {
  const { x, y, h, facing, running, airborne, anim, throwing, throwT = 0, vy = 0, land = 0 } = o;
  const H = h * 1.4;
  const s = H / img.height;
  const W = img.width * s;
  const swing = running ? Math.sin(anim) : 0;
  const ox = -P.footX * W;
  const oy = -H;
  const hipY = oy + rig.cut * H;
  const hasKnee = !!rig.knee;
  const kneeSrc = (rig.knee || 1) * img.height;
  const kneeY = oy + (rig.knee || 1) * H;

  // ---- позы ног: угол в бедре (плюс — стопа назад) и сгиб колена (плюс — пятка назад)
  let fh = 0, fk = 0, bh = 0, bk = 0;
  if (airborne) {
    const fall = clamp01((vy + 150) / 550); // 0 — летит вверх, 1 — падает
    if (hasKnee) {
      fh = lerp(-0.85, -0.3, fall); fk = lerp(1.35, 0.45, fall);
      bh = lerp(0.2, 0.12, fall); bk = lerp(1.15, 0.55, fall);
    } else { fh = rig.swing * 0.8; bh = -rig.swing * 0.6; }
  } else if (running) {
    fh = swing * rig.swing; bh = -swing * rig.swing;
    if (hasKnee) {
      fk = 0.12 + 0.9 * Math.max(0, fh / rig.swing);
      bk = 0.12 + 0.9 * Math.max(0, bh / rig.swing);
    }
  }
  if (land > 0 && hasKnee) {
    fh = lerp(fh, -0.75, land); fk = lerp(fk, 1.4, land);
    bh = lerp(bh, -0.45, land); bk = lerp(bk, 1.2, land);
  }

  const rot = (px, py, cx, cy, a) => {
    const c = Math.cos(a), sn = Math.sin(a);
    return [cx + (px - cx) * c - (py - cy) * sn, cy + (px - cx) * sn + (py - cy) * c];
  };
  // Насколько поднялась стопа из-за сгиба: прогоняем пятку и носок через те же повороты.
  const footLift = (L, hip, knee) => {
    const pX = ox + L.hipX * W, kX = ox + L.kneeX * W, fX = ox + L.footX * W;
    const fY = oy + L.footY * H;
    let lowest = -Infinity;
    for (const dx of [-0.1 * W, 0.12 * W]) {
      let [px, py] = hasKnee ? rot(fX + dx, fY, kX, kneeY, knee) : [fX + dx, fY];
      [px, py] = rot(px, py, pX, hipY, hip);
      lowest = Math.max(lowest, py);
    }
    return -lowest;
  };
  const drop = airborne ? 0 : Math.min(footLift(P.front, fh, fk), footLift(P.back, bh, bk));
  const bob = running ? Math.abs(Math.cos(anim)) * 2.2 : 0;

  ctx.save();
  ctx.translate(x, y - bob + drop);
  ctx.scale(facing, 1);
  if (!hasKnee && land > 0) ctx.scale(1 + 0.05 * land, 1 - 0.08 * land); // длинное платье: пружиним телом
  const lean = (throwing ? 0.14 : 0) + (running ? 0.04 : 0) + (airborne ? -0.03 : 0) + land * 0.12;
  const pivX = ox + P.hipX * W;

  // ---- руки: угол 0 — вытянута вперёд, PI/2 — висит вниз
  let armFront = Math.PI / 2 - 0.08;
  let armBack = Math.PI / 2 + 0.08;
  if (running) { armFront -= swing * 0.75; armBack += swing * 0.75; }
  if (airborne) {
    const fall = clamp01((vy + 150) / 550);
    armFront = lerp(0.35, 0.9, fall); armBack = lerp(2.4, 1.9, fall);
  }
  if (land > 0) { armFront = lerp(armFront, 0.9, land); armBack = lerp(armBack, 1.2, land); }
  if (throwing) {
    const e = 1 - (1 - clamp01(throwT)) ** 2;
    armFront = lerp(Math.PI + 0.7, 0.15, e); // замах из-за головы и бросок вперёд
  }
  const drawArm = (angle, src) => {
    if (!arm) return;
    const a = arm.rig;
    ctx.save();
    ctx.translate(pivX, hipY);
    ctx.rotate(lean);
    ctx.translate(ox + a.shoulderX * W - pivX, oy + a.shoulderY * H - hipY);
    ctx.rotate(angle);
    ctx.drawImage(src, -a.pivotX * src.width * s, -a.pivotY * src.height * s, src.width * s, src.height * s);
    ctx.restore();
  };

  // ---- нога: бедро вокруг тазобедренного шарнира, голень вокруг колена
  const leg = (L, hip, knee, dark) => {
    const src = dark ? darkened(L.img) : L.img;
    const pX = ox + L.hipX * W, kX = ox + L.kneeX * W;
    ctx.save();
    ctx.translate(pX, hipY);
    ctx.rotate(hip);
    ctx.translate(-pX, -hipY);
    if (!hasKnee) {
      ctx.drawImage(src, ox, oy, W, H);
    } else {
      const ov = img.height * 0.02;
      const thighEnd = kneeSrc + ov;
      ctx.drawImage(src, 0, 0, img.width, thighEnd, ox, oy, W, thighEnd * s);
      ctx.translate(kX, kneeY);
      ctx.rotate(knee);
      ctx.translate(-kX, -kneeY);
      const shin0 = kneeSrc - ov;
      ctx.drawImage(src, 0, shin0, img.width, img.height - shin0, ox, oy + shin0 * s, W, (img.height - shin0) * s);
    }
    ctx.restore();
  };

  if (arm) drawArm(armBack, darkened(arm.img));
  leg(P.back, bh, bk, true);
  leg(P.front, fh, fk, false);
  ctx.save();
  ctx.translate(pivX, hipY);
  ctx.rotate(lean);
  ctx.drawImage(P.top, ox - pivX, oy - hipY, W, H);
  ctx.restore();
  if (arm) drawArm(armFront, arm.img);
  ctx.restore();
}

export function drawHeroine(ctx, o) {
  const { x, y, h, facing, running, airborne, anim, throwing, outfit } = o;
  const rig = RIG[o.outfitId];
  const body = rig && IMG['body-' + o.outfitId];
  const P = body && preparePolina(body, rig);
  if (P) {
    if (o.shadowY !== undefined) drawShadow(ctx, x, o.shadowY, 20 * (h / 64), airborne ? 0.15 : 0.32);
    const armImg = IMG['arm-' + o.outfitId];
    drawPolinaSprite(ctx, body, rig, P, o, armImg && rig.arm ? { img: armImg, rig: rig.arm } : null);
    return;
  }
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
