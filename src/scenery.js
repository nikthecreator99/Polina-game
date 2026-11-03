// Фон летнего Зелёного. Слои рисуются один раз в отдельные холсты (кэш),
// а потом просто сдвигаются с разной скоростью (параллакс) — так и красивее, и быстрее.
// Дальние слои слегка размыты и затянуты дымкой, чтобы появилась глубина.

const LW = 1600; // ширина повторяющегося куска слоя в виртуальных пикселях
const H = 540;

export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

let deviceScale = 2;
const cache = new Map();

export function setRenderScale(s) {
  const next = Math.min(2, Math.max(1, s));
  if (Math.abs(next - deviceScale) > 0.05) {
    deviceScale = next;
    cache.clear();
  }
}

const canFilter = (() => {
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.filter = 'blur(2px)';
    return c.filter === 'blur(2px)';
  } catch (e) { return false; }
})();

// Рисует fn(ctx, x) три раза со сдвигом, чтобы предметы на краях стыковались без шва.
function wrap(fn) {
  for (const k of [-LW, 0, LW]) fn(k);
}

function buildLayer(key, top, bottom, res, blur, draw) {
  if (cache.has(key)) return cache.get(key);
  const s = deviceScale * res;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(LW * s);
    c.height = Math.ceil((bottom - top) * s);
    return c;
  };
  let c = make();
  const g = c.getContext('2d');
  g.scale(s, s);
  g.translate(0, -top);
  draw(g);
  // Размытие применяем один раз ко всему слою (по отдельным фигурам слишком медленно).
  if (blur && canFilter) {
    const b = make();
    const bg = b.getContext('2d');
    bg.filter = `blur(${blur * s}px)`;
    bg.drawImage(c, 0, 0);
    c = b;
  }
  const layer = { canvas: c, top, bottom };
  cache.set(key, layer);
  return layer;
}

function blit(ctx, layer, off, dy, W) {
  let x = -(((off % LW) + LW) % LW);
  const h = layer.bottom - layer.top;
  for (; x < W; x += LW) ctx.drawImage(layer.canvas, x, layer.top + dy, LW + 0.5, h);
}

// ---------- примитивы ----------

function softPoly(ctx, pts, fill, round = 6) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  ctx.lineJoin = 'round';
  ctx.lineWidth = round;
  ctx.fill();
  ctx.stroke();
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Пушистая крона: несколько кругов с подсветкой сверху-слева.
function canopy(ctx, x, y, r, light, mid, dark, seed) {
  const blobs = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + hash(seed + i) * 0.6;
    blobs.push([x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.45, r * (0.45 + hash(seed * 3 + i) * 0.2)]);
  }
  blobs.push([x, y, r * 0.6]);
  ctx.fillStyle = dark;
  for (const [bx, by, br] of blobs) { ctx.beginPath(); ctx.arc(bx + 3, by + 4, br, 0, Math.PI * 2); ctx.fill(); }
  for (const [bx, by, br] of blobs) {
    const g = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.5, br * 0.1, bx, by, br);
    g.addColorStop(0, light);
    g.addColorStop(1, mid);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Ель из скруглённых ярусов.
function spruce(ctx, x, base, h, light, dark) {
  ctx.fillStyle = '#4a3528';
  ctx.fillRect(x - h * 0.03, base - h * 0.14, h * 0.06, h * 0.14);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const tb = base - h * 0.1 - i * h * 0.2;
    const tt = tb - h * 0.38;
    const tw = h * (0.3 - i * 0.055);
    const g = ctx.createLinearGradient(x - tw, 0, x + tw, 0);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - tw, tb);
    ctx.quadraticCurveTo(x - tw * 0.35, tb - (tb - tt) * 0.45, x, tt);
    ctx.quadraticCurveTo(x + tw * 0.35, tb - (tb - tt) * 0.45, x + tw, tb);
    ctx.quadraticCurveTo(x, tb + tw * 0.22, x - tw, tb);
    ctx.fill();
  }
}

