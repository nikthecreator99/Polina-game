import { Game } from './game.js';
import { LEVELS, MAPS } from './levels.js';
import { CONFIG, OUTFITS, DEFAULT_OUTFIT } from './config.js';
import { loadAssets } from './assets.js';
import { APP_VERSION } from './version.js';
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
  checkUpdate();
}

// ---------- обновления ----------
// Сайт с игрой отдаёт свежие файлы сразу, поэтому обычно игра обновляется сама при запуске.
// Два случая плашки:
//  • «Вышло обновление!» — игра давно открыта (висит в фоне), а на сайте уже новая версия: кнопка «Обновить игру».
//  • «Игра обновилась!» — игра уже новая, а игрок этого ещё не видел: показываем, что нового.
// Плюс маленькая кнопка «Обновить» на главной — всегда можно перезагрузить игру вручную.
let updateInfo = null;
let plaqueMode = null; // 'update' | 'news'
let updateLater = 0;
async function fetchVersion() {
  if (location.protocol === 'file:') return null;
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; } // нет сети — проверим позже
}
async function checkUpdate() {
  const info = await fetchVersion();
  if (info && Number(info.version) > APP_VERSION) { updateInfo = info; plaqueMode = 'update'; }
  else if ((save.seenVersion || 0) < APP_VERSION) {
    const veteran = save.seenVersion > 0 || save.coins > 0 || save.unlocked > 1 || save.owned.length > 1;
    if (veteran && info && Number(info.version) === APP_VERSION) { updateInfo = info; plaqueMode = 'news'; }
    else if (!veteran) { save.seenVersion = APP_VERSION; persist(); }
  }
  showUpdateIfReady();
}
function showUpdateIfReady() {
  if (!updateInfo || mode !== 'menu') return;
  if (plaqueMode === 'update' && Date.now() < updateLater) return;
  const box = $('update');
  if (!box.classList.contains('hidden')) return;
  const news = plaqueMode === 'news';
  $('update-title').textContent = news ? 'Игра обновилась!' : (updateInfo.title || 'Вышло обновление!');
  $('update-go').textContent = news ? 'Отлично!' : 'Обновить игру';
  $('update-go').disabled = false;
  $('update-later').classList.toggle('hidden', news);
  const ul = $('update-notes');
  ul.innerHTML = '';
  for (const n of updateInfo.notes || []) {
    const li = document.createElement('li');
    li.textContent = n;
    ul.appendChild(li);
  }
  box.classList.remove('hidden');
}
$('update-later').addEventListener('click', () => {
  $('update').classList.add('hidden');
  updateLater = Date.now() + 10 * 60 * 1000; // напомним через 10 минут
});
async function reloadFresh(v) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch { /* всё равно перезагрузим */ }
  location.replace(`${location.pathname}?v=${v || Date.now()}`);
}
$('update-go').addEventListener('click', () => {
  if (plaqueMode === 'news') {
    save.seenVersion = APP_VERSION;
    persist();
    updateInfo = null;
    $('update').classList.add('hidden');
    return;
  }
  $('update-go').disabled = true;
  $('update-go').textContent = 'Обновляем…';
  reloadFresh(updateInfo?.version);
});
$('menu-refresh').addEventListener('click', () => {
  $('menu-refresh').textContent = 'Обновляем…';
  reloadFresh();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });

// ---------- гардероб и ярмарка ----------
const wornId = () => (OUTFITS[save.outfit] ? save.outfit : DEFAULT_OUTFIT);
const frontImg = (id) => `img/polina/front-${OUTFITS[id] ? id : DEFAULT_OUTFIT}.webp`;
let wardrobeSel = DEFAULT_OUTFIT;

// Главная: в сарафане Полина 3 секунды стоит, потом 3 секунды танцует, и так по кругу.
let dancing = false;
setInterval(() => {
  dancing = !dancing && mode === 'menu' && wornId() === 'sundress';
  $('screen-menu').classList.toggle('dancing', dancing);
}, 3000);

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

// Заставка главы: картинка-сцена, вывеска «вбивается» и блестит, летят листочки.
// Показываем перед первым уровнем главы; тап — пропустить.
let splashDone = null;
function showSplash(sp, then) {
  const el = $('splash');
  el.querySelector('.splash-bg').src = sp.img;
  const pl = el.querySelector('.splash-plaque');
  pl.querySelector('img').src = sp.plaque;
  pl.style.left = `${sp.box[0] * 100}%`;
  pl.style.top = `${sp.box[1] * 100}%`;
  pl.style.width = `${sp.box[2] * 100}%`;
  pl.style.setProperty('--mask', `url("${sp.plaque}")`);
  el.style.setProperty('--ratio', sp.ratio);
  const leaves = el.querySelector('.splash-leaves');
  leaves.innerHTML = '';
  for (let k = 0; k < 14; k++) {
    const f = document.createElement('i');
    f.style.left = `${Math.random() * 100}%`;
    f.style.animationDelay = `${(Math.random() * 3.2).toFixed(2)}s`;
    f.style.animationDuration = `${(3 + Math.random() * 2).toFixed(2)}s`;
    f.style.setProperty('--sx', `${Math.round(Math.random() * 160 - 80)}px`);
    f.style.setProperty('--s', (0.6 + Math.random() * 0.7).toFixed(2));
    leaves.appendChild(f);
  }
  mode = 'splash';
  show('splash');
  el.classList.remove('hidden', 'out');
  void el.offsetWidth;
  el.classList.add('run');
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(t1);
    el.classList.add('out');
    then();
    setTimeout(() => el.classList.add('hidden'), 700);
    el.classList.remove('run');
  };
  const t1 = setTimeout(finish, 4300);
  splashDone = finish;
}
$('splash').addEventListener('click', () => splashDone?.());

