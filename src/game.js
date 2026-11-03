import { TILE, parseLevel } from './levels.js';
import { CONFIG, AGES, OUTFITS } from './config.js';
import { input } from './input.js';
import { save } from './save.js';
import { drawBackground, drawTiles, drawCoin, drawEnemy, drawHeroine, drawStation, drawCheckpoint, drawStone, drawSign, drawHint, drawVignette, drawShadow } from './draw.js';

// Физика (пиксели и секунды). Подобрано под «мягкий» платформер.
const G = 2300;
const MAX_FALL = 1100;
const RUN = 320;
const ACC_GROUND = 2600;
const ACC_AIR = 1700;
const FRICTION = 3000;
const JUMP_V = 860;
const COYOTE = 0.1; // можно прыгнуть чуть после того, как сошла с края
const BUFFER = 0.12; // нажатие прыжка чуть раньше приземления не теряется
const STEP = 1 / 120;

// '=' — тонкие доски: на них можно запрыгнуть снизу и встать сверху.
const isSolid = (t) => t === '#' || t === 'B';
const canStand = (t) => isSolid(t) || t === '=';

const LAND_TIME = 0.2; // сколько длится приседание при приземлении

export class Game {
  constructor(def, events) {
    this.def = def;
    this.events = events; // { onComplete, onGameOver, onHud }
    this.viewW = 960;
    this.viewH = 540;
    this.reset();
  }