// Дымка: подмешиваем цвет неба поверх уже нарисованного слоя.
function haze(ctx, top, bottom, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, `rgba(214, 238, 250, ${alpha})`);
  g.addColorStop(1, `rgba(214, 238, 250, ${alpha * 0.4})`);
  ctx.fillStyle = g;
  ctx.fillRect(-LW, top, LW * 3, bottom - top);
  ctx.restore();
}

// Плавные холмы: сумма синусов с периодом, кратным ширине слоя (стыкуется без шва).
function hills(ctx, base, amp, seed, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, H + 200);
  for (let x = 0; x <= LW; x += 10) {
    const k = (x / LW) * Math.PI * 2;
    const y = base - amp * (0.5 * Math.sin(k * 2 + seed) + 0.3 * Math.sin(k * 5 + seed * 2) + 0.2 * Math.sin(k * 9 + seed * 3));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(LW, H + 200);
  ctx.closePath();
  ctx.fill();
}

// ---------- слои ----------

function farLayer() {
  return buildLayer('far', 220, H + 160, 0.6, 2.5, (g) => {
    hills(g, 360, 40, 1, '#9ec9b7');
    for (let i = 0; i < 70; i++) {
      const x = (i / 70) * LW + hash(i) * 14;
      const k = (x / LW) * Math.PI * 2;
      const y = 360 - 40 * (0.5 * Math.sin(k * 2 + 1) + 0.3 * Math.sin(k * 5 + 2) + 0.2 * Math.sin(k * 9 + 3));
      wrap((o) => spruce(g, x + o, y + 14, 40 + hash(i + 3) * 30, '#7fb49b', '#6a9f88'));
    }
    haze(g, 220, H, 0.55);
  });
}

function forestLayer() {
  return buildLayer('forest', 220, H + 160, 0.8, 1.2, (g) => {
    hills(g, 410, 22, 4, '#5f9a72');
    for (let i = 0; i < 90; i++) {
      const x = (i / 90) * LW + hash(i * 1.7) * 12;
      const h = 70 + hash(i * 2.3) * 60;
      wrap((o) => spruce(g, x + o, 430 + hash(i) * 10, h, '#5d9a6c', '#3f7552'));
    }
    haze(g, 220, H, 0.28);
  });
}

const WALLS = [
  ['#c9674c', '#9c4a35'], ['#e8c062', '#c19a3e'], ['#7fa9cf', '#5b84aa'],
  ['#97bf80', '#729c5d'], ['#d68b5a', '#ad6a3f'], ['#b585b0', '#8f6189'],
];
const ROOFS = ['#5d4f4c', '#8e4436', '#4d677c', '#6e5d40'];

function house(g, x, base, i) {
  const w = 120 + hash(i + 1) * 30;
  const h = 66;
  const [wl, wd] = WALLS[Math.floor(hash(i + 3) * WALLS.length)];
  const roof = ROOFS[Math.floor(hash(i + 4) * ROOFS.length)];
  // тень на земле
  ellipse(g, x + w / 2 + 10, base + 2, w * 0.65, 7, 'rgba(40, 70, 30, .25)');
  // стены
  const wg = g.createLinearGradient(x, 0, x + w, 0);
  wg.addColorStop(0, wl);
  wg.addColorStop(1, wd);
  softPoly(g, [[x, base], [x, base - h], [x + w, base - h], [x + w, base]], wg, 5);
  g.strokeStyle = 'rgba(0,0,0,.10)';
  g.lineWidth = 2;
  for (let k = 9; k < h; k += 10) {
    g.beginPath();
    g.moveTo(x + 2, base - k);
    g.lineTo(x + w - 2, base - k);
    g.stroke();
  }
  // крыша со свесом и тенью под ней
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.fillRect(x, base - h, w, 8);
  softPoly(g, [[x - 12, base - h + 2], [x + w / 2, base - h - 50], [x + w + 12, base - h + 2]], roof, 9);
  g.fillStyle = 'rgba(255,255,255,.12)';
  g.beginPath();
  g.moveTo(x - 8, base - h);
  g.lineTo(x + w / 2, base - h - 46);
  g.lineTo(x + w / 2, base - h - 36);
  g.lineTo(x + 4, base - h);
  g.fill();
  // окна с белыми наличниками
  for (const wx of [x + w * 0.2, x + w * 0.6]) {
    softPoly(g, [[wx - 4, base - h + 14], [wx + 28, base - h + 14], [wx + 28, base - h + 48], [wx - 4, base - h + 48]], '#fbf7ef', 4);
    softPoly(g, [[wx - 7, base - h + 10], [wx + 12, base - h + 4], [wx + 31, base - h + 10]], '#fbf7ef', 4);
    const glass = g.createLinearGradient(wx, base - h + 18, wx + 24, base - h + 44);
    glass.addColorStop(0, '#d9f1ff');
    glass.addColorStop(1, '#6fa9cf');
    g.fillStyle = glass;
    g.fillRect(wx, base - h + 18, 24, 26);
    g.fillStyle = '#fbf7ef';
    g.fillRect(wx + 11, base - h + 18, 2, 26);
  }
  g.fillStyle = '#7a4b3a';
  g.fillRect(x + w * 0.72, base - h - 42, 12, 26);
}

