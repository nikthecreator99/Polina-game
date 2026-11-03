// Ввод: мультитач на iPad + клавиатура для отладки на компьютере.
// Состояние читается игрой каждый кадр; "pressed" — флаги нажатия, сбрасываются после кадра.

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
    padPointers.clear();
    jumpPointers.clear();
    keys.clear();
    this.left = this.right = this.jump = false;
    this.endFrame();
    refresh();
  },
};

const padPointers = new Map(); // pointerId -> -1 | 1
const jumpPointers = new Set();
const keys = new Set();

let padEl, leftArrow, rightArrow, jumpBtn, throwBtn;

function refresh() {
  let l = false, r = false;
  for (const dir of padPointers.values()) {
    if (dir < 0) l = true; else r = true;
  }
  input.left = l || keys.has('ArrowLeft') || keys.has('KeyA');
  input.right = r || keys.has('ArrowRight') || keys.has('KeyD');
  input.jump = jumpPointers.size > 0 || keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW');
  if (leftArrow) {
    leftArrow.classList.toggle('on', input.left);
    rightArrow.classList.toggle('on', input.right);
    jumpBtn.classList.toggle('on', input.jump);
  }
}

function padDir(e) {
  const rect = padEl.getBoundingClientRect();
  return e.clientX < rect.left + rect.width / 2 ? -1 : 1;
}

export function initInput() {
  padEl = document.getElementById('pad');
  leftArrow = padEl.querySelector('.left');
  rightArrow = padEl.querySelector('.right');
  jumpBtn = document.getElementById('btn-jump');
  throwBtn = document.getElementById('btn-throw');

  // Крестовина: палец можно двигать влево-вправо, не отрывая.
  padEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    padEl.setPointerCapture(e.pointerId);
    padPointers.set(e.pointerId, padDir(e));
    refresh();
  });
  padEl.addEventListener('pointermove', (e) => {
    if (!padPointers.has(e.pointerId)) return;
    padPointers.set(e.pointerId, padDir(e));
    refresh();
  });
  const padUp = (e) => { padPointers.delete(e.pointerId); refresh(); };
  padEl.addEventListener('pointerup', padUp);
  padEl.addEventListener('pointercancel', padUp);
  padEl.addEventListener('lostpointercapture', padUp);

  jumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    jumpBtn.setPointerCapture(e.pointerId);
    if (jumpPointers.size === 0) input.jumpPressed = true;
    jumpPointers.add(e.pointerId);
    refresh();
  });
  const jumpUp = (e) => { jumpPointers.delete(e.pointerId); refresh(); };
  jumpBtn.addEventListener('pointerup', jumpUp);
  jumpBtn.addEventListener('pointercancel', jumpUp);
  jumpBtn.addEventListener('lostpointercapture', jumpUp);

  throwBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.throwPressed = true;
    throwBtn.classList.add('on');
    setTimeout(() => throwBtn.classList.remove('on'), 120);
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) input.jumpPressed = true;
    if (['KeyX', 'KeyJ', 'ShiftLeft'].includes(e.code)) input.throwPressed = true;
    keys.add(e.code);
    refresh();
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); refresh(); });
  window.addEventListener('blur', () => input.reset());

  // iOS: не даём масштабировать жестами и не показываем меню долгого нажатия.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}