  setView(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  reset() {
    this.level = parseLevel(this.def);
    const s = AGES[this.def.age]?.scale ?? 1;
    this.player = {
      w: Math.round(32 * s), h: Math.round(72 * s), scale: s,
      x: 0, y: 0, vx: 0, vy: 0, onGround: false, facing: 1,
      coyote: 0, buffer: 0, invuln: 0, throwCd: 0, throwAnim: 0, anim: 0, land: 0, fallV: 0,
    };
    const st = this.level.start;
    this.spawn = { x: st.x * TILE + TILE / 2, y: this.groundBelow(st.x, st.y) };
    this.placePlayer(this.spawn);
    this.lives = CONFIG.startLives;
    this.coins = 0;
    let boxes = 0;
    for (const row of this.level.tiles) for (const t of row) if (t === 'B') boxes++;
    this.totalCoins = this.level.coins.length + boxes;
    this.enemies = this.level.enemies.map((e) => ({ x: e.x - 6, y: e.y - 8, w: 48, h: 44, dir: -1, vy: 0, alive: true, dead: 0, angry: false }));
    this.finishGround = this.level.finish ? this.groundBelow(this.level.finish.x / TILE, this.level.finish.y / TILE) : 0;
    for (const cp of this.level.checkpoints) cp.ground = this.groundBelow(cp.x / TILE, cp.y / TILE);
    this.signs = (this.def.signs || []).map((sg) => ({
      ...sg, x: sg.col * TILE + TILE / 2, ground: this.groundBelow(sg.col, this.level.h - 4),
    }));
    this.hint = null;
    this.hintAlpha = 0;
    this.shots = [];
    this.particles = [];
    this.popups = [];
    this.cam = { x: 0, y: 0, look: 0 };
    this.time = 0;
    this.acc = 0;
    this.shake = 0;
    this.state = 'play';
    this.snapCamera();
    this.hud();
  }

  // ---------- карта ----------
  tile(tx, ty) {
    const L = this.level;
    if (tx < 0 || tx >= L.w) return '#'; // невидимые стены по краям
    if (ty < 0 || ty >= L.h) return ' ';
    return L.tiles[ty][tx];
  }

  groundBelow(tx, ty) {
    tx = Math.floor(tx);
    for (let y = Math.floor(ty); y < this.level.h; y++) if (canStand(this.tile(tx, y))) return y * TILE;
    return this.level.h * TILE;
  }

  colSolid(tx, y0, y1) {
    for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y1 - 0.01) / TILE); ty++) if (isSolid(this.tile(tx, ty))) return true;
    return false;
  }

  rowSolid(ty, x0, x1, test = isSolid) {
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x1 - 0.01) / TILE); tx++) if (test(this.tile(tx, ty))) return true;
    return false;
  }

  moveBody(b, dt) {
    const res = { left: false, right: false, ground: false, ceil: false };
    b.x += b.vx * dt;
    if (b.vx > 0) {
      const tx = Math.floor((b.x + b.w) / TILE);
      if (this.colSolid(tx, b.y, b.y + b.h)) { b.x = tx * TILE - b.w - 0.01; b.vx = 0; res.right = true; }
    } else if (b.vx < 0) {
      const tx = Math.floor(b.x / TILE);
      if (this.colSolid(tx, b.y, b.y + b.h)) { b.x = (tx + 1) * TILE; b.vx = 0; res.left = true; }
    }
    const prevBottom = b.y + b.h;
    b.y += b.vy * dt;
    if (b.vy > 0) {
      const ty = Math.floor((b.y + b.h) / TILE);
      const fromAbove = prevBottom <= ty * TILE + 0.5;
      if (this.rowSolid(ty, b.x, b.x + b.w, fromAbove ? canStand : isSolid)) { b.y = ty * TILE - b.h; b.vy = 0; res.ground = true; }
    } else if (b.vy < 0) {
      const ty = Math.floor(b.y / TILE);
      if (this.rowSolid(ty, b.x, b.x + b.w)) { b.y = (ty + 1) * TILE; b.vy = 0; res.ceil = true; }
    }
    return res;
  }

  placePlayer(pt) {
    const p = this.player;
    p.x = pt.x - p.w / 2;
    p.y = pt.y - p.h;
    p.vx = 0;
    p.vy = 0;
  }

  // ---------- цикл ----------
  step(frameDt) {
    if (this.state !== 'play') return;
    // Нажатия читаем один раз за кадр, физику считаем мелкими шагами.
    if (input.jumpPressed) this.player.buffer = BUFFER;
    if (input.throwPressed) this.throwShot();
    this.acc = Math.min(this.acc + frameDt, 0.1);
    while (this.acc >= STEP && this.state === 'play') {
      this.update(STEP);
      this.acc -= STEP;
    }
  }

  update(dt) {
    this.time += dt;
    this.updatePlayer(dt);
    this.updateShots(dt);
    this.updateEnemies(dt);
    this.updateFx(dt);
    this.updateCamera(dt);
    this.updateHint(dt);
  }

  // Подсказка показывается, пока героиня рядом с табличкой (и ещё несколько клеток после неё).
  updateHint(dt) {
    const px = this.player.x + this.player.w / 2;
    let cur = null;
    for (const sg of this.signs) if (px > sg.x - TILE * 1.5 && px < sg.x + TILE * 6) cur = sg;
    if (cur) {
      if (this.hint !== cur.text) this.hintAlpha = 0;
      this.hint = cur.text;
      this.hintAlpha = Math.min(1, this.hintAlpha + dt * 4);
    } else {
      this.hintAlpha = Math.max(0, this.hintAlpha - dt * 3);
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) p.facing = dir;
    const acc = p.onGround ? ACC_GROUND : ACC_AIR;
    if (dir) {
      const turning = Math.sign(p.vx) === -dir;
      p.vx += dir * acc * (turning ? 1.8 : 1) * dt;
      p.vx = Math.max(-RUN, Math.min(RUN, p.vx));
    } else {
      const f = (p.onGround ? FRICTION : FRICTION * 0.25) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }

    p.coyote = p.onGround ? COYOTE : p.coyote - dt;
    p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -JUMP_V;
      p.buffer = 0;
      p.coyote = 0;
      p.onGround = false;
      this.puff(p.x + p.w / 2, p.y + p.h, 5);
    }

    // Отпустила кнопку — прыжок ниже. Падение чуть быстрее подъёма.
    let g = G;
    if (p.vy < 0 && !input.jump) g *= 2.6;
    else if (p.vy > 0) g *= 1.15;
    p.vy = Math.min(p.vy + g * dt, MAX_FALL);

    const wasGround = p.onGround;
    const vyBefore = p.vy;
    const res = this.moveBody(p, dt);
    p.onGround = res.ground;
    if (p.onGround && !wasGround) {
      this.puff(p.x + p.w / 2, p.y + p.h, 3);
      // приземление: чем выше падала, тем глубже присядет
      p.land = LAND_TIME;
      p.fallV = Math.min(1, Math.max(0.35, vyBefore / 700));
    }
    p.land = Math.max(0, p.land - dt);

    p.anim += Math.abs(p.vx) * dt * 0.05;
    p.invuln = Math.max(0, p.invuln - dt);
    p.throwCd -= dt;
    p.throwAnim = Math.max(0, p.throwAnim - dt);

    // Монетки
    for (const c of this.level.coins) {
      if (c.taken) continue;
      if (c.x > p.x - 14 && c.x < p.x + p.w + 14 && c.y > p.y - 14 && c.y < p.y + p.h + 14) {
        c.taken = true;
        this.coins++;
        this.sparkle(c.x, c.y);
        this.hud();
      }
    }

    // Лужи
    const feetRow = Math.floor((p.y + p.h - 4) / TILE);
    for (let tx = Math.floor((p.x + 6) / TILE); tx <= Math.floor((p.x + p.w - 6) / TILE); tx++) {
      if (this.tile(tx, feetRow) === '~') { this.loseLife('Промочила ноги!'); return; }
    }

    // Пропасть
    if (p.y > this.level.h * TILE + 120) { this.loseLife('Ой, упала!'); return; }

    // Контрольные точки
    for (const cp of this.level.checkpoints) {
      if (!cp.active && p.x > cp.x) {
        cp.active = true;
        this.spawn = { x: cp.x + TILE / 2, y: cp.ground };
        this.popup(cp.x + TILE / 2, cp.ground - 90, 'Сохранено');
      }
    }

    // Финиш
    const F = this.level.finish;
    if (F && p.x + p.w > F.x + TILE * 0.4) {
      this.state = 'done';
      this.events.onComplete?.({ coins: this.coins, total: this.totalCoins, lives: this.lives });
    }
  }

  throwShot() {
    const p = this.player;
    if (this.state !== 'play' || p.throwCd > 0 || this.shots.length >= 3) return;
    p.throwCd = 0.3;
    p.throwAnim = 0.22;
    this.shots.push({
      x: p.x + p.w / 2 + p.facing * 12,
      y: p.y + p.h * 0.5,
      vx: p.facing * 640 + p.vx * 0.3,
      vy: -260,
      r: 9,
      a: 0,
      life: 1.6,
    });
  }

  updateShots(dt) {
    for (const s of this.shots) {
      s.life -= dt;
      s.a += dt * 14 * Math.sign(s.vx);
      s.vy += G * 0.5 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const tx = Math.floor(s.x / TILE);
      const ty = Math.floor(s.y / TILE);
      const t = this.tile(tx, ty);
      if (isSolid(t)) {
        if (t === 'B') this.breakBox(tx, ty);
        this.splash(s.x, s.y);
        s.life = 0;
        continue;
      }
      for (const e of this.enemies) {
        if (e.alive && s.x > e.x - s.r && s.x < e.x + e.w + s.r && s.y > e.y - s.r && s.y < e.y + e.h + s.r) {
          this.killEnemy(e, Math.sign(s.vx));
          this.splash(s.x, s.y);
          s.life = 0;
          break;
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0 && s.y < this.level.h * TILE + 200);
  }

  breakBox(tx, ty) {
    this.level.tiles[ty][tx] = ' ';
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: cx, y: cy, vx: (Math.random() - 0.5) * 500, vy: -Math.random() * 500 - 100,
        life: 0.8, size: 6 + Math.random() * 6, color: i % 2 ? '#b07a3e' : '#8a5a2b', g: 1,
      });
    }
    // Монетка из ящика сразу идёт в копилку.
    this.coins++;
    this.sparkle(cx, cy);
    this.popup(cx, cy - 10, '+1');
    this.hud();
    // Ящики сверху падают на освободившееся место.
    for (let y = ty; y > 0 && this.level.tiles[y - 1][tx] === 'B'; y--) {
      this.level.tiles[y][tx] = 'B';
      this.level.tiles[y - 1][tx] = ' ';
    }
    this.shake = 0.15;
  }

  killEnemy(e, dir) {
    e.alive = false;
    e.dead = 0.6;
    e.vy = -400;
    e.flyX = dir * 150;
    this.popup(e.x + e.w / 2, e.y - 10, 'Бах!');
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) {
        e.dead -= dt;
        e.vy += G * dt;
        e.y += e.vy * dt;
        e.x += (e.flyX || 0) * dt;
        continue;
      }
      // Ходят туда-сюда, разворачиваются у стен и у края платформы.
      e.vx = e.dir * 70;
      e.vy = Math.min(e.vy + G * dt, MAX_FALL);
      const res = this.moveBody(e, dt);
      if (res.left || res.right) e.dir *= -1;
      if (res.ground) {
        const fx = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
        if (!canStand(this.tile(Math.floor(fx / TILE), Math.floor((e.y + e.h + 2) / TILE)))) e.dir *= -1;
      }
      if (e.y > this.level.h * TILE + 100) e.alive = false;
      // Шипит, когда Полина близко и гусь смотрит на неё.
      const dx = p.x + p.w / 2 - (e.x + e.w / 2);
      e.angry = Math.abs(dx) < 190 && Math.sign(dx) === e.dir && Math.abs(p.y - e.y) < 120;

      // Столкновение с героиней
      if (this.state !== 'play') continue;
      if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
        if (p.vy > 0 && p.y + p.h - e.y < 22) {
          this.killEnemy(e, 0);
          p.vy = -JUMP_V * 0.6;
        } else if (p.invuln <= 0) {
          this.hurt(Math.sign(p.x + p.w / 2 - (e.x + e.w / 2)) || 1);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive || e.dead > 0);
  }

  hurt(dir) {
    const p = this.player;
    this.lives--;
    this.hud();
    p.invuln = 1.5;
    p.vx = dir * 380;
    p.vy = -520;
    this.shake = 0.25;
    if (this.lives <= 0) this.gameOver();
  }

  loseLife(reason) {
    this.lives--;
    this.hud();
    this.popup(this.player.x + this.player.w / 2, this.player.y - 20, reason);
    this.shake = 0.25;
    if (this.lives <= 0) { this.gameOver(); return; }
    this.placePlayer(this.spawn);
    this.player.invuln = 1.5;
    this.snapCamera();
  }

  gameOver() {
    this.state = 'over';
    this.events.onGameOver?.();
  }

  // ---------- эффекты ----------
  puff(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 60, life: 0.35, size: 5, color: 'rgba(255,255,255,.7)', g: 0 });
    }
  }

  sparkle(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 0.35, size: 4, color: '#ffe27a', g: 0 });
    }
  }

  splash(x, y) {
    for (let i = 0; i < 7; i++) {
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 250, life: 0.4, size: 4, color: CONFIG.projectile.color, g: 1 });
    }
  }

  popup(x, y, text) {
    this.popups.push({ x, y, text, life: 1.1 });
  }

  updateFx(dt) {
    for (const q of this.particles) {
      q.life -= dt;
      q.vy += G * 0.6 * q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const q of this.popups) { q.life -= dt; q.y -= 40 * dt; }
    this.popups = this.popups.filter((q) => q.life > 0);
    this.shake = Math.max(0, this.shake - dt);
  }

  // ---------- камера ----------
  cameraTarget() {
    const p = this.player;
    const L = this.level;
    const tx = p.x + p.w / 2 - this.viewW * 0.42 + this.cam.look;
    const ty = p.y + p.h / 2 - this.viewH * 0.55;
    return {
      x: Math.max(0, Math.min(L.w * TILE - this.viewW, tx)),
      y: Math.min(L.h * TILE - this.viewH, ty),
    };
  }

  snapCamera() {
    this.cam.look = 0;
    const t = this.cameraTarget();
    this.cam.x = t.x;
    this.cam.y = t.y;
  }

  updateCamera(dt) {
    this.cam.look += (this.player.facing * 60 - this.cam.look) * Math.min(1, dt * 2);
    const t = this.cameraTarget();
    this.cam.x += (t.x - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (t.y - this.cam.y) * Math.min(1, dt * 5);
  }

  hud() {
    this.events.onHud?.({ lives: this.lives, coins: this.coins });
  }

  // ---------- отрисовка ----------
  draw(ctx) {
    const { viewW: W, viewH: H } = this;
    let cx = this.cam.x;
    let cy = this.cam.y;
    if (this.shake > 0) {
      cx += (Math.random() - 0.5) * 10;
      cy += (Math.random() - 0.5) * 10;
    }
    // dy: насколько камера поднята над «нижним» положением (для параллакса по вертикали).
    drawBackground(ctx, this.def.theme, cx, cy - (this.level.h * TILE - H), W, H, this.time);

    ctx.save();
    ctx.translate(-Math.round(cx), -Math.round(cy));

    drawTiles(ctx, this.level, cx, cy, W, H, this.time);

    if (this.level.finish) drawStation(ctx, this.level.finish.x + TILE / 2, this.finishGround, this.time);
    for (const sg of this.signs) drawSign(ctx, sg.x, sg.ground, sg.text === this.hint && this.hintAlpha > 0);
    for (const cp of this.level.checkpoints) drawCheckpoint(ctx, cp.x + TILE / 2, cp.ground, cp.active);

    for (const c of this.level.coins) {
      if (!c.taken && c.x > cx - 40 && c.x < cx + W + 40) drawCoin(ctx, c.x, c.y + Math.sin(this.time * 3 + c.x) * 3, this.time + c.x * 0.01);
    }

    for (const e of this.enemies) drawEnemy(ctx, e, this.time);

    const p = this.player;
    const gy = this.groundBelow((p.x + p.w / 2) / TILE, (p.y + p.h - 2) / TILE);
    const shadowY = gy - (p.y + p.h) < 260 ? gy : undefined;
    if (!(p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0)) {
      drawHeroine(ctx, {
        shadowY,
        x: p.x + p.w / 2, y: p.y + p.h, h: p.h, facing: p.facing,
        running: p.onGround && Math.abs(p.vx) > 20, airborne: !p.onGround, vy: p.vy,
        land: p.land > 0 ? Math.sin((1 - p.land / LAND_TIME) * Math.PI) * p.fallV : 0,
        anim: p.anim, throwing: p.throwAnim > 0, throwT: 1 - p.throwAnim / 0.22, outfitId: OUTFITS[save.outfit] ? save.outfit : 'sundress', outfit: OUTFITS[save.outfit] || OUTFITS.sundress,
      });
    }

    for (const s of this.shots) drawStone(ctx, s.x, s.y, s.r, s.a);
    for (const c of this.level.coins) if (!c.taken && c.x > cx - 40 && c.x < cx + W + 40) drawShadow(ctx, c.x, this.groundBelow(c.x / TILE, c.y / TILE), 10, 0.12);

    for (const q of this.particles) {
      ctx.globalAlpha = Math.min(1, q.life * 3);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;

    ctx.font = '700 22px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (const q of this.popups) {
      ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.strokeText(q.text, q.x, q.y);
      ctx.fillStyle = '#fff';
      ctx.fillText(q.text, q.x, q.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    drawVignette(ctx, W);
    if (this.hint && this.hintAlpha > 0) drawHint(ctx, this.hint, W, this.hintAlpha);
  }
}
