// Ввод: мультитач на iPad + мышь и клавиатура для проверки на компьютере.
//
// Тач обрабатывается «без памяти»: при каждом событии касания заново смотрим на
// все пальцы, которые сейчас лежат на экране (e.touches), и по их положению решаем,
// какие кнопки нажаты. Так кнопка не может «залипнуть», даже если iPad потерял
// какое-то событие отпускания пальца.

export const input = {
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  throwPressed: false,
  endFrame() {
    this.jumpPressed = false;
    this.throwPressed = false;
  },
  reset() {
    touchState = { left: false, right: false, jump: false };
    mouse = { left: false, right: false, jump: false };
    keys.clear();
    this.endFrame();
    refresh();
  },
};

const keys = new Set();
let touchState = { left: false, right: false, jump: false };
let mouse = { left: false, right: false, jump: false };
let controlsEl, padEl, leftArrow, rightArrow, jumpBtn, throwBtn;

function refresh() {
  input.left = touchState.left || mouse.left || keys.has('ArrowLeft') || keys.has('KeyA');
  input.right = touchState.right || mouse.right || keys.has('ArrowRight') || keys.has('KeyD');
  // Если зажаты обе стороны (палец ровно посередине), никуда не бежим.
  input.jump = touchState.jump || mouse.jump || keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW');
  if (leftArrow) {
    leftArrow.classList.toggle('on', input.left);
    rightArrow.classList.toggle('on', input.right);
    jumpBtn.classList.toggle('on', input.jump);
  }
}

const controlsActive = () => controlsEl && !controlsEl.classList.contains('hidden');

function inRect(x, y, r, pad) {
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

// Что делает палец в точке (x, y).
function zoneAt(x, y) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const tr = throwBtn.getBoundingClientRect();
  const jr = jumpBtn.getBoundingClientRect();
  const pr = padEl.getBoundingClientRect();
  if (inRect(x, y, tr, 14)) return 'throw';
  if (inRect(x, y, jr, 24)) return 'jump';
  // Вся нижняя левая область работает как крестовина, а не только сама кнопка:
  // так палец не «теряется», если чуть съехал.
  if (inRect(x, y, pr, 40) || (x < W * 0.42 && y > H * 0.45)) {
    return x < pr.left + pr.width / 2 ? 'left' : 'right';
  }
  // Правая нижняя часть экрана вне кнопки броска — тоже прыжок.
  if (x > W * 0.6 && y > H * 0.45) return 'jump';
  return null;
}

function onTouch(e) {
  if (!controlsActive()) return;
  const next = { left: false, right: false, jump: false };
  for (const t of e.touches) {
    const z = zoneAt(t.clientX, t.clientY);
    if (z === 'left' || z === 'right' || z === 'jump') next[z] = true;
  }
  if (e.type === 'touchstart') {
    for (const t of e.changedTouches) {
      const z = zoneAt(t.clientX, t.clientY);
      if (z === 'throw') {
        input.throwPressed = true;
        throwBtn.classList.add('on');
        setTimeout(() => throwBtn.classList.remove('on'), 120);
      }
      if (z === 'jump' && !touchState.jump) input.jumpPressed = true;
    }
  }
  touchState = next;
  refresh();
  // Касания по кнопке паузы пропускаем, остальное не должно скроллить/зумить страницу.
  if (!(e.target && e.target.closest && e.target.closest('#btn-pause'))) e.preventDefault();
}

// Мышь — только для проверки на компьютере.
function onMouse(e) {
  if (!controlsActive() || e.pointerType !== 'mouse') return;
  const down = e.type === 'pointerdown' || (e.type === 'pointermove' && e.buttons & 1);
  const z = down ? zoneAt(e.clientX, e.clientY) : null;
  if (e.type === 'pointerdown' && z === 'throw') input.throwPressed = true;
  if (e.type === 'pointerdown' && z === 'jump' && !mouse.jump) input.jumpPressed = true;
  mouse = { left: z === 'left', right: z === 'right', jump: z === 'jump' };
  refresh();
}

export function initInput() {
  controlsEl = document.getElementById('controls');
  padEl = document.getElementById('pad');
  leftArrow = padEl.querySelector('.left');
  rightArrow = padEl.querySelector('.right');
  jumpBtn = document.getElementById('btn-jump');
  throwBtn = document.getElementById('btn-throw');

  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    window.addEventListener(type, onTouch, { passive: false });
  }
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    window.addEventListener(type, onMouse);
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) input.jumpPressed = true;
    if (['KeyX', 'KeyJ', 'ShiftLeft'].includes(e.code)) input.throwPressed = true;
    keys.add(e.code);
    refresh();
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); refresh(); });
  window.addEventListener('blur', () => input.reset());
  document.addEventListener('visibilitychange', () => { if (document.hidden) input.reset(); });

  // iOS: не даём масштабировать жестами и не показываем меню долгого нажатия.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}
