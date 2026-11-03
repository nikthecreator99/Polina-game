// Картинки из нейросети (вырезанные из фона). Грузим заранее, а пока не загрузились,
// игра рисует запасные фигуры кодом.

const LIST = {
  sky: 'img/bg/sky.jpg',
  village: 'img/bg/village.webp',
  station: 'img/bg/station.webp',
  gooseWalk: 'img/obj/goose-walk.png',
  gooseAngry: 'img/obj/goose-angry.png',
  crate: 'img/obj/crate.png',
  coin: 'img/obj/coin.png',
  stone: 'img/obj/stone.png',
  sign: 'img/obj/sign.png',
  'side-sundress': 'img/polina/side-sundress.png',
  'side-yolochka': 'img/polina/side-yolochka.png',
  'side-blue': 'img/polina/side-blue.png',
  'side-pajamas': 'img/polina/side-pajamas.png',
  'front-sundress': 'img/polina/front-sundress.webp',
  'front-yolochka': 'img/polina/front-yolochka.webp',
  'front-blue': 'img/polina/front-blue.webp',
  'front-pajamas': 'img/polina/front-pajamas.webp',
};

export const IMG = {};

export function loadAssets(onProgress) {
  const keys = Object.keys(LIST);
  let done = 0;
  return Promise.all(keys.map((k) => new Promise((resolve) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { IMG[k] = im; done++; onProgress?.(done / keys.length); resolve(); };
    im.onerror = () => { done++; onProgress?.(done / keys.length); resolve(); };
    im.src = LIST[k];
  })));
}

export const ASSET_FILES = Object.values(LIST);

// Как резать Полину сбоку на части (доли от высоты/ширины картинки):
// cut — где кончается платье/кофта и начинаются ноги, pivotX — где тазобедренный «шарнир»,
// footX — где стопы (по ним ставим её на землю), swing — насколько широко шагает.
export const RIG = {
  sundress: { cut: 0.675, pivotX: 0.466, footX: 0.557, swing: 0.5 },
  yolochka: { cut: 0.9, pivotX: 0.484, footX: 0.529, swing: 0.18 },
  blue: { cut: 0.775, pivotX: 0.376, footX: 0.559, swing: 0.45 },
  pajamas: { cut: 0.62, pivotX: 0.557, footX: 0.628, swing: 0.3 },
};
