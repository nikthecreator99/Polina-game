import { Game } from './game.js';
import { LEVELS } from './levels.js';
import { CONFIG, OUTFITS, DEFAULT_OUTFIT } from './config.js';
import { loadAssets } from './assets.js';
import { input, initInput } from './input.js';
import { save, persist } from './save.js';
import { drawBackground, drawVignette, setRenderScale } from './draw.js';

// Виртуальная высота экрана; ширина зависит от пропорций устройства.
// На телефоне (низкий широкий экран) мир чуть крупнее, чтобы Полину было хорошо видно.
let VIEW_H = 540;

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
  VIEW_H = h < 500 ? 450 : 540;
  scale = canvas.height / VIEW_H;
  viewW = canvas.width / scale;
  setRenderScale(scale);
  if (game) game.setView(viewW, VIEW_H);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- экраны ----------
const SCREENS = ['menu', 'levels', 'wardrobe', 'shop', 'intro', 'pause', 'complete', 'gameover'];
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
  $('menu-girl').src = frontImg(save.outfit);
  show('menu');
}

// ---------- гардероб и ярмарка ----------
const wornId = () => (OUTFITS[save.outfit] ? save.outfit : DEFAULT_OUTFIT);
const frontImg = (id) => `img/polina/front-${OUTFITS[id] ? id : DEFAULT_OUTFIT}.webp`;
let wardrobeSel = DEFAULT_OUTFIT;

function openWardrobe() {
  wardrobeSel = wornId();
  renderWardrobe();
  mode = 'wardrobe';
  show('wardrobe');
}

function renderWardrobe() {
  const o = OUTFITS[wardrobeSel];
  const owned = save.owned.includes(wardrobeSel);
  $('wardrobe-big').src = frontImg(wardrobeSel);
  $('wardrobe-name').textContent = o.name;
  $('wardrobe-note').textContent = owned ? o.note : `${o.note}. Можно купить на ярмарке за ${o.price} монеток.`;
  const wear = $('wardrobe-wear');
  if (!owned) wear.textContent = 'На ярмарку';
  else if (wardrobeSel === wornId()) wear.textContent = 'Уже надето';
  else wear.textContent = 'Надеть';
  wear.disabled = owned && wardrobeSel === wornId();
  const list = $('wardrobe-list');
  list.innerHTML = '';
  for (const id of Object.keys(OUTFITS)) {
    const b = document.createElement('button');
    b.className = 'outfit';
    b.classList.toggle('sel', id === wardrobeSel);
    b.classList.toggle('worn', id === wornId());
    b.classList.toggle('locked', !save.owned.includes(id));
    b.setAttribute('aria-label', OUTFITS[id].name);
    b.innerHTML = `<img src="${frontImg(id)}" alt="">`;
    b.addEventListener('click', () => { wardrobeSel = id; renderWardrobe(); });
    list.appendChild(b);
  }
}

$('wardrobe-wear').addEventListener('click', () => {
  if (!save.owned.includes(wardrobeSel)) { openShop(); return; }
  save.outfit = wardrobeSel;
  persist();
  renderWardrobe();
  toast(`Полина переоделась: ${OUTFITS[wardrobeSel].name.toLowerCase()}`);
});

const BLANKETS = ['#c94f4f', '#4f7cc9', '#d99a2b', '#7a5aa8', '#3f9a6b'];

function openShop() {
  renderShop();
  mode = 'shop';
  show('shop');
}

function renderShop() {
  $('shop-coins').textContent = save.coins;
  const box = $('shop-items');
  box.innerHTML = '';
  Object.entries(OUTFITS).forEach(([id, o], i) => {
    const owned = save.owned.includes(id);
    const b = document.createElement('button');
    b.className = 'shop-item';
    b.classList.toggle('owned', owned);
    b.style.setProperty('--blanket', BLANKETS[i % BLANKETS.length]);
    b.style.setProperty('--tilt', `${[-4, 3, -2, 4][i % 4]}deg`);
    const price = owned ? (id === wornId() ? 'надето' : 'уже твоё') : `${o.price} монеток`;
    b.innerHTML = `<span class="blanket"></span><img src="${frontImg(id)}" alt=""><span class="tag">${o.name}<small>${price}</small></span>`;
    b.addEventListener('click', () => buy(id));
    box.appendChild(b);
  });
}

function buy(id) {
  const o = OUTFITS[id];
  if (save.owned.includes(id)) {
    save.outfit = id;
    persist();
    renderShop();
    toast(`Полина переоделась: ${o.name.toLowerCase()}`);
    return;
  }
  if (save.coins < o.price) {
    toast(`Не хватает ${o.price - save.coins} монеток. Собери их в уровнях!`);
    return;
  }
  save.coins -= o.price;
  save.owned.push(id);
  save.outfit = id;
  persist();
  renderShop();
  toast(`Обновка: ${o.name.toLowerCase()}! Полина сразу переоделась`);
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
  wardrobe: openWardrobe,
  shop: openShop,
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
    drawVignette(ctx, viewW);
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
// Картинки грузятся несколько секунд; пока они не пришли, показываем заставку.
// Если интернет пропал, через 12 секунд всё равно пускаем в игру (нарисуем запасным кодом).
Promise.race([loadAssets(), new Promise((r) => setTimeout(r, 12000))])
  .then(() => $('loading').classList.add('done'));

// Для автотестов и отладки в консоли.
window.__polina = { getGame: () => game, input };

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
