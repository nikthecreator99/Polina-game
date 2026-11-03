import { Game } from './game.js';
import { LEVELS } from './levels.js';
import { CONFIG, OUTFITS } from './config.js';
import { input, initInput } from './input.js';
import { save, persist } from './save.js';
import { drawBackground, drawHeroine } from './draw.js';

const VIEW_H = 540; // виртуальная высота экрана; ширина зависит от пропорций устройства

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let viewW = 960;
let scale = 1;
let game = null;
let levelIndex = 0;
let mode = 'menu'; // menu | intro | play | pause | complete | over
let menuTime = 0;

// ---------- размер экрана ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  scale = canvas.height / VIEW_H;
  viewW = canvas.width / scale;
  if (game) game.setView(viewW, VIEW_H);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- экраны ----------
const SCREENS = ['menu', 'levels', 'intro', 'pause', 'complete', 'gameover'];
function show(name) {
  for (const s of SCREENS) $(`screen-${s}`).classList.toggle('hidden', s !== name);
  const playing = name === null || name === 'pause';
  $('hud').classList.toggle('hidden', !playing);
  $('controls').classList.toggle('hidden', name !== null);
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2200);
}

function goMenu() {
  game = null;
  mode = 'menu';
  $('menu-coins').textContent = save.coins;
  show('menu');
}

function openIntro(i) {
  levelIndex = i;
  const L = LEVELS[i];
  $('intro-eyebrow').textContent = L.chapter;
  $('intro-title').textContent = L.title;
  $('intro-text').textContent = L.text;
  mode = 'intro';
  show('intro');
}

function startLevel() {
  const L = LEVELS[levelIndex];
  game = new Game(L, {
    onHud: ({ lives, coins }) => {
      $('hud-lives').textContent = '♥'.repeat(Math.max(0, lives));
      $('hud-coins').textContent = coins;
    },
    onComplete: ({ coins, total }) => {
      save.coins += coins;
      save.best[L.id] = Math.max(save.best[L.id] || 0, coins);
      save.unlocked = Math.max(save.unlocked, levelIndex + 2);
      persist();
      $('complete-title').textContent = L.title;
      $('complete-text').textContent = `Собрано монеток: ${coins} из ${total}. Всего в копилке: ${save.coins}.`;
      setTimeout(() => { mode = 'complete'; show('complete'); }, 700);
    },
    onGameOver: () => {
      setTimeout(() => { mode = 'over'; show('gameover'); }, 600);
    },
  });
  game.setView(viewW, VIEW_H);
  game.snapCamera();
  $('hud-title').textContent = L.title;
  input.reset();
  mode = 'play';
  show(null);
}

function renderLevelList() {
  const list = $('level-list');
  list.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.disabled = i + 1 > save.unlocked;
    b.innerHTML = `<small>${L.chapter}</small>${L.title}`;
    b.addEventListener('click', () => openIntro(i));
    list.appendChild(b);
  });
}

const actions = {
  'new-game': () => openIntro(0),
  levels: () => { renderLevelList(); mode = 'levels'; show('levels'); },
  wardrobe: () => toast('Гардероб скоро появится'),
  shop: () => toast('Магазин скоро появится'),
  menu: goMenu,
  'start-level': startLevel,
  resume: () => { input.reset(); mode = 'play'; show(null); },
  restart: startLevel,
  'next-level': () => {
    if (levelIndex + 1 < LEVELS.length) openIntro(levelIndex + 1);
    else { goMenu(); toast('Следующие уровни уже в работе!'); }
  },
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (btn && actions[btn.dataset.action]) actions[btn.dataset.action]();
});

function pause() {
  if (mode !== 'play') return;
  mode = 'pause';
  show('pause');
}
$('btn-pause').addEventListener('click', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('keydown', (e) => { if (e.code === 'Escape' || e.code === 'KeyP') mode === 'play' ? pause() : mode === 'pause' && actions.resume(); });

// ---------- главный цикл ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (game && mode === 'play') game.step(dt);
  input.endFrame();

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  if (game) {
    game.draw(ctx);
  } else {
    // Фон главного меню: медленно «едем» по Зелёному, слева стоит Полина.
    menuTime += dt;
    drawBackground(ctx, 'zeleny', menuTime * 20, 0, viewW, VIEW_H, menuTime);
    ctx.fillStyle = '#6cc04a';
    ctx.fillRect(0, VIEW_H * 0.86, viewW, VIEW_H);
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(0, VIEW_H * 0.86 + 14, viewW, VIEW_H);
    if (mode === 'menu') {
      drawHeroine(ctx, {
        x: viewW * 0.24, y: VIEW_H * 0.86 + 2, h: 300, facing: 1,
        running: false, airborne: false, anim: 0, throwing: false,
        outfit: OUTFITS[save.outfit] || OUTFITS.starter,
      });
    }
  }
  requestAnimationFrame(frame);
}

// ---------- старт ----------
$('menu-title').innerHTML = `<small>${CONFIG.titleTop}</small><span>${CONFIG.titleName}</span>`;
document.title = `${CONFIG.titleTop} ${CONFIG.titleName}`;
initInput();
resize();
goMenu();
requestAnimationFrame(frame);

// Для автотестов и отладки в консоли.
window.__polina = { getGame: () => game, input };

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