function openIntro(i) {
  const L0 = LEVELS[i];
  const firstOfChapter = i === 0 || LEVELS[i - 1].chapter !== L0.chapter;
  if (L0.splash && firstOfChapter && mode !== 'splash') {
    showSplash(L0.splash, () => openIntro(i));
    return;
  }
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
    onComplete: ({ coins, total, lives }) => {
      save.coins += coins;
      save.best[L.id] = Math.max(save.best[L.id] || 0, coins);
      const st = starsFor(coins, total, lives);
      save.stars = save.stars || {};
      save.stars[L.id] = Math.max(save.stars[L.id] || 0, st.n);
      showCompleteStars(st);
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

// ---------- звёзды ----------
// 1 звезда — за то, что дошла до конца; ещё одна — если собрано 70% монеток и больше;
// ещё одна — если потеряно не больше одной жизни.
function starsFor(coins, total, lives) {
  const coinsOk = total === 0 || coins / total >= 0.7;
  const livesOk = CONFIG.startLives - lives <= 1;
  return { n: 1 + (coinsOk ? 1 : 0) + (livesOk ? 1 : 0), coinsOk, livesOk };
}
const starsHtml = (n) => [1, 2, 3].map((k) => `<i class="star${k <= n ? ' on' : ''}" style="--k:${k}"></i>`).join('');
function showCompleteStars(st) {
  const box = $('complete-stars');
  box.innerHTML = starsHtml(st.n);
  box.classList.remove('pop');
  void box.offsetWidth;
  box.classList.add('pop');
  const tips = [];
  if (!st.coinsOk) tips.push('собери больше монеток');
  if (!st.livesOk) tips.push('потеряй не больше одной жизни');
  $('complete-why').textContent = tips.length ? `Чтобы получить ещё звезду: ${tips.join(' и ')}.` : 'Идеально! Все три звезды.';
}

// ---------- выбор уровня: карта главы ----------
let mapSel = 0;
function openLevels() {
  const L0 = LEVELS[Math.min(save.unlocked, LEVELS.length) - 1];
  mapSel = LEVELS.indexOf(L0);
  mode = 'levels';
  show('levels');
  renderMap();
}
function renderMap() {
  const chapter = LEVELS[mapSel].chapter;
  const M = MAPS[chapter];
  $('map-bg').src = M.img;
  const box = $('map-stops');
  box.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const r = M.stops[L.id];
    if (L.chapter !== chapter || !r) return;
    const locked = i + 1 > save.unlocked;
    const stars = (save.stars || {})[L.id] || 0;
    const b = document.createElement('button');
    b.className = 'map-stop';
    b.classList.toggle('sel', i === mapSel);
    b.classList.toggle('locked', locked);
    b.style.left = `${(r[0] / M.w) * 100}%`;
    b.style.top = `${(r[1] / M.h) * 100}%`;
    b.style.width = `${((r[2] - r[0]) / M.w) * 100}%`;
    b.style.height = `${((r[3] - r[1]) / M.h) * 100}%`;
    b.innerHTML = `<span class="badge"><b>${i + 1}</b></span><span class="plate"><span class="name">${L.title}</span>${
      locked ? '<span class="lock">🔒 Сначала пройди уровень ' + i + '</span>' : `<span class="stars">${starsHtml(stars)}</span>`}</span>`;
    b.addEventListener('click', () => {
      if (locked) { toast(`Сначала пройди уровень ${i}`); return; }
      if (mapSel === i) { openIntro(i); return; }
      mapSel = i;
      renderMap();
    });
    box.appendChild(b);
  });
  const p = M.play;
  const pl = $('map-play');
  pl.style.left = `${(p[0] / M.w) * 100}%`;
  pl.style.top = `${(p[1] / M.h) * 100}%`;
  pl.style.width = `${((p[2] - p[0]) / M.w) * 100}%`;
  pl.style.height = `${((p[3] - p[1]) / M.h) * 100}%`;
  layoutMap();
}
// Карта шире экрана: масштабируем так, чтобы влезла важная часть (focus), и при этом экран был закрыт целиком.
function layoutMap() {
  const M = MAPS[LEVELS[mapSel].chapter];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const f = M.focus;
  const fit = Math.min(vw / (f[2] - f[0]), vh / (f[3] - f[1]));
  const s = Math.max(fit, vw / M.w, vh / M.h);
  const W = M.w * s;
  const H = M.h * s;
  const cx = ((f[0] + f[2]) / 2) * s;
  const cy = ((f[1] + f[3]) / 2) * s;
  const left = Math.min(0, Math.max(vw - W, vw / 2 - cx));
  const top = Math.min(0, Math.max(vh - H, vh / 2 - cy));
  const sc = $('map-scene');
  Object.assign(sc.style, { width: `${W}px`, height: `${H}px`, left: `${left}px`, top: `${top}px` });
  sc.style.setProperty('--s', s);
  // «Назад» — на месте нарисованной кнопки, но не дальше края экрана.
  const back = document.querySelector('.map-back');
  Object.assign(back.style, {
    left: `${Math.max(12, left + 32 * s)}px`,
    top: `${Math.max(10, top + 22 * s)}px`,
    width: `${230 * s}px`,
    height: `${86 * s}px`,
    fontSize: `${Math.max(14, 30 * s)}px`,
  });
}
window.addEventListener('resize', () => { if (mode === 'levels') layoutMap(); });
$('map-play').addEventListener('click', () => openIntro(mapSel));

const actions = {
  'new-game': () => openIntro(0),
  levels: openLevels,
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