function dacha(g, x, base, i) {
  const [wl, wd] = WALLS[Math.floor(hash(i + 5) * WALLS.length)];
  ellipse(g, x + 90, base + 2, 110, 6, 'rgba(40, 70, 30, .2)');
  const wg = g.createLinearGradient(x, 0, x + 72, 0);
  wg.addColorStop(0, wl);
  wg.addColorStop(1, wd);
  softPoly(g, [[x, base], [x, base - 48], [x + 72, base - 48], [x + 72, base]], wg, 5);
  softPoly(g, [[x - 8, base - 46], [x + 36, base - 80], [x + 80, base - 46]], '#6e5d40', 8);
  g.fillStyle = '#bfe4f5';
  g.fillRect(x + 25, base - 38, 22, 18);
  // теплица
  const gg = g.createLinearGradient(0, base - 54, 0, base);
  gg.addColorStop(0, 'rgba(245, 252, 255, .9)');
  gg.addColorStop(1, 'rgba(200, 230, 240, .7)');
  g.fillStyle = gg;
  g.beginPath();
  g.moveTo(x + 92, base);
  g.lineTo(x + 92, base - 24);
  g.arc(x + 124, base - 24, 32, Math.PI, 0);
  g.lineTo(x + 156, base);
  g.fill();
  g.strokeStyle = 'rgba(120, 160, 175, .6)';
  g.lineWidth = 2;
  g.stroke();
  for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 108 + k * 16, base); g.lineTo(x + 108 + k * 16, base - 50 + Math.abs(k - 1) * 8); g.stroke(); }
  // грядки
  for (let k = 0; k < 5; k++) canopy(g, x + 172 + k * 14, base - 6, 7, '#8fd06a', '#5f9e45', 'rgba(0,0,0,.12)', i * 10 + k);
}

function birch(g, x, base, h, seed) {
  const tg = g.createLinearGradient(x - 5, 0, x + 5, 0);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(1, '#d8d4cc');
  g.fillStyle = tg;
  g.beginPath();
  g.moveTo(x - 5, base);
  g.lineTo(x - 3, base - h + 30);
  g.lineTo(x + 3, base - h + 30);
  g.lineTo(x + 5, base);
  g.fill();
  g.fillStyle = '#3b3b3b';
  for (let m = 30; m < h - 40; m += 16) {
    g.beginPath();
    g.ellipse(x + (hash(seed + m) - 0.5) * 4, base - m, 3, 1.3, 0, 0, Math.PI * 2);
    g.fill();
  }
  canopy(g, x, base - h + 20, 34, '#a8de7e', '#5fa047', 'rgba(30, 70, 30, .35)', seed);
}

function villageLayer() {
  return buildLayer('village', 110, H + 160, 1, 0.6, (g) => {
    const base = 400;
    // луг под деревней
    hills(g, base + 6, 6, 7, '#9fd27f');
    const seg = 230;
    const n = Math.round(LW / seg);
    for (let i = 0; i < n; i++) {
      const x0 = (i / n) * LW;
      const r = hash(i * 7.3);
      wrap((o) => {
        if (r < 0.45) house(g, x0 + o + 30 + hash(i) * 50, base, i);
        else if (r < 0.72) dacha(g, x0 + o + 20 + hash(i + 2) * 40, base, i);
        else for (let k = 0; k < 3; k++) birch(g, x0 + o + 40 + k * 55 + hash(i + k) * 16, base, 130 + hash(i * 2 + k) * 50, i * 5 + k);
      });
    }
    // заборчик из штакетника
    g.fillStyle = '#b89470';
    for (let x = 0; x < LW; x += 14) {
      g.beginPath();
      g.moveTo(x, base + 4);
      g.lineTo(x, base - 14);
      g.lineTo(x + 4, base - 18);
      g.lineTo(x + 8, base - 14);
      g.lineTo(x + 8, base + 4);
      g.fill();
    }
    g.fillStyle = '#9b7756';
    g.fillRect(0, base - 10, LW, 3);
    haze(g, 110, H, 0.12);
  });
}

function meadowLayer() {
  return buildLayer('meadow', 360, H + 160, 1, 0, (g) => {
    const base = 432;
    const mg = g.createLinearGradient(0, base - 10, 0, H);
    mg.addColorStop(0, '#8fd068');
    mg.addColorStop(1, '#5fae43');
    g.fillStyle = mg;
    g.fillRect(0, base, LW, H + 160 - base);
    for (let i = 0; i < 46; i++) {
      const x = (i / 46) * LW + hash(i * 5.7) * 20;
      const r = hash(i * 3.3);
      wrap((o) => {
        if (r < 0.55) canopy(g, x + o, base + 2, 16 + hash(i) * 10, '#9fe07a', '#55a33c', 'rgba(30, 80, 30, .25)', i * 13);
        else {
          const colors = ['#ffffff', '#ffe066', '#ff8fb8', '#b49cff'];
          for (let k = 0; k < 5; k++) {
            const fx = x + o + (hash(i + k) - 0.5) * 50;
            const fy = base + 12 + hash(i * 2 + k) * 40;
            g.fillStyle = '#4d9a38';
            g.fillRect(fx - 0.7, fy, 1.4, 7);
            ellipse(g, fx, fy, 3.2, 3.2, colors[Math.floor(hash(i * k + 1) * colors.length)]);
            ellipse(g, fx, fy, 1.2, 1.2, '#ffd23f');
          }
        }
      });
    }
  });
}

let cloudSprite = null;
function cloud() {
  if (cloudSprite) return cloudSprite;
  const c = document.createElement('canvas');
  const s = deviceScale;
  c.width = 200 * s;
  c.height = 110 * s;
  const g = c.getContext('2d');
  g.scale(s, s);
  const puffs = [[50, 70, 30], [85, 50, 38], [125, 58, 32], [150, 74, 24], [95, 78, 30], [30, 82, 20]];
  g.fillStyle = 'rgba(160, 190, 215, .35)';
  for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x + 2, y + 8, r, 0, Math.PI * 2); g.fill(); }
  for (const [x, y, r] of puffs) {
    const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.5, r * 0.2, x, y, r);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(1, '#e9f3fb');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  cloudSprite = c;
  return c;
}

// ---------- электричка (рисуется каждый кадр, едет) ----------

function railway(ctx, off, y, W, t) {
  const g = ctx.createLinearGradient(0, y - 6, 0, y + 16);
  g.addColorStop(0, '#c2b4a0');
  g.addColorStop(1, '#8f8170');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, y + 16);
  ctx.lineTo(0, y - 2);
  ctx.quadraticCurveTo(W / 2, y - 6, W, y - 2);
  ctx.lineTo(W, y + 16);
  ctx.fill();
  ctx.fillStyle = '#6b4f3a';
  const st = 16;
  for (let x = -(((off % st) + st) % st); x < W; x += st) ctx.fillRect(x, y - 2, 9, 5);
  ctx.fillStyle = '#7d8088';
  ctx.fillRect(0, y - 5, W, 2.5);
  ctx.fillStyle = '#c9ccd2';
  ctx.fillRect(0, y - 5, W, 1);

  const period = 24;
  const phase = (t % period) / period;
  const len = 4 * 190;
  const span = W + len + 600;
  const tx = W + 300 - phase * span;
  if (tx < W && tx + len > 0) train(ctx, tx, y - 4);
}

function train(ctx, x, y) {
  for (let c = 0; c < 4; c++) {
    const cx = x + c * 190;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(cx + 4, y - 2, 176, 4);
    const body = ctx.createLinearGradient(0, y - 54, 0, y - 4);
    body.addColorStop(0, '#5fb27a');
    body.addColorStop(0.6, '#3e8a54');
    body.addColorStop(1, '#2c6b3f');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx, y - 52, 182, 48, c === 0 ? [18, 6, 6, 6] : 6) : ctx.rect(cx, y - 52, 182, 48);
    ctx.fill();
    ctx.fillStyle = '#d9473f';
    ctx.fillRect(cx, y - 18, 182, 6);
    ctx.fillStyle = '#a5aab1';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx + 6, y - 57, 170, 7, 3) : ctx.rect(cx + 6, y - 57, 170, 7);
    ctx.fill();
    for (let w = 0; w < 7; w++) {
      const wg = ctx.createLinearGradient(0, y - 44, 0, y - 28);
      wg.addColorStop(0, '#eaf7ff');
      wg.addColorStop(1, '#8cbfe0');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(cx + 14 + w * 24, y - 44, 16, 15, 3) : ctx.rect(cx + 14 + w * 24, y - 44, 16, 15);
      ctx.fill();
    }
    ctx.fillStyle = '#2a2a2a';
    for (const wx of [cx + 30, cx + 46, cx + 136, cx + 152]) { ctx.beginPath(); ctx.arc(wx, y - 2, 6, 0, Math.PI * 2); ctx.fill(); }
  }
}

// ---------- сборка кадра ----------

// Картинка-слой, повторяется по горизонтали; каждый второй повтор зеркальный,
// чтобы края стыковались без шва.
function imageStrip(ctx, img, off, y, w, h, W) {
  const start = Math.floor(off / w);
  for (let i = start; (i * w) - off < W; i++) {
    const x = i * w - off;
    if (i % 2 === 0) ctx.drawImage(img, x, y, w + 0.5, h);
    else {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w + 0.5, h);
      ctx.restore();
    }
  }
}

function trainPass(ctx, W, y, t) {
  const period = 24;
  const phase = (t % period) / period;
  const len = 4 * 190;
  const span = W + len + 600;
  const tx = W + 300 - phase * span;
  if (tx < W && tx + len > 0) train(ctx, tx, y);
}

// Трава под картинкой деревни (видна на главной и в магазине): мягкий градиент,
// травинки и цветочки. Рисуется один раз и повторяется.
let grassCache = null;
function grassTile() {
  if (grassCache) return grassCache;
  const w = 600, h = 260;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#6b7c12');
  gr.addColorStop(0.35, '#5f7f1d');
  gr.addColorStop(1, '#46681c');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  // пятна светлее и темнее
  for (let i = 0; i < 40; i++) {
    const x = hash(i * 3.1) * w, y = hash(i * 7.7) * h, r = 30 + hash(i * 1.3) * 70;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, i % 2 ? 'rgba(160, 200, 80, .22)' : 'rgba(40, 70, 20, .18)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    for (const dx of [-w, 0, w]) g.fillRect(x - r + dx, y - r, r * 2, r * 2);
  }
  // травинки
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = hash(i * 1.71) * w;
    const y = 6 + hash(i * 2.37) * (h - 6);
    const len = 6 + hash(i * 5.1) * 10 * (0.6 + y / h);
    const lean = (hash(i * 9.3) - 0.5) * 6;
    g.strokeStyle = hash(i * 4.4) > 0.5 ? 'rgba(150, 195, 70, .55)' : 'rgba(45, 85, 25, .45)';
    g.lineWidth = 1.2 + y / h;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len);
    g.stroke();
  }
  // цветочки: ромашки и клевер
  for (let i = 0; i < 26; i++) {
    const x = 20 + hash(i * 6.6) * (w - 40), y = 20 + hash(i * 8.2) * (h - 30);
    const s = 1.6 + y / h * 1.8;
    g.fillStyle = i % 3 === 0 ? '#e7a3d8' : '#fffdf5';
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 0.4;
      g.beginPath();
      g.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.8, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#f4c542';
    g.beginPath();
    g.arc(x, y, s * 0.6, 0, Math.PI * 2);
    g.fill();
  }
  grassCache = c;
  return c;
}

// Размеры слоёв из нейросети в виртуальных пикселях.
const VILLAGE_H = 340;
const VILLAGE_TOP = 130;
const VILLAGE_RAIL = 0.768; // где рельсы на картинке деревни (доля высоты)

export function drawScenery(ctx, cx, dy, W, t, IMG = {}) {
  if (IMG.sky) {
    const sh = 500;
    const sw = sh * (IMG.sky.width / IMG.sky.height);
    ctx.fillStyle = '#8fd0f7';
    ctx.fillRect(0, 0, W, H + 400);
    imageStrip(ctx, IMG.sky, cx * 0.04, -dy * 0.05 - 10, sw, sh, W);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#5fb6ec');
    sky.addColorStop(0.55, '#b9e3f8');
    sky.addColorStop(1, '#e8f7ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H + 400);
    const sx = W * 0.8;
    const sy = H * 0.15 - dy * 0.05;
    const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 160);
    sg.addColorStop(0, 'rgba(255, 250, 220, 1)');
    sg.addColorStop(0.25, 'rgba(255, 244, 200, .8)');
    sg.addColorStop(1, 'rgba(255, 244, 200, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 160, sy - 160, 320, 320);
    const cs = cloud();
    for (let i = 0; i < 6; i++) {
      const span = W + 500;
      let x = (i * 330 + 120 - cx * 0.05 - t * 5) % span;
      if (x < 0) x += span;
      x -= 250;
      const y = H * (0.05 + hash(i) * 0.22) - dy * 0.05;
      const s = 0.7 + hash(i + 9) * 0.6;
      ctx.drawImage(cs, x, y, 200 * s, 110 * s);
    }
  }

  blit(ctx, farLayer(), cx * 0.1, -dy * 0.12, W);
  blit(ctx, forestLayer(), cx * 0.22, -dy * 0.25, W);

  if (IMG.village) {
    const vw = VILLAGE_H * (IMG.village.width / IMG.village.height);
    const vy = VILLAGE_TOP - dy * 0.45;
    const gy = vy + VILLAGE_H - 30;
    ctx.fillStyle = '#4a7421';
    ctx.fillRect(0, gy, W, H + 400);
    imageStrip(ctx, grassTile(), cx * 0.6, gy, 600, 260, W);
    imageStrip(ctx, IMG.village, cx * 0.45, vy, vw, VILLAGE_H, W);
    // плавный переход от травы на картинке к траве-текстуре
    const fy = vy + VILLAGE_H - 3;
    const fade = ctx.createLinearGradient(0, fy, 0, fy + 40);
    fade.addColorStop(0, 'rgba(104, 119, 11, 1)');
    fade.addColorStop(1, 'rgba(104, 119, 11, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, fy, W, 40);
    trainPass(ctx, W, vy + VILLAGE_H * VILLAGE_RAIL - 2, t);
  } else {
    blit(ctx, villageLayer(), cx * 0.4, -dy * 0.4, W);
    railway(ctx, cx * 0.55, 418 - dy * 0.55, W, t);
    blit(ctx, meadowLayer(), cx * 0.7, -dy * 0.7, W);
  }
}

// Мягкая виньетка и тёплый свет поверх всего мира (в экранных координатах).
export function drawVignette(ctx, W) {
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.45, W / 2, H * 0.5, W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(20, 30, 10, .28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  const warm = ctx.createLinearGradient(W, 0, 0, H);
  warm.addColorStop(0, 'rgba(255, 220, 150, .14)');
  warm.addColorStop(0.5, 'rgba(255, 220, 150, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);
}
